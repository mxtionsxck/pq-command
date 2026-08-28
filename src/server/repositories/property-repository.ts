import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
} from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import type { NewProperty, Property } from "@/db/models";
import { propertyMedia, properties } from "@/db/schema";
import type {
  PropertyFilters,
  StockRoomPropertyCard,
} from "@/domain/property/types";

import { createRepository } from "./base-repository";

type NewPropertyInput = Omit<NewProperty, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

function compactConditions<T>(values: Array<T | undefined>): T[] {
  return values.filter((value): value is T => value !== undefined);
}

export function createPropertyRepository(db: PQCommandDb) {
  const baseRepository = createRepository(db, properties, "prp");

  return {
    ...baseRepository,

    async listStockRoom(
      filters: PropertyFilters = {},
      pagination?: { limit?: number; offset?: number },
    ): Promise<StockRoomPropertyCard[]> {
      const conditions = compactConditions([
        filters.status ? eq(properties.status, filters.status) : undefined,
        !filters.status ? isNull(properties.archivedAt) : undefined,
        filters.availability
          ? eq(properties.availability, filters.availability)
          : undefined,
        filters.companyLetFit
          ? eq(properties.companyLetFit, filters.companyLetFit)
          : undefined,
        filters.minBedrooms
          ? gte(properties.bedrooms, filters.minBedrooms)
          : undefined,
        filters.minRentCents
          ? gte(properties.monthlyRentCents, filters.minRentCents)
          : undefined,
        filters.maxRentCents
          ? lte(properties.monthlyRentCents, filters.maxRentCents)
          : undefined,
        filters.area
          ? or(
              ilike(properties.borough, `%${filters.area}%`),
              ilike(properties.city, `%${filters.area}%`),
              ilike(properties.postcode, `%${filters.area}%`),
            )
          : undefined,
        filters.search
          ? or(
              ilike(properties.title, `%${filters.search}%`),
              ilike(properties.addressLine1, `%${filters.search}%`),
              ilike(properties.postcode, `%${filters.search}%`),
              ilike(properties.city, `%${filters.search}%`),
              ilike(properties.borough, `%${filters.search}%`),
            )
          : undefined,
      ]);

      const rows = await db
        .select()
        .from(properties)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(properties.updatedAt), desc(properties.createdAt))
        .limit(Math.max(1, Math.min(100, pagination?.limit ?? 24)))
        .offset(Math.max(0, pagination?.offset ?? 0));

      if (rows.length === 0) {
        return [];
      }

      const propertyIds = rows.map((row) => row.id);
      const mediaRows = await db
        .select({
          propertyId: propertyMedia.propertyId,
          storageKey: propertyMedia.storageKey,
          altText: propertyMedia.altText,
        })
        .from(propertyMedia)
        .where(
          and(
            inArray(propertyMedia.propertyId, propertyIds),
            eq(propertyMedia.kind, "image"),
            isNull(propertyMedia.archivedAt),
          ),
        )
        .orderBy(asc(propertyMedia.sortOrder), asc(propertyMedia.createdAt));

      const heroByPropertyId = new Map<
        string,
        {
          storageKey: string;
          altText: string | null;
        }
      >();

      for (const media of mediaRows) {
        if (!heroByPropertyId.has(media.propertyId)) {
          heroByPropertyId.set(media.propertyId, {
            storageKey: media.storageKey,
            altText: media.altText,
          });
        }
      }

      return rows.map((row) => {
        const hero = heroByPropertyId.get(row.id);

        return {
          ...row,
          heroMediaKey: hero?.storageKey ?? null,
          heroAltText: hero?.altText ?? null,
        };
      });
    },

    async archiveById(id: string): Promise<Property | undefined> {
      const [property] = await db
        .update(properties)
        .set({
          archivedAt: new Date(),
          status: "archived",
          updatedAt: new Date(),
        })
        .where(eq(properties.id, id))
        .returning();

      return property;
    },

    async createWithDefaults(input: NewPropertyInput): Promise<Property> {
      return baseRepository.create({
        ...input,
        id: input.id ?? createEntityId("prp"),
      });
    },
  };
}

export type PropertyRepository = ReturnType<typeof createPropertyRepository>;
