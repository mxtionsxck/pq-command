import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canManageSources } from "@/server/auth/rbac";
import {
  createAcquisitionEngineRepository,
  type AcquisitionEngineRepository,
} from "@/server/repositories/acquisition-engine-repository";

import { createAuditService } from "./audit-event-service";

type DemandIntelligenceDependencies = {
  repository?: AcquisitionEngineRepository;
  auditService?: ReturnType<typeof createAuditService>;
};

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
  if (!actor.role || !canManageSources(actor.role)) {
    throw new Error("Only management can run demand intelligence.");
  }
}

function budgetBand(minCents: number | null, maxCents: number | null) {
  const max = maxCents ?? minCents ?? 0;
  if (max <= 150_000) {
    return "under_1500";
  }
  if (max <= 250_000) {
    return "1500_2500";
  }
  if (max <= 350_000) {
    return "2500_3500";
  }
  return "3500_plus";
}

function bedroomsBand(min: number | null, max: number | null) {
  const from = min ?? max ?? 0;
  const to = max ?? min ?? from;
  if (from >= 4 && to >= 4) {
    return "4+";
  }

  return `${from}-${to}`;
}

function statusFromRatio(ratio: number, trend: number) {
  if (ratio >= 200) {
    return "CRITICAL_SHORTAGE" as const;
  }
  if (ratio >= 140) {
    return "SHORTAGE" as const;
  }
  if (trend >= 25 && ratio >= 100) {
    return "EMERGING_SHORTAGE" as const;
  }
  if (ratio >= 110) {
    return "HIGH_DEMAND" as const;
  }

  return "BALANCED" as const;
}

export function createDemandIntelligenceService(
  dependencies: DemandIntelligenceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();

  return {
    async refreshHeatmap(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before demand intelligence can run.");
      }

      const rows = await repository.listRequirementDemandSnapshot();
      const upsertedIds: string[] = [];

      for (const row of rows) {
        const requirementsCount = row.requirementCount;
        const suitablePropertiesCount = 0;
        const shortageRatio = Math.round(
          (requirementsCount / Math.max(1, suitablePropertiesCount + 1)) * 100,
        );
        const demandTrendScore = Math.min(100, requirementsCount * 8);

        const upserted = await repository.upsertDemandHeatmapCell({
          ...(row.area ? { area: row.area } : {}),
          bedroomsBand: bedroomsBand(row.bedroomsMin, row.bedroomsMax),
          propertyType: "house",
          budgetBand: budgetBand(row.budgetMinCents, row.budgetMaxCents),
          requirementsCount,
          suitablePropertiesCount,
          shortageRatio,
          demandTrendScore,
          status: statusFromRatio(shortageRatio, demandTrendScore),
          trace: {
            requirementsCount,
            suitablePropertiesCount,
            shortageRatio,
            demandTrendScore,
            formula: "(requirements/max(suitable+1,1))*100",
          },
        });

        if (upserted?.id) {
          upsertedIds.push(upserted.id);
        }
      }

      await auditService.recordEvent({
        actor,
        action: "demand.heatmap.refreshed",
        entityType: "demand_heatmap",
        entityId: "m25",
        metadata: {
          cells: upsertedIds.length,
        },
      });

      return upsertedIds;
    },

    async listHeatmap(statuses?: Array<
      "BALANCED" | "HIGH_DEMAND" | "SHORTAGE" | "CRITICAL_SHORTAGE" | "EMERGING_SHORTAGE"
    >) {
      if (!repository) {
        return [];
      }

      return repository.listHeatmap(statuses);
    },

    async buildShortageMissionSuggestions() {
      if (!repository) {
        return [];
      }

      const rows = await repository.listHeatmap([
        "CRITICAL_SHORTAGE",
        "SHORTAGE",
        "EMERGING_SHORTAGE",
      ]);

      return rows.slice(0, 10).map((row) => ({
        title: `Acquire ${Math.max(1, row.requirementsCount - row.suitablePropertiesCount)} suitable ${row.bedroomsBand} properties`,
        missionType: "SHORTAGE" as const,
        area: row.area,
        budgetBand: row.budgetBand,
        status: row.status,
      }));
    },
  };
}
