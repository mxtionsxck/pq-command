import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState, StatusPill } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createBackgroundJobInfrastructureService } from "@/server/services/background-job-infrastructure-service";
import { createOutreachService } from "@/server/services/outreach-service";

import {
  clearGracefulShutdownAction,
  requestGracefulShutdownAction,
  retryQueueItemAction,
  runDueJobsAction,
  setGlobalLevel3AutonomyAction,
  scheduleDefaultJobsAction,
  setWorkerPausedAction,
} from "./actions";

type OperationsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function OperationsPage({ searchParams }: OperationsPageProps) {
  const user = await requireCurrentUserPermission("manageSources");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Operations console unavailable"
          description="Configure DATABASE_URL to view queue and worker operations."
        />
      </AppShell>
    );
  }

  const params = await searchParams;
  const service = createBackgroundJobInfrastructureService();
  const outreachService = createOutreachService();
  const workerName = readParam(params, "workerName") as
    | "discovery"
    | "research"
    | "scoring"
    | "outreach_planning"
    | "inbox_sync"
    | "reply_analysis"
    | "matching"
    | "shortage"
    | "deal_watcher"
    | "cleanup"
    | undefined;
  const status = readParam(params, "status");
  const sourceId = readParam(params, "sourceId");

  const [health, snapshot, globalLevel3Enabled] = await Promise.all([
    service.workerHealth(),
    service.activitySnapshot({
      ...(workerName ? { workerName } : {}),
      ...(status ? { status } : {}),
      ...(sourceId ? { sourceId } : {}),
    }),
    outreachService.getGlobalLevel3Enabled(),
  ]);

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Prompt 36"
          title="AI Activity & Operations"
          description="Monitor workers, queue depth, retries, dead-letter state, and source health without exposing credentials."
        />

        <Card title="Control plane" eyebrow="Admin and manager only">
          <div className="flex flex-wrap gap-3">
            <form action={scheduleDefaultJobsAction}>
              <Button type="submit">Schedule default jobs</Button>
            </form>
            <form action={runDueJobsAction}>
              <Button type="submit" variant="secondary">
                Run due jobs now
              </Button>
            </form>
            <form action={requestGracefulShutdownAction}>
              <Button type="submit" variant="ghost">
                Request graceful shutdown
              </Button>
            </form>
            <form action={clearGracefulShutdownAction}>
              <Button type="submit" variant="ghost">
                Clear shutdown request
              </Button>
            </form>
          </div>
          {user.role === "ADMIN" ? (
            <div className="mt-4 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3">
              <p className="text-xs uppercase tracking-[0.2em] pq-copy-subtle">Prompt 41 autonomy control</p>
              <p className="mt-1 text-sm text-white">
                Global Level 3 autonomy is {globalLevel3Enabled ? "enabled" : "disabled"}.
              </p>
              <form action={setGlobalLevel3AutonomyAction} className="mt-3 flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-white">
                  <input defaultChecked={globalLevel3Enabled} name="enabled" type="checkbox" />
                  Enable Level 3 globally
                </label>
                <Button type="submit" variant="secondary">Save autonomy switch</Button>
              </form>
            </div>
          ) : null}
        </Card>

        <Card title="Worker health" eyebrow={`${health.length} workers`}>
          {health.length === 0 ? (
            <EmptyState title="No worker health" description="Run worker health refresh by loading this page after scheduling jobs." />
          ) : (
            <div className="space-y-3">
              {health.map((worker) => (
                <article
                  key={worker.workerName}
                  className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-white">{worker.workerName}</p>
                    <StatusPill
                      tone={
                        worker.status === "healthy"
                          ? "success"
                          : worker.status === "degraded"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {worker.status}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-xs pq-copy-muted">
                    queue {worker.queueDepth} | running {worker.runningCount} | failures {worker.recentFailures}
                  </p>
                  <p className="mt-1 text-xs pq-copy-muted">
                    last run {worker.lastRun ? worker.lastRun.toLocaleString("en-GB") : "none"}
                  </p>
                  <form action={setWorkerPausedAction} className="mt-3 flex flex-wrap items-center gap-3">
                    <input type="hidden" name="workerName" value={worker.workerName} />
                    <label className="flex items-center gap-2 text-xs text-white">
                      <input type="checkbox" name="paused" defaultChecked={worker.paused} /> Pause
                    </label>
                    <label className="flex items-center gap-2 text-xs text-white">
                      Concurrency
                      <input
                        className="w-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-2 py-1 text-xs text-white"
                        defaultValue="1"
                        min="1"
                        name="concurrencyLimit"
                        type="number"
                      />
                    </label>
                    <Button type="submit" variant="secondary">
                      Save
                    </Button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent runs" eyebrow={`${snapshot.runs.length} records`}>
          {snapshot.runs.length === 0 ? (
            <EmptyState title="No runs" description="No worker activity yet." />
          ) : (
            <div className="space-y-3">
              {snapshot.runs.map((run) => (
                <article
                  key={run.id}
                  className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-white">{run.workerName} | {run.status}</p>
                    <Badge tone={run.deadLettered ? "warning" : "info"}>attempt {run.attempt}/{run.maxAttempts}</Badge>
                  </div>
                  <p className="mt-1 text-xs pq-copy-muted">{run.errorMessage ?? "No error"}</p>
                  <p className="mt-1 text-xs pq-copy-muted">items {run.itemsProcessed}</p>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent failures" eyebrow={`${snapshot.failures.length} records`}>
          {snapshot.failures.length === 0 ? (
            <EmptyState title="No failures" description="No failed/dead-letter runs found." />
          ) : (
            <div className="space-y-3">
              {snapshot.failures.map((failure) => (
                <article
                  key={failure.id}
                  className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3"
                >
                  <p className="text-xs text-white">{failure.workerName} | {failure.status}</p>
                  <p className="mt-1 text-xs pq-copy-muted">{failure.errorMessage ?? "Unknown error"}</p>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card title="Queue exceptions" eyebrow="Retry controls">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] pq-copy-subtle">Dead letter</p>
              {snapshot.queue.deadLetter.map((item) => (
                <form key={item.id} action={retryQueueItemAction} className="rounded border border-[color:var(--pq-border)] p-2">
                  <input type="hidden" name="queueItemId" value={item.id} />
                  <p className="text-xs text-white">{item.workerName}</p>
                  <p className="text-xs pq-copy-muted">{item.deadLetterReason ?? item.lastError ?? "n/a"}</p>
                  <Button type="submit" variant="ghost">Retry</Button>
                </form>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] pq-copy-subtle">Retrying</p>
              {snapshot.queue.retrying.map((item) => (
                <article key={item.id} className="rounded border border-[color:var(--pq-border)] p-2">
                  <p className="text-xs text-white">{item.workerName}</p>
                  <p className="text-xs pq-copy-muted">next {item.scheduledFor.toLocaleString("en-GB")}</p>
                </article>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] pq-copy-subtle">Queued</p>
              {snapshot.queue.queued.map((item) => (
                <article key={item.id} className="rounded border border-[color:var(--pq-border)] p-2">
                  <p className="text-xs text-white">{item.workerName}</p>
                  <p className="text-xs pq-copy-muted">scheduled {item.scheduledFor.toLocaleString("en-GB")}</p>
                </article>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Source health" eyebrow={`${snapshot.sources.length} records`}>
          <div className="space-y-2">
            {snapshot.sources.map((source) => (
              <article key={source.id} className="rounded border border-[color:var(--pq-border)] p-2">
                <p className="text-xs text-white">{source.name}</p>
                <p className="text-xs pq-copy-muted">
                  health {source.health} | permission {source.permissionStatus} | {source.enabled ? "enabled" : "disabled"}
                </p>
              </article>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
