import { and, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  conversations,
  deals,
  jobRuns,
  leads,
  matches,
  outreachDrafts,
  pilotFeedback,
  properties,
  requirements,
} from "@/db/schema";

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function createPilotModeRepository(db: PQCommandDb) {
  return {
    async addFeedback(input: {
      workflowKey: string;
      feedbackLabel: "GOOD_AI" | "WRONG" | "MISSING" | "NEEDS_HUMAN";
      notes?: string;
      entityType?: string;
      entityId?: string;
      submittedByUserId?: string;
    }) {
      const [row] = await db
        .insert(pilotFeedback)
        .values({
          id: createEntityId("plf"),
          workflowKey: input.workflowKey,
          feedbackLabel: input.feedbackLabel,
          notes: input.notes,
          entityType: input.entityType,
          entityId: input.entityId,
          submittedByUserId: input.submittedByUserId,
        })
        .returning();

      return row;
    },

    async listFeedbackSummaryForDay(day: Date) {
      const dayStart = startOfUtcDay(day);
      const rows = await db
        .select({
          feedbackLabel: pilotFeedback.feedbackLabel,
          total: count(pilotFeedback.id),
        })
        .from(pilotFeedback)
        .where(gte(pilotFeedback.createdAt, dayStart))
        .groupBy(pilotFeedback.feedbackLabel);

      return rows;
    },

    async workflowQueueCounts(day: Date) {
      const dayStart = startOfUtcDay(day);

      const [overnightLeads, stockToQualify, directDemandReview, outreachApprovals, hotReplies] = await Promise.all([
        db
          .select({ total: count(leads.id) })
          .from(leads)
          .where(
            and(
              gte(leads.createdAt, dayStart),
              inArray(leads.status, ["new", "researching"]),
              isNull(leads.archivedAt),
            ),
          ),
        db
          .select({ total: count(properties.id) })
          .from(properties)
          .where(
            and(
              isNull(properties.archivedAt),
              inArray(properties.companyLetFit, ["review", "strong"]),
              eq(properties.status, "active"),
            ),
          ),
        db
          .select({ total: count(leads.id) })
          .from(leads)
          .where(
            and(
              eq(leads.leadType, "demand"),
              inArray(leads.status, ["new", "researching"]),
              isNull(leads.archivedAt),
            ),
          ),
        db
          .select({ total: count(outreachDrafts.id) })
          .from(outreachDrafts)
          .where(and(eq(outreachDrafts.status, "draft"), isNull(outreachDrafts.archivedAt))),
        db
          .select({ total: count(conversations.id) })
          .from(conversations)
          .where(and(eq(conversations.inboxCategory, "HOT"), eq(conversations.status, "open"))),
      ]);

      const [requirementsCreatedToday, suggestedMatches, viewingBooked, activeDeals, aiErrors] = await Promise.all([
        db
          .select({ total: count(requirements.id) })
          .from(requirements)
          .where(gte(requirements.createdAt, dayStart)),
        db
          .select({ total: count(matches.id) })
          .from(matches)
          .where(eq(matches.status, "suggested")),
        db
          .select({ total: count(matches.id) })
          .from(matches)
          .where(eq(matches.status, "viewing_booked")),
        db
          .select({ total: count(deals.id) })
          .from(deals)
          .where(inArray(deals.status, ["NEGOTIATION", "CONTRACT", "AGREED"])),
        db
          .select({ total: count(jobRuns.id) })
          .from(jobRuns)
          .where(
            and(
              gte(jobRuns.createdAt, dayStart),
              inArray(jobRuns.status, ["failed", "dead_letter"]),
            ),
          ),
      ]);

      return {
        review_overnight_leads: overnightLeads[0]?.total ?? 0,
        qualify_stock: stockToQualify[0]?.total ?? 0,
        review_direct_demand: directDemandReview[0]?.total ?? 0,
        approve_outreach: outreachApprovals[0]?.total ?? 0,
        handle_hot_replies: hotReplies[0]?.total ?? 0,
        create_requirement: requirementsCreatedToday[0]?.total ?? 0,
        review_matches: suggestedMatches[0]?.total ?? 0,
        book_viewing: viewingBooked[0]?.total ?? 0,
        progress_deal: activeDeals[0]?.total ?? 0,
        review_ai_errors: aiErrors[0]?.total ?? 0,
      };
    },

    async listFeedbackEvents(limit = 50) {
      return db
        .select()
        .from(pilotFeedback)
        .orderBy(sql`${pilotFeedback.createdAt} desc`)
        .limit(Math.max(1, Math.min(200, limit)));
    },
  };
}

export type PilotModeRepository = ReturnType<typeof createPilotModeRepository>;
