import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { Requirement } from "@/db/models";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { createDirectDemandRepository } from "@/server/repositories/direct-demand-repository";

import { createAuditService } from "./audit-event-service";
import { createDirectnessVerificationService } from "./directness-verification-service";

type DirectDemandRepositoryLike = ReturnType<
  typeof createDirectDemandRepository
>;

type DirectDemandDiscoveryDependencies = {
  repository?: DirectDemandRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
  directnessService?: ReturnType<typeof createDirectnessVerificationService>;
};

type RelationshipType = "DIRECT" | "INTRODUCER" | "UNKNOWN";
type Urgency = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface DirectDemandDiscoveryResult {
  leadId: string;
  requirementId?: string;
  updatedLeadScore?: number;
  extracted: boolean;
  relationshipType: RelationshipType;
  directRelationshipVerified: boolean;
  reason?: string;
}

function getRepository(repository?: DirectDemandRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createDirectDemandRepository(getDb());
}

function ensureAccess(
  actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error(
      "Only authenticated team members can run demand discovery.",
    );
  }
}

function parseBudget(text: string): { min?: number; max?: number } {
  const range = /\£?\s*([\d,]{3,})\s*(?:-|to)\s*\£?\s*([\d,]{3,})/i.exec(text);
  if (range) {
    const minText = range[1];
    const maxText = range[2];
    if (!minText || !maxText) {
      return {};
    }

    const min = Number.parseInt(minText.replace(/,/g, ""), 10);
    const max = Number.parseInt(maxText.replace(/,/g, ""), 10);
    return Number.isFinite(min) && Number.isFinite(max)
      ? { min: min * 100, max: max * 100 }
      : {};
  }

  const single = /(?:budget|up to|max)\s*\£?\s*([\d,]{3,})/i.exec(text);
  if (!single) {
    return {};
  }

  const maxText = single[1];
  if (!maxText) {
    return {};
  }

  const max = Number.parseInt(maxText.replace(/,/g, ""), 10);
  return Number.isFinite(max) ? { max: max * 100 } : {};
}

function parseBedrooms(text: string): { min?: number; max?: number } {
  const range = /(\d+)\s*(?:-|to)\s*(\d+)\s*bed/i.exec(text);
  if (range) {
    const minText = range[1];
    const maxText = range[2];
    if (!minText || !maxText) {
      return {};
    }

    return {
      min: Number.parseInt(minText, 10),
      max: Number.parseInt(maxText, 10),
    };
  }

  const plus = /(\d+)\+\s*bed/i.exec(text);
  if (plus) {
    const minText = plus[1];
    if (!minText) {
      return {};
    }

    return { min: Number.parseInt(minText, 10) };
  }

  const single = /(\d+)\s*bed/i.exec(text);
  if (single) {
    const exactText = single[1];
    if (!exactText) {
      return {};
    }

    const exact = Number.parseInt(exactText, 10);
    return { min: exact, max: exact };
  }

  return {};
}

function parseUnitCount(text: string): number | undefined {
  const match = /(\d+)\s*(?:units?|homes?|properties)/i.exec(text);
  if (!match) {
    return undefined;
  }

  const unitsText = match[1];
  if (!unitsText) {
    return undefined;
  }

  const units = Number.parseInt(unitsText, 10);
  return Number.isFinite(units) ? units : undefined;
}

function parseRadiusMiles(text: string): number | undefined {
  const match = /(\d{1,2})\s*(?:mile|miles|mi)\b/i.exec(text);
  if (!match) {
    return undefined;
  }

  const radiusText = match[1];
  if (!radiusText) {
    return undefined;
  }

  const radius = Number.parseInt(radiusText, 10);
  return Number.isFinite(radius) ? radius : undefined;
}

function parseLocation(text: string): string | undefined {
  const postcode = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i.exec(text);
  if (postcode?.[1]) {
    return postcode[1].toUpperCase();
  }

  const inClause = /\bin\s+([A-Za-z][A-Za-z\s-]{2,40})/i.exec(text);
  if (inClause?.[1]) {
    return inClause[1].trim();
  }

  return undefined;
}

function parseStartDate(text: string): Date | undefined {
  const immediate = /(asap|immediate|straight away|right away)/i.test(text);
  if (immediate) {
    return new Date();
  }

  const dateMatch = /(20\d{2}-\d{2}-\d{2})/.exec(text);
  if (dateMatch?.[1]) {
    const parsed = new Date(dateMatch[1]);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
}

function parseTermMonths(text: string): number | undefined {
  const match = /(\d{1,2})\s*(?:month|months|mo)\b/i.exec(text);
  if (!match) {
    return undefined;
  }

  const termText = match[1];
  if (!termText) {
    return undefined;
  }

  const term = Number.parseInt(termText, 10);
  return Number.isFinite(term) ? term : undefined;
}

function parsePurpose(text: string): string | undefined {
  const known = [
    "staff housing",
    "relocation",
    "corporate let",
    "short stay",
    "long stay",
  ];

  return known.find((value) => text.toLowerCase().includes(value));
}

function parseUrgency(text: string): Urgency {
  if (/(urgent|priority|critical)/i.test(text)) {
    return "URGENT";
  }

  if (/(asap|immediate|soon)/i.test(text)) {
    return "HIGH";
  }

  if (/(next month|within \d+ weeks?)/i.test(text)) {
    return "MEDIUM";
  }

  return "LOW";
}

function detectRelationship(texts: string[]): {
  relationshipType: RelationshipType;
  directRelationshipVerified: boolean;
} {
  const joined = texts.join("\n");
  const direct =
    /(we need|our team needs|for our company|direct tenant|we are looking)/i.test(
      joined,
    );
  const introducer =
    /(on behalf|for my client|introducing|acting for|broker)/i.test(joined);

  if (direct && !introducer) {
    return {
      relationshipType: "DIRECT",
      directRelationshipVerified: true,
    };
  }

  if (introducer && !direct) {
    return {
      relationshipType: "INTRODUCER",
      directRelationshipVerified: false,
    };
  }

  return {
    relationshipType: "UNKNOWN",
    directRelationshipVerified: false,
  };
}

function hasDemandSignal(text: string) {
  return /(looking for|need|requirement|budget|bed|units?|radius|move|lease|tenant)/i.test(
    text,
  );
}

function shouldBlockExtraction(input: {
  aggregateText: string;
  evidenceCount: number;
  relationshipType: RelationshipType;
  extractedFieldCount: number;
}) {
  // Guardrail: generic company descriptors with no demand cues cannot create requirements.
  if (!hasDemandSignal(input.aggregateText) && input.evidenceCount === 0) {
    return true;
  }

  if (input.relationshipType === "UNKNOWN" && input.extractedFieldCount < 2) {
    return true;
  }

  return false;
}

function mapRequirementPatch(extracted: {
  budgetMinCents?: number;
  budgetMaxCents?: number;
  bedroomsMin?: number;
  bedroomsMax?: number;
  unitCount?: number;
  acceptableRadiusMiles?: number;
  preferredArea?: string;
  startDate?: Date;
  termMonths?: number;
  purpose?: string;
  urgency: Urgency;
  relationshipType: RelationshipType;
  directRelationshipVerified: boolean;
  evidenceIds: string[];
}) {
  return {
    ...(extracted.budgetMinCents !== undefined
      ? { budgetMinCents: extracted.budgetMinCents }
      : {}),
    ...(extracted.budgetMaxCents !== undefined
      ? { budgetMaxCents: extracted.budgetMaxCents }
      : {}),
    ...(extracted.bedroomsMin !== undefined
      ? { bedroomsMin: extracted.bedroomsMin }
      : {}),
    ...(extracted.bedroomsMax !== undefined
      ? { bedroomsMax: extracted.bedroomsMax }
      : {}),
    ...(extracted.unitCount !== undefined
      ? { unitCount: extracted.unitCount }
      : {}),
    ...(extracted.acceptableRadiusMiles !== undefined
      ? { acceptableRadiusMiles: extracted.acceptableRadiusMiles }
      : {}),
    ...(extracted.preferredArea
      ? { preferredArea: extracted.preferredArea }
      : {}),
    ...(extracted.startDate ? { startDate: extracted.startDate } : {}),
    ...(extracted.termMonths !== undefined
      ? { termMonths: extracted.termMonths }
      : {}),
    ...(extracted.purpose ? { purpose: extracted.purpose } : {}),
    urgency: extracted.urgency,
    relationshipType: extracted.relationshipType,
    directRelationshipVerified: extracted.directRelationshipVerified,
    evidenceIds: extracted.evidenceIds,
  };
}

export function createDirectDemandDiscoveryService(
  dependencies: DirectDemandDiscoveryDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const getAuditService = () =>
    dependencies.auditService ?? createAuditService();
  const getDirectnessService = () =>
    dependencies.directnessService ??
    createDirectnessVerificationService({ auditService: getAuditService() });

  return {
    async discover(
      input: {
        leadId: string;
        ownerUserId?: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<DirectDemandDiscoveryResult> {
      ensureAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before demand discovery can run.",
        );
      }

      const context = await repository.getLeadContext(input.leadId);
      if (!context) {
        throw new Error("Lead not found.");
      }

      const evidenceText = context.leadEvidence.map((item) => item.summary);
      const signalText = context.leadSignals
        .map((item) => JSON.stringify(item.payload))
        .filter((value) => value !== "{}");
      const leadSummary = context.leadRow.lead.summary ?? "";
      const aggregateText = [leadSummary, ...evidenceText, ...signalText]
        .join("\n")
        .trim();

      const relationship = detectRelationship([leadSummary, ...evidenceText]);
      const proposedClassification = relationship.directRelationshipVerified
        ? "DIRECT"
        : relationship.relationshipType === "INTRODUCER"
          ? "INTERMEDIARY"
          : "UNKNOWN";

      const budget = parseBudget(aggregateText);
      const bedrooms = parseBedrooms(aggregateText);
      const unitCount = parseUnitCount(aggregateText);
      const preferredArea = parseLocation(aggregateText);
      const acceptableRadiusMiles = parseRadiusMiles(aggregateText);
      const startDate = parseStartDate(aggregateText);
      const termMonths = parseTermMonths(aggregateText);
      const purpose = parsePurpose(aggregateText);
      const urgency = parseUrgency(aggregateText);
      const evidenceIds = context.leadEvidence.map((item) => item.id);

      const extractedFieldCount = [
        budget.min,
        budget.max,
        bedrooms.min,
        bedrooms.max,
        unitCount,
        preferredArea,
        acceptableRadiusMiles,
        startDate,
        termMonths,
        purpose,
      ].filter((value) => value !== undefined).length;

      if (
        shouldBlockExtraction({
          aggregateText,
          evidenceCount: context.leadEvidence.length,
          relationshipType: relationship.relationshipType,
          extractedFieldCount,
        })
      ) {
        return {
          leadId: input.leadId,
          extracted: false,
          relationshipType: relationship.relationshipType,
          directRelationshipVerified: relationship.directRelationshipVerified,
          reason:
            "Insufficient direct demand evidence; requirement extraction was intentionally skipped.",
        };
      }

      await getDirectnessService().assess(
        {
          leadId: input.leadId,
          entityName:
            context.leadRow.lead.summary ??
            context.leadRow.sourceName ??
            "Unknown entity",
          relationshipToPropertyOrCompany:
            relationship.relationshipType === "DIRECT"
              ? "explicit first-party demand signal"
              : relationship.relationshipType === "INTRODUCER"
                ? "acting on behalf / broker-like wording"
                : "insufficient direct ownership/control proof",
          evidenceSource: context.leadRow.sourceName ?? "unknown_source",
          evidenceReference:
            context.leadEvidence[0]?.sourceReference ?? context.leadRow.lead.id,
          evidenceType: "demand_intent_analysis",
          evidenceDate: new Date(),
          explanation:
            relationship.relationshipType === "DIRECT"
              ? "Detected direct first-party requirement language without intermediary indicators."
              : relationship.relationshipType === "INTRODUCER"
                ? "Detected intermediary indicators (on behalf/acting for/broker signals)."
                : "Could not verify direct relationship with high confidence.",
          confidence: relationship.relationshipType === "UNKNOWN" ? 55 : 82,
          proposedClassification,
        },
        actor,
      );

      const patch = mapRequirementPatch({
        ...(budget.min !== undefined ? { budgetMinCents: budget.min } : {}),
        ...(budget.max !== undefined ? { budgetMaxCents: budget.max } : {}),
        ...(bedrooms.min !== undefined ? { bedroomsMin: bedrooms.min } : {}),
        ...(bedrooms.max !== undefined ? { bedroomsMax: bedrooms.max } : {}),
        ...(unitCount !== undefined ? { unitCount } : {}),
        ...(acceptableRadiusMiles !== undefined
          ? { acceptableRadiusMiles }
          : {}),
        ...(preferredArea ? { preferredArea } : {}),
        ...(startDate ? { startDate } : {}),
        ...(termMonths !== undefined ? { termMonths } : {}),
        ...(purpose ? { purpose } : {}),
        urgency,
        relationshipType: relationship.relationshipType,
        directRelationshipVerified: relationship.directRelationshipVerified,
        evidenceIds,
      });

      let requirement: Requirement | undefined;
      if (context.existingRequirement) {
        requirement = await repository.updateRequirement(
          context.existingRequirement.id,
          {
            ...patch,
          },
        );
      } else {
        requirement = await repository.createRequirement({
          leadId: input.leadId,
          companyId: context.leadRow.lead.companyId ?? null,
          contactId: context.leadRow.lead.contactId ?? null,
          ownerUserId:
            input.ownerUserId ?? context.leadRow.lead.ownerUserId ?? null,
          status: "open",
          ...patch,
        });
      }

      let updatedLeadScore: number | undefined;
      if (relationship.directRelationshipVerified) {
        const updatedLead = await repository.applyDirectPriorityBoost(
          input.leadId,
          8,
        );
        updatedLeadScore = updatedLead?.score;
      }

      if (requirement) {
        await getAuditService().recordEvent({
          actor,
          action: "demand.requirement.extracted",
          entityType: "requirement",
          entityId: requirement.id,
          metadata: {
            leadId: input.leadId,
            relationshipType: relationship.relationshipType,
            directRelationshipVerified: relationship.directRelationshipVerified,
            evidenceCount: evidenceIds.length,
          },
        });
      }

      return {
        leadId: input.leadId,
        extracted: Boolean(requirement),
        relationshipType: relationship.relationshipType,
        directRelationshipVerified: relationship.directRelationshipVerified,
        ...(requirement?.id ? { requirementId: requirement.id } : {}),
        ...(updatedLeadScore !== undefined ? { updatedLeadScore } : {}),
      };
    },
  };
}
