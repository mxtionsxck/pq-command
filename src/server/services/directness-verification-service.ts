import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import {
  createAcquisitionEngineRepository,
  type AcquisitionEngineRepository,
} from "@/server/repositories/acquisition-engine-repository";

import { createAuditService } from "./audit-event-service";

type DirectnessDependencies = {
  repository?: AcquisitionEngineRepository;
  auditService?: ReturnType<typeof createAuditService>;
};

type DirectnessClassification =
  | "DIRECT"
  | "INTERMEDIARY"
  | "UNKNOWN"
  | "SUPPRESSED";

function getRepository(repository?: AcquisitionEngineRepository) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createAcquisitionEngineRepository(getDb());
}

function ensureAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authenticated team members can verify directness.");
  }
}

function resolveClassification(
  existing: Array<{ classification: DirectnessClassification }> ,
  incoming: DirectnessClassification,
) {
  if (incoming === "SUPPRESSED") {
    return {
      classification: "SUPPRESSED" as const,
      verificationStatus: "verified" as const,
      conflictDetected: false,
      verified: true,
    };
  }

  const classes = new Set(existing.map((row) => row.classification));
  classes.add(incoming);

  if (classes.has("DIRECT") && classes.has("INTERMEDIARY")) {
    return {
      classification: "UNKNOWN" as const,
      verificationStatus: "conflicted" as const,
      conflictDetected: true,
      verified: false,
    };
  }

  if (classes.has("INTERMEDIARY")) {
    return {
      classification: "INTERMEDIARY" as const,
      verificationStatus: "verified" as const,
      conflictDetected: false,
      verified: false,
    };
  }

  if (classes.has("DIRECT")) {
    return {
      classification: "DIRECT" as const,
      verificationStatus: "verified" as const,
      conflictDetected: false,
      verified: true,
    };
  }

  return {
    classification: "UNKNOWN" as const,
    verificationStatus: "partially_verified" as const,
    conflictDetected: false,
    verified: false,
  };
}

export function createDirectnessVerificationService(
  dependencies: DirectnessDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();

  return {
    async assess(
      input: {
        leadId: string;
        entityName: string;
        personName?: string;
        roleTitle?: string;
        relationshipToPropertyOrCompany: string;
        evidenceSource: string;
        evidenceReference: string;
        evidenceType: string;
        evidenceDate: Date;
        explanation: string;
        confidence: number;
        proposedClassification: DirectnessClassification;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before directness verification can run.");
      }

      const context = await repository.getLeadEligibilityContext(input.leadId);
      if (!context) {
        throw new Error("Lead not found.");
      }

      const resolved = resolveClassification(
        context.assessments.map((item) => ({ classification: item.classification })),
        context.suppressed ? "SUPPRESSED" : input.proposedClassification,
      );

      const assessment = await repository.recordDirectnessAssessment({
        leadId: input.leadId,
        entityName: input.entityName,
        ...(input.personName ? { personName: input.personName } : {}),
        ...(input.roleTitle ? { roleTitle: input.roleTitle } : {}),
        relationshipToPropertyOrCompany: input.relationshipToPropertyOrCompany,
        evidenceSource: input.evidenceSource,
        evidenceReference: input.evidenceReference,
        evidenceType: input.evidenceType,
        evidenceDate: input.evidenceDate,
        explanation: input.explanation,
        confidence: Math.max(0, Math.min(100, input.confidence)),
        classification: resolved.classification,
        verificationStatus: resolved.verificationStatus,
        conflictDetected: resolved.conflictDetected,
      });

      const lead = await repository.updateLeadDirectness({
        leadId: input.leadId,
        classification: resolved.classification,
        confidence: input.confidence,
        verified: resolved.verified,
      });

      if (resolved.classification === "UNKNOWN" || resolved.conflictDetected) {
        await repository.createAgentMessage({
          type: "DIRECTNESS_NEEDS_REVIEW",
          title: "Directness requires review",
          body: `Lead ${input.leadId} has conflicting or insufficient directness evidence.`,
          severity: "warning",
          leadId: input.leadId,
        });
      }

      await auditService.recordEvent({
        actor,
        action: "lead.directness.assessed",
        entityType: "lead",
        entityId: input.leadId,
        metadata: {
          assessmentId: assessment?.id,
          proposedClassification: input.proposedClassification,
          resolvedClassification: resolved.classification,
          conflictDetected: resolved.conflictDetected,
        },
      });

      return lead;
    },

    async listAssessments(leadId: string) {
      if (!repository) {
        return [];
      }

      return repository.listRecentAssessments(leadId);
    },
  };
}
