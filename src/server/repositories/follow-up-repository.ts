import { and, count, desc, eq, gte, inArray, isNull } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  contacts,
  conversations,
  followUpQueue,
  leads,
  messages,
  outreachCampaigns,
  outreachSendAttempts,
  suppressionList,
} from "@/db/schema";

export function createFollowUpRepository(db: PQCommandDb) {
  return {
    async getCampaignLeadContext(campaignId: string, leadId: string) {
      const [row] = await db
        .select({
          campaign: outreachCampaigns,
          lead: leads,
          contact: contacts,
        })
        .from(outreachCampaigns)
        .innerJoin(leads, eq(leads.id, leadId))
        .leftJoin(contacts, eq(contacts.id, leads.contactId))
        .where(eq(outreachCampaigns.id, campaignId))
        .limit(1);

      return row;
    },

    async hasInboundReply(leadId: string, contactId?: string | null) {
      const [conversation] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.leadId, leadId),
            contactId ? eq(conversations.contactId, contactId) : isNull(conversations.contactId),
            isNull(conversations.archivedAt),
          ),
        )
        .limit(1);

      if (!conversation) {
        return false;
      }

      const [reply] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversation.id),
            eq(messages.direction, "inbound"),
          ),
        )
        .limit(1);

      return Boolean(reply);
    },

    async isOptedOut(email?: string | null) {
      if (!email) {
        return false;
      }

      const [row] = await db
        .select({ id: suppressionList.id })
        .from(suppressionList)
        .where(
          and(
            eq(suppressionList.channel, "email"),
            eq(suppressionList.value, email.toLowerCase()),
            isNull(suppressionList.archivedAt),
          ),
        )
        .limit(1);

      return Boolean(row);
    },

    async countQueuedForDay(campaignId: string, startOfDay: Date) {
      const [row] = await db
        .select({ count: count(followUpQueue.id) })
        .from(followUpQueue)
        .where(
          and(
            eq(followUpQueue.campaignId, campaignId),
            eq(followUpQueue.status, "scheduled"),
            gte(followUpQueue.scheduledFor, startOfDay),
          ),
        );

      return row?.count ?? 0;
    },

    async countSentAttemptsForDay(campaignId: string, startOfDay: Date) {
      const [row] = await db
        .select({ count: count(outreachSendAttempts.id) })
        .from(outreachSendAttempts)
        .where(
          and(
            eq(outreachSendAttempts.campaignId, campaignId),
            gte(outreachSendAttempts.attemptedAt, startOfDay),
            inArray(outreachSendAttempts.status, ["queued", "sent"]),
          ),
        );

      return row?.count ?? 0;
    },

    async upsertFollowUp(input: {
      campaignId: string;
      leadId: string;
      conversationId?: string | null;
      stepKey: string;
      scheduledFor: Date;
      dedupeKey: string;
      status?: "scheduled" | "cancelled" | "sent";
      reason?: string;
    }) {
      const [created] = await db
        .insert(followUpQueue)
        .values({
          id: createEntityId("fuq"),
          campaignId: input.campaignId,
          leadId: input.leadId,
          conversationId: input.conversationId ?? null,
          stepKey: input.stepKey,
          scheduledFor: input.scheduledFor,
          dedupeKey: input.dedupeKey,
          status: input.status ?? "scheduled",
          ...(input.reason ? { reason: input.reason } : {}),
        })
        .onConflictDoNothing()
        .returning();

      return created;
    },

    async listFollowUps(campaignId: string, leadId: string) {
      return db
        .select()
        .from(followUpQueue)
        .where(
          and(
            eq(followUpQueue.campaignId, campaignId),
            eq(followUpQueue.leadId, leadId),
          ),
        )
        .orderBy(desc(followUpQueue.scheduledFor));
    },
  };
}

export type FollowUpRepository = ReturnType<typeof createFollowUpRepository>;
