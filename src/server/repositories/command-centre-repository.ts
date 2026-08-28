import { and, count, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import {
  conversations,
  deals,
  leads,
  queueItems,
  requirements,
  shortageIntelligenceRows,
  tasks,
  viewings,
} from "@/db/schema";

export function createCommandCentreRepository(db: PQCommandDb) {
  return {
    async countQualifiedSupply() {
      const [row] = await db
        .select({ count: count(leads.id) })
        .from(leads)
        .where(and(eq(leads.leadType, "supply"), eq(leads.status, "qualified")));

      return row?.count ?? 0;
    },

    async countDirectDemand() {
      const [row] = await db
        .select({ count: count(requirements.id) })
        .from(requirements)
        .where(
          and(
            eq(requirements.relationshipType, "DIRECT"),
            inArray(requirements.status, ["open", "matched"]),
          ),
        );

      return row?.count ?? 0;
    },

    async sumSupplyGap() {
      const [row] = await db
        .select({
          total: sql<number>`coalesce(sum(${shortageIntelligenceRows.estimatedGap}), 0)`,
        })
        .from(shortageIntelligenceRows)
        .where(eq(shortageIntelligenceRows.status, "active"));

      return Number(row?.total ?? 0);
    },

    async countHotReplies() {
      const [row] = await db
        .select({ count: count(conversations.id) })
        .from(conversations)
        .where(
          and(
            inArray(conversations.inboxCategory, ["HOT", "INTERESTED"]),
            inArray(conversations.status, ["open", "pending"]),
          ),
        );

      return row?.count ?? 0;
    },

    async countViewingsToday(now: Date) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [row] = await db
        .select({ count: count(viewings.id) })
        .from(viewings)
        .where(
          and(
            gte(viewings.scheduledFor, start),
            lt(viewings.scheduledFor, end),
            inArray(viewings.status, ["scheduled", "confirmed", "reminded"]),
          ),
        );

      return row?.count ?? 0;
    },

    async countActiveDeals() {
      const [row] = await db
        .select({ count: count(deals.id) })
        .from(deals)
        .where(
          inArray(deals.status, [
            "MATCHED",
            "VIEWING",
            "OFFER",
            "NEGOTIATION",
            "AGREED",
            "CONTRACT",
            "LIVE",
          ]),
        );

      return row?.count ?? 0;
    },

    async countStalledItems(now: Date) {
      const [row] = await db
        .select({ count: count(tasks.id) })
        .from(tasks)
        .where(
          and(
            inArray(tasks.status, ["todo", "in_progress"]),
            lte(tasks.dueAt, now),
          ),
        );

      return row?.count ?? 0;
    },

    async countOvernightIntelligence(now: Date) {
      const since = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      const [row] = await db
        .select({ count: count(leads.id) })
        .from(leads)
        .where(gte(leads.createdAt, since));

      return row?.count ?? 0;
    },

    async listTopAcquisitionTargets() {
      return db
        .select({
          id: shortageIntelligenceRows.id,
          area: shortageIntelligenceRows.area,
          borough: shortageIntelligenceRows.borough,
          estimatedGap: shortageIntelligenceRows.estimatedGap,
          priority: shortageIntelligenceRows.priority,
          budgetBand: shortageIntelligenceRows.budgetBand,
          bedroomsBand: shortageIntelligenceRows.bedroomsBand,
        })
        .from(shortageIntelligenceRows)
        .where(inArray(shortageIntelligenceRows.priority, ["CRITICAL", "HIGH"]))
        .orderBy(desc(shortageIntelligenceRows.estimatedGap), desc(shortageIntelligenceRows.updatedAt))
        .limit(5);
    },

    async listNextActions() {
      return db
        .select({
          id: tasks.id,
          title: tasks.title,
          dueAt: tasks.dueAt,
          priority: tasks.priority,
          status: tasks.status,
          dealId: tasks.dealId,
          leadId: tasks.leadId,
          viewingId: tasks.viewingId,
        })
        .from(tasks)
        .where(inArray(tasks.status, ["todo", "in_progress"]))
        .orderBy(desc(tasks.priority), tasks.dueAt)
        .limit(5);
    },

    async queueDepth() {
      const [row] = await db
        .select({ count: count(queueItems.id) })
        .from(queueItems)
        .where(inArray(queueItems.status, ["queued", "retrying", "running"]));

      return row?.count ?? 0;
    },
  };
}

export type CommandCentreRepository = ReturnType<typeof createCommandCentreRepository>;
