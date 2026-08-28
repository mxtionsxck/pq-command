import { and, desc, eq, isNull } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  auditEvents,
  companies,
  deals,
  documents,
  properties,
  requirements,
  tasks,
} from "@/db/schema";

export function createDealRoomRepository(db: PQCommandDb) {
  return {
    async listDeals() {
      return db
        .select({
          deal: deals,
          company: companies,
          property: properties,
          requirement: requirements,
        })
        .from(deals)
        .leftJoin(companies, eq(companies.id, deals.companyId))
        .leftJoin(properties, eq(properties.id, deals.propertyId))
        .leftJoin(requirements, eq(requirements.id, deals.requirementId))
        .where(isNull(deals.archivedAt))
        .orderBy(desc(deals.updatedAt), desc(deals.createdAt));
    },

    async createDeal(input: Omit<typeof deals.$inferInsert, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
      const [created] = await db
        .insert(deals)
        .values({
          ...input,
          id: input.id ?? createEntityId("del"),
        })
        .returning();

      return created;
    },

    async findDealById(dealId: string) {
      const [row] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, dealId), isNull(deals.archivedAt)))
        .limit(1);

      return row;
    },

    async updateDeal(
      dealId: string,
      patch: Partial<Omit<typeof deals.$inferInsert, "id" | "createdAt" | "updatedAt">>,
    ) {
      const [updated] = await db
        .update(deals)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(deals.id, dealId))
        .returning();

      return updated;
    },

    async listDealTimeline(dealId: string) {
      return db
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.entityType, "deal"), eq(auditEvents.entityId, dealId)))
        .orderBy(desc(auditEvents.occurredAt));
    },

    async listDealTasks(dealId: string) {
      return db
        .select()
        .from(tasks)
        .where(and(eq(tasks.dealId, dealId), isNull(tasks.archivedAt)))
        .orderBy(desc(tasks.updatedAt));
    },

    async listDealDocuments(dealId: string) {
      return db
        .select()
        .from(documents)
        .where(and(eq(documents.dealId, dealId), isNull(documents.archivedAt)))
        .orderBy(desc(documents.updatedAt));
    },

    async createDealTask(input: {
      dealId: string;
      title: string;
      description?: string;
      assignedToUserId?: string;
      createdByUserId?: string;
      dueAt?: Date;
      priority?: "low" | "medium" | "high" | "urgent";
    }) {
      const [created] = await db
        .insert(tasks)
        .values({
          id: createEntityId("tsk"),
          dealId: input.dealId,
          title: input.title,
          description: input.description ?? null,
          assignedToUserId: input.assignedToUserId ?? null,
          createdByUserId: input.createdByUserId ?? null,
          dueAt: input.dueAt ?? null,
          priority: input.priority ?? "medium",
          status: "todo",
        })
        .returning();

      return created;
    },
  };
}

export type DealRoomRepository = ReturnType<typeof createDealRoomRepository>;
