import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canManageSources } from "@/server/auth/rbac";
import {
  createShortageIntelligenceRepository,
  type ShortageFilter,
} from "@/server/repositories/shortage-intelligence-repository";

import { createAuditService } from "./audit-event-service";

type ShortageRepositoryLike = ReturnType<typeof createShortageIntelligenceRepository>;

type ShortageDependencies = {
  repository?: ShortageRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function getRepository(repository?: ShortageRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createShortageIntelligenceRepository(getDb());
}

function ensureManagerAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (!actor.role || !canManageSources(actor.role)) {
    throw new Error("Only management can run shortage intelligence.");
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

function bedroomBand(min: number | null, max: number | null) {
  const from = min ?? max ?? 0;
  const to = max ?? min ?? from;
  return `${from}-${to}`;
}

function unitBand(unitCount: number | null) {
  if (!unitCount || unitCount <= 1) {
    return "1";
  }
  if (unitCount <= 3) {
    return "2-3";
  }
  return "4+";
}

function availabilityWindowFromStartDate(startDate: Date | null) {
  if (!startDate) {
    return "future";
  }

  const days = Math.floor((startDate.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) {
    return "now";
  }
  if (days <= 30) {
    return "within_30_days";
  }
  if (days <= 90) {
    return "31_90_days";
  }
  return "future";
}

function availabilityWindowFromProperty(input: {
  availability: "available_now" | "available_soon" | "occupied" | "let_agreed" | "unavailable";
  availableFrom: Date | null;
}) {
  if (input.availability === "available_now") {
    return "now";
  }

  if (input.availability === "available_soon") {
    return "within_30_days";
  }

  if (!input.availableFrom) {
    return "future";
  }

  const days = Math.floor((input.availableFrom.getTime() - Date.now()) / 86_400_000);
  if (days <= 30) {
    return "within_30_days";
  }
  if (days <= 90) {
    return "31_90_days";
  }

  return "future";
}

function priorityFromGap(gap: number) {
  if (gap >= 10) {
    return "CRITICAL" as const;
  }
  if (gap >= 6) {
    return "HIGH" as const;
  }
  if (gap >= 3) {
    return "MEDIUM" as const;
  }
  return "LOW" as const;
}

export function createShortageIntelligenceService(
  dependencies: ShortageDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();

  return {
    async recalculate(
      filter: ShortageFilter,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureManagerAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before shortage intelligence can run.");
      }

      const demand = await repository.listActiveDemandRequirements(filter);
      const stock = await repository.listSuitableStock(filter);

      const buckets = new Map<
        string,
        {
          borough: string | null;
          area: string | null;
          bedroomsBand: string;
          unitCountBand: string;
          budgetBand: string;
          availabilityWindow: string;
          demandIds: string[];
          stockIds: string[];
        }
      >();

      for (const req of demand) {
        const bucket = {
          borough: null,
          area: req.preferredArea,
          bedroomsBand: bedroomBand(req.bedroomsMin, req.bedroomsMax),
          unitCountBand: unitBand(req.unitCount),
          budgetBand: budgetBand(req.budgetMinCents, req.budgetMaxCents),
          availabilityWindow: availabilityWindowFromStartDate(req.startDate),
        };

        const key = `${bucket.borough ?? "none"}|${bucket.area ?? "none"}|${bucket.bedroomsBand}|${bucket.unitCountBand}|${bucket.budgetBand}|${bucket.availabilityWindow}`;
        const existing = buckets.get(key);
        if (!existing) {
          buckets.set(key, {
            ...bucket,
            demandIds: [req.id],
            stockIds: [],
          });
          continue;
        }

        existing.demandIds.push(req.id);
      }

      for (const prop of stock) {
        const bucket = {
          borough: prop.borough,
          area: prop.city,
          bedroomsBand: `${prop.bedrooms ?? 0}-${prop.bedrooms ?? 0}`,
          unitCountBand: "1",
          budgetBand: budgetBand(prop.monthlyRentCents, prop.monthlyRentCents),
          availabilityWindow: availabilityWindowFromProperty({
            availability: prop.availability,
            availableFrom: prop.availableFrom,
          }),
        };

        const key = `${bucket.borough ?? "none"}|${bucket.area ?? "none"}|${bucket.bedroomsBand}|${bucket.unitCountBand}|${bucket.budgetBand}|${bucket.availabilityWindow}`;
        const existing = buckets.get(key);
        if (!existing) {
          buckets.set(key, {
            ...bucket,
            demandIds: [],
            stockIds: [prop.id],
          });
          continue;
        }

        existing.stockIds.push(prop.id);
      }

      const rows = [] as Array<{
        id: string;
        borough: string | null;
        area: string | null;
        bedroomsBand: string;
        unitCountBand: string;
        budgetBand: string;
        availabilityWindow: string;
        activeDemand: number;
        suitableStock: number;
        estimatedGap: number;
        priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        trace: Record<string, unknown>;
      }>;

      for (const bucket of buckets.values()) {
        const activeDemand = bucket.demandIds.length;
        const suitableStock = bucket.stockIds.length;
        const estimatedGap = Math.max(activeDemand - suitableStock, 0);

        const persisted = await repository.upsertShortageRow({
          borough: bucket.borough,
          area: bucket.area,
          bedroomsBand: bucket.bedroomsBand,
          unitCountBand: bucket.unitCountBand,
          budgetBand: bucket.budgetBand,
          availabilityWindow: bucket.availabilityWindow,
          activeDemand,
          suitableStock,
          estimatedGap,
          priority: priorityFromGap(estimatedGap),
          trace: {
            demandRequirementIds: bucket.demandIds,
            stockPropertyIds: bucket.stockIds,
            formula: "max(activeDemand - suitableStock, 0)",
          },
        });

        if (persisted) {
          rows.push({
            id: persisted.id,
            borough: persisted.borough,
            area: persisted.area,
            bedroomsBand: persisted.bedroomsBand,
            unitCountBand: persisted.unitCountBand,
            budgetBand: persisted.budgetBand,
            availabilityWindow: persisted.availabilityWindow,
            activeDemand: persisted.activeDemand,
            suitableStock: persisted.suitableStock,
            estimatedGap: persisted.estimatedGap,
            priority: persisted.priority,
            trace: persisted.trace,
          });
        }
      }

      await auditService.recordEvent({
        actor,
        action: "shortage.recalculated",
        entityType: "shortage_intelligence",
        entityId: "aggregate",
        metadata: {
          rows: rows.length,
          filter,
        },
      });

      return rows.sort((a, b) => b.estimatedGap - a.estimatedGap);
    },

    async list(filter: ShortageFilter) {
      if (!repository) {
        return [];
      }

      return repository.listShortageRows(filter);
    },

    async convertToTarget(
      input: {
        shortageId: string;
        createObjective: boolean;
        createCampaignTarget: boolean;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureManagerAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before shortage intelligence can run.");
      }

      const shortage = await repository.getShortageById(input.shortageId);
      if (!shortage) {
        throw new Error("Shortage row not found.");
      }

      let objectiveId: string | undefined;
      if (input.createObjective) {
        const objective = await repository.createObjectiveFromShortage({
          title: `Shortage target ${shortage.area ?? shortage.borough ?? "unscoped"}`,
          description:
            `Gap ${shortage.estimatedGap} for ${shortage.bedroomsBand} beds, budget ${shortage.budgetBand}, window ${shortage.availabilityWindow}.`,
          ...(actor.userId ? { ownerUserId: actor.userId } : {}),
          targetValue: shortage.activeDemand,
          currentValue: shortage.suitableStock,
        });

        objectiveId = objective?.id;
      }

      let campaignId: string | undefined;
      if (input.createCampaignTarget) {
        const bedroomsParts = shortage.bedroomsBand.split("-");
        const bedroomsMin = Number.parseInt(bedroomsParts[0] ?? "", 10);
        const bedroomsMax = Number.parseInt(bedroomsParts[1] ?? "", 10);

        const campaign = await repository.createCampaignTarget({
          name: `Sourcing target ${shortage.area ?? shortage.borough ?? "market"}`,
          ...(actor.userId ? { ownerUserId: actor.userId } : {}),
          location: shortage.area ?? shortage.borough,
          ...(Number.isFinite(bedroomsMin) ? { bedroomsMin } : {}),
          ...(Number.isFinite(bedroomsMax) ? { bedroomsMax } : {}),
          unitCountMin: shortage.unitCountBand === "4+" ? 4 : 1,
          minimumScore: 60,
          objective: `Close shortage gap ${shortage.id}`,
        });

        campaignId = campaign?.id;
      }

      await repository.markShortageConverted({
        shortageId: shortage.id,
        ...(objectiveId ? { objectiveId } : {}),
        ...(campaignId ? { campaignId } : {}),
      });

      await auditService.recordEvent({
        actor,
        action: "shortage.converted_to_target",
        entityType: "shortage_intelligence_row",
        entityId: shortage.id,
        metadata: {
          objectiveId,
          campaignId,
          automaticSourcingTriggered: false,
        },
      });

      return {
        objectiveId,
        campaignId,
      };
    },
  };
}
