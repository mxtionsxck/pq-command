import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import { evidence, leads, outreachDrafts } from "@/db/schema";

export function createOutreachDraftingRepository(db: PQCommandDb) {
  type DraftCreateInput = Omit<
    typeof outreachDrafts.$inferInsert,
    "id" | "createdAt" | "updatedAt"
  > & {
    id?: string;
  };

  return {
    async findLeadById(leadId: string) {
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1);
      return lead;
    },

    async listEvidenceByLead(leadId: string) {
      return db
        .select()
        .from(evidence)
        .where(and(eq(evidence.leadId, leadId), isNull(evidence.archivedAt)))
        .orderBy(desc(evidence.detectedAt), desc(evidence.createdAt))
        .limit(30);
    },

    async listEvidenceByIds(evidenceIds: string[]) {
      if (evidenceIds.length === 0) {
        return [];
      }

      return db
        .select()
        .from(evidence)
        .where(
          and(inArray(evidence.id, evidenceIds), isNull(evidence.archivedAt)),
        );
    },

    async createDraft(input: DraftCreateInput) {
      const [created] = await db
        .insert(outreachDrafts)
        .values({
          ...input,
          id: input.id ?? createEntityId("drf"),
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create outreach draft.");
      }

      return created;
    },

    async updateDraft(
      draftId: string,
      input: Partial<typeof outreachDrafts.$inferInsert>,
    ) {
      const [updated] = await db
        .update(outreachDrafts)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(outreachDrafts.id, draftId))
        .returning();

      return updated;
    },

    async findDraftById(draftId: string) {
      const [draft] = await db
        .select()
        .from(outreachDrafts)
        .where(eq(outreachDrafts.id, draftId))
        .limit(1);

      return draft;
    },
  };
}

export type OutreachDraftingRepository = ReturnType<
  typeof createOutreachDraftingRepository
>;
