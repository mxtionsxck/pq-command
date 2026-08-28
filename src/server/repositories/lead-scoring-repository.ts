import { and, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import type { NewLeadScoringConfig } from "@/db/models";
import {
  aiConclusions,
  contacts,
  evidence,
  leadScoringConfigs,
  leads,
  properties,
  sources,
} from "@/db/schema";

import { createRepository } from "./base-repository";

export function createLeadScoringRepository(db: PQCommandDb) {
  const configRepository = createRepository(db, leadScoringConfigs, "lsc");

  return {
    async listConfigs() {
      return db
        .select()
        .from(leadScoringConfigs)
        .where(isNull(leadScoringConfigs.archivedAt))
        .orderBy(desc(leadScoringConfigs.createdAt))
        .limit(100);
    },

    async getActiveConfig() {
      const [config] = await db
        .select()
        .from(leadScoringConfigs)
        .where(
          and(
            eq(leadScoringConfigs.active, true),
            isNull(leadScoringConfigs.archivedAt),
          ),
        )
        .orderBy(desc(leadScoringConfigs.createdAt))
        .limit(1);

      return config;
    },

    async findConfigByVersion(version: string) {
      const [config] = await db
        .select()
        .from(leadScoringConfigs)
        .where(eq(leadScoringConfigs.version, version))
        .limit(1);

      return config;
    },

    async saveConfig(
      input: Omit<NewLeadScoringConfig, "id" | "createdAt" | "updatedAt"> & {
        id?: string;
      },
    ) {
      const existing = await this.findConfigByVersion(input.version);

      if (existing) {
        const [updated] = await db
          .update(leadScoringConfigs)
          .set({
            createdByUserId: input.createdByUserId,
            active: input.active ?? existing.active,
            weights: input.weights,
            thresholds: input.thresholds,
            notes: input.notes ?? null,
            archivedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(leadScoringConfigs.id, existing.id))
          .returning();

        return updated;
      }

      return configRepository.create(
        input as Parameters<typeof configRepository.create>[0],
      );
    },

    async setConfigActive(configId: string) {
      await db
        .update(leadScoringConfigs)
        .set({ active: false, updatedAt: new Date() })
        .where(
          and(
            eq(leadScoringConfigs.active, true),
            isNull(leadScoringConfigs.archivedAt),
          ),
        );

      const [activeConfig] = await db
        .update(leadScoringConfigs)
        .set({ active: true, updatedAt: new Date() })
        .where(eq(leadScoringConfigs.id, configId))
        .returning();

      return activeConfig;
    },

    async getLeadScoringInput(leadId: string) {
      const [leadRow] = await db
        .select({
          lead: leads,
          propertyCompanyLetFit: properties.companyLetFit,
          propertyCity: properties.city,
          propertyPostcode: properties.postcode,
          propertyBedrooms: properties.bedrooms,
          contactConfidence: contacts.confidence,
          contactSuppressionStatus: contacts.suppressionStatus,
          contactEmail: contacts.email,
          contactPhone: contacts.phone,
          sourceKind: sources.kind,
        })
        .from(leads)
        .leftJoin(properties, eq(properties.id, leads.propertyId))
        .leftJoin(contacts, eq(contacts.id, leads.contactId))
        .leftJoin(sources, eq(sources.id, leads.sourceId))
        .where(eq(leads.id, leadId))
        .limit(1);

      if (!leadRow) {
        return null;
      }

      const [evidenceStats] = await db
        .select({
          evidenceCount: sql<number>`count(*)::int`,
          latestDetectedAt: max(evidence.detectedAt),
        })
        .from(evidence)
        .where(and(eq(evidence.leadId, leadId), isNull(evidence.archivedAt)));

      const [conclusionStats] = await db
        .select({
          supportedCount: sql<number>`count(*)::int`,
        })
        .from(aiConclusions)
        .where(
          and(
            eq(aiConclusions.leadId, leadId),
            eq(aiConclusions.supported, true),
            isNull(aiConclusions.archivedAt),
          ),
        );

      return {
        ...leadRow,
        evidenceCount: evidenceStats?.evidenceCount ?? 0,
        latestEvidenceAt: evidenceStats?.latestDetectedAt ?? null,
        supportedConclusionCount: conclusionStats?.supportedCount ?? 0,
      };
    },

    async updateLeadScore(
      leadId: string,
      input: {
        score: number;
        confidence: number;
        scoreVersion: string;
        lastScoredAt: Date;
      },
    ) {
      const [lead] = await db
        .update(leads)
        .set({
          score: input.score,
          confidence: input.confidence,
          scoreVersion: input.scoreVersion,
          lastScoredAt: input.lastScoredAt,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, leadId))
        .returning();

      return lead;
    },

    async listLeadsByIds(leadIds: string[]) {
      if (leadIds.length === 0) {
        return [];
      }

      return db.select().from(leads).where(inArray(leads.id, leadIds));
    },
  };
}

export type LeadScoringRepository = ReturnType<
  typeof createLeadScoringRepository
>;
