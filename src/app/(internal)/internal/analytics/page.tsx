import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, EmptyState, StatCard } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createAiAcquisitionOrchestratorService } from "@/server/services/ai-acquisition-orchestrator-service";
import { createAnalyticsAttributionService } from "@/server/services/analytics-attribution-service";

import { refreshAnalyticsSnapshotAction } from "./actions";

type AnalyticsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function toDate(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Analytics unavailable"
          description="Configure DATABASE_URL to compute real funnel analytics."
        />
      </AppShell>
    );
  }

  const params = await searchParams;
  const service = createAnalyticsAttributionService();
  const orchestratorService = createAiAcquisitionOrchestratorService();

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sourceId = readParam(params, "sourceId");
  const campaignId = readParam(params, "campaignId");
  const leadType = readParam(params, "leadType") as
    | "supply"
    | "demand"
    | "ai_discovered"
    | undefined;
  const area = readParam(params, "area");
  const bedroomsBand = readParam(params, "bedroomsBand");
  const agentUserId = readParam(params, "agentUserId");

  const filter = {
    periodStart: toDate(readParam(params, "periodStart"), start),
    periodEnd: toDate(readParam(params, "periodEnd"), now),
    ...(sourceId ? { sourceId } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...(leadType ? { leadType } : {}),
    ...(area ? { area } : {}),
    ...(bedroomsBand ? { bedroomsBand } : {}),
    ...(agentUserId ? { agentUserId } : {}),
  };

  const [funnel, snapshots, northStar] = await Promise.all([
    service.computeFunnel(filter),
    service.listSnapshots({ periodStart: filter.periodStart, periodEnd: filter.periodEnd }),
    orchestratorService.getCommercialNorthStarSnapshot(),
  ]);

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Prompt 39"
          title="Analytics & Attribution"
          description="Funnel values are computed from real event tables and traceable snapshot records."
        />

        <Card title="Filter and persist snapshot" eyebrow="No fake numbers">
          <form action={refreshAnalyticsSnapshotAction} className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Period start</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filter.periodStart.toISOString().slice(0, 10)}
                name="periodStart"
                type="date"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Period end</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filter.periodEnd.toISOString().slice(0, 10)}
                name="periodEnd"
                type="date"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Lead type</span>
              <select
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filter.leadType ?? ""}
                name="leadType"
              >
                <option value="">any</option>
                <option value="supply">supply</option>
                <option value="demand">demand</option>
                <option value="ai_discovered">ai_discovered</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Source ID</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filter.sourceId ?? ""}
                name="sourceId"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Campaign ID</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filter.campaignId ?? ""}
                name="campaignId"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Area</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filter.area ?? ""}
                name="area"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Bedrooms band</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filter.bedroomsBand ?? ""}
                name="bedroomsBand"
                placeholder="2-3 or 4+"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Agent user ID</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filter.agentUserId ?? ""}
                name="agentUserId"
              />
            </label>
            <div className="self-end">
              <Button type="submit">Persist snapshot</Button>
            </div>
          </form>
        </Card>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Completed lets this week"
            value={String(northStar.completedLetsThisWeek)}
            detail={`Target ${northStar.weeklyTargetLow}-${northStar.weeklyTargetHigh}`}
          />
          <StatCard
            label="Pipeline fee value"
            value={new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: "GBP",
              maximumFractionDigits: 0,
            }).format(northStar.pipelineValueCents / 100)}
            detail="Deal values currently drive commercial pipeline"
          />
          <StatCard
            label="Weighted pipeline"
            value={new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: "GBP",
              maximumFractionDigits: 0,
            }).format(northStar.weightedPipelineValueCents / 100)}
            detail="Stage-weighted revenue probability"
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {funnel.metrics.map((metric) => (
            <StatCard
              key={metric.metric}
              label={metric.metric.replaceAll("_", " ")}
              value={String(metric.value)}
              detail="Computed from live records"
            />
          ))}
        </section>

        <Card title="Recent snapshots" eyebrow={`${snapshots.length} rows`}>
          {snapshots.length === 0 ? (
            <EmptyState title="No snapshots" description="Persist a snapshot to keep auditable trend history." />
          ) : (
            <div className="space-y-2">
              {snapshots.map((item) => (
                <article key={item.id} className="rounded border border-[color:var(--pq-border)] p-2">
                  <p className="text-xs text-white">{item.metric} | {item.value}</p>
                  <p className="text-xs pq-copy-muted">
                    {item.periodStart.toISOString().slice(0, 10)} to {item.periodEnd.toISOString().slice(0, 10)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
