import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createDealRoomService } from "@/server/services/deal-room-service";

import {
  createDealAction,
  createDealTaskAction,
  transitionDealStageAction,
  updateDealDetailsAction,
} from "./actions";

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

export default async function DealsPage({ searchParams }: PageProps) {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Deal room unavailable"
          description="Configure DATABASE_URL to manage deal lifecycle."
        />
      </AppShell>
    );
  }

  const params = await searchParams;
  const selectedDealId = readParam(params, "dealId");

  const service = createDealRoomService();
  const [dealListResult, dealRoomResult] = await Promise.allSettled([
    service.listDeals(),
    selectedDealId ? service.getDealRoom(selectedDealId) : Promise.resolve(null),
  ]);

  const rows =
    dealListResult.status === "fulfilled" && Array.isArray(dealListResult.value)
      ? dealListResult.value
      : [];
  const room =
    dealRoomResult.status === "fulfilled" ? dealRoomResult.value ?? null : null;

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Prompt 34"
          title="Deal Room"
          description="Validated stage transitions, blockers, documents, tasks, timeline, and linked entities with audit trail."
        />

        <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Card title="Create deal" eyebrow="Start at MATCHED">
            <form action={createDealAction} className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Company ID</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="companyId" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Property ID</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="propertyId" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Requirement ID</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="requirementId" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Lead ID</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="leadId" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs pq-copy-subtle">Commercial summary</span>
                <textarea className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white" name="commercialSummary" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs pq-copy-subtle">Blockers (one per line)</span>
                <textarea className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white" name="blockers" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs pq-copy-subtle">Next action</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="nextAction" />
              </label>
              <div>
                <Button type="submit">Create deal</Button>
              </div>
            </form>
          </Card>

          <Card title="Links" eyebrow="Related rooms">
            <div className="space-y-3 text-sm">
              <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/viewings">
                Open viewings
              </Link>
              <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/demand-room">
                Open demand room
              </Link>
              <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/stock-room">
                Open stock room
              </Link>
            </div>
          </Card>
        </section>

        <Card title="Deals" eyebrow={`${rows.length} records`}>
          {rows.length === 0 ? (
            <EmptyState title="No deals" description="Create a deal to begin lifecycle tracking." />
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={row.deal.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-white">
                      {row.company?.name ?? "Unknown company"} | {row.property?.title ?? "Unknown property"}
                    </p>
                    <Badge tone="info">{row.deal.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs pq-copy-muted">
                    next action: {row.deal.nextAction ?? "-"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link className="inline-flex min-h-10 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-3 text-xs text-white" href={`/internal/deals?dealId=${row.deal.id}`}>
                      Open room
                    </Link>
                    {service.stageOrder.map((stage) => (
                      <form action={transitionDealStageAction} key={`${row.deal.id}-${stage}`}>
                        <input name="dealId" type="hidden" value={row.deal.id} />
                        <input name="toStage" type="hidden" value={stage} />
                        <Button type="submit" variant="ghost" size="sm">{stage}</Button>
                      </form>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        {room ? (
          <section className="grid gap-4 xl:grid-cols-2">
            <Card title="Deal detail" eyebrow={room.deal.id}>
              <form action={updateDealDetailsAction} className="grid gap-3">
                <input name="dealId" type="hidden" value={room.deal.id} />
                <label className="space-y-1">
                  <span className="text-xs pq-copy-subtle">Commercial summary</span>
                  <textarea className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white" defaultValue={room.deal.commercialSummary ?? ""} name="commercialSummary" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs pq-copy-subtle">Blockers (one per line)</span>
                  <textarea className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white" defaultValue={room.deal.blockers.join("\n")} name="blockers" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs pq-copy-subtle">Next action</span>
                  <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue={room.deal.nextAction ?? ""} name="nextAction" />
                </label>
                <Button type="submit" variant="secondary">Update deal detail</Button>
              </form>
            </Card>

            <Card title="Timeline / tasks / documents" eyebrow="Operational visibility">
              <div className="space-y-3">
                <p className="text-xs text-white">Timeline events: {room.timeline.length}</p>
                <p className="text-xs text-white">Tasks: {room.tasks.length}</p>
                <p className="text-xs text-white">Documents: {room.documents.length}</p>
                <form action={createDealTaskAction} className="grid gap-2">
                  <input name="dealId" type="hidden" value={room.deal.id} />
                  <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="title" placeholder="Task title" required />
                  <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="description" placeholder="Task description" />
                  <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="dueAt" placeholder="2026-09-10T12:00:00.000Z" />
                  <Button type="submit" variant="ghost" size="sm">Create task</Button>
                </form>
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
