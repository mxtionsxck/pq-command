import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import { deals, documents } from "@/db/schema";
import { appEnv } from "@/lib/env";

function getDbOrNull() {
  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return getDb();
}

export function createDocumentControlService() {
  const db = getDbOrNull();

  return {
    async listRecentDocuments(limit = 50) {
      if (!db) {
        return [];
      }

      return db
        .select()
        .from(documents)
        .where(isNull(documents.archivedAt))
        .orderBy(desc(documents.updatedAt), desc(documents.createdAt))
        .limit(limit);
    },

    async listDealCoverage(limit = 50) {
      if (!db) {
        return [];
      }

      return db
        .select({
          dealId: deals.id,
          status: deals.status,
          totalDocs: sql<number>`count(${documents.id})`,
          contractDocs:
            sql<number>`sum(case when ${documents.documentType} = 'contract' then 1 else 0 end)`,
          complianceDocs:
            sql<number>`sum(case when ${documents.documentType} = 'compliance' then 1 else 0 end)`,
          floorplanDocs:
            sql<number>`sum(case when ${documents.documentType} = 'floorplan' then 1 else 0 end)`,
        })
        .from(deals)
        .leftJoin(documents, eq(documents.dealId, deals.id))
        .where(
          and(
            inArray(deals.status, ["AGREED", "CONTRACT", "LIVE", "COMPLETED"] as const),
            isNull(deals.archivedAt),
          ),
        )
        .groupBy(deals.id, deals.status)
        .orderBy(desc(deals.updatedAt))
        .limit(limit);
    },
  };
}
