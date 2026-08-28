import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  contacts,
  conversations,
  directnessAssessments,
  evidence,
  leads,
  outreachCampaigns,
  outreachDrafts,
  outreachMessages,
  outreachSendAttempts,
  sources,
  suppressionList,
  workerControls,
} from "@/db/schema";

export function createControlledEmailRepository(db: PQCommandDb) {
  return {
    async getSendContext(campaignId: string, leadId: string) {
      const [row] = await db
        .select({
          campaign: outreachCampaigns,
          lead: leads,
          contact: contacts,
          source: sources,
        })
        .from(outreachCampaigns)
        .innerJoin(leads, eq(leads.id, leadId))
        .leftJoin(contacts, eq(contacts.id, leads.contactId))
        .leftJoin(sources, eq(sources.id, leads.sourceId))
        .where(eq(outreachCampaigns.id, campaignId))
        .limit(1);

      if (!row) {
        return null;
      }

      const [evidenceCountRow] = await db
        .select({ count: count(evidence.id) })
        .from(evidence)
        .where(and(eq(evidence.leadId, leadId), isNull(evidence.archivedAt)));

      const [directnessEvidenceCountRow] = await db
        .select({ count: count(directnessAssessments.id) })
        .from(directnessAssessments)
        .where(eq(directnessAssessments.leadId, leadId));

      const [suppressionRow] = row.contact?.email
        ? await db
            .select({ id: suppressionList.id })
            .from(suppressionList)
            .where(
              and(
                eq(suppressionList.channel, "email"),
                eq(suppressionList.value, row.contact.email),
                isNull(suppressionList.archivedAt),
              ),
            )
            .limit(1)
        : [];

      const [optOutRow] = row.contact?.email
        ? await db
            .select({ id: suppressionList.id })
            .from(suppressionList)
            .where(
              and(
                eq(suppressionList.channel, "email"),
                eq(suppressionList.value, row.contact.email),
                eq(suppressionList.reason, "opt_out"),
                isNull(suppressionList.archivedAt),
              ),
            )
            .limit(1)
        : [];

      return {
        ...row,
        evidenceCount: evidenceCountRow?.count ?? 0,
        directnessEvidenceCount: directnessEvidenceCountRow?.count ?? 0,
        suppressed: Boolean(suppressionRow),
        optedOut: Boolean(optOutRow),
      };
    },

    async countRecipientAttemptsSince(recipient: string, since: Date) {
      const [row] = await db
        .select({ count: count(outreachSendAttempts.id) })
        .from(outreachSendAttempts)
        .where(
          and(
            eq(outreachSendAttempts.recipient, recipient),
            gte(outreachSendAttempts.attemptedAt, since),
            inArray(outreachSendAttempts.status, ["queued", "sent"]),
          ),
        );

      return row?.count ?? 0;
    },

    async countLeadAttempts(campaignId: string, leadId: string) {
      const [row] = await db
        .select({ count: count(outreachSendAttempts.id) })
        .from(outreachSendAttempts)
        .where(
          and(
            eq(outreachSendAttempts.campaignId, campaignId),
            eq(outreachSendAttempts.leadId, leadId),
            inArray(outreachSendAttempts.status, ["queued", "sent"]),
          ),
        );

      return row?.count ?? 0;
    },

    async isOutboundKillSwitchActive() {
      const [row] = await db
        .select({ paused: workerControls.paused })
        .from(workerControls)
        .where(eq(workerControls.workerName, "outreach_planning"))
        .limit(1);

      return row?.paused === true;
    },

    async isGlobalLevel3Enabled() {
      const [row] = await db
        .select({ paused: workerControls.paused })
        .from(workerControls)
        .where(eq(workerControls.workerName, "outreach_level3_switch"))
        .limit(1);

      return row?.paused === false;
    },

    async getApprovedDraft(input: { campaignId: string; leadId: string }) {
      const [draft] = await db
        .select()
        .from(outreachDrafts)
        .where(
          and(
            eq(outreachDrafts.campaignId, input.campaignId),
            eq(outreachDrafts.leadId, input.leadId),
            eq(outreachDrafts.status, "approved"),
            isNull(outreachDrafts.archivedAt),
          ),
        )
        .orderBy(desc(outreachDrafts.updatedAt), desc(outreachDrafts.createdAt))
        .limit(1);

      return draft;
    },

    async countDailyAttempts(campaignId: string, startOfDay: Date) {
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

    async hasRecentDuplicateSend(
      campaignId: string,
      recipient: string,
      dedupeKey: string,
      since: Date,
    ) {
      const [row] = await db
        .select({ id: outreachSendAttempts.id })
        .from(outreachSendAttempts)
        .where(
          and(
            eq(outreachSendAttempts.campaignId, campaignId),
            eq(outreachSendAttempts.recipient, recipient),
            eq(outreachSendAttempts.dedupeKey, dedupeKey),
            gte(outreachSendAttempts.attemptedAt, since),
          ),
        )
        .limit(1);

      return Boolean(row);
    },

    async createSendAttempt(input: {
      campaignId: string;
      leadId?: string | null;
      contactId?: string | null;
      conversationId?: string | null;
      outreachMessageId?: string | null;
      recipient: string;
      dedupeKey: string;
      status: "blocked" | "queued" | "sent" | "failed";
      reason?: string;
      policySnapshot: Record<string, unknown>;
      attemptedAt: Date;
    }) {
      const [created] = await db
        .insert(outreachSendAttempts)
        .values({
          id: createEntityId("sat"),
          campaignId: input.campaignId,
          leadId: input.leadId ?? null,
          contactId: input.contactId ?? null,
          conversationId: input.conversationId ?? null,
          outreachMessageId: input.outreachMessageId ?? null,
          recipient: input.recipient,
          dedupeKey: input.dedupeKey,
          status: input.status,
          ...(input.reason ? { reason: input.reason } : {}),
          policySnapshot: input.policySnapshot,
          attemptedAt: input.attemptedAt,
        })
        .onConflictDoNothing()
        .returning();

      return created;
    },

    async createOutreachMessage(input: {
      campaignId: string;
      leadId: string;
      contactId?: string | null;
      createdByUserId?: string;
      subject: string;
      bodyText: string;
      externalMessageId?: string;
      status: "queued" | "sent" | "failed" | "cancelled";
      sentAt?: Date;
    }) {
      const [created] = await db
        .insert(outreachMessages)
        .values({
          id: createEntityId("omg"),
          campaignId: input.campaignId,
          leadId: input.leadId,
          contactId: input.contactId ?? null,
          ...(input.createdByUserId ? { createdByUserId: input.createdByUserId } : {}),
          channel: "email",
          status: input.status,
          subject: input.subject,
          bodyText: input.bodyText,
          ...(input.externalMessageId ? { externalMessageId: input.externalMessageId } : {}),
          ...(input.sentAt ? { sentAt: input.sentAt } : {}),
        })
        .returning();

      return created;
    },

    async findOrCreateConversation(input: {
      leadId: string;
      contactId?: string | null;
      subject?: string;
    }) {
      const [existing] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.leadId, input.leadId),
            input.contactId ? eq(conversations.contactId, input.contactId) : sql`true`,
            isNull(conversations.archivedAt),
          ),
        )
        .orderBy(desc(conversations.updatedAt), desc(conversations.createdAt))
        .limit(1);

      if (existing) {
        return existing;
      }

      const [created] = await db
        .insert(conversations)
        .values({
          id: createEntityId("cnv"),
          leadId: input.leadId,
          contactId: input.contactId ?? null,
          subject: input.subject ?? "Campaign outreach",
          channel: "email",
          status: "open",
          inboxCategory: "UNCLEAR",
          lastMessageAt: new Date(),
        })
        .returning();

      return created;
    },

    async updateConversationOnOutbound(conversationId: string, at: Date) {
      const [updated] = await db
        .update(conversations)
        .set({
          lastMessageAt: at,
          updatedAt: at,
        })
        .where(eq(conversations.id, conversationId))
        .returning();

      return updated;
    },
  };
}

export type ControlledEmailRepository = ReturnType<
  typeof createControlledEmailRepository
>;
