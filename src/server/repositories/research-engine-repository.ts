import { eq } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { leads, signals } from "@/db/schema";

import { createRepository } from "./base-repository";

export function createResearchEngineRepository(db: PQCommandDb) {
  const leadRepository = createRepository(db, leads, "led");
  const signalRepository = createRepository(db, signals, "sig");

  return {
    findLeadById(id: string) {
      return leadRepository.findById(id);
    },

    findSignalById(id: string) {
      return signalRepository.findById(id);
    },

    async updateLeadSummary(leadId: string, summary: string) {
      const [row] = await db
        .update(leads)
        .set({
          summary,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, leadId))
        .returning();

      return row;
    },
  };
}

export type ResearchEngineRepository = ReturnType<
  typeof createResearchEngineRepository
>;
