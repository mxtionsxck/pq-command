import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import {
  createAnalyticsAttributionRepository,
  type AnalyticsAttributionRepository,
  type FunnelFilter,
  type FunnelMetric,
} from "@/server/repositories/analytics-attribution-repository";

import { createAuditService } from "./audit-event-service";

type AnalyticsDependencies = {
  repository?: AnalyticsAttributionRepository;
  auditService?: ReturnType<typeof createAuditService>;
};

const FUNNEL_ORDER: FunnelMetric[] = [
  "discovered",
  "researched_prospect",
  "qualified",
  "conversation",
  "positive_reply",
  "requirement",
  "qualified_stock",
  "match",
  "viewing",
  "offer",
  "completed_deal",
  "multi_unit_units",
];

function getRepository(repository?: AnalyticsAttributionRepository) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createAnalyticsAttributionRepository(getDb());
}

export function createAnalyticsAttributionService(
  dependencies: AnalyticsDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();

  return {
    funnelStages: FUNNEL_ORDER,

    async computeFunnel(filter: FunnelFilter) {
      if (!repository) {
        return {
          metrics: FUNNEL_ORDER.map((metric) => ({ metric, value: 0, trace: {} })),
        };
      }

      const metrics = [] as Array<{
        metric: FunnelMetric;
        value: number;
        trace: Record<string, unknown>;
      }>;

      for (const metric of FUNNEL_ORDER) {
        const value = await repository.countMetric(metric, filter);
        metrics.push({
          metric,
          value,
          trace: {
            metric,
            filter: {
              sourceId: filter.sourceId ?? null,
              campaignId: filter.campaignId ?? null,
              leadType: filter.leadType ?? null,
              area: filter.area ?? null,
              bedroomsBand: filter.bedroomsBand ?? null,
              agentUserId: filter.agentUserId ?? null,
              periodStart: filter.periodStart.toISOString(),
              periodEnd: filter.periodEnd.toISOString(),
            },
            generatedFrom: "live_query",
          },
        });
      }

      return { metrics };
    },

    async persistSnapshot(
      filter: FunnelFilter,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      if (!repository) {
        throw new Error("DATABASE_URL is required before analytics can run.");
      }

      const computed = await this.computeFunnel(filter);
      const created = [] as string[];

      for (const row of computed.metrics) {
        const snapshot = await repository.createSnapshot({
          metric: row.metric,
          value: row.value,
          filter,
          trace: row.trace,
        });

        if (snapshot) {
          created.push(snapshot.id);
        }
      }

      await auditService.recordEvent({
        actor,
        action: "analytics.funnel.snapshot_created",
        entityType: "analytics_funnel",
        entityId: `${filter.periodStart.toISOString()}_${filter.periodEnd.toISOString()}`,
        metadata: {
          createdCount: created.length,
          sourceId: filter.sourceId,
          campaignId: filter.campaignId,
          leadType: filter.leadType,
          area: filter.area,
          bedroomsBand: filter.bedroomsBand,
          agentUserId: filter.agentUserId,
        },
      });

      return created;
    },

    async listSnapshots(filter: { periodStart: Date; periodEnd: Date }) {
      if (!repository) {
        return [];
      }

      return repository.listLatestSnapshots(filter.periodStart, filter.periodEnd);
    },
  };
}
