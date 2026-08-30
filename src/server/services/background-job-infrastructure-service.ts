import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import { leads } from "@/db/schema";
import type { AuditActor } from "@/domain/audit/types";
import { and, desc, eq, ilike, inArray, isNull, not, or } from "drizzle-orm";
import { appEnv } from "@/lib/env";
import { canManageSources } from "@/server/auth/rbac";
import {
  createBackgroundJobsRepository,
  type BackgroundJobsRepository,
  type QueueWorkerName,
} from "@/server/repositories/background-jobs-repository";

import { createAuditService } from "./audit-event-service";
import { createDiscoveryConnectorResolverService } from "./discovery-connector-resolver-service";
import { createDiscoveryPipelineService } from "./discovery-pipeline-service";
import { createDirectDemandDiscoveryService } from "./direct-demand-discovery-service";
import { createHotelDealIntelligenceService } from "./hotel-deal-intelligence-service";
import { createMatchingEngineService } from "./matching-engine-service";
import { createSourceExpansionService } from "./source-expansion-service";
import { createSourceRegistryService } from "./source-registry-service";

type WorkerHandler = (
  payload: Record<string, unknown>,
  context: { jobRunId: string; heartbeat: () => Promise<void> },
) => Promise<{ itemsProcessed: number; result?: Record<string, unknown> }>;

type BackgroundJobDependencies = {
  repository?: BackgroundJobsRepository;
  auditService?: ReturnType<typeof createAuditService>;
  now?: () => Date;
  handlers?: Partial<Record<QueueWorkerName, WorkerHandler>>;
  sourceService?: ReturnType<typeof createSourceRegistryService>;
  discoveryPipelineService?: ReturnType<typeof createDiscoveryPipelineService>;
  connectorResolverService?: ReturnType<
    typeof createDiscoveryConnectorResolverService
  >;
  sourceExpansionService?: ReturnType<typeof createSourceExpansionService>;
};

type EnqueueInput = {
  workerName: QueueWorkerName;
  queueName?: string;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
  scheduledFor?: Date;
  maxAttempts?: number;
  triggeredByUserId?: string;
};

const WORKER_SCHEDULE_MINUTES: Record<QueueWorkerName, number> = {
  discovery: 15,
  research: 15,
  scoring: 15,
  outreach_planning: 15,
  inbox_sync: 5,
  reply_analysis: 5,
  matching: 15,
  shortage: 30,
  deal_watcher: 30,
  cleanup: 60,
};

const WORKERS: Record<QueueWorkerName, WorkerHandler> = {
  discovery: async () => ({
    itemsProcessed: 0,
    result: {
      worker: "discovery",
      note: "configured at runtime",
    },
  }),
  research: async () => ({ itemsProcessed: 1, result: { worker: "research" } }),
  scoring: async () => ({ itemsProcessed: 1, result: { worker: "scoring" } }),
  outreach_planning: async () => ({
    itemsProcessed: 1,
    result: { worker: "outreach_planning", outboundTriggered: false },
  }),
  inbox_sync: async () => ({ itemsProcessed: 1, result: { worker: "inbox_sync" } }),
  reply_analysis: async () => ({
    itemsProcessed: 1,
    result: { worker: "reply_analysis" },
  }),
  matching: async () => ({ itemsProcessed: 1, result: { worker: "matching" } }),
  shortage: async () => ({ itemsProcessed: 1, result: { worker: "shortage" } }),
  deal_watcher: async () => ({
    itemsProcessed: 1,
    result: { worker: "deal_watcher" },
  }),
  cleanup: async () => ({ itemsProcessed: 1, result: { worker: "cleanup" } }),
};

function getRepository(repository?: BackgroundJobsRepository) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createBackgroundJobsRepository(getDb());
}

function ensureAdminControl(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (!actor.role || !canManageSources(actor.role)) {
    throw new Error("Only admin/manager can control background workers.");
  }
}

function backoffMs(attempt: number) {
  const base = 5_000;
  return base * Math.pow(2, Math.max(0, attempt - 1));
}

function bucketStart(value: Date, intervalMinutes: number) {
  const intervalMs = Math.max(1, intervalMinutes) * 60_000;
  return new Date(Math.floor(value.getTime() / intervalMs) * intervalMs);
}

let shutdownRequested = false;

function resolveNightShiftConfig() {
  const residentialStockTarget = Math.max(
    1,
    appEnv.NIGHT_SHIFT_RESIDENTIAL_STOCK_TARGET ?? 100,
  );
  const residentialDemandTarget = Math.max(
    1,
    appEnv.NIGHT_SHIFT_RESIDENTIAL_DEMAND_TARGET ?? 100,
  );
  const hotelSellerTarget = Math.max(1, appEnv.NIGHT_SHIFT_HOTEL_SELLER_TARGET ?? 100);
  const hotelBuyerTarget = Math.max(1, appEnv.NIGHT_SHIFT_HOTEL_BUYER_TARGET ?? 100);
  const dailyAiBudgetGbp = appEnv.NIGHT_SHIFT_DAILY_AI_BUDGET_GBP ?? 10;

  // Conservative planner: cap candidate deep-research volume using a fixed per-candidate estimate.
  const estimatedGbpPerCandidate = 0.02;
  const hardCandidateBudget = Math.max(
    0,
    Math.floor(dailyAiBudgetGbp / estimatedGbpPerCandidate),
  );

  return {
    residentialStockTarget,
    residentialDemandTarget,
    hotelSellerTarget,
    hotelBuyerTarget,
    dailyAiBudgetGbp,
    estimatedGbpPerCandidate,
    hardCandidateBudget,
  };
}

function isAutomatedSourceCandidate(input: {
  connectorKey: string | null;
  enabled: boolean;
  permissionStatus: string;
}) {
  return (
    input.enabled &&
    input.permissionStatus === "APPROVED" &&
    typeof input.connectorKey === "string" &&
    input.connectorKey.trim().length > 0
  );
}

export function createBackgroundJobInfrastructureService(
  dependencies: BackgroundJobDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService =
    dependencies.auditService ??
    (getDatabaseConfig(appEnv).configured
      ? createAuditService()
      : {
          async recordEvent() {
            return { id: "aud_noop" };
          },
        });
  const now = dependencies.now ?? (() => new Date());
  const discoveryHandler: WorkerHandler = async (_payload, context) => {
    const sourceService =
      dependencies.sourceService ?? createSourceRegistryService();
    const discoveryPipelineService =
      dependencies.discoveryPipelineService ??
      createDiscoveryPipelineService();
    const connectorResolverService =
      dependencies.connectorResolverService ??
      createDiscoveryConnectorResolverService();
    const sourceExpansionService =
      dependencies.sourceExpansionService ?? createSourceExpansionService();
    const configuredSourceId =
      typeof _payload["sourceId"] === "string" ? _payload["sourceId"] : undefined;
    const allSources = await sourceService.listSources();
    const candidateSources = configuredSourceId
      ? allSources.filter((source) => source.id === configuredSourceId)
      : allSources.filter((source) =>
          isAutomatedSourceCandidate({
            connectorKey: source.connectorKey,
            enabled: source.enabled,
            permissionStatus: source.permissionStatus,
          }),
        );

    if (candidateSources.length === 0) {
      return {
        itemsProcessed: 0,
        result: {
          worker: "discovery",
          processedSources: 0,
          errors: [
            configuredSourceId
              ? `No runnable source found for ${configuredSourceId}.`
              : "No approved automated discovery sources configured.",
          ],
        },
      };
    }

    const errors: string[] = [];
    let processedSources = 0;
    let createdLeads = 0;
    let qualifiedLeads = 0;
    let createdSignals = 0;

    for (const source of candidateSources) {
      try {
        const connector = connectorResolverService.resolve(source);
        const result = await discoveryPipelineService.run(
          {
            sourceId: source.id,
            idempotencyKey: `${context.jobRunId}:${source.id}`,
            connector,
          },
          {
            type: "job",
            id: context.jobRunId,
          },
        );

        processedSources += 1;
        createdLeads += result.createdLeads;
        qualifiedLeads += result.qualifiedLeads;
        createdSignals += result.createdSignals;

        if (result.errors.length > 0) {
          errors.push(...result.errors.map((error) => `${source.name}: ${error}`));
        }
      } catch (error) {
        errors.push(
          `${source.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (processedSources === 0 && errors.length > 0) {
      throw new Error(errors.join("; "));
    }

    const expansionResult = await sourceExpansionService.registerDiscoveredSources();

    return {
      itemsProcessed: processedSources,
      result: {
        worker: "discovery",
        processedSources,
        createdLeads,
        qualifiedLeads,
        createdSignals,
        discoveredSourcesCreated: expansionResult.created,
        discoveredSourcesSkipped: expansionResult.skipped,
        errors,
      },
    };
  };
  const handlers = {
    ...WORKERS,
    discovery: discoveryHandler,
    research: async () => {
      if (!getDatabaseConfig(appEnv).configured) {
        return {
          itemsProcessed: 0,
          result: {
            worker: "research",
            note: "DATABASE_URL is required before night-shift research can run.",
          },
        };
      }

      const db = getDb();
      const directDemandService = createDirectDemandDiscoveryService();
      const matchingService = createMatchingEngineService();
      const hotelService = createHotelDealIntelligenceService();
      const config = resolveNightShiftConfig();
      const requestedTotal =
        config.residentialStockTarget +
        config.residentialDemandTarget +
        config.hotelSellerTarget +
        config.hotelBuyerTarget;
      const allowedTotal = Math.min(
        requestedTotal,
        Math.max(1, config.hardCandidateBudget),
      );
      const allocationRatio = requestedTotal > 0 ? allowedTotal / requestedTotal : 1;
      const residentialStockTarget = Math.max(
        1,
        Math.floor(config.residentialStockTarget * allocationRatio),
      );
      const residentialDemandTarget = Math.max(
        1,
        Math.floor(config.residentialDemandTarget * allocationRatio),
      );
      const hotelSellerTarget = Math.max(
        1,
        Math.floor(config.hotelSellerTarget * allocationRatio),
      );
      const hotelBuyerTarget = Math.max(
        1,
        Math.floor(config.hotelBuyerTarget * allocationRatio),
      );
      const actor = {
        type: "system" as const,
        id: "pq_night_shift_worker",
      };

      const residentialStockPromise = (async () => {
        const candidates = await db
          .select({
            id: leads.id,
            directnessClassification: leads.directnessClassification,
            directnessVerified: leads.directnessVerified,
          })
          .from(leads)
          .where(
            and(
              eq(leads.leadType, "supply"),
              inArray(leads.status, ["new", "researching", "qualified", "nurturing"]),
              isNull(leads.archivedAt),
              or(isNull(leads.summary), not(ilike(leads.summary, "%hotel%"))),
            ),
          )
          .orderBy(desc(leads.updatedAt))
          .limit(residentialStockTarget);

        const directVerified = candidates.filter(
          (item) =>
            item.directnessClassification === "DIRECT" && item.directnessVerified,
        ).length;

        return {
          candidatesResearched: candidates.length,
          directVerified,
        };
      })();

      const residentialDemandPromise = (async () => {
        const demandCandidates = await db
          .select({ id: leads.id })
          .from(leads)
          .where(
            and(
              eq(leads.leadType, "demand"),
              inArray(leads.status, ["new", "researching", "qualified", "nurturing"]),
              isNull(leads.archivedAt),
              or(isNull(leads.summary), not(ilike(leads.summary, "%hotel%"))),
            ),
          )
          .orderBy(desc(leads.updatedAt))
          .limit(residentialDemandTarget);

        let extracted = 0;
        let directVerified = 0;
        let matched = 0;

        for (const lead of demandCandidates) {
          try {
            const result = await directDemandService.discover(
              { leadId: lead.id },
              actor,
            );

            if (result.extracted) {
              extracted += 1;
            }
            if (result.directRelationshipVerified) {
              directVerified += 1;
            }

            if (result.requirementId) {
              await matchingService.runRequirementMatch(result.requirementId, actor);
              matched += 1;
            }
          } catch {
            // Keep night-shift stream resilient per lead.
          }
        }

        return {
          candidatesResearched: demandCandidates.length,
          requirementsExtracted: extracted,
          directVerified,
          requirementsMatched: matched,
        };
      })();

      const hotelSellerPromise = hotelService.runSellSideResearchCycle(actor, {
        sellerTarget: hotelSellerTarget,
      });
      const hotelBuyerPromise = hotelService.runBuySideResearchCycle(actor, {
        buyerTarget: hotelBuyerTarget,
      });

      const [residentialStock, residentialDemand, hotelSell, hotelBuy] =
        await Promise.all([
          residentialStockPromise,
          residentialDemandPromise,
          hotelSellerPromise,
          hotelBuyerPromise,
        ]);

      const hotelMatch = await hotelService.runLiveMatchCycle(actor, {
        matchTarget: Math.max(10, Math.floor(hotelBuyerTarget * 0.4)),
      });

      const result = {
        budget: {
          dailyAiBudgetGbp: config.dailyAiBudgetGbp,
          estimatedGbpPerCandidate: config.estimatedGbpPerCandidate,
          requestedCandidates: requestedTotal,
          allowedCandidates: allowedTotal,
        },
        streams: {
          residentialStock,
          residentialDemand,
          hotelSell,
          hotelBuy,
          hotelMatch,
        },
      };

      return {
        itemsProcessed:
          residentialStock.candidatesResearched +
          residentialDemand.candidatesResearched +
          hotelSell.verificationQueue +
          hotelBuy.candidateRequirements +
          hotelMatch.matchesConsidered,
        result: {
          worker: "research",
          vertical: "residential_and_hotel",
          ...result,
        },
      };
    },
    matching: async () => {
      const hotelService = createHotelDealIntelligenceService();
      const actor = {
        type: "system" as const,
        id: "hotel_match_worker",
      };

      const result = await hotelService.runLiveMatchCycle(actor);

      return {
        itemsProcessed: result.matchesConsidered,
        result: {
          worker: "matching",
          vertical: "hotel",
          ...result,
        },
      };
    },
    ...dependencies.handlers,
  };

  return {
    workerNames: Object.keys(WORKERS) as QueueWorkerName[],

    async enqueueJob(input: EnqueueInput) {
      if (!repository) {
        throw new Error("DATABASE_URL is required before job infrastructure can run.");
      }

      if (input.idempotencyKey) {
        const exists = await repository.hasCompletedIdempotency(input.idempotencyKey);
        if (exists) {
          return { duplicate: true } as const;
        }
      }

      const item = await repository.enqueue({
        workerName: input.workerName,
        queueName: input.queueName ?? "default",
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        payload: input.payload ?? {},
        scheduledFor: input.scheduledFor ?? now(),
        maxAttempts: Math.max(1, input.maxAttempts ?? 3),
      });

      if (!item) {
        return { duplicate: true } as const;
      }

      await repository.createJobRun({
        workerName: item.workerName as QueueWorkerName,
        queueName: item.queueName,
        jobName: item.workerName,
        ...(item.idempotencyKey ? { idempotencyKey: item.idempotencyKey } : {}),
        ...(input.triggeredByUserId ? { triggeredByUserId: input.triggeredByUserId } : {}),
        status: "queued",
        attempt: item.attempt,
        maxAttempts: item.maxAttempts,
        scheduledFor: item.scheduledFor,
        context: item.payload,
      });

      return {
        duplicate: false,
        queueItemId: item.id,
      } as const;
    },

    async scheduleDefaultJobs(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
      ensureAdminControl(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before job infrastructure can run.");
      }

      const scheduled = [] as string[];
      for (const workerName of this.workerNames) {
        const idempotencyKey = `sched:${workerName}:${now().toISOString().slice(0, 13)}`;
        const result = await this.enqueueJob({
          workerName,
          idempotencyKey,
          payload: { scheduled: true },
          ...(actor.userId ? { triggeredByUserId: actor.userId } : {}),
        });

        if (!result.duplicate && result.queueItemId) {
          scheduled.push(result.queueItemId);
        }
      }

      await auditService.recordEvent({
        actor,
        action: "jobs.scheduled.default",
        entityType: "job_queue",
        entityId: "default",
        metadata: {
          count: scheduled.length,
        },
      });

      return { scheduledCount: scheduled.length };
    },

    async scheduleRecurringJobs(input?: {
      triggeredByUserId?: string;
      force?: boolean;
    }) {
      if (!repository) {
        throw new Error("DATABASE_URL is required before job infrastructure can run.");
      }

      const current = now();
      const scheduled = [] as string[];

      for (const workerName of this.workerNames) {
        const intervalMinutes = WORKER_SCHEDULE_MINUTES[workerName] ?? 15;
        const scheduleAt = input?.force
          ? current
          : bucketStart(current, intervalMinutes);
        const result = await this.enqueueJob({
          workerName,
          queueName: "automation",
          idempotencyKey: `bot:${workerName}:${scheduleAt.toISOString()}`,
          payload: {
            scheduled: true,
            automated: true,
            intervalMinutes,
          },
          scheduledFor: scheduleAt,
          ...(input?.triggeredByUserId
            ? { triggeredByUserId: input.triggeredByUserId }
            : {}),
        });

        if (!result.duplicate && result.queueItemId) {
          scheduled.push(result.queueItemId);
        }
      }

      return {
        scheduledCount: scheduled.length,
        scheduledQueueItemIds: scheduled,
      };
    },

    async runDueJobs(workerId = "local-worker") {
      if (!repository) {
        throw new Error("DATABASE_URL is required before job infrastructure can run.");
      }

      if (shutdownRequested) {
        return { processed: 0, skipped: "shutdown_requested" as const };
      }

      const due = await repository.listDueQueued(50);
      let processed = 0;

      for (const item of due) {
        if (shutdownRequested) {
          break;
        }

        const control = await repository.getWorkerControl(item.workerName as QueueWorkerName);
        const paused = control?.paused ?? false;
        const concurrencyLimit = Math.max(1, control?.concurrencyLimit ?? 1);
        const runningCount = await repository.countRunningForWorker(
          item.workerName as QueueWorkerName,
        );

        if (paused || runningCount >= concurrencyLimit) {
          continue;
        }

        const nextAttempt = item.attempt + 1;
        const locked = await repository.markQueueRunning({
          queueItemId: item.id,
          lockedBy: workerId,
          attempt: nextAttempt,
        });

        if (!locked) {
          continue;
        }

        const run = await repository.createJobRun({
          workerName: item.workerName as QueueWorkerName,
          queueName: item.queueName,
          jobName: item.workerName,
          ...(item.idempotencyKey ? { idempotencyKey: item.idempotencyKey } : {}),
          status: "running",
          attempt: nextAttempt,
          maxAttempts: item.maxAttempts,
          scheduledFor: item.scheduledFor,
          context: item.payload,
        });

        const startedAt = now();

        try {
          const handler = handlers[item.workerName as QueueWorkerName];
          const output = await handler(item.payload, {
            jobRunId: run?.id ?? "",
            heartbeat: async () => {
              if (run?.id) {
                await repository.incrementHeartbeat(run.id);
              }
            },
          });

          await repository.markQueueSucceeded(item.id);
          if (run?.id) {
            await repository.updateJobRun(run.id, {
              status: "succeeded",
              startedAt,
              finishedAt: now(),
              durationMs: Math.max(0, now().getTime() - startedAt.getTime()),
              itemsProcessed: output.itemsProcessed,
              result: output.result ?? {},
            });
          }

          processed += 1;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const canRetry = nextAttempt < item.maxAttempts;

          if (canRetry) {
            const nextAt = new Date(now().getTime() + backoffMs(nextAttempt));
            await repository.markQueueRetry({
              queueItemId: item.id,
              nextAt,
              lastError: errorMessage,
            });

            if (run?.id) {
              await repository.updateJobRun(run.id, {
                status: "retrying",
                startedAt,
                finishedAt: now(),
                durationMs: Math.max(0, now().getTime() - startedAt.getTime()),
                errorCode: "JOB_RETRY",
                errorMessage,
                nextAttemptAt: nextAt,
              });
            }
          } else {
            await repository.markQueueDeadLetter({
              queueItemId: item.id,
              reason: errorMessage,
            });

            if (run?.id) {
              await repository.updateJobRun(run.id, {
                status: "dead_letter",
                startedAt,
                finishedAt: now(),
                durationMs: Math.max(0, now().getTime() - startedAt.getTime()),
                errorCode: "JOB_DEAD_LETTER",
                errorMessage,
                deadLettered: true,
              });
            }
          }
        }
      }

      return { processed };
    },

    async runAutomationTick(input?: {
      workerId?: string;
      triggeredByUserId?: string;
      forceSchedule?: boolean;
    }) {
      const scheduled = await this.scheduleRecurringJobs({
        ...(input?.triggeredByUserId
          ? { triggeredByUserId: input.triggeredByUserId }
          : {}),
        ...(input?.forceSchedule ? { force: true } : {}),
      });
      const processed = await this.runDueJobs(input?.workerId ?? `bot-${process.pid}`);

      return {
        scheduledCount: scheduled.scheduledCount,
        processed: processed.processed,
        scheduledQueueItemIds: scheduled.scheduledQueueItemIds,
      };
    },

    async setWorkerPaused(
      input: { workerName: QueueWorkerName; paused: boolean; concurrencyLimit?: number },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAdminControl(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before job infrastructure can run.");
      }

      const row = await repository.upsertWorkerControl({
        workerName: input.workerName,
        paused: input.paused,
        concurrencyLimit: Math.max(1, input.concurrencyLimit ?? 1),
      });

      await auditService.recordEvent({
        actor,
        action: input.paused ? "jobs.worker.paused" : "jobs.worker.resumed",
        entityType: "worker",
        entityId: input.workerName,
        metadata: {
          concurrencyLimit: row?.concurrencyLimit,
        },
      });

      return row;
    },

    async retryQueueItem(
      queueItemId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAdminControl(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before job infrastructure can run.");
      }

      const item = await repository.getQueueItem(queueItemId);
      if (!item) {
        throw new Error("Queue item not found.");
      }

      await repository.markQueueRetry({
        queueItemId,
        nextAt: now(),
        lastError: item.lastError ?? "manual retry",
      });

      await auditService.recordEvent({
        actor,
        action: "jobs.queue.retry_requested",
        entityType: "queue_item",
        entityId: queueItemId,
      });
    },

    async requestGracefulShutdown() {
      shutdownRequested = true;
      return { shutdownRequested };
    },

    async clearGracefulShutdown(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
      ensureAdminControl(actor);
      shutdownRequested = false;
      return { shutdownRequested };
    },

    async workerHealth() {
      if (!repository) {
        return [];
      }

      const runs = await repository.listRecentRuns({ limit: 300 });
      const failures = await repository.listRecentFailures(200);
      const output: Array<{
        workerName: QueueWorkerName;
        status: string;
        lastRun: Date | null;
        queueDepth: number;
        runningCount: number;
        recentFailures: number;
        paused: boolean;
      }> = [];

      for (const workerName of this.workerNames) {
        const control = await repository.getWorkerControl(workerName);
        const queueDepth = await repository.queueDepthByWorker(workerName);
        const runningCount = await repository.countRunningForWorker(workerName);

        const workerRuns = runs.filter((run) => run.workerName === workerName);
        const lastRun = workerRuns[0]?.createdAt ?? null;
        const recentFailures = failures.filter((run) => run.workerName === workerName).length;

        const status = control?.paused
          ? "paused"
          : recentFailures > 0
            ? "degraded"
            : "healthy";

        await repository.snapshotWorkerHealth({
          workerName,
          status,
          queueDepth,
          runningCount,
          recentFailures,
          ...(lastRun ? { lastRunAt: lastRun } : {}),
        });

        output.push({
          workerName,
          status,
          lastRun,
          queueDepth,
          runningCount,
          recentFailures,
          paused: control?.paused ?? false,
        });
      }

      return output;
    },

    async activitySnapshot(input?: {
      workerName?: QueueWorkerName;
      status?: string;
      sourceId?: string;
    }) {
      if (!repository) {
        return {
          runs: [],
          failures: [],
          controls: [],
          sources: [],
          queue: {
            deadLetter: [],
            retrying: [],
            queued: [],
          },
        };
      }

      return {
        runs: await repository.listRecentRuns({
          ...(input?.workerName ? { workerName: input.workerName } : {}),
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.sourceId ? { sourceId: input.sourceId } : {}),
          limit: 100,
        }),
        failures: await repository.listRecentFailures(30),
        controls: await repository.listWorkerControls(),
        sources: await repository.listSourcesHealth(),
        queue: {
          deadLetter: await repository.listQueueItemsByStatus("dead_letter"),
          retrying: await repository.listQueueItemsByStatus("retrying"),
          queued: await repository.listQueueItemsByStatus("queued"),
        },
      };
    },
  };
}
