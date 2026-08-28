import assert from "node:assert/strict";
import test from "node:test";

import { createAnalyticsAttributionService } from "../src/server/services/analytics-attribution-service";
import { createBackgroundJobInfrastructureService } from "../src/server/services/background-job-infrastructure-service";
import { createCommandCentreService } from "../src/server/services/command-centre-service";
import { createPqQuestService } from "../src/server/services/pq-quest-service";

const actor = {
  type: "user" as const,
  id: "usr_1",
  userId: "usr_1",
  role: "MANAGER" as const,
};

test("prompt 35 enforces idempotency and avoids duplicate queueing", async () => {
  let enqueueCalled = false;

  const service = createBackgroundJobInfrastructureService({
    repository: {
      async hasCompletedIdempotency() {
        return true;
      },
      async enqueue() {
        enqueueCalled = true;
        return undefined;
      },
    } as never,
  });

  const result = await service.enqueueJob({
    workerName: "discovery",
    idempotencyKey: "dup-1",
  });

  assert.equal(result.duplicate, true);
  assert.equal(enqueueCalled, false);
});

test("prompt 35 retries failed jobs and dead-letters at max attempts", async () => {
  const updates: string[] = [];
  const queueState = [{ id: "que_1", attempt: 0, maxAttempts: 2 }];

  const service = createBackgroundJobInfrastructureService({
    repository: {
      async listDueQueued() {
        return [
          {
            id: "que_1",
            workerName: "discovery",
            queueName: "default",
            idempotencyKey: "id-1",
            payload: { shouldFail: true },
            scheduledFor: new Date(),
            attempt: queueState[0]?.attempt ?? 0,
            maxAttempts: queueState[0]?.maxAttempts ?? 2,
          },
        ];
      },
      async getWorkerControl() {
        return { paused: false, concurrencyLimit: 1 };
      },
      async countRunningForWorker() {
        return 0;
      },
      async markQueueRunning() {
        return { id: "que_1" };
      },
      async createJobRun() {
        return { id: "job_1" };
      },
      async markQueueSucceeded() {
        return { id: "que_1" };
      },
      async updateJobRun(_jobRunId: string, patch: { status?: string }) {
        if (patch.status) {
          updates.push(patch.status);
        }
        return { id: "job_1" };
      },
      async markQueueRetry() {
        queueState[0] = { id: "que_1", attempt: 1, maxAttempts: 2 };
        return { id: "que_1" };
      },
      async markQueueDeadLetter() {
        updates.push("dead_letter_queue");
        return { id: "que_1" };
      },
      async incrementHeartbeat() {
        return;
      },
    } as never,
    handlers: {
      discovery: async () => {
        throw new Error("forced failure");
      },
    },
  });

  await service.runDueJobs("worker-a");
  await service.runDueJobs("worker-a");

  assert.equal(updates.includes("retrying"), true);
  assert.equal(updates.includes("dead_letter"), true);
  assert.equal(updates.includes("dead_letter_queue"), true);
});

test("prompt 35 automation tick schedules recurring workers for a constant sourcing bot", async () => {
  const enqueued: Array<{ workerName: string; scheduledFor: string }> = [];

  const service = createBackgroundJobInfrastructureService({
    repository: {
      async hasCompletedIdempotency() {
        return false;
      },
      async enqueue(input: {
        workerName: string;
        queueName: string;
        payload: Record<string, unknown>;
        scheduledFor: Date;
        maxAttempts: number;
      }) {
        enqueued.push({
          workerName: input.workerName,
          scheduledFor: input.scheduledFor.toISOString(),
        });

        return {
          id: `que_${input.workerName}`,
          workerName: input.workerName,
          queueName: input.queueName,
          payload: input.payload,
          scheduledFor: input.scheduledFor,
          attempt: 0,
          maxAttempts: input.maxAttempts,
        };
      },
      async createJobRun() {
        return { id: "job_sched" };
      },
      async listDueQueued() {
        return [];
      },
      async getWorkerControl() {
        return { paused: false, concurrencyLimit: 1 };
      },
      async countRunningForWorker() {
        return 0;
      },
      async listRecentRuns() {
        return [];
      },
      async listRecentFailures() {
        return [];
      },
      async queueDepthByWorker() {
        return 0;
      },
      async snapshotWorkerHealth() {
        return { id: "whs_1" };
      },
    } as never,
    now: () => new Date("2026-01-05T10:07:00.000Z"),
  });

  const result = await service.runAutomationTick({ workerId: "bot-1" });

  assert.equal(result.scheduledCount, 10);
  assert.equal(result.processed, 0);
  assert.equal(
    enqueued.some(
      (item) =>
        item.workerName === "discovery" &&
        item.scheduledFor === "2026-01-05T10:00:00.000Z",
    ),
    true,
  );
  assert.equal(
    enqueued.some(
      (item) =>
        item.workerName === "inbox_sync" &&
        item.scheduledFor === "2026-01-05T10:05:00.000Z",
    ),
    true,
  );
});

test("prompt 35 discovery worker runs approved configured sources automatically", async () => {
  const resolvedSources: string[] = [];
  const pipelineRuns: string[] = [];

  const service = createBackgroundJobInfrastructureService({
    repository: {
      async listDueQueued() {
        return [
          {
            id: "que_discovery",
            workerName: "discovery",
            queueName: "automation",
            idempotencyKey: "bot:discovery:2026-01-05T10:00:00.000Z",
            payload: {},
            scheduledFor: new Date("2026-01-05T10:00:00.000Z"),
            attempt: 0,
            maxAttempts: 3,
          },
        ];
      },
      async getWorkerControl() {
        return { paused: false, concurrencyLimit: 1 };
      },
      async countRunningForWorker() {
        return 0;
      },
      async markQueueRunning() {
        return { id: "que_discovery" };
      },
      async createJobRun() {
        return { id: "job_discovery" };
      },
      async markQueueSucceeded() {
        return { id: "que_discovery" };
      },
      async updateJobRun() {
        return { id: "job_discovery" };
      },
      async markQueueRetry() {
        return { id: "que_discovery" };
      },
      async markQueueDeadLetter() {
        return { id: "que_discovery" };
      },
      async incrementHeartbeat() {
        return;
      },
    } as never,
    sourceService: {
      async listSources() {
        return [
          {
            id: "src_approved",
            name: "Approved portal",
            connectorKey: "supply.public.web",
            permissionStatus: "APPROVED",
            enabled: true,
            config: { urls: ["https://approved.example.com"] },
          },
          {
            id: "src_gumtree",
            name: "Gumtree",
            connectorKey: "supply.public.web",
            permissionStatus: "REVIEW_REQUIRED",
            enabled: true,
            config: { urls: ["https://www.gumtree.com"] },
          },
        ];
      },
    } as never,
    connectorResolverService: {
      resolve(source: { id: string }) {
        resolvedSources.push(source.id);
        return { name: `connector:${source.id}`, maxRetries: 1 } as never;
      },
    } as never,
    discoveryPipelineService: {
      async run(input: { sourceId: string }) {
        pipelineRuns.push(input.sourceId);
        return {
          jobRunId: `job:${input.sourceId}`,
          idempotencyKey: `id:${input.sourceId}`,
          status: "succeeded",
          processed: 1,
          collapsedDuplicates: 0,
          createdSignals: 1,
          createdLeads: 1,
          qualifiedLeads: 1,
          errors: [],
        };
      },
    } as never,
  });

  const result = await service.runDueJobs("worker-a");

  assert.equal(result.processed, 1);
  assert.deepEqual(resolvedSources, ["src_approved"]);
  assert.deepEqual(pipelineRuns, ["src_approved"]);
});

test("prompt 36 pause or resume controls are audited and persisted", async () => {
  const auditActions: string[] = [];

  const service = createBackgroundJobInfrastructureService({
    repository: {
      async upsertWorkerControl(input: { paused: boolean }) {
        return { id: "wct_1", paused: input.paused, concurrencyLimit: 2 };
      },
    } as never,
    auditService: {
      async recordEvent(input: { action: string }) {
        auditActions.push(input.action);
        return { id: "aud_1" };
      },
    } as never,
  });

  await service.setWorkerPaused(
    {
      workerName: "matching",
      paused: true,
      concurrencyLimit: 2,
    },
    actor,
  );

  await service.setWorkerPaused(
    {
      workerName: "matching",
      paused: false,
      concurrencyLimit: 2,
    },
    actor,
  );

  assert.equal(auditActions.includes("jobs.worker.paused"), true);
  assert.equal(auditActions.includes("jobs.worker.resumed"), true);
});

test("prompt 38 only verified business events award XP and duplicate source events are blocked", async () => {
  let createdEvents = 0;

  const service = createPqQuestService({
    repository: {
      async getProfile() {
        return {
          userId: "usr_1",
          totalXp: 0,
          level: 1,
          streakDays: 0,
          lastXpAt: null,
          unlockedChapters: ["The Scout"],
        };
      },
      async createProfile() {
        return {
          userId: "usr_1",
          totalXp: 0,
          level: 1,
          streakDays: 0,
          lastXpAt: null,
          unlockedChapters: ["The Scout"],
        };
      },
      async upsertObjective() {
        return { id: "pqo_1" };
      },
      async findXpEventBySourceEventId(sourceEventId: string) {
        return sourceEventId === "evt_dup" ? { id: "pqe_existing" } : undefined;
      },
      async createXpEvent() {
        createdEvents += 1;
        return { id: "pqe_1" };
      },
      async updateProfile() {
        return { id: "pqp_1" };
      },
      async incrementObjectiveProgress() {
        return { id: "pqo_1" };
      },
      async listRecentXpEvents() {
        return [];
      },
      async listObjectives() {
        return [];
      },
      async countCompletedObjectives() {
        return 0;
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_1" };
      },
    } as never,
  });

  const ignored = await service.awardVerifiedEvent(
    {
      userId: "usr_1",
      sourceEventId: "evt_ignored",
      sourceAction: "outreach.sent",
    },
    actor,
  );
  assert.equal(ignored.awarded, false);

  const awarded = await service.awardVerifiedEvent(
    {
      userId: "usr_1",
      sourceEventId: "evt_ok",
      sourceAction: "deal.completed",
    },
    actor,
  );
  assert.equal(awarded.awarded, true);

  const duplicate = await service.awardVerifiedEvent(
    {
      userId: "usr_1",
      sourceEventId: "evt_dup",
      sourceAction: "deal.completed",
    },
    actor,
  );
  assert.equal(duplicate.awarded, false);
  assert.equal(createdEvents, 1);
});

test("prompt 39 analytics funnel computes from repository and persists snapshots", async () => {
  const persistedMetrics: string[] = [];

  const service = createAnalyticsAttributionService({
    repository: {
      async countMetric(metric: string) {
        return metric === "discovered" ? 10 : metric === "completed_deal" ? 2 : 4;
      },
      async createSnapshot(input: { metric: string }) {
        persistedMetrics.push(input.metric);
        return { id: `afs_${input.metric}` };
      },
      async listLatestSnapshots() {
        return [{ id: "afs_1", metric: "discovered", value: 10 }];
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_1" };
      },
    } as never,
  });

  const filter = {
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    periodEnd: new Date("2026-01-31T23:59:59.000Z"),
  };

  const funnel = await service.computeFunnel(filter);
  assert.equal(funnel.metrics.length, 12);
  assert.equal(
    funnel.metrics.some((metric) => metric.metric === "conversation"),
    true,
  );
  assert.equal(
    funnel.metrics.some((metric) => metric.metric === "qualified_stock"),
    true,
  );
  assert.equal(
    funnel.metrics.some((metric) => metric.metric === "multi_unit_units"),
    true,
  );

  const snapshotIds = await service.persistSnapshot(filter, actor);
  assert.equal(snapshotIds.length, 12);
  assert.equal(persistedMetrics.includes("completed_deal"), true);
  assert.equal(persistedMetrics.includes("conversation"), true);
  assert.equal(persistedMetrics.includes("qualified_stock"), true);
});

test("prompt 37 command centre snapshot uses real repository metrics and worker health", async () => {
  const service = createCommandCentreService({
    repository: {
      async countQualifiedSupply() {
        return 5;
      },
      async countDirectDemand() {
        return 3;
      },
      async sumSupplyGap() {
        return 4;
      },
      async countHotReplies() {
        return 2;
      },
      async countViewingsToday() {
        return 1;
      },
      async countActiveDeals() {
        return 6;
      },
      async countStalledItems() {
        return 2;
      },
      async countOvernightIntelligence() {
        return 7;
      },
      async queueDepth() {
        return 8;
      },
      async listTopAcquisitionTargets() {
        return [{ id: "shr_1" }];
      },
      async listNextActions() {
        return [{ id: "tsk_1" }];
      },
    } as never,
    jobsService: {
      async workerHealth() {
        return [{ workerName: "discovery", status: "healthy" }];
      },
    } as never,
  });

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.qualifiedSupply, 5);
  assert.equal(snapshot.directDemand, 3);
  assert.equal(snapshot.topAcquisitionTargets.length, 1);
  assert.equal(snapshot.workerHealth.length, 1);
});
