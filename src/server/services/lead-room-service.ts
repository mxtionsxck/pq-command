import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { Lead, NewLead } from "@/db/models";
import type { AuditActor } from "@/domain/audit/types";
import type {
  LeadDrawerRecord,
  LeadListItem,
  LeadOutreachStatus,
  LeadRoomView,
  LeadStatus,
} from "@/domain/lead/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { createLeadRoomRepository } from "@/server/repositories/lead-room-repository";

import { createAuditService } from "./audit-event-service";

type LeadRoomRepositoryLike = ReturnType<typeof createLeadRoomRepository>;

type LeadRoomServiceDependencies = {
  repository?: LeadRoomRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function getRepository(repository?: LeadRoomRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createLeadRoomRepository(getDb());
}

function ensureLeadMutationAccess(
  actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error(
      "Authenticated agents, managers, or admins can mutate leads.",
    );
  }
}

function payloadSummary(payload: Record<string, unknown>) {
  const keys = Object.keys(payload).slice(0, 3);

  if (keys.length === 0) {
    return "No signal payload summary";
  }

  return keys
    .map((key) => {
      const value = payload[key];

      return `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`;
    })
    .join(" | ");
}

export function createLeadRoomService(
  dependencies: LeadRoomServiceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const getAuditService = () =>
    dependencies.auditService ?? createAuditService();

  return {
    async listView(
      view: LeadRoomView,
      search?: string,
      pagination?: { limit?: number; offset?: number },
    ): Promise<LeadListItem[]> {
      if (!repository) {
        return [];
      }

      const rows = await repository.listLeads(view, search, pagination);

      return rows.map((row) => ({
        id: row.lead.id,
        leadLabel:
          row.contactName ??
          row.companyName ??
          row.propertyTitle ??
          row.lead.summary ??
          row.lead.id,
        leadType: row.lead.leadType,
        score: row.lead.score,
        confidence: row.lead.confidence,
        sourceName: row.sourceName ?? "Unknown source",
        lastSignalAt: row.lastSignalAt,
        evidenceCount: row.evidenceCount,
        status: row.lead.status,
        directnessClassification: row.lead.directnessClassification,
        nextAction: row.lead.nextAction,
      }));
    },

    async getLeadDrawer(leadId: string): Promise<LeadDrawerRecord | null> {
      if (!repository) {
        return null;
      }

      const result = await repository.getLeadDrawer(leadId);

      if (!result) {
        return null;
      }

      const contactName =
        result.leadRow.contactFirstName && result.leadRow.contactLastName
          ? `${result.leadRow.contactFirstName} ${result.leadRow.contactLastName}`
          : (result.leadRow.contactFirstName ??
            result.leadRow.contactLastName ??
            null);

      return {
        id: result.leadRow.lead.id,
        leadType: result.leadRow.lead.leadType,
        status: result.leadRow.lead.status,
        directnessClassification: result.leadRow.lead.directnessClassification,
        score: result.leadRow.lead.score,
        confidence: result.leadRow.lead.confidence,
        scoreVersion: result.leadRow.lead.scoreVersion,
        lastScoredAt: result.leadRow.lead.lastScoredAt,
        summary: result.leadRow.lead.summary,
        nextAction: result.leadRow.lead.nextAction,
        outreachStatus: result.leadRow.lead.outreachStatus,
        sourceName: result.leadRow.sourceName ?? "Unknown source",
        sourceProvenance: [
          `kind=${result.leadRow.sourceKind}`,
          result.leadRow.sourceConnectorKey
            ? `connector=${result.leadRow.sourceConnectorKey}`
            : "connector=unset",
        ].join(" | "),
        companyName: result.leadRow.companyName,
        contactName,
        propertyTitle: result.leadRow.propertyTitle,
        plan: null,
        signals: result.leadSignals.map((signal) => ({
          id: signal.id,
          type: signal.type,
          status: signal.status,
          detectedAt: signal.detectedAt,
          payloadSummary: payloadSummary(signal.payload),
        })),
        evidence: result.leadEvidence.map((item) => ({
          id: item.id,
          sourceId: item.sourceId,
          sourceReference: item.sourceReference,
          sourceUrl: item.sourceUrl,
          detectedAt: item.detectedAt,
          summary: item.summary,
          confidence: item.confidence,
          collectionMethod: item.collectionMethod,
          signalId: item.signalId,
        })),
        qualificationGuard: {
          canUseForHighConfidenceQualification:
            result.supportedConclusionCount > 0,
          supportedConclusionCount: result.supportedConclusionCount,
        },
      };
    },

    async createLead(
      input: Omit<NewLead, "id" | "createdAt" | "updatedAt"> & { id?: string },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<Lead> {
      ensureLeadMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before leads can be managed.",
        );
      }

      const lead = await repository.createLead(input);

      await getAuditService().recordEvent({
        actor,
        action: "lead.created",
        entityType: "lead",
        entityId: lead.id,
        metadata: {
          sourceId: lead.sourceId,
          leadType: lead.leadType,
          status: lead.status,
        },
        afterState: {
          status: lead.status,
          score: lead.score,
          confidence: lead.confidence,
        },
      });

      return lead;
    },

    async transitionStatus(
      leadId: string,
      status: LeadStatus,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureLeadMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before leads can be managed.",
        );
      }

      const before = await repository.findLeadById(leadId);

      if (!before) {
        return undefined;
      }

      if (
        status === "qualified" &&
        (before.directnessClassification !== "DIRECT" || !before.directnessVerified)
      ) {
        throw new Error(
          "Only verified direct leads can be marked as qualified.",
        );
      }

      const updated = await repository.updateLead(leadId, { status });

      if (!updated) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "lead.status.transitioned",
        entityType: "lead",
        entityId: leadId,
        metadata: {
          from: before.status,
          to: updated.status,
        },
        beforeState: {
          status: before.status,
        },
        afterState: {
          status: updated.status,
        },
      });

      return updated;
    },

    async updateNextAction(
      leadId: string,
      input: { nextAction?: string; outreachStatus?: LeadOutreachStatus },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureLeadMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before leads can be managed.",
        );
      }

      const before = await repository.findLeadById(leadId);

      if (!before) {
        return undefined;
      }

      const nextAction = input.nextAction?.trim();
      const updated = await repository.updateLead(leadId, {
        ...(input.nextAction !== undefined
          ? { nextAction: nextAction || null }
          : {}),
        ...(input.outreachStatus
          ? { outreachStatus: input.outreachStatus }
          : {}),
      });

      if (!updated) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "lead.plan.updated",
        entityType: "lead",
        entityId: leadId,
        metadata: {
          changedFields: Object.keys(input),
        },
        beforeState: {
          nextAction: before.nextAction,
          outreachStatus: before.outreachStatus,
        },
        afterState: {
          nextAction: updated.nextAction,
          outreachStatus: updated.outreachStatus,
        },
      });

      return updated;
    },
  };
}
