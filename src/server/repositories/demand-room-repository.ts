import { and, asc, desc, eq, ilike, isNull, or } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  auditEvents,
  companies,
  contacts,
  conversations,
  messages,
  requirements,
} from "@/db/schema";

function compactConditions<T>(values: Array<T | undefined>) {
  return values.filter((value): value is T => value !== undefined);
}

export function createDemandRoomRepository(db: PQCommandDb) {
  return {
    async listRequirements(search?: string) {
      const conditions = compactConditions([
        isNull(requirements.archivedAt),
        search
          ? or(
              ilike(companies.name, `%${search}%`),
              ilike(contacts.email, `%${search}%`),
              ilike(requirements.preferredArea, `%${search}%`),
            )
          : undefined,
      ]);

      return db
        .select({
          requirement: requirements,
          companyName: companies.name,
          contactFirstName: contacts.firstName,
          contactLastName: contacts.lastName,
          contactEmail: contacts.email,
        })
        .from(requirements)
        .leftJoin(companies, eq(companies.id, requirements.companyId))
        .leftJoin(contacts, eq(contacts.id, requirements.contactId))
        .where(and(...conditions))
        .orderBy(desc(requirements.updatedAt), desc(requirements.createdAt))
        .limit(200);
    },

    async getRequirement(requirementId: string) {
      const [row] = await db
        .select({
          requirement: requirements,
          company: companies,
          contact: contacts,
        })
        .from(requirements)
        .leftJoin(companies, eq(companies.id, requirements.companyId))
        .leftJoin(contacts, eq(contacts.id, requirements.contactId))
        .where(eq(requirements.id, requirementId))
        .limit(1);

      return row;
    },

    async createRequirement(input: Omit<typeof requirements.$inferInsert, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
      const [created] = await db
        .insert(requirements)
        .values({
          ...input,
          id: input.id ?? createEntityId("req"),
        })
        .returning();

      return created;
    },

    async updateRequirement(
      requirementId: string,
      patch: Partial<Omit<typeof requirements.$inferInsert, "id" | "createdAt" | "updatedAt">>,
    ) {
      const [updated] = await db
        .update(requirements)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(requirements.id, requirementId))
        .returning();

      return updated;
    },

    async archiveRequirement(requirementId: string) {
      const [updated] = await db
        .update(requirements)
        .set({
          status: "archived",
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(requirements.id, requirementId))
        .returning();

      return updated;
    },

    async getRequirementTimeline(requirementId: string) {
      return db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityType, "requirement"),
            eq(auditEvents.entityId, requirementId),
          ),
        )
        .orderBy(desc(auditEvents.occurredAt))
        .limit(80);
    },

    async listRequirementConversations(leadId: string | null) {
      if (!leadId) {
        return [];
      }

      const rows = await db
        .select({
          conversation: conversations,
          contactEmail: contacts.email,
          companyName: companies.name,
        })
        .from(conversations)
        .leftJoin(contacts, eq(contacts.id, conversations.contactId))
        .leftJoin(companies, eq(companies.id, contacts.companyId))
        .where(and(eq(conversations.leadId, leadId), isNull(conversations.archivedAt)))
        .orderBy(desc(conversations.lastMessageAt), desc(conversations.updatedAt))
        .limit(30);

      const conversationsWithMessages = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          messages: await db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, row.conversation.id))
            .orderBy(asc(messages.createdAt))
            .limit(20),
        })),
      );

      return conversationsWithMessages;
    },
  };
}

export type DemandRoomRepository = ReturnType<typeof createDemandRoomRepository>;
