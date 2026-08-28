import { and, desc, eq, isNull } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  contacts,
  conversations,
  messages,
  replyFactTypeEnum,
  replyIntelligenceEvents,
  requirements,
  suppressionList,
} from "@/db/schema";

export type ReplyFactType = (typeof replyFactTypeEnum.enumValues)[number];

export interface ExtractedReplyFact {
  type: ReplyFactType;
  value: string;
  confidence: number;
  sourceMessageId: string;
}

export function createReplyIntelligenceRepository(db: PQCommandDb) {
  return {
    async getMessageContext(messageId: string) {
      const [row] = await db
        .select({
          message: messages,
          conversation: conversations,
          contact: contacts,
        })
        .from(messages)
        .leftJoin(conversations, eq(conversations.id, messages.conversationId))
        .leftJoin(contacts, eq(contacts.id, conversations.contactId))
        .where(eq(messages.id, messageId))
        .limit(1);

      return row;
    },

    async findRequirementByLead(leadId: string | null) {
      if (!leadId) {
        return undefined;
      }

      const [row] = await db
        .select()
        .from(requirements)
        .where(and(eq(requirements.leadId, leadId), isNull(requirements.archivedAt)))
        .orderBy(desc(requirements.updatedAt), desc(requirements.createdAt))
        .limit(1);

      return row;
    },

    async createRequirementForLead(input: {
      leadId: string;
      companyId?: string | null;
      contactId?: string | null;
      ownerUserId?: string | null;
      notes?: string;
    }) {
      const [created] = await db
        .insert(requirements)
        .values({
          id: createEntityId("req"),
          leadId: input.leadId,
          companyId: input.companyId ?? null,
          contactId: input.contactId ?? null,
          ownerUserId: input.ownerUserId ?? null,
          status: "open",
          ...(input.notes ? { notes: input.notes } : {}),
        })
        .returning();

      return created;
    },

    async updateRequirement(
      requirementId: string,
      patch: Partial<typeof requirements.$inferInsert>,
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

    async updateConversationCategory(
      conversationId: string,
      category:
        | "HOT"
        | "INTERESTED"
        | "FUTURE"
        | "QUESTION"
        | "UNCLEAR"
        | "NOT_INTERESTED"
        | "OPT_OUT",
      aiSummary?: string,
    ) {
      const [updated] = await db
        .update(conversations)
        .set({
          inboxCategory: category,
          ...(aiSummary ? { aiSummary } : {}),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId))
        .returning();

      return updated;
    },

    async createReplyIntelligenceEvent(input: {
      conversationId: string;
      messageId: string;
      leadId?: string | null;
      intent:
        | "HOT"
        | "INTERESTED"
        | "FUTURE"
        | "QUESTION"
        | "UNCLEAR"
        | "NOT_INTERESTED"
        | "OPT_OUT";
      confidence: number;
      extractedFacts: ExtractedReplyFact[];
    }) {
      const [created] = await db
        .insert(replyIntelligenceEvents)
        .values({
          id: createEntityId("rie"),
          conversationId: input.conversationId,
          messageId: input.messageId,
          leadId: input.leadId ?? null,
          intent: input.intent,
          confidence: input.confidence,
          extractedFacts: input.extractedFacts,
        })
        .onConflictDoUpdate({
          target: replyIntelligenceEvents.messageId,
          set: {
            intent: input.intent,
            confidence: input.confidence,
            extractedFacts: input.extractedFacts,
            updatedAt: new Date(),
          },
        })
        .returning();

      return created;
    },

    async suppressContactImmediately(input: {
      contactId: string;
      email: string;
      createdByUserId?: string;
      notes?: string;
    }) {
      await db
        .insert(suppressionList)
        .values({
          id: createEntityId("sup"),
          contactId: input.contactId,
          createdByUserId: input.createdByUserId ?? null,
          channel: "email",
          value: input.email,
          reason: "opt_out",
          ...(input.notes ? { notes: input.notes } : {}),
        })
        .onConflictDoNothing();

      await db
        .update(contacts)
        .set({
          suppressionStatus: "suppressed",
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, input.contactId));
    },
  };
}

export type ReplyIntelligenceRepository = ReturnType<
  typeof createReplyIntelligenceRepository
>;
