import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  objectives,
  outreachCampaigns,
  properties,
  requirements,
  shortageIntelligenceRows,
} from "@/db/schema";

export type ShortageFilter = {
  borough?: string;
  area?: string;
  bedroomsMin?: number;
  bedroomsMax?: number;
  unitCountMin?: number;
  budgetBand?: "under_1500" | "1500_2500" | "2500_3500" | "3500_plus";
  availabilityWindow?: "now" | "within_30_days" | "31_90_days" | "future";
};

function compactConditions<T>(values: Array<T | undefined>) {
  return values.filter((value): value is T => value !== undefined);
}

export function createShortageIntelligenceRepository(db: PQCommandDb) {
  return {
    async listActiveDemandRequirements(filter: ShortageFilter) {
      const conditions = compactConditions([
        isNull(requirements.archivedAt),
        eq(requirements.relationshipType, "DIRECT"),
        eq(requirements.directRelationshipVerified, true),
        inArray(requirements.status, ["open", "on_hold"]),
        filter.area ? sql<boolean>`lower(${requirements.preferredArea}) like ${`%${filter.area.toLowerCase()}%`}` : undefined,
        filter.bedroomsMin !== undefined
          ? gte(requirements.bedroomsMin, filter.bedroomsMin)
          : undefined,
        filter.bedroomsMax !== undefined
          ? lte(requirements.bedroomsMax, filter.bedroomsMax)
          : undefined,
        filter.unitCountMin !== undefined
          ? gte(requirements.unitCount, filter.unitCountMin)
          : undefined,
      ]);

      return db.select().from(requirements).where(and(...conditions));
    },

    async listSuitableStock(filter: ShortageFilter) {
      const conditions = compactConditions([
        isNull(properties.archivedAt),
        eq(properties.status, "active"),
        inArray(properties.companyLetFit, ["ideal", "strong", "review"]),
        filter.borough ? eq(properties.borough, filter.borough) : undefined,
        filter.area
          ? sql<boolean>`lower(${properties.city}) like ${`%${filter.area.toLowerCase()}%`} or lower(${properties.borough}) like ${`%${filter.area.toLowerCase()}%`}`
          : undefined,
        filter.bedroomsMin !== undefined
          ? gte(properties.bedrooms, filter.bedroomsMin)
          : undefined,
        filter.bedroomsMax !== undefined
          ? lte(properties.bedrooms, filter.bedroomsMax)
          : undefined,
      ]);

      return db.select().from(properties).where(and(...conditions));
    },

    async upsertShortageRow(input: {
      borough: string | null;
      area: string | null;
      bedroomsBand: string;
      unitCountBand: string;
      budgetBand: string;
      availabilityWindow: string;
      activeDemand: number;
      suitableStock: number;
      estimatedGap: number;
      priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      trace: Record<string, unknown>;
    }) {
      const [row] = await db
        .insert(shortageIntelligenceRows)
        .values({
          id: createEntityId("shr"),
          borough: input.borough,
          area: input.area,
          bedroomsBand: input.bedroomsBand,
          unitCountBand: input.unitCountBand,
          budgetBand: input.budgetBand,
          availabilityWindow: input.availabilityWindow,
          activeDemand: input.activeDemand,
          suitableStock: input.suitableStock,
          estimatedGap: input.estimatedGap,
          priority: input.priority,
          status: "active",
          trace: input.trace,
        })
        .onConflictDoUpdate({
          target: [
            shortageIntelligenceRows.borough,
            shortageIntelligenceRows.area,
            shortageIntelligenceRows.bedroomsBand,
            shortageIntelligenceRows.unitCountBand,
            shortageIntelligenceRows.budgetBand,
            shortageIntelligenceRows.availabilityWindow,
          ],
          set: {
            activeDemand: input.activeDemand,
            suitableStock: input.suitableStock,
            estimatedGap: input.estimatedGap,
            priority: input.priority,
            trace: input.trace,
            status: "active",
            updatedAt: new Date(),
          },
        })
        .returning();

      return row;
    },

    async listShortageRows(filter: ShortageFilter) {
      const conditions = compactConditions([
        isNull(shortageIntelligenceRows.archivedAt),
        eq(shortageIntelligenceRows.status, "active"),
        filter.borough ? eq(shortageIntelligenceRows.borough, filter.borough) : undefined,
        filter.area
          ? sql<boolean>`lower(${shortageIntelligenceRows.area}) like ${`%${filter.area.toLowerCase()}%`}`
          : undefined,
        filter.budgetBand
          ? eq(shortageIntelligenceRows.budgetBand, filter.budgetBand)
          : undefined,
        filter.availabilityWindow
          ? eq(shortageIntelligenceRows.availabilityWindow, filter.availabilityWindow)
          : undefined,
      ]);

      return db.select().from(shortageIntelligenceRows).where(and(...conditions));
    },

    async createObjectiveFromShortage(input: {
      title: string;
      description: string;
      ownerUserId?: string;
      targetValue: number;
      currentValue: number;
    }) {
      const [created] = await db
        .insert(objectives)
        .values({
          id: createEntityId("obj"),
          title: input.title,
          description: input.description,
          ownerUserId: input.ownerUserId ?? null,
          status: "active",
          targetValue: input.targetValue,
          currentValue: input.currentValue,
        })
        .returning();

      return created;
    },

    async createCampaignTarget(input: {
      name: string;
      ownerUserId?: string;
      location?: string | null;
      bedroomsMin?: number;
      bedroomsMax?: number;
      unitCountMin?: number;
      minimumScore: number;
      objective: string;
    }) {
      const [created] = await db
        .insert(outreachCampaigns)
        .values({
          id: createEntityId("cam"),
          name: input.name,
          ownerUserId: input.ownerUserId ?? null,
          channel: "email",
          status: "draft",
          objective: input.objective,
          audience: "shortage_target",
          minimumScore: input.minimumScore,
          location: input.location ?? null,
          bedroomsMin: input.bedroomsMin ?? null,
          bedroomsMax: input.bedroomsMax ?? null,
          unitCountMin: input.unitCountMin ?? null,
          approvalMode: "HUMAN_APPROVAL",
          active: false,
        })
        .returning();

      return created;
    },

    async markShortageConverted(input: {
      shortageId: string;
      objectiveId?: string;
      campaignId?: string;
    }) {
      const [updated] = await db
        .update(shortageIntelligenceRows)
        .set({
          status: "converted",
          convertedObjectiveId: input.objectiveId ?? null,
          convertedCampaignId: input.campaignId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(shortageIntelligenceRows.id, input.shortageId))
        .returning();

      return updated;
    },

    async getShortageById(shortageId: string) {
      const [row] = await db
        .select()
        .from(shortageIntelligenceRows)
        .where(eq(shortageIntelligenceRows.id, shortageId))
        .limit(1);

      return row;
    },
  };
}

export type ShortageIntelligenceRepository = ReturnType<
  typeof createShortageIntelligenceRepository
>;
