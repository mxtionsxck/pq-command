import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import type { NewAiConclusion, NewEvidence } from "@/db/models";
import { aiConclusions, evidence } from "@/db/schema";

import { createRepository } from "./base-repository";

export function createEvidenceRepository(db: PQCommandDb) {
  const evidenceRepository = createRepository(db, evidence, "evd");
  const conclusionRepository = createRepository(db, aiConclusions, "aic");

  return {
    async createEvidence(
      input: Omit<NewEvidence, "id" | "createdAt" | "updatedAt"> & {
        id?: string;
      },
    ) {
      return evidenceRepository.create(
        input as Parameters<typeof evidenceRepository.create>[0],
      );
    },

    async findEvidenceBySignalReference(
      signalId: string,
      sourceReference: string,
    ) {
      const [item] = await db
        .select()
        .from(evidence)
        .where(
          and(
            eq(evidence.signalId, signalId),
            eq(evidence.sourceReference, sourceReference),
            isNull(evidence.archivedAt),
          ),
        )
        .limit(1);

      return item;
    },

    async listLeadEvidence(leadId: string) {
      return db
        .select()
        .from(evidence)
        .where(and(eq(evidence.leadId, leadId), isNull(evidence.archivedAt)))
        .orderBy(desc(evidence.detectedAt), desc(evidence.createdAt))
        .limit(200);
    },

    async countEvidenceIds(evidenceIds: string[]) {
      if (evidenceIds.length === 0) {
        return 0;
      }

      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(evidence)
        .where(
          and(inArray(evidence.id, evidenceIds), isNull(evidence.archivedAt)),
        );

      return row?.count ?? 0;
    },

    async createConclusion(
      input: Omit<NewAiConclusion, "id" | "createdAt" | "updatedAt"> & {
        id?: string;
      },
    ) {
      return conclusionRepository.create(
        input as Parameters<typeof conclusionRepository.create>[0],
      );
    },

    async listLeadConclusions(leadId: string) {
      return db
        .select()
        .from(aiConclusions)
        .where(
          and(
            eq(aiConclusions.leadId, leadId),
            isNull(aiConclusions.archivedAt),
          ),
        )
        .orderBy(desc(aiConclusions.createdAt))
        .limit(100);
    },

    async findConclusionById(conclusionId: string) {
      const [item] = await db
        .select()
        .from(aiConclusions)
        .where(eq(aiConclusions.id, conclusionId))
        .limit(1);

      return item;
    },

    async updateConclusionStatus(
      conclusionId: string,
      status: "advisory" | "unsupported" | "promoted" | "dismissed",
    ) {
      const [item] = await db
        .update(aiConclusions)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(aiConclusions.id, conclusionId))
        .returning();

      return item;
    },

    async hasSupportedConclusionForLead(
      leadId: string,
      minimumConfidence: number,
      recommendation = "qualify",
    ) {
      const [item] = await db
        .select({ id: aiConclusions.id })
        .from(aiConclusions)
        .where(
          and(
            eq(aiConclusions.leadId, leadId),
            eq(aiConclusions.supported, true),
            eq(aiConclusions.status, "advisory"),
            eq(aiConclusions.recommendation, recommendation),
            gte(aiConclusions.confidence, minimumConfidence),
            isNull(aiConclusions.archivedAt),
          ),
        )
        .limit(1);

      return Boolean(item);
    },
  };
}

export type EvidenceRepository = ReturnType<typeof createEvidenceRepository>;
