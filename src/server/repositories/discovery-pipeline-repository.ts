import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import type { NewJobRun, NewLead, NewSignal } from "@/db/models";
import { jobRuns, leads, signals, sources } from "@/db/schema";

import { createRepository } from "./base-repository";

export function createDiscoveryPipelineRepository(db: PQCommandDb) {
  const jobRunRepository = createRepository(db, jobRuns, "job");
  const signalRepository = createRepository(db, signals, "sig");

  return {
    async findSourceById(sourceId: string) {
      const [source] = await db
        .select()
        .from(sources)
        .where(eq(sources.id, sourceId))
        .limit(1);

      return source;
    },

    async updateSourceHealth(
      sourceId: string,
      input: {
        health: "healthy" | "degraded" | "offline" | "unknown";
        lastScannedAt: Date;
      },
    ) {
      const [source] = await db
        .update(sources)
        .set({
          health: input.health,
          lastScannedAt: input.lastScannedAt,
          updatedAt: new Date(),
        })
        .where(eq(sources.id, sourceId))
        .returning();

      return source;
    },

    async createJobRun(
      input: Omit<NewJobRun, "id" | "createdAt" | "updatedAt"> & {
        id?: string;
      },
    ) {
      return jobRunRepository.create(
        input as Parameters<typeof jobRunRepository.create>[0],
      );
    },

    async findLatestByIdempotencyKey(idempotencyKey: string) {
      const [job] = await db
        .select()
        .from(jobRuns)
        .where(
          and(
            eq(jobRuns.jobName, "discovery.pipeline"),
            sql<boolean>`(${jobRuns.context} ->> 'idempotencyKey') = ${idempotencyKey}`,
          ),
        )
        .orderBy(desc(jobRuns.createdAt))
        .limit(1);

      return job;
    },

    async markJobRunRunning(jobRunId: string, startedAt: Date) {
      const [job] = await db
        .update(jobRuns)
        .set({
          status: "running",
          startedAt,
          updatedAt: startedAt,
        })
        .where(eq(jobRuns.id, jobRunId))
        .returning();

      return job;
    },

    async markJobRunSucceeded(
      jobRunId: string,
      input: {
        finishedAt: Date;
        durationMs: number;
        result: Record<string, unknown>;
      },
    ) {
      const [job] = await db
        .update(jobRuns)
        .set({
          status: "succeeded",
          finishedAt: input.finishedAt,
          durationMs: input.durationMs,
          result: input.result,
          errorMessage: null,
          updatedAt: input.finishedAt,
        })
        .where(eq(jobRuns.id, jobRunId))
        .returning();

      return job;
    },

    async markJobRunFailed(
      jobRunId: string,
      input: {
        finishedAt: Date;
        durationMs: number;
        errorMessage: string;
        result: Record<string, unknown>;
      },
    ) {
      const [job] = await db
        .update(jobRuns)
        .set({
          status: "failed",
          finishedAt: input.finishedAt,
          durationMs: input.durationMs,
          errorMessage: input.errorMessage,
          result: input.result,
          updatedAt: input.finishedAt,
        })
        .where(eq(jobRuns.id, jobRunId))
        .returning();

      return job;
    },

    async listRecentJobRuns(limit = 50) {
      return db
        .select()
        .from(jobRuns)
        .where(eq(jobRuns.jobName, "discovery.pipeline"))
        .orderBy(desc(jobRuns.createdAt))
        .limit(limit);
    },

    async findLeadByIdentityKey(identityKey: string) {
      const [lead] = await db
        .select()
        .from(leads)
        .where(
          and(
            ilike(leads.summary, `%discovery:${identityKey}%`),
            isNull(leads.archivedAt),
          ),
        )
        .limit(1);

      return lead;
    },

    async createLeadForDiscovery(
      input: Omit<NewLead, "id" | "createdAt" | "updatedAt"> & { id?: string },
      identityKey: string,
    ) {
      const [lead] = await db
        .insert(leads)
        .values({
          ...(input as NewLead),
          id: input.id ?? createEntityId("led"),
          summary: input.summary
            ? `${input.summary} | discovery:${identityKey}`
            : `discovery:${identityKey}`,
        })
        .returning();

      return lead;
    },

    async createSignal(
      input: Omit<NewSignal, "id" | "createdAt" | "updatedAt"> & {
        id?: string;
      },
    ) {
      return signalRepository.create(
        input as Parameters<typeof signalRepository.create>[0],
      );
    },

    async findSignalByPipelineKey(pipelineSignalKey: string) {
      const [signal] = await db
        .select()
        .from(signals)
        .where(
          sql<boolean>`(${signals.payload} ->> 'pipelineSignalKey') = ${pipelineSignalKey}`,
        )
        .orderBy(desc(signals.createdAt))
        .limit(1);

      return signal;
    },

    async markLeadQualified(leadId: string) {
      const [lead] = await db
        .update(leads)
        .set({
          status: "qualified",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, leadId))
        .returning();

      return lead;
    },

    createJobRunId() {
      return createEntityId("job");
    },
  };
}

export type DiscoveryPipelineRepository = ReturnType<
  typeof createDiscoveryPipelineRepository
>;
