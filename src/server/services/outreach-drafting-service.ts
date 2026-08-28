import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { OutreachDraft } from "@/db/models";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { createOutreachDraftingRepository } from "@/server/repositories/outreach-drafting-repository";

import { createAuditService } from "./audit-event-service";

type OutreachDraftingRepositoryLike = ReturnType<
  typeof createOutreachDraftingRepository
>;

type SegmentTemplate =
  "PRIVATE_LANDLORD" | "DEVELOPER" | "PORTFOLIO_OWNER" | "DIRECT_COMPANY";

type OutreachDraftingDependencies = {
  repository?: OutreachDraftingRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function getRepository(repository?: OutreachDraftingRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createOutreachDraftingRepository(getDb());
}

function ensureAccess(
  actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authenticated team members can draft outreach.");
  }
}

function chooseTemplate(text: string): SegmentTemplate {
  if (/developer|build-to-rent|scheme/i.test(text)) {
    return "DEVELOPER";
  }

  if (/portfolio|multiple properties|multi-unit/i.test(text)) {
    return "PORTFOLIO_OWNER";
  }

  if (/landlord|owner/i.test(text)) {
    return "PRIVATE_LANDLORD";
  }

  return "DIRECT_COMPANY";
}

function sentence(text: string) {
  return text.endsWith(".") ? text : `${text}.`;
}

function renderTemplate(
  template: SegmentTemplate,
  evidenceSummaries: string[],
  leadLabel: string,
) {
  const evidenceLine = evidenceSummaries.slice(0, 2).map(sentence).join(" ");

  switch (template) {
    case "DEVELOPER":
      return {
        subject: `Quick developer lettings fit check for ${leadLabel}`,
        bodyText: [
          `Hi ${leadLabel},`,
          "",
          "I am reaching out because your recent activity suggests active demand planning.",
          evidenceLine,
          "",
          "If useful, we can share available homes aligned to your location, unit, and start-date constraints.",
          "",
          "Best regards,",
          "PQ COMMAND",
        ].join("\n"),
      };
    case "PORTFOLIO_OWNER":
      return {
        subject: `Portfolio supply options matched for ${leadLabel}`,
        bodyText: [
          `Hi ${leadLabel},`,
          "",
          "We have identified suitable inventory for your multi-unit demand profile.",
          evidenceLine,
          "",
          "I can send a short, evidence-backed shortlist for review.",
          "",
          "Best regards,",
          "PQ COMMAND",
        ].join("\n"),
      };
    case "PRIVATE_LANDLORD":
      return {
        subject: `Company-let options aligned to your demand`,
        bodyText: [
          `Hi ${leadLabel},`,
          "",
          "Your recent requirement signals suggest this is a good time to review available homes.",
          evidenceLine,
          "",
          "If helpful, I can share options that match bedrooms, location radius, and timing.",
          "",
          "Best regards,",
          "PQ COMMAND",
        ].join("\n"),
      };
    case "DIRECT_COMPANY":
      return {
        subject: `Availability options for ${leadLabel}`,
        bodyText: [
          `Hi ${leadLabel},`,
          "",
          "I am following up based on your verified demand signals.",
          evidenceLine,
          "",
          "We can send a concise shortlist once you confirm preferred timing and area.",
          "",
          "Best regards,",
          "PQ COMMAND",
        ].join("\n"),
      };
  }
}

function unsupportedClaims(body: string, supportedFacts: string[]) {
  const forbidden = [
    "guaranteed",
    "exclusive off-market",
    "best price in London",
    "already approved",
  ];

  const unsupported: string[] = [];
  const lowerBody = body.toLowerCase();

  for (const phrase of forbidden) {
    if (lowerBody.includes(phrase)) {
      unsupported.push(phrase);
    }
  }

  if (supportedFacts.length === 0) {
    unsupported.push("no_evidence");
  }

  return unsupported;
}

export function createOutreachDraftingService(
  dependencies: OutreachDraftingDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const getAuditService = () =>
    dependencies.auditService ?? createAuditService();

  return {
    async createDraft(
      input: {
        leadId: string;
        campaignId?: string;
        conversationId?: string;
        evidenceIds: string[];
        provider: string;
        model: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<OutreachDraft> {
      ensureAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before outreach drafting can run.",
        );
      }

      const lead = await repository.findLeadById(input.leadId);
      if (!lead) {
        throw new Error("Lead not found.");
      }

      const evidenceRows = await repository.listEvidenceByIds(
        input.evidenceIds,
      );
      if (evidenceRows.length !== input.evidenceIds.length) {
        throw new Error(
          "All evidenceIds must map to verified evidence records.",
        );
      }

      const evidenceSummaries = evidenceRows.map((row) => row.summary);
      const label = lead.summary ?? lead.id;
      const templateType = chooseTemplate(
        [label, ...evidenceSummaries].join("\n"),
      );
      const rendered = renderTemplate(templateType, evidenceSummaries, label);
      const unsupported = unsupportedClaims(
        rendered.bodyText,
        evidenceSummaries,
      );

      if (unsupported.length > 0) {
        throw new Error(
          `Draft blocked due to unsupported claims: ${unsupported.join(", ")}.`,
        );
      }

      const draft = await repository.createDraft({
        leadId: input.leadId,
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        ...(input.conversationId
          ? { conversationId: input.conversationId }
          : {}),
        ...(actor.userId ? { createdByUserId: actor.userId } : {}),
        templateType,
        status: "draft",
        provider: input.provider,
        model: input.model,
        evidenceIds: input.evidenceIds,
        unsupportedClaims: [],
        subject: rendered.subject,
        bodyText: rendered.bodyText,
        whyThisLead: evidenceSummaries.slice(0, 3).join(" | "),
      });

      await getAuditService().recordEvent({
        actor,
        action: "outreach.draft.created",
        entityType: "outreach_draft",
        entityId: draft.id,
        metadata: {
          leadId: input.leadId,
          provider: input.provider,
          model: input.model,
          evidenceCount: input.evidenceIds.length,
        },
      });

      return draft;
    },

    async updateDraft(
      draftId: string,
      input: {
        subject?: string;
        bodyText?: string;
        status?: "draft" | "approved" | "rejected";
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<OutreachDraft | undefined> {
      ensureAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before outreach drafting can run.",
        );
      }

      const existing = await repository.findDraftById(draftId);
      if (!existing) {
        return undefined;
      }

      const unsupported = unsupportedClaims(
        input.bodyText ?? existing.bodyText,
        existing.evidenceIds,
      );
      if (unsupported.length > 0) {
        throw new Error(
          `Draft update blocked due to unsupported claims: ${unsupported.join(", ")}.`,
        );
      }

      const updated = await repository.updateDraft(draftId, {
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.bodyText !== undefined ? { bodyText: input.bodyText } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        unsupportedClaims: [],
      });

      if (!updated) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "outreach.draft.updated",
        entityType: "outreach_draft",
        entityId: draftId,
        metadata: {
          changedFields: Object.keys(input),
        },
      });

      return updated;
    },
  };
}
