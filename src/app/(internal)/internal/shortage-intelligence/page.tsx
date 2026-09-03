import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createShortageIntelligenceService } from "@/server/services/shortage-intelligence-service";

import { convertShortageTargetAction, recalculateShortageAction } from "./actions";

type PageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ShortageIntelligencePage({ searchParams }: PageProps) {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Shortage intelligence unavailable"
          description="Configure DATABASE_URL to evaluate active demand against stock."
        />
      </AppShell>
    );
  }

  const params = await searchParams;
  const service = createShortageIntelligenceService();
  const borough = readParam(params, "borough");
  const area = readParam(params, "area");
  const budgetBand = readParam(params, "budgetBand") as
    | "under_1500"
    | "1500_2500"
    | "2500_3500"
    | "3500_plus"
    | undefined;
  const availabilityWindow = readParam(params, "availabilityWindow") as
    | "now"
    | "within_30_days"
    | "31_90_days"
    | "future"
    | undefined;

  const rowsResult = await Promise.allSettled([
    service.list({
      ...(borough ? { borough } : {}),
      ...(area ? { area } : {}),
      ...(budgetBand ? { budgetBand } : {}),
      ...(availabilityWindow ? { availabilityWindow } : {}),
    }),
  ]);

  const rows = rowsResult[0].status === "fulfilled" ? rowsResult[0].value : [];
  if (rowsResult[0].status === "rejected") {
    console.error("Shortage intelligence listing failed:", rowsResult[0].reason);
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Prompt 31"
          title="Shortage Intelligence"
          description="Traceable gap analysis from active direct requirements and suitable active stock only."
        />

        <Card title="Filters and recalculation" eyebrow="No fabricated metrics">
          <form action={recalculateShortageAction} className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Borough</span>
              <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="borough" defaultValue={readParam(params, "borough") ?? ""} />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Area</span>
              <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="area" defaultValue={readParam(params, "area") ?? ""} />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Bedrooms min</span>
              <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="bedroomsMin" type="number" />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Bedrooms max</span>
              <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="bedroomsMax" type="number" />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Units min</span>
              <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="unitCountMin" type="number" />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Budget band</span>
              <select className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="budgetBand" defaultValue={readParam(params, "budgetBand") ?? ""}>
                <option value="">any</option>
                <option value="under_1500">under_1500</option>
                <option value="1500_2500">1500_2500</option>
                <option value="2500_3500">2500_3500</option>
                <option value="3500_plus">3500_plus</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Availability window</span>
              <select className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="availabilityWindow" defaultValue={readParam(params, "availabilityWindow") ?? ""}>
                <option value="">any</option>
                <option value="now">now</option>
                <option value="within_30_days">within_30_days</option>
                <option value="31_90_days">31_90_days</option>
                <option value="future">future</option>
              </select>
            </label>
            <div className="md:col-span-3 flex gap-3">
              <Button type="submit">Recalculate</Button>
              <Link className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white" href="/internal/demand-room">
                Open demand room
              </Link>
            </div>
          </form>
        </Card>

        <Card title="Gap rows" eyebrow={`${rows.length} results`}>
          {rows.length === 0 ? (
            <EmptyState
              title="No rows"
              description="Run recalculation with filters to build shortage rows."
            />
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={row.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-white">
                      {(row.area ?? row.borough ?? "unknown")} | beds {row.bedroomsBand} | units {row.unitCountBand} | budget {row.budgetBand} | {row.availabilityWindow}
                    </p>
                    <Badge tone={row.priority === "CRITICAL" || row.priority === "HIGH" ? "warning" : "info"}>
                      {row.priority}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-white">
                    demand {row.activeDemand} | stock {row.suitableStock} | gap {row.estimatedGap}
                  </p>
                  <p className="mt-1 text-xs pq-copy-muted">Trace formula: max(activeDemand - suitableStock, 0)</p>
                  <form action={convertShortageTargetAction} className="mt-3 flex flex-wrap gap-3">
                    <input name="shortageId" type="hidden" value={row.id} />
                    <label className="flex items-center gap-2 text-xs text-white">
                      <input defaultChecked name="createObjective" type="checkbox" />
                      Create sourcing objective
                    </label>
                    <label className="flex items-center gap-2 text-xs text-white">
                      <input defaultChecked name="createCampaignTarget" type="checkbox" />
                      Create campaign target (draft)
                    </label>
                    <Button type="submit" variant="secondary">Convert to target</Button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
