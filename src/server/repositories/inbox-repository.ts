import { and, asc, desc, eq, ilike, isNull, or } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  companies,
  contacts,
  conversations,
  leads,
  messages,
  requirements,
  suppressionList,
  tasks,
} from "@/db/schema";

import { createRepository } from "./base-repository";

function compactConditions<T>(values: Array<T | undefined>) {
  return values.filter((value): value is T => value !== undefined);
}

export function createInboxRepository(db: PQCommandDb) {
  const conversationRepository = createRepository(db, conversations, "cnv");

  return {
    async listConversations(input: {
      category?:
        | "HOT"
        | "INTERESTED"
        | "FUTURE"
        | "QUESTION"
        | "UNCLEAR"
        | "NOT_INTERESTED"
        | "OPT_OUT";
      search?: string;
      limit?: number;
      offset?: number;
    }) {
      const conditions = compactConditions([
        isNull(conversations.archivedAt),
        input.category
          ? eq(conversations.inboxCategory, input.category)
          : undefined,
        input.search
          ? or(
              ilike(conversations.subject, `%${input.search}%`),
              ilike(companies.name, `%${input.search}%`),
              ilike(contacts.email, `%${input.search}%`),
            )
          : undefined,
      ]);

      return db
        .select({
          conversation: conversations,
          leadSummary: leads.summary,
          companyName: companies.name,
          contactFirstName: contacts.firstName,
          contactLastName: contacts.lastName,
          contactEmail: contacts.email,
        })
        .from(conversations)
        .leftJoin(leads, eq(leads.id, conversations.leadId))
        .leftJoin(contacts, eq(contacts.id, conversations.contactId))
        .leftJoin(companies, eq(companies.id, contacts.companyId))
        .where(and(...conditions))
        .orderBy(
          desc(conversations.lastMessageAt),
          desc(conversations.updatedAt),
        )
        .limit(Math.max(1, Math.min(100, input.limit ?? 25)))
        .offset(Math.max(0, input.offset ?? 0));
    },

    async getConversationById(conversationId: string) {
      const [row] = await db
        .select({
          conversation: conversations,
          lead: leads,
          contact: contacts,
          company: companies,
        })
        .from(conversations)
        .leftJoin(leads, eq(leads.id, conversations.leadId))
        .leftJoin(contacts, eq(contacts.id, conversations.contactId))
        .leftJoin(companies, eq(companies.id, contacts.companyId))
        .where(eq(conversations.id, conversationId))
        .limit(1);

      return row;
    },

    async listMessages(conversationId: string) {
      return db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt));
    },

    async updateConversation(
      conversationId: string,
      patch: Partial<typeof conversations.$inferInsert>,
    ) {
      return conversationRepository.updateById(conversationId, patch);
    },

    async assignConversation(conversationId: string, ownerUserId: string) {
      return conversationRepository.updateById(conversationId, {
        ownerUserId,
      });
    },

    async snoozeConversation(conversationId: string, snoozedUntil: Date) {
      return conversationRepository.updateById(conversationId, {
        snoozedUntil,
      });
    },

    async createReplyDraft(
      conversationId: string,
      authorUserId: string,
      bodyText: string,
    ) {
      const [created] = await db
        .insert(messages)
        .values({
          id: createEntityId("msg"),
          conversationId,
          authorUserId,
          direction: "outbound",
          status: "queued",
          bodyText,
        })
        .returning();

      return created;
    },

    async linkProperty(conversationId: string, propertyId: string) {
      const row = await this.getConversationById(conversationId);
      if (!row?.conversation.leadId) {
        return undefined;
      }

      const [updated] = await db
        .update(leads)
        .set({
          propertyId,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, row.conversation.leadId))
        .returning();

      return updated;
    },

    async linkCompany(conversationId: string, companyId: string) {
      const row = await this.getConversationById(conversationId);
      if (!row?.conversation.leadId) {
        return undefined;
      }

      const [updated] = await db
        .update(leads)
        .set({
          companyId,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, row.conversation.leadId))
        .returning();

      return updated;
    },

    async createRequirementFromConversation(input: {
      conversationId: string;
      ownerUserId?: string;
      notes?: string;
    }) {
      const row = await this.getConversationById(input.conversationId);
      if (!row) {
        return undefined;
      }

      const [created] = await db
        .insert(requirements)
        .values({
          id: createEntityId("req"),
          leadId: row.conversation.leadId,
          companyId: row.company?.id ?? null,
          contactId: row.contact?.id ?? null,
          ownerUserId: input.ownerUserId ?? null,
          status: "open",
          ...(input.notes ? { notes: input.notes } : {}),
        })
        .returning();

      return created;
    },

    async createTaskFromConversation(input: {
      conversationId: string;
      createdByUserId: string;
      assignedToUserId?: string;
      title: string;
      description?: string;
    }) {
      const row = await this.getConversationById(input.conversationId);
      if (!row) {
        return undefined;
      }

      const [created] = await db
        .insert(tasks)
        .values({
          id: createEntityId("tsk"),
          leadId: row.conversation.leadId,
          createdByUserId: input.createdByUserId,
          ...(input.assignedToUserId
            ? { assignedToUserId: input.assignedToUserId }
            : {}),
          title: input.title,
          ...(input.description ? { description: input.description } : {}),
          status: "todo",
          priority: "medium",
        })
        .returning();

      return created;
    },

    async suppressConversationContact(input: {
      conversationId: string;
      createdByUserId: string;
      reason: "bounced" | "opt_out" | "manual" | "legal";
      notes?: string;
    }) {
      const row = await this.getConversationById(input.conversationId);
      if (!row?.contact?.email) {
        return undefined;
      }

      await db
        .insert(suppressionList)
        .values({
          id: createEntityId("sup"),
          contactId: row.contact.id,
          createdByUserId: input.createdByUserId,
          channel: "email",
          value: row.contact.email,
          reason: input.reason,
          notes: input.notes,
        })
        .onConflictDoNothing();

      await db
        .update(contacts)
        .set({
          suppressionStatus: "suppressed",
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, row.contact.id));

      return conversationRepository.updateById(input.conversationId, {
        inboxCategory: "OPT_OUT",
      });
    },
  };
}

export type InboxRepository = ReturnType<typeof createInboxRepository>;
