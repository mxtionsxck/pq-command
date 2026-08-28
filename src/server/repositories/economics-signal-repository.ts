import { and, desc, eq, isNull } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  economicsSignals,
  lhaRates,
  notifications,
  properties,
} from "@/db/schema";

export function createEconomicsSignalRepository(db: PQCommandDb) {
  return {
    async createLhaRate(input: Omit<typeof lhaRates.$inferInsert, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
      const [created] = await db
        .insert(lhaRates)
        .values({
          ...input,
          id: input.id ?? createEntityId("lha"),
        })
        .returning();

      return created;
    },

    async findLhaRate(input: {
      borough?: string | null;
      area?: string | null;
      bedroomBand: string;
      rateVersion?: string;
    }) {
      const [row] = await db
        .select()
        .from(lhaRates)
        .where(
          and(
            input.borough ? eq(lhaRates.borough, input.borough) : isNull(lhaRates.borough),
            input.area ? eq(lhaRates.area, input.area) : isNull(lhaRates.area),
            eq(lhaRates.bedroomBand, input.bedroomBand),
            input.rateVersion
              ? eq(lhaRates.rateVersion, input.rateVersion)
              : eq(lhaRates.sourceApproved, true),
            isNull(lhaRates.archivedAt),
          ),
        )
        .orderBy(desc(lhaRates.rateDate), desc(lhaRates.createdAt))
        .limit(1);

      return row;
    },

    async getProperty(propertyId: string) {
      const [row] = await db
        .select()
        .from(properties)
        .where(and(eq(properties.id, propertyId), isNull(properties.archivedAt)))
        .limit(1);

      return row;
    },

    async upsertEconomicsSignal(input: {
      propertyId: string;
      lhaRateId: string;
      bedroomBand: string;
      knownRentCents: number;
      lhaRateCents: number;
      differenceCents: number;
      signalStatus: "new" | "informational" | "reviewed" | "dismissed";
      notifyEnabled: boolean;
      notes?: string;
    }) {
      const [created] = await db
        .insert(economicsSignals)
        .values({
          id: createEntityId("eco"),
          propertyId: input.propertyId,
          lhaRateId: input.lhaRateId,
          bedroomBand: input.bedroomBand,
          knownRentCents: input.knownRentCents,
          lhaRateCents: input.lhaRateCents,
          differenceCents: input.differenceCents,
          signalStatus: input.signalStatus,
          notifyEnabled: input.notifyEnabled,
          ...(input.notes ? { notes: input.notes } : {}),
        })
        .onConflictDoUpdate({
          target: [economicsSignals.propertyId, economicsSignals.lhaRateId],
          set: {
            bedroomBand: input.bedroomBand,
            knownRentCents: input.knownRentCents,
            lhaRateCents: input.lhaRateCents,
            differenceCents: input.differenceCents,
            signalStatus: input.signalStatus,
            notifyEnabled: input.notifyEnabled,
            ...(input.notes ? { notes: input.notes } : {}),
            updatedAt: new Date(),
          },
        })
        .returning();

      return created;
    },

    async createNotification(input: {
      userId: string;
      title: string;
      body: string;
      linkHref?: string;
    }) {
      const [created] = await db
        .insert(notifications)
        .values({
          id: createEntityId("ntf"),
          userId: input.userId,
          title: input.title,
          body: input.body,
          ...(input.linkHref ? { linkHref: input.linkHref } : {}),
          status: "unread",
        })
        .returning();

      return created;
    },

    async listSignals() {
      return db
        .select({
          signal: economicsSignals,
          rate: lhaRates,
          property: properties,
        })
        .from(economicsSignals)
        .innerJoin(lhaRates, eq(lhaRates.id, economicsSignals.lhaRateId))
        .innerJoin(properties, eq(properties.id, economicsSignals.propertyId))
        .where(isNull(economicsSignals.archivedAt))
        .orderBy(desc(economicsSignals.updatedAt), desc(economicsSignals.createdAt));
    },
  };
}

export type EconomicsSignalRepository = ReturnType<
  typeof createEconomicsSignalRepository
>;
