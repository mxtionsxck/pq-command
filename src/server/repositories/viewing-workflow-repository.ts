import { and, desc, eq, gte } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  companies,
  contacts,
  notifications,
  properties,
  requirements,
  tasks,
  viewings,
} from "@/db/schema";

export function createViewingWorkflowRepository(db: PQCommandDb) {
  return {
    async createViewing(
      input: Omit<typeof viewings.$inferInsert, "id" | "createdAt" | "updatedAt"> & { id?: string },
    ) {
      const [created] = await db
        .insert(viewings)
        .values({
          ...input,
          id: input.id ?? createEntityId("viw"),
        })
        .returning();

      return created;
    },

    async updateViewing(
      viewingId: string,
      patch: Partial<Omit<typeof viewings.$inferInsert, "id" | "createdAt" | "updatedAt">>,
    ) {
      const [updated] = await db
        .update(viewings)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(viewings.id, viewingId))
        .returning();

      return updated;
    },

    async getViewingById(viewingId: string) {
      const [row] = await db
        .select({
          viewing: viewings,
          property: properties,
          requirement: requirements,
          company: companies,
          contact: contacts,
        })
        .from(viewings)
        .leftJoin(properties, eq(properties.id, viewings.propertyId))
        .leftJoin(requirements, eq(requirements.id, viewings.requirementId))
        .leftJoin(companies, eq(companies.id, viewings.companyId))
        .leftJoin(contacts, eq(contacts.id, viewings.contactId))
        .where(eq(viewings.id, viewingId))
        .limit(1);

      return row;
    },

    async listViewings(input?: { from?: Date; to?: Date }) {
      const rows = await db
        .select({
          viewing: viewings,
          property: properties,
          requirement: requirements,
          company: companies,
          contact: contacts,
        })
        .from(viewings)
        .leftJoin(properties, eq(properties.id, viewings.propertyId))
        .leftJoin(requirements, eq(requirements.id, viewings.requirementId))
        .leftJoin(companies, eq(companies.id, viewings.companyId))
        .leftJoin(contacts, eq(contacts.id, viewings.contactId))
        .where(
          and(input?.from ? gte(viewings.scheduledFor, input.from) : undefined),
        )
        .orderBy(desc(viewings.scheduledFor), desc(viewings.updatedAt));

      if (!input?.to) {
        return rows;
      }

      const upper = input.to;
      return rows.filter((row) => row.viewing.scheduledFor <= upper);
    },

    async createReminder(input: {
      userId: string;
      viewingId: string;
      title: string;
      body: string;
      linkHref: string;
    }) {
      const [created] = await db
        .insert(notifications)
        .values({
          id: createEntityId("ntf"),
          userId: input.userId,
          title: input.title,
          body: input.body,
          linkHref: input.linkHref,
          status: "unread",
        })
        .returning();

      return created;
    },

    async createTask(input: {
      title: string;
      description?: string;
      viewingId: string;
      assignedToUserId?: string;
      createdByUserId?: string;
      dueAt?: Date;
      priority?: "low" | "medium" | "high" | "urgent";
    }) {
      const [created] = await db
        .insert(tasks)
        .values({
          id: createEntityId("tsk"),
          title: input.title,
          description: input.description ?? null,
          viewingId: input.viewingId,
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

export type ViewingWorkflowRepository = ReturnType<
  typeof createViewingWorkflowRepository
>;
