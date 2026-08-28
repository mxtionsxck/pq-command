import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { LeadScoringConfig } from "@/db/models";
import type { AuditActor } from "@/domain/audit/types";
import type {
  LeadScoreBand,
  LeadScoreResult,
  LeadScoringConfigShape,
  LeadScoringThresholds,
  LeadScoringWeights,
} from "@/domain/scoring/types";
import { appEnv } from "@/lib/env";
import { canManageSources, canSendOutreach } from "@/server/auth/rbac";
import { createLeadScoringRepository } from "@/server/repositories/lead-scoring-repository";

import { createAuditService } from "./audit-event-service";

type LeadScoringRepositoryLike = ReturnType<typeof createLeadScoringRepository>;

type LeadScoringServiceDependencies = {
  repository?: LeadScoringRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
  now?: () => Date;
};

const defaultWeights: LeadScoringWeights = {
  companyLetFit: 15,
  location: 10,
  bedroomsUnits: 8,
  timing: 12,
  commercialFit: 10,
  evidenceStrength: 15,
  decisionMakerConfidence: 10,
  recency: 8,
  contactability: 6,
  historicalConversionLikelihood: 6,
};

const defaultThresholds: LeadScoringThresholds = {
  IGNORE: 0,
  MONITOR: 35,
  RESEARCH: 55,
  QUALIFIED: 72,
  PRIORITY: 88,
};

function toNumericRecord<T extends object>(input: T): Record<string, number> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, Number(value)]),
  );
}

function getRepository(repository?: LeadScoringRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createLeadScoringRepository(getDb());
}

function ensureConfigAccess(
  actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
) {
  if (actor.role && !canManageSources(actor.role)) {
    throw new Error(
      "Only managers and admins can manage lead scoring configs.",
    );
  }
}

function ensureScoringAccess(
  actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authenticated team members can score leads.");
  }
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function daysSince(date: Date | null, now: Date) {
  if (!date) {
    return 365;
  }

  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function mapBand(
  score: number,
  thresholds: LeadScoringThresholds,
): LeadScoreBand {
  if (score >= thresholds.PRIORITY) {
    return "PRIORITY";
  }

  if (score >= thresholds.QUALIFIED) {
    return "QUALIFIED";
  }

  if (score >= thresholds.RESEARCH) {
    return "RESEARCH";
  }

  if (score >= thresholds.MONITOR) {
    return "MONITOR";
  }

  return "IGNORE";
}

function getDefaultConfig(): LeadScoringConfigShape {
  return {
    version: "default-v1",
    weights: defaultWeights,
    thresholds: defaultThresholds,
  };
}

function parseConfig(
  input: LeadScoringConfig | null | undefined,
): LeadScoringConfigShape {
  const fallback = getDefaultConfig();

  if (!input) {
    return fallback;
  }

  const weights = {
    ...defaultWeights,
    ...(input.weights as Partial<LeadScoringWeights>),
  };
  const thresholds = {
    ...defaultThresholds,
    ...(input.thresholds as Partial<LeadScoringThresholds>),
  };

  return {
    version: input.version,
    weights,
    thresholds,
  };
}

export function createLeadScoringService(
  dependencies: LeadScoringServiceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const now = dependencies.now ?? (() => new Date());
  const getAuditService = () =>
    dependencies.auditService ?? createAuditService();

  return {
    getDefaultConfig,

    async listConfigs() {
      if (!repository) {
        return [];
      }

      return repository.listConfigs();
    },

    async getActiveConfig() {
      if (!repository) {
        return null;
      }

      return repository.getActiveConfig();
    },

    async saveConfig(
      input: LeadScoringConfigShape & { notes?: string },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureConfigAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before scoring configs can be managed.",
        );
      }

      const saved = await repository.saveConfig({
        createdByUserId: actor.userId,
        version: input.version,
        active: false,
        weights: toNumericRecord(input.weights),
        thresholds: toNumericRecord(input.thresholds),
        notes: input.notes ?? null,
      });

      if (!saved) {
        throw new Error("Failed to save scoring config.");
      }

      await getAuditService().recordEvent({
        actor,
        action: "lead.score.config.saved",
        entityType: "lead_scoring_config",
        entityId: saved.id,
        metadata: {
          version: saved.version,
        },
      });

      return saved;
    },

    async activateConfig(
      configId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureConfigAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before scoring configs can be managed.",
        );
      }

      const activeConfig = await repository.setConfigActive(configId);

      if (!activeConfig) {
        throw new Error("Scoring config not found.");
      }

      await getAuditService().recordEvent({
        actor,
        action: "lead.score.config.activated",
        entityType: "lead_scoring_config",
        entityId: activeConfig.id,
        metadata: {
          version: activeConfig.version,
        },
      });

      return activeConfig;
    },

    async scoreLead(
      leadId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<LeadScoreResult> {
      ensureScoringAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before lead scoring can run.",
        );
      }

      const activeConfig = parseConfig(await repository.getActiveConfig());
      const input = await repository.getLeadScoringInput(leadId);

      if (!input) {
        throw new Error("Lead not found.");
      }

      const currentNow = now();
      const missingData: string[] = [];
      const reasonCodes: string[] = [];

      const companyLetFitScore =
        input.propertyCompanyLetFit === "ideal"
          ? 100
          : input.propertyCompanyLetFit === "strong"
            ? 82
            : input.propertyCompanyLetFit === "review"
              ? 58
              : input.propertyCompanyLetFit === "unsuitable"
                ? 15
                : 45;
      if (!input.propertyCompanyLetFit) {
        missingData.push("property.companyLetFit");
      }

      const locationScore =
        input.propertyCity && input.propertyPostcode ? 85 : 35;
      if (!input.propertyCity || !input.propertyPostcode) {
        missingData.push("property.location");
      }

      const bedroomsUnitsScore =
        (input.propertyBedrooms ?? 0) >= 4
          ? 92
          : (input.propertyBedrooms ?? 0) >= 2
            ? 74
            : input.propertyBedrooms === null
              ? 40
              : 55;
      if (input.propertyBedrooms === null) {
        missingData.push("property.bedrooms");
      }

      const timingDays = daysSince(input.lead.receivedAt, currentNow);
      const timingScore =
        timingDays <= 7
          ? 95
          : timingDays <= 21
            ? 78
            : timingDays <= 45
              ? 60
              : 45;
      if (!input.lead.receivedAt) {
        missingData.push("lead.receivedAt");
      }

      const commercialFitScore =
        input.lead.leadType === "supply"
          ? 84
          : input.lead.leadType === "demand"
            ? 76
            : 66;

      const evidenceStrengthScore = clampPercent(
        input.evidenceCount * 12 + input.supportedConclusionCount * 24,
      );
      if (input.evidenceCount === 0) {
        missingData.push("evidence");
      }

      const decisionMakerConfidenceScore = clampPercent(
        input.contactConfidence ?? 42,
      );
      if (input.contactConfidence === null) {
        missingData.push("contact.confidence");
      }

      const recencyDays = daysSince(input.latestEvidenceAt, currentNow);
      const recencyScore =
        recencyDays <= 3
          ? 96
          : recencyDays <= 10
            ? 82
            : recencyDays <= 30
              ? 64
              : 40;

      const contactabilityScore =
        input.contactSuppressionStatus === "suppressed"
          ? 5
          : input.contactEmail || input.contactPhone
            ? 82
            : 35;
      if (!input.contactEmail && !input.contactPhone) {
        missingData.push("contact.channel");
      }

      const historicalConversionLikelihoodScore =
        input.sourceKind === "referral"
          ? 86
          : input.sourceKind === "partner"
            ? 80
            : input.sourceKind === "portal"
              ? 72
              : 64;

      const factors: Array<[keyof LeadScoringWeights, number]> = [
        ["companyLetFit", companyLetFitScore],
        ["location", locationScore],
        ["bedroomsUnits", bedroomsUnitsScore],
        ["timing", timingScore],
        ["commercialFit", commercialFitScore],
        ["evidenceStrength", evidenceStrengthScore],
        ["decisionMakerConfidence", decisionMakerConfidenceScore],
        ["recency", recencyScore],
        ["contactability", contactabilityScore],
        ["historicalConversionLikelihood", historicalConversionLikelihoodScore],
      ];

      const totalWeight = factors.reduce(
        (sum, [key]) => sum + activeConfig.weights[key],
        0,
      );
      const weighted = factors.reduce(
        (sum, [key, value]) => sum + value * activeConfig.weights[key],
        0,
      );
      const score = clampPercent(totalWeight > 0 ? weighted / totalWeight : 0);
      const confidence = clampPercent(100 - missingData.length * 9);
      const band = mapBand(score, activeConfig.thresholds);

      reasonCodes.push(`band:${band.toLowerCase()}`);
      reasonCodes.push(`evidence:${input.evidenceCount}`);
      reasonCodes.push(
        `supported_conclusions:${input.supportedConclusionCount}`,
      );

      await repository.updateLeadScore(leadId, {
        score,
        confidence,
        scoreVersion: activeConfig.version,
        lastScoredAt: currentNow,
      });

      await getAuditService().recordEvent({
        actor,
        action: "lead.scored",
        entityType: "lead",
        entityId: leadId,
        metadata: {
          score,
          confidence,
          scoringVersion: activeConfig.version,
          band,
        },
      });

      return {
        leadId,
        score,
        confidence,
        reasonCodes,
        missingData,
        scoringVersion: activeConfig.version,
        band,
      };
    },
  };
}
