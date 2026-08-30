import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, EmptyState, StatCard, StatusPill } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createCommandCentreService } from "@/server/services/command-centre-service";

export default async function CommandCentrePage() {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Command Centre unavailable"
          description="Configure DATABASE_URL to compute live intelligence metrics."
        />
      </AppShell>
    );
  }

  const service = createCommandCentreService();
  const snapshot = await service.getSnapshot();

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Monday Morning"
          title="PQ Command Centre"
          description="What happened, what matters now, and what your team should do first."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Active deals" value={String(snapshot.activeDeals)} detail={<Link href="/internal/deals">Open deals</Link>} />
          <StatCard label="Hot replies" value={String(snapshot.hotReplies)} detail={<Link href="/internal/inbox">Open inbox</Link>} />
          <StatCard label="Viewings today" value={String(snapshot.viewingsToday)} detail={<Link href="/internal/viewings">Open viewings</Link>} />
          <StatCard label="Qualified leads" value={String(snapshot.qualifiedSupply)} detail={<Link href="/internal/leads?view=qualified">Open qualified leads</Link>} />
          <StatCard label="Direct demand" value={String(snapshot.directDemand)} detail={<Link href="/internal/demand-room">Open demand room</Link>} />
          <StatCard label="Overnight discoveries" value={String(snapshot.overnightIntelligence)} detail="New leads in last 12h" />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Stalled actions" value={String(snapshot.stalledItems)} detail="Overdue todo or in-progress tasks" />
          <StatCard label="Supply gap" value={String(snapshot.supplyGap)} detail={<Link href="/internal/shortage-intelligence">Open shortage intelligence</Link>} />
          <StatCard label="Automation queue" value={String(snapshot.queueDepth)} detail={<Link href="/admin/operations">Open operations console</Link>} />
        </section>

        <Card title="Start-of-day run order" eyebrow="Do these first">
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p className="pq-copy-muted">1. Handle HOT replies first.</p>
            <p className="pq-copy-muted">2. Review qualified leads.</p>
            <p className="pq-copy-muted">3. Approve or edit outbound queue.</p>
            <p className="pq-copy-muted">4. Work best stock-demand matches.</p>
            <p className="pq-copy-muted">5. Book and complete viewings.</p>
            <p className="pq-copy-muted">6. Progress deals.</p>
            <p className="pq-copy-muted">7. Review AI activity only where exceptions exist.</p>
            <p className="pq-copy-muted">8. End day with clean next actions.</p>
          </div>
        </Card>

        <Card title="Top acquisition targets" eyebrow={`${snapshot.topAcquisitionTargets.length} targets`}>
          {snapshot.topAcquisitionTargets.length === 0 ? (
            <EmptyState
              title="No shortage targets"
              description="Run shortage recalculation to surface critical gaps."
            />
          ) : (
            <div className="space-y-3">
              {snapshot.topAcquisitionTargets.map((row) => (
                <article key={row.id} className="rounded border border-[color:var(--pq-border)] p-3">
                  <p className="text-sm text-white">
                    {row.area ?? row.borough ?? "unknown"} | beds {row.bedroomsBand} | budget {row.budgetBand}
                  </p>
                  <p className="mt-1 text-xs pq-copy-muted">Gap {row.estimatedGap}</p>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card title="Your next 5 actions" eyebrow={`${snapshot.nextActions.length} tasks`}>
          {snapshot.nextActions.length === 0 ? (
            <EmptyState title="No open actions" description="No pending tasks are currently due." />
          ) : (
            <div className="space-y-3">
              {snapshot.nextActions.map((task) => (
                <article key={task.id} className="rounded border border-[color:var(--pq-border)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white">{task.title}</p>
                    <StatusPill tone={task.status === "in_progress" ? "warning" : "neutral"}>{task.status}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs pq-copy-muted">
                    due {task.dueAt ? task.dueAt.toLocaleString("en-GB") : "not set"} | priority {task.priority}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card title="AI worker health" eyebrow={`${snapshot.workerHealth.length} workers`}>
          <div className="space-y-3">
            {snapshot.workerHealth.map((worker) => (
              <article key={worker.workerName} className="rounded border border-[color:var(--pq-border)] p-3">
                <div className="flex items-center justify-between gap-2">
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
              </article>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
