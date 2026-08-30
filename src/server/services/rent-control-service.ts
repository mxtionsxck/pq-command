import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import { companies, deals, properties } from "@/db/schema";
import { appEnv } from "@/lib/env";

function getDbOrNull() {
  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return getDb();
}

export function createRentControlService() {
  const db = getDbOrNull();

  return {
    async getSnapshot() {
      if (!db) {
        return {
          trackedDeals: 0,
          liveDeals: 0,
          completedDeals: 0,
          trackedMonthlyRentCents: 0,
          estimatedSourcingFeeCents: 0,
          highValueTrackedDeals: 0,
        };
      }

      const activeStatuses = ["LIVE", "COMPLETED"] as const;

      const [summary] = await db
        .select({
          trackedDeals: sql<number>`count(*)`,
          liveDeals:
            sql<number>`sum(case when ${deals.status} = 'LIVE' then 1 else 0 end)`,
          completedDeals:
            sql<number>`sum(case when ${deals.status} = 'COMPLETED' then 1 else 0 end)`,
          trackedMonthlyRentCents:
            sql<number>`coalesce(sum(${properties.monthlyRentCents}), 0)`,
          highValueTrackedDeals:
            sql<number>`sum(case when ${properties.monthlyRentCents} >= 1500000 then 1 else 0 end)`,
        })
        .from(deals)
        .leftJoin(properties, eq(properties.id, deals.propertyId))
        .where(and(inArray(deals.status, activeStatuses), isNull(deals.archivedAt)));

      const trackedMonthlyRentCents = Number(summary?.trackedMonthlyRentCents ?? 0);

      return {
        trackedDeals: Number(summary?.trackedDeals ?? 0),
        liveDeals: Number(summary?.liveDeals ?? 0),
        completedDeals: Number(summary?.completedDeals ?? 0),
        trackedMonthlyRentCents,
        estimatedSourcingFeeCents: Math.round((trackedMonthlyRentCents * 3) / 4),
        highValueTrackedDeals: Number(summary?.highValueTrackedDeals ?? 0),
      };
    },

    async listTrackedDeals(limit = 40) {
      if (!db) {
        return [];
      }

      return db
        .select({
          deal: deals,
          property: properties,
          company: companies,
        })
        .from(deals)
        .leftJoin(properties, eq(properties.id, deals.propertyId))
        .leftJoin(companies, eq(companies.id, deals.companyId))
        .where(
          and(
            inArray(deals.status, ["LIVE", "COMPLETED"] as const),
            isNull(deals.archivedAt),
          ),
        )
        .orderBy(desc(deals.updatedAt), desc(deals.createdAt))
        .limit(limit);
    },
  };
}
