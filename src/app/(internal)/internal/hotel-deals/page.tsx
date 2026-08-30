import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState, StatCard, StatusPill } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createHotelDealIntelligenceService } from "@/server/services/hotel-deal-intelligence-service";

import {
  createHotelHumanHandoffTaskAction,
  importPqHotelInventoryAction,
  runHotelUnifiedCycleAction,
} from "./actions";

function formatMoneyCents(cents: number | null) {
  if (cents === null) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function HotelDealsPage() {
  await requireCurrentUserPermission("sendOutreach");

  const service = createHotelDealIntelligenceService();
  const snapshot = await service.getPipelineSnapshot();
  const inventory = await service.listLiveStockUniverse(30);
  const directBuyers = await service.listDirectBuyers(20);
  const matches = await service.generateMatches(12);

  const preview = matches[0]
    ? service.buildOutreachPreview({
        stock: matches[0].stock,
        buyer: matches[0].buyer,
      })
    : null;

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Hotel Intelligence Engine unavailable"
          description="Configure DATABASE_URL so direct stock, buyer verification, matching, and human handoff can run."
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Hotel Intelligence"
          title="Direct Hotel Deal Engine"
          description="Find direct hotel stock, verify mandate chain, match direct decision-makers, and trigger human-led outreach handoff."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Hot direct stock" value={String(snapshot.hotDirectStock)} detail="DIRECT owner or mandate-first" />
          <StatCard label="Hot direct buyers" value={String(snapshot.hotDirectBuyers)} detail="Direct acquisition authority only" />
          <StatCard label="Ready to reach out" value={String(snapshot.readyToReachOut)} detail="Verified and outreach-eligible" />
          <StatCard label="Responded" value={String(snapshot.respondedHumanActionRequired)} detail="Human action required" />
          <StatCard label="Follow-ups queued" value={String(snapshot.followUps)} />
          <StatCard label="Deals in progress" value={String(snapshot.dealsInProgress)} />
        </section>

        <Card title="Priority actions" eyebrow="Most important first">
          <div className="grid gap-3 md:grid-cols-2">
            <form action={runHotelUnifiedCycleAction}>
              <Button type="submit" variant="secondary">Run dual AI cycles now</Button>
            </form>
            <form action={importPqHotelInventoryAction}>
              <Button type="submit">Load or refresh PQ supplied hotel inventory</Button>
            </form>
            <Link className="text-sm text-[color:var(--pq-accent-strong)]" href="/internal/inbox">
              Open responded inbox for handoff
            </Link>
            <p className="text-xs pq-copy-muted">No agents as primary leads. Intermediaries remain outside direct pipeline until mandate evidence is verified.</p>
            <p className="text-xs pq-copy-muted">Every claim must map to evidence before outreach can be trusted.</p>
          </div>
        </Card>

        <Card title="Top direct buyer-stock matches" eyebrow={`${matches.length} surfaced`}>
          {matches.length === 0 ? (
            <EmptyState
              title="No direct matches surfaced yet"
              description="Load inventory and verify direct buyer requirements to unlock evidence-backed match scoring."
            />
          ) : (
            <div className="space-y-3">
              {matches.map((row) => (
                <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={`${row.buyer.requirementId}-${row.stock.inventoryRef}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-white">{row.stock.hotelName} | {row.stock.location}</p>
                    <StatusPill tone={row.score >= 80 ? "success" : row.score >= 60 ? "warning" : "neutral"}>
                      MATCH {row.score}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-xs pq-copy-muted">
                    buyer {row.buyer.label} | stock directness {row.stock.directness} | price {row.stock.priceLabel ?? "TBA"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.reasons.map((reason) => (
                      <Badge key={reason} tone="info">{reason}</Badge>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Link
                      className="inline-flex min-h-10 items-center justify-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border-strong)] bg-[linear-gradient(180deg,var(--pq-accent-strong),var(--pq-accent))] px-4 text-sm font-medium text-black"
                      href="/internal/outreach"
                    >
                      REACH OUT
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card title="Live hotel stock universe" eyebrow={`${inventory.length} records (existing + newly discovered)`}>
            <div className="space-y-3">
              {inventory.map((row) => (
                <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={row.inventoryRef}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-white">{row.hotelName}</p>
                    <StatusPill
                      tone={
                        row.directness === "DIRECT_OWNER" || row.directness === "VERIFIED_MANDATE"
                          ? "success"
                          : row.directness === "INTERMEDIARY_UNVERIFIED"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {row.directness}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-xs pq-copy-muted">
                    {row.location} | {row.keys ? `${row.keys} keys` : "keys unknown"} | {row.priceLabel ?? "price tba"}
                  </p>
                  <p className="mt-1 text-xs pq-copy-muted">{row.statusLabel ?? "status unverified"}</p>
                </article>
              ))}
            </div>
          </Card>

          <Card title="Direct buyers" eyebrow={`${directBuyers.length} direct profiles`}>
            {directBuyers.length === 0 ? (
              <EmptyState
                title="No direct hotel buyer profiles"
                description="Create direct buyer requirements with hotel evidence and decision-maker context."
              />
            ) : (
              <div className="space-y-3">
                {directBuyers.map((row) => (
                  <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={row.requirementId}>
                    <p className="text-sm text-white">{row.label}</p>
                    <p className="mt-1 text-xs pq-copy-muted">
                      area {row.locationTarget ?? "unknown"} | budget {formatMoneyCents(row.budgetMinCents)}-{formatMoneyCents(row.budgetMaxCents)}
                    </p>
                    <p className="mt-1 text-xs pq-copy-muted">
                      directness {row.directnessClassification} | decision-maker hint {row.decisionMakerHint ?? "needs verification"}
                    </p>
                    <form action={createHotelHumanHandoffTaskAction} className="mt-2">
                      <input name="leadId" type="hidden" value={row.leadId} />
                      <input name="title" type="hidden" value="RESPONDED - HUMAN ACTION REQUIRED" />
                      <Button size="sm" type="submit" variant="ghost">Mark human handoff task</Button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </Card>
        </section>

        {preview ? (
          <Card title="Reach out previews" eyebrow="Evidence-backed drafts">
            <div className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] pq-copy-subtle">Buyer outreach</p>
                <pre className="whitespace-pre-wrap text-xs text-white">{preview.buyerMessage}</pre>
              </article>
              <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] pq-copy-subtle">Seller outreach</p>
                <pre className="whitespace-pre-wrap text-xs text-white">{preview.sellerMessage}</pre>
              </article>
            </div>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
