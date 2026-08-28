import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  lte,
  or,
} from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  jobRuns,
  queueItems,
  sources,
  workerControls,
  workerHealthSnapshots,
} from "@/db/schema";

export type QueueWorkerName =
  | "discovery"
  | "research"
  | "scoring"
  | "outreach_planning"
  | "inbox_sync"
  | "reply_analysis"
  | "matching"
  | "shortage"
  | "deal_watcher"
  | "cleanup";

export function createBackgroundJobsRepository(db: PQCommandDb) {
  return {
    async enqueue(input: {
      workerName: QueueWorkerName;
      queueName: string;
      idempotencyKey?: string;
      payload: Record<string, unknown>;
      scheduledFor: Date;
      maxAttempts: number;
    }) {
      const [created] = await db
        .insert(queueItems)
        .values({
          id: createEntityId("que"),
          workerName: input.workerName,
          queueName: input.queueName,
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
          status: "queued",
          scheduledFor: input.scheduledFor,
          maxAttempts: input.maxAttempts,
          payload: input.payload,
        })
        .onConflictDoNothing()
        .returning();

      return created;
    },

    async hasCompletedIdempotency(idempotencyKey: string) {
      const [row] = await db
        .select({ id: queueItems.id })
        .from(queueItems)
        .where(
          and(
            eq(queueItems.idempotencyKey, idempotencyKey),
            inArray(queueItems.status, ["running", "succeeded", "dead_letter"]),
          ),
        )
        .limit(1);

      return Boolean(row);
    },

    async listDueQueued(limit = 20) {
      return db
        .select()
        .from(queueItems)
        .where(
          and(
            inArray(queueItems.status, ["queued", "retrying"]),
            lte(queueItems.scheduledFor, new Date()),
          ),
        )
        .orderBy(asc(queueItems.scheduledFor), asc(queueItems.createdAt))
        .limit(limit);
    },

    async countRunningForWorker(workerName: QueueWorkerName) {
      const [row] = await db
        .select({ count: count(queueItems.id) })
        .from(queueItems)
        .where(
          and(eq(queueItems.workerName, workerName), eq(queueItems.status, "running")),
        );

      return row?.count ?? 0;
    },

    async getWorkerControl(workerName: QueueWorkerName) {
      const [row] = await db
        .select()
        .from(workerControls)
        .where(eq(workerControls.workerName, workerName))
        .limit(1);

      return row;
    },

    async upsertWorkerControl(input: {
      workerName: QueueWorkerName;
      paused: boolean;
      concurrencyLimit: number;
      notes?: string;
    }) {
      const [row] = await db
        .insert(workerControls)
        .values({
          id: createEntityId("wct"),
          workerName: input.workerName,
          paused: input.paused,
          concurrencyLimit: input.concurrencyLimit,
          ...(input.notes ? { notes: input.notes } : {}),
        })
        .onConflictDoUpdate({
          target: workerControls.workerName,
          set: {
            paused: input.paused,
            concurrencyLimit: input.concurrencyLimit,
            ...(input.notes ? { notes: input.notes } : {}),
            updatedAt: new Date(),
          },
        })
        .returning();

      return row;
    },

    async markQueueRunning(input: {
      queueItemId: string;
      lockedBy: string;
      attempt: number;
    }) {
      const [updated] = await db
        .update(queueItems)
        .set({
          status: "running",
          lockedBy: input.lockedBy,
          lockedAt: new Date(),
          attempt: input.attempt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(queueItems.id, input.queueItemId),
            inArray(queueItems.status, ["queued", "retrying"]),
          ),
        )
        .returning();

      return updated;
    },

    async markQueueSucceeded(queueItemId: string) {
      const [updated] = await db
        .update(queueItems)
        .set({
          status: "succeeded",
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(queueItems.id, queueItemId))
        .returning();

      return updated;
    },

    async markQueueRetry(input: {
      queueItemId: string;
      nextAt: Date;
      lastError: string;
    }) {
      const [updated] = await db
        .update(queueItems)
        .set({
          status: "retrying",
          scheduledFor: input.nextAt,
          lastError: input.lastError,
          lockedBy: null,
          lockedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(queueItems.id, input.queueItemId))
        .returning();

      return updated;
    },

    async markQueueDeadLetter(input: {
      queueItemId: string;
      reason: string;
    }) {
      const [updated] = await db
        .update(queueItems)
        .set({
          status: "dead_letter",
          deadLetterReason: input.reason,
          lockedBy: null,
          lockedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(queueItems.id, input.queueItemId))
        .returning();

      return updated;
    },

    async createJobRun(input: {
      workerName: QueueWorkerName;
      queueName: string;
      jobName: string;
      idempotencyKey?: string;
      sourceId?: string;
      triggeredByUserId?: string;
      status: "queued" | "running" | "retrying" | "succeeded" | "failed" | "dead_letter" | "cancelled";
      attempt: number;
      maxAttempts: number;
      scheduledFor?: Date;
      context?: Record<string, unknown>;
    }) {
      const [created] = await db
        .insert(jobRuns)
        .values({
          id: createEntityId("job"),
          workerName: input.workerName,
          queueName: input.queueName,
          jobName: input.jobName,
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
          ...(input.sourceId ? { sourceId: input.sourceId } : {}),
          ...(input.triggeredByUserId ? { triggeredByUserId: input.triggeredByUserId } : {}),
          status: input.status,
          attempt: input.attempt,
          maxAttempts: input.maxAttempts,
          ...(input.scheduledFor ? { scheduledFor: input.scheduledFor } : {}),
          context: input.context ?? {},
          result: {},
        })
        .returning();

      return created;
    },

    async updateJobRun(
      jobRunId: string,
      patch: Partial<
        Pick<
          typeof jobRuns.$inferInsert,
          | "status"
          | "startedAt"
          | "finishedAt"
          | "durationMs"
          | "itemsProcessed"
          | "errorCode"
          | "errorMessage"
          | "nextAttemptAt"
          | "deadLettered"
          | "lastHeartbeatAt"
          | "startedBy"
          | "result"
        >
      >,
    ) {
      const [updated] = await db
        .update(jobRuns)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(jobRuns.id, jobRunId))
        .returning();

      return updated;
    },

    async listRecentRuns(input?: {
      workerName?: QueueWorkerName;
      status?: string;
      sourceId?: string;
      limit?: number;
    }) {
      return db
        .select()
        .from(jobRuns)
        .where(
          and(
            input?.workerName ? eq(jobRuns.workerName, input.workerName) : undefined,
            input?.status ? eq(jobRuns.status, input.status as never) : undefined,
            input?.sourceId ? eq(jobRuns.sourceId, input.sourceId) : undefined,
          ),
        )
        .orderBy(desc(jobRuns.createdAt))
        .limit(input?.limit ?? 50);
    },

    async listRecentFailures(limit = 20) {
      return db
        .select()
        .from(jobRuns)
        .where(or(eq(jobRuns.status, "failed"), eq(jobRuns.status, "dead_letter")))
        .orderBy(desc(jobRuns.createdAt))
        .limit(limit);
    },

    async queueDepthByWorker(workerName: QueueWorkerName) {
      const [row] = await db
        .select({ count: count(queueItems.id) })
        .from(queueItems)
        .where(
          and(
            eq(queueItems.workerName, workerName),
            inArray(queueItems.status, ["queued", "retrying", "running"]),
          ),
        );

      return row?.count ?? 0;
    },

    async listWorkerControls() {
      return db.select().from(workerControls);
    },

    async snapshotWorkerHealth(input: {
      workerName: QueueWorkerName;
      status: string;
      queueDepth: number;
      runningCount: number;
      recentFailures: number;
      lastRunAt?: Date;
      notes?: string;
    }) {
      const [created] = await db
        .insert(workerHealthSnapshots)
        .values({
          id: createEntityId("whs"),
          workerName: input.workerName,
          status: input.status,
          queueDepth: input.queueDepth,
          runningCount: input.runningCount,
          recentFailures: input.recentFailures,
          ...(input.lastRunAt ? { lastRunAt: input.lastRunAt } : {}),
          ...(input.notes ? { notes: input.notes } : {}),
        })
        .returning();

      return created;
    },

    async listLatestWorkerHealth() {
      const rows = await db
        .select()
        .from(workerHealthSnapshots)
        .orderBy(desc(workerHealthSnapshots.createdAt))
        .limit(200);

      const latest = new Map<string, (typeof rows)[number]>();
      for (const row of rows) {
        if (!latest.has(row.workerName)) {
          latest.set(row.workerName, row);
        }
      }

      return Array.from(latest.values());
    },

    async listSourcesHealth() {
      return db
        .select({
          id: sources.id,
          name: sources.name,
          health: sources.health,
          enabled: sources.enabled,
          permissionStatus: sources.permissionStatus,
        })
        .from(sources)
        .orderBy(asc(sources.name));
    },

    async listQueueItemsByStatus(status: "dead_letter" | "retrying" | "queued") {
      return db
        .select()
        .from(queueItems)
        .where(eq(queueItems.status, status))
        .orderBy(desc(queueItems.updatedAt))
        .limit(100);
    },

    async getQueueItem(queueItemId: string) {
      const [row] = await db
        .select()
        .from(queueItems)
        .where(eq(queueItems.id, queueItemId))
        .limit(1);

      return row;
    },

    async incrementHeartbeat(jobRunId: string) {
      await db
        .update(jobRuns)
        .set({
          lastHeartbeatAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobRuns.id, jobRunId));
    },
  };
}

export type BackgroundJobsRepository = ReturnType<
  typeof createBackgroundJobsRepository
>;
