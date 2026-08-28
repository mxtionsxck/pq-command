import { and, eq, inArray, isNull } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import { matches, properties, requirements } from "@/db/schema";

export function createMatchingRepository(db: PQCommandDb) {
  return {
    async getRequirement(requirementId: string) {
      const [row] = await db
        .select()
        .from(requirements)
        .where(and(eq(requirements.id, requirementId), isNull(requirements.archivedAt)))
        .limit(1);

      return row;
    },

    async listCandidateProperties() {
      return db
        .select()
        .from(properties)
        .where(and(eq(properties.status, "active"), isNull(properties.archivedAt)));
    },

    async findExistingMatch(requirementId: string, propertyId: string) {
      const [row] = await db
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.requirementId, requirementId),
            eq(matches.propertyId, propertyId),
            isNull(matches.archivedAt),
          ),
        )
        .limit(1);

      return row;
    },

    async upsertMatch(input: {
      requirementId: string;
      propertyId: string;
      leadId?: string | null;
      score: number;
      confidence: number;
      matchVersion: string;
      rationale: Record<string, unknown>;
    }) {
      const existing = await this.findExistingMatch(input.requirementId, input.propertyId);

      if (existing) {
        const [updated] = await db
          .update(matches)
          .set({
            score: input.score,
            confidence: input.confidence,
            matchVersion: input.matchVersion,
            rationale: input.rationale,
            status: "suggested",
            updatedAt: new Date(),
          })
          .where(eq(matches.id, existing.id))
          .returning();

        return updated;
      }

      const [created] = await db
        .insert(matches)
        .values({
          id: createEntityId("mat"),
          requirementId: input.requirementId,
          propertyId: input.propertyId,
          leadId: input.leadId ?? null,
          score: input.score,
          confidence: input.confidence,
          matchVersion: input.matchVersion,
          status: "suggested",
          rationale: input.rationale,
        })
        .returning();

      return created;
    },

    async listMatchesByRequirement(requirementId: string) {
      return db
        .select()
        .from(matches)
        .where(
          and(eq(matches.requirementId, requirementId), isNull(matches.archivedAt)),
        );
    },

    async listMatchesByIds(matchIds: string[]) {
      if (matchIds.length === 0) {
        return [];
      }

      return db.select().from(matches).where(inArray(matches.id, matchIds));
    },
  };
}

export type MatchingRepository = ReturnType<typeof createMatchingRepository>;
