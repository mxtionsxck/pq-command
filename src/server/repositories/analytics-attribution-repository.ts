import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  analyticsFunnelSnapshots,
  conversations,
  deals,
  leads,
  matches,
  outreachMessages,
  properties,
  requirements,
  viewings,
} from "@/db/schema";

export type FunnelMetric =
  | "discovered"
  | "researched_prospect"
  | "qualified"
  | "conversation"
  | "positive_reply"
  | "requirement"
  | "qualified_stock"
  | "match"
  | "viewing"
  | "offer"
  | "completed_deal"
  | "multi_unit_units";

export type FunnelFilter = {
  sourceId?: string;
  campaignId?: string;
  leadType?: "supply" | "demand" | "ai_discovered";
  area?: string;
  bedroomsBand?: string;
  agentUserId?: string;
  periodStart: Date;
  periodEnd: Date;
};

function bedroomsCondition(bedroomsBand: string | undefined) {
  if (!bedroomsBand) {
    return undefined;
  }

  if (bedroomsBand === "4+") {
    return gte(properties.bedrooms, 4);
  }

  const [minRaw, maxRaw] = bedroomsBand.split("-");
  const min = Number.parseInt(minRaw ?? "", 10);
  const max = Number.parseInt(maxRaw ?? "", 10);

  if (Number.isFinite(min) && Number.isFinite(max)) {
    return and(gte(properties.bedrooms, min), lte(properties.bedrooms, max));
  }

  if (Number.isFinite(min)) {
    return eq(properties.bedrooms, min);
  }

  return undefined;
}

export function createAnalyticsAttributionRepository(db: PQCommandDb) {
  return {
    async countMetric(metric: FunnelMetric, filter: FunnelFilter) {
      const bedroomsFilter = bedroomsCondition(filter.bedroomsBand);
      const campaignTouchFilter = filter.campaignId
        ? sql`exists (
            select 1 from outreach_messages om
            where om.lead_id = ${leads.id}
              and om.campaign_id = ${filter.campaignId}
          )`
        : undefined;

      switch (metric) {
        case "discovered": {
          const [row] = await db
            .select({ value: count(leads.id) })
            .from(leads)
            .leftJoin(properties, eq(leads.propertyId, properties.id))
            .where(
              and(
                gte(leads.createdAt, filter.periodStart),
                lte(leads.createdAt, filter.periodEnd),
                filter.sourceId ? eq(leads.sourceId, filter.sourceId) : undefined,
                filter.leadType ? eq(leads.leadType, filter.leadType) : undefined,
                filter.agentUserId ? eq(leads.ownerUserId, filter.agentUserId) : undefined,
                campaignTouchFilter,
                filter.area
                  ? or(eq(properties.city, filter.area), eq(properties.borough, filter.area))
                  : undefined,
                bedroomsFilter,
              ),
            );

          return row?.value ?? 0;
        }
        case "qualified": {
          const [row] = await db
            .select({ value: count(leads.id) })
            .from(leads)
            .leftJoin(properties, eq(leads.propertyId, properties.id))
            .where(
              and(
                eq(leads.status, "qualified"),
                gte(leads.updatedAt, filter.periodStart),
                lte(leads.updatedAt, filter.periodEnd),
                filter.sourceId ? eq(leads.sourceId, filter.sourceId) : undefined,
                filter.leadType ? eq(leads.leadType, filter.leadType) : undefined,
                filter.agentUserId ? eq(leads.ownerUserId, filter.agentUserId) : undefined,
                campaignTouchFilter,
                filter.area
                  ? or(eq(properties.city, filter.area), eq(properties.borough, filter.area))
                  : undefined,
                bedroomsFilter,
              ),
            );

          return row?.value ?? 0;
        }
        case "researched_prospect": {
          const [row] = await db
            .select({ value: count(leads.id) })
            .from(leads)
            .leftJoin(properties, eq(leads.propertyId, properties.id))
            .where(
              and(
                inArray(leads.status, ["researching", "qualified", "nurturing"]),
                gte(leads.updatedAt, filter.periodStart),
                lte(leads.updatedAt, filter.periodEnd),
                filter.sourceId ? eq(leads.sourceId, filter.sourceId) : undefined,
                filter.leadType ? eq(leads.leadType, filter.leadType) : undefined,
                filter.agentUserId ? eq(leads.ownerUserId, filter.agentUserId) : undefined,
                campaignTouchFilter,
                filter.area
                  ? or(eq(properties.city, filter.area), eq(properties.borough, filter.area))
                  : undefined,
                bedroomsFilter,
              ),
            );

          return row?.value ?? 0;
        }
        case "conversation": {
          const [row] = await db
            .select({ value: count(conversations.id) })
            .from(conversations)
            .leftJoin(leads, eq(conversations.leadId, leads.id))
            .leftJoin(properties, eq(leads.propertyId, properties.id))
            .where(
              and(
                gte(conversations.createdAt, filter.periodStart),
                lte(conversations.createdAt, filter.periodEnd),
                filter.sourceId ? eq(leads.sourceId, filter.sourceId) : undefined,
                filter.leadType ? eq(leads.leadType, filter.leadType) : undefined,
                filter.agentUserId ? eq(conversations.ownerUserId, filter.agentUserId) : undefined,
                campaignTouchFilter,
                filter.area
                  ? or(eq(properties.city, filter.area), eq(properties.borough, filter.area))
                  : undefined,
                bedroomsFilter,
              ),
            );

          return row?.value ?? 0;
        }
        case "positive_reply": {
          const [row] = await db
            .select({ value: count(conversations.id) })
            .from(conversations)
            .leftJoin(leads, eq(conversations.leadId, leads.id))
            .leftJoin(properties, eq(leads.propertyId, properties.id))
            .where(
              and(
                inArray(conversations.inboxCategory, ["HOT", "INTERESTED"]),
                gte(conversations.updatedAt, filter.periodStart),
                lte(conversations.updatedAt, filter.periodEnd),
                filter.sourceId ? eq(leads.sourceId, filter.sourceId) : undefined,
                filter.leadType ? eq(leads.leadType, filter.leadType) : undefined,
                filter.agentUserId ? eq(conversations.ownerUserId, filter.agentUserId) : undefined,
                campaignTouchFilter,
                filter.area
                  ? or(eq(properties.city, filter.area), eq(properties.borough, filter.area))
                  : undefined,
                bedroomsFilter,
              ),
            );

          return row?.value ?? 0;
        }
        case "requirement": {
          const [row] = await db
            .select({ value: count(requirements.id) })
            .from(requirements)
            .leftJoin(leads, eq(requirements.leadId, leads.id))
            .where(
              and(
                inArray(requirements.status, ["open", "matched", "closed"]),
                gte(requirements.createdAt, filter.periodStart),
                lte(requirements.createdAt, filter.periodEnd),
                filter.sourceId ? eq(leads.sourceId, filter.sourceId) : undefined,
                filter.leadType ? eq(leads.leadType, filter.leadType) : undefined,
                filter.agentUserId ? eq(requirements.ownerUserId, filter.agentUserId) : undefined,
                campaignTouchFilter,
              ),
            );

          return row?.value ?? 0;
        }
        case "qualified_stock": {
          const [row] = await db
            .select({ value: count(properties.id) })
            .from(properties)
            .where(
              and(
                eq(properties.status, "active"),
                inArray(properties.companyLetFit, ["ideal", "strong"]),
                gte(properties.updatedAt, filter.periodStart),
                lte(properties.updatedAt, filter.periodEnd),
                filter.sourceId ? eq(properties.sourceId, filter.sourceId) : undefined,
                filter.area
                  ? or(eq(properties.city, filter.area), eq(properties.borough, filter.area))
                  : undefined,
                bedroomsFilter,
              ),
            );

          return row?.value ?? 0;
        }
        case "match": {
          const [row] = await db
            .select({ value: count(matches.id) })
            .from(matches)
            .leftJoin(leads, eq(matches.leadId, leads.id))
            .leftJoin(requirements, eq(matches.requirementId, requirements.id))
            .leftJoin(properties, eq(matches.propertyId, properties.id))
            .where(
              and(
                inArray(matches.status, ["suggested", "contacted", "viewing_booked", "won"]),
                gte(matches.createdAt, filter.periodStart),
                lte(matches.createdAt, filter.periodEnd),
                filter.sourceId ? eq(leads.sourceId, filter.sourceId) : undefined,
                filter.leadType ? eq(leads.leadType, filter.leadType) : undefined,
                filter.agentUserId
                  ? eq(requirements.ownerUserId, filter.agentUserId)
                  : undefined,
                campaignTouchFilter,
                filter.area
                  ? or(eq(properties.city, filter.area), eq(properties.borough, filter.area))
                  : undefined,
                bedroomsFilter,
              ),
            );

          return row?.value ?? 0;
        }
        case "viewing": {
          const [row] = await db
            .select({ value: count(viewings.id) })
            .from(viewings)
            .leftJoin(matches, eq(viewings.matchId, matches.id))
            .leftJoin(leads, eq(matches.leadId, leads.id))
            .leftJoin(properties, eq(viewings.propertyId, properties.id))
            .where(
              and(
                inArray(viewings.status, ["scheduled", "confirmed", "completed"]),
                gte(viewings.scheduledFor, filter.periodStart),
                lte(viewings.scheduledFor, filter.periodEnd),
                filter.sourceId ? eq(leads.sourceId, filter.sourceId) : undefined,
                filter.leadType ? eq(leads.leadType, filter.leadType) : undefined,
                filter.agentUserId
                  ? eq(viewings.scheduledByUserId, filter.agentUserId)
                  : undefined,
                campaignTouchFilter,
                filter.area
                  ? or(eq(properties.city, filter.area), eq(properties.borough, filter.area))
                  : undefined,
                bedroomsFilter,
              ),
            );

          return row?.value ?? 0;
        }
        case "offer": {
          const [row] = await db
            .select({ value: count(deals.id) })
            .from(deals)
            .leftJoin(leads, eq(deals.leadId, leads.id))
            .leftJoin(properties, eq(deals.propertyId, properties.id))
            .where(
              and(
                inArray(deals.status, ["OFFER", "NEGOTIATION", "AGREED", "CONTRACT", "LIVE", "COMPLETED"]),
                gte(deals.updatedAt, filter.periodStart),
                lte(deals.updatedAt, filter.periodEnd),
                filter.sourceId ? eq(leads.sourceId, filter.sourceId) : undefined,
                filter.leadType ? eq(leads.leadType, filter.leadType) : undefined,
                filter.agentUserId ? eq(deals.ownerUserId, filter.agentUserId) : undefined,
                campaignTouchFilter,
                filter.area
                  ? or(eq(properties.city, filter.area), eq(properties.borough, filter.area))
                  : undefined,
                bedroomsFilter,
              ),
            );

          return row?.value ?? 0;
        }
        case "completed_deal": {
          const [row] = await db
            .select({ value: count(deals.id) })
            .from(deals)
            .leftJoin(leads, eq(deals.leadId, leads.id))
            .leftJoin(properties, eq(deals.propertyId, properties.id))
            .where(
              and(
                eq(deals.status, "COMPLETED"),
                gte(deals.updatedAt, filter.periodStart),
                lte(deals.updatedAt, filter.periodEnd),
                filter.sourceId ? eq(leads.sourceId, filter.sourceId) : undefined,
                filter.leadType ? eq(leads.leadType, filter.leadType) : undefined,
                filter.agentUserId ? eq(deals.ownerUserId, filter.agentUserId) : undefined,
                campaignTouchFilter,
                filter.area
                  ? or(eq(properties.city, filter.area), eq(properties.borough, filter.area))
                  : undefined,
                bedroomsFilter,
              ),
            );

          return row?.value ?? 0;
        }
        case "multi_unit_units": {
          const [row] = await db
            .select({
              value: sql<number>`coalesce(sum(case when ${requirements.unitCount} > 1 then ${requirements.unitCount} else 0 end), 0)`,
            })
            .from(requirements)
            .leftJoin(leads, eq(requirements.leadId, leads.id))
            .where(
              and(
                inArray(requirements.status, ["open", "matched", "closed"]),
                gte(requirements.createdAt, filter.periodStart),
                lte(requirements.createdAt, filter.periodEnd),
                filter.sourceId ? eq(leads.sourceId, filter.sourceId) : undefined,
                filter.leadType ? eq(leads.leadType, filter.leadType) : undefined,
                filter.agentUserId ? eq(requirements.ownerUserId, filter.agentUserId) : undefined,
                campaignTouchFilter,
              ),
            );

          return Number(row?.value ?? 0);
        }
      }
    },

    async createSnapshot(input: {
      metric: FunnelMetric;
      value: number;
      filter: FunnelFilter;
      trace: Record<string, unknown>;
    }) {
      const [created] = await db
        .insert(analyticsFunnelSnapshots)
        .values({
          id: createEntityId("afs"),
          ...(input.filter.sourceId ? { sourceId: input.filter.sourceId } : {}),
          ...(input.filter.campaignId ? { campaignId: input.filter.campaignId } : {}),
          ...(input.filter.leadType ? { leadType: input.filter.leadType } : {}),
          ...(input.filter.area ? { area: input.filter.area } : {}),
          ...(input.filter.bedroomsBand ? { bedroomsBand: input.filter.bedroomsBand } : {}),
          ...(input.filter.agentUserId ? { agentUserId: input.filter.agentUserId } : {}),
          periodStart: input.filter.periodStart,
          periodEnd: input.filter.periodEnd,
          metric: input.metric,
          value: input.value,
          trace: input.trace,
        })
        .returning();

      return created;
    },

    async listLatestSnapshots(periodStart: Date, periodEnd: Date) {
      return db
        .select()
        .from(analyticsFunnelSnapshots)
        .where(
          and(
            gte(analyticsFunnelSnapshots.periodStart, periodStart),
            lte(analyticsFunnelSnapshots.periodEnd, periodEnd),
          ),
        )
        .orderBy(desc(analyticsFunnelSnapshots.createdAt))
        .limit(200);
    },

    async hasCampaignTouch(leadId: string, campaignId: string) {
      const [row] = await db
        .select({ id: outreachMessages.id })
        .from(outreachMessages)
        .where(
          and(
            eq(outreachMessages.leadId, leadId),
            eq(outreachMessages.campaignId, campaignId),
          ),
        )
        .limit(1);

      return Boolean(row);
    },
  };
}

export type AnalyticsAttributionRepository = ReturnType<
  typeof createAnalyticsAttributionRepository
>;
