import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AiConclusion, Evidence } from "@/db/models";
import type { AuditActor } from "@/domain/audit/types";
import type {
  AiConclusionInput,
  EvidenceInput,
  EvidenceTimelineItem,
  QualificationGuardResult,
} from "@/domain/evidence/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { createEvidenceRepository } from "@/server/repositories/evidence-repository";

import { createAuditService } from "./audit-event-service";

type EvidenceRepositoryLike = ReturnType<typeof createEvidenceRepository>;

type EvidenceServiceDependencies = {
  repository?: EvidenceRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function getRepository(repository?: EvidenceRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createEvidenceRepository(getDb());
}

function ensureEvidenceMutationAccess(
  actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authenticated team members can mutate evidence.");
  }
}

function toTimelineItem(item: Evidence): EvidenceTimelineItem {
  return {
    id: item.id,
    sourceId: item.sourceId,
    sourceReference: item.sourceReference,
    sourceUrl: item.sourceUrl,
    detectedAt: item.detectedAt,
    summary: item.summary,
    confidence: item.confidence,
    collectionMethod: item.collectionMethod,
    signalId: item.signalId,
  };
}

export function createEvidenceService(
  dependencies: EvidenceServiceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const getAuditService = () =>
    dependencies.auditService ?? createAuditService();

  return {
    async recordEvidence(
      input: EvidenceInput,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<Evidence> {
      ensureEvidenceMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before evidence can be persisted.",
        );
      }

      const existing = await repository.findEvidenceBySignalReference(
        input.signalId,
        input.sourceReference,
      );

      if (existing) {
        return existing;
      }

      const evidenceRecord = await repository.createEvidence({
        sourceId: input.sourceId,
        leadId: input.leadId,
        signalId: input.signalId,
        sourceReference: input.sourceReference,
        sourceUrl: input.sourceUrl,
        detectedAt: input.detectedAt,
        summary: input.summary,
        confidence: Math.min(100, Math.max(0, Math.round(input.confidence))),
        collectionMethod: input.collectionMethod,
      });

      await getAuditService().recordEvent({
        actor,
        action: "evidence.recorded",
        entityType: "evidence",
        entityId: evidenceRecord.id,
        metadata: {
          leadId: evidenceRecord.leadId,
          signalId: evidenceRecord.signalId,
          sourceId: evidenceRecord.sourceId,
        },
      });

      return evidenceRecord;
    },

    async listLeadEvidence(leadId: string): Promise<EvidenceTimelineItem[]> {
      if (!repository) {
        return [];
      }

      const items = await repository.listLeadEvidence(leadId);

      return items.map(toTimelineItem);
    },

    async recordAiConclusion(
      input: AiConclusionInput,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<AiConclusion> {
      ensureEvidenceMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before conclusions can be persisted.",
        );
      }

      const evidenceCount = await repository.countEvidenceIds(
        input.evidenceIds,
      );
      const supported =
        evidenceCount === input.evidenceIds.length && evidenceCount > 0;

      const conclusion = await repository.createConclusion({
        leadId: input.leadId,
        signalId: input.signalId,
        provider: input.provider,
        model: input.model,
        summary: input.summary,
        recommendation: input.recommendation,
        confidence: Math.min(100, Math.max(0, Math.round(input.confidence))),
        evidenceIds: input.evidenceIds,
        supported,
        status: supported ? "advisory" : "unsupported",
        failureReason: supported
          ? null
          : (input.failureReason ??
            "No valid supporting evidence IDs provided."),
        latencyMs: input.latencyMs,
        tokenUsage: input.tokenUsage,
        costUsdMicros: input.costUsdMicros,
      });

      await getAuditService().recordEvent({
        actor,
        action: "ai.conclusion.recorded",
        entityType: "lead",
        entityId: input.leadId,
        metadata: {
          conclusionId: conclusion.id,
          supported,
          evidenceCount: input.evidenceIds.length,
          recommendation: conclusion.recommendation,
        },
      });

      return conclusion;
    },

    async listLeadConclusions(leadId: string): Promise<AiConclusion[]> {
      if (!repository) {
        return [];
      }

      return repository.listLeadConclusions(leadId);
    },

    async getQualificationGuard(
      leadId: string,
      minimumConfidence = 75,
    ): Promise<QualificationGuardResult> {
      if (!repository) {
        return {
          canUseForHighConfidenceQualification: false,
          unsupportedReason: "Evidence store unavailable.",
          supportedConclusionIds: [],
        };
      }

      const conclusions = await repository.listLeadConclusions(leadId);
      const supportedConclusionIds = conclusions
        .filter(
          (item) =>
            item.supported &&
            item.status === "advisory" &&
            item.confidence >= minimumConfidence &&
            item.recommendation === "qualify",
        )
        .map((item) => item.id);

      if (supportedConclusionIds.length === 0) {
        return {
          canUseForHighConfidenceQualification: false,
          unsupportedReason:
            "No supported AI conclusion references evidence for high-confidence qualification.",
          supportedConclusionIds: [],
        };
      }

      return {
        canUseForHighConfidenceQualification: true,
        supportedConclusionIds,
      };
    },

    async promoteConclusionToMasterFacts(
      conclusionId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureEvidenceMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before conclusions can be promoted.",
        );
      }

      const conclusion = await repository.findConclusionById(conclusionId);

      if (!conclusion) {
        throw new Error("Conclusion not found.");
      }

      if (!conclusion.supported) {
        throw new Error(
          "Unsupported conclusion cannot be promoted to master facts.",
        );
      }

      const promoted = await repository.updateConclusionStatus(
        conclusionId,
        "promoted",
      );

      if (!promoted) {
        throw new Error("Failed to promote conclusion.");
      }

      await getAuditService().recordEvent({
        actor,
        action: "ai.conclusion.promoted",
        entityType: "lead",
        entityId: promoted.leadId,
        metadata: {
          conclusionId: promoted.id,
          evidenceIds: promoted.evidenceIds,
        },
      });

      return promoted;
    },
  };
}
