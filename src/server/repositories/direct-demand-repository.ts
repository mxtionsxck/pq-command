import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import { evidence, leads, requirements, signals, sources } from "@/db/schema";

export function createDirectDemandRepository(db: PQCommandDb) {
  type RequirementCreateInput = Omit<
    typeof requirements.$inferInsert,
    "id" | "createdAt" | "updatedAt"
  > & {
    id?: string;
  };

  return {
    async getLeadContext(leadId: string) {
      const [leadRow] = await db
        .select({
          lead: leads,
          sourceName: sources.name,
          sourceKind: sources.kind,
        })
        .from(leads)
        .leftJoin(sources, eq(sources.id, leads.sourceId))
        .where(eq(leads.id, leadId))
        .limit(1);

      if (!leadRow) {
        return null;
      }

      const leadEvidence = await db
        .select()
        .from(evidence)
        .where(and(eq(evidence.leadId, leadId), isNull(evidence.archivedAt)))
        .orderBy(desc(evidence.detectedAt), desc(evidence.createdAt))
        .limit(25);

      const leadSignals = await db
        .select()
        .from(signals)
        .where(eq(signals.leadId, leadId))
        .orderBy(desc(signals.detectedAt), desc(signals.createdAt))
        .limit(25);

      const existingRequirement = await db
        .select()
        .from(requirements)
        .where(
          and(eq(requirements.leadId, leadId), isNull(requirements.archivedAt)),
        )
        .orderBy(desc(requirements.updatedAt), desc(requirements.createdAt))
        .limit(1)
        .then((rows) => rows[0]);

      return {
        leadRow,
        leadEvidence,
        leadSignals,
        existingRequirement,
      };
    },

    async createRequirement(input: RequirementCreateInput) {
      const [created] = await db
        .insert(requirements)
        .values({
          ...input,
          id: input.id ?? createEntityId("req"),
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create requirement.");
      }

      return created;
    },

    async updateRequirement(
      requirementId: string,
      input: Partial<typeof requirements.$inferInsert>,
    ) {
      const [updated] = await db
        .update(requirements)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(requirements.id, requirementId))
        .returning();

      return updated;
    },

    async applyDirectPriorityBoost(leadId: string, boostAmount: number) {
      const [updated] = await db
        .update(leads)
        .set({
          score: sql`${leads.score} + ${boostAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, leadId))
        .returning();

      return updated;
    },
  };
}

export type DirectDemandRepository = ReturnType<
  typeof createDirectDemandRepository
>;
