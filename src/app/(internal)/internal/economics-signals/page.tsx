import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createEconomicsSignalService } from "@/server/services/economics-signal-service";

import { addLhaRateAction, evaluateEconomicsSignalAction } from "./actions";

export default async function EconomicsSignalsPage() {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Economics signals unavailable"
          description="Configure DATABASE_URL to store approved LHA rates and informational deltas."
        />
      </AppShell>
    );
  }

  const service = createEconomicsSignalService();
  const rows = await service.listSignals();

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Prompt 32"
          title="LHA Signal Module"
          description="Informational economics signals only, with approved-rate provenance and optional notifications."
        />

        <section className="grid gap-4 xl:grid-cols-2">
          <Card title="Add approved rate" eyebrow="Rate provenance">
            <form action={addLhaRateAction} className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Borough</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="borough" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Area</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="area" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Bedroom band</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="bedroomBand" placeholder="1,2,3,4+" required />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Monthly rate (GBP)</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="monthlyRate" type="number" required />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Rate source</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="rateSource" required />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Rate version</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="rateVersion" required />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs pq-copy-subtle">Rate reference URL or citation</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="rateReference" required />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Rate date</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="rateDate" type="date" required />
              </label>
              <label className="flex items-center gap-2 text-xs text-white">
                <input name="sourceApproved" type="checkbox" required />
                Source approved
              </label>
              <div className="md:col-span-2">
                <Button type="submit">Store rate</Button>
              </div>
            </form>
          </Card>

          <Card title="Evaluate property" eyebrow="Informational only">
            <form action={evaluateEconomicsSignalAction} className="grid gap-3">
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Property ID</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="propertyId" required />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Bedroom band (optional override)</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="bedroomBand" placeholder="1,2,3,4+" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Rate version (optional)</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="rateVersion" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Notify manager user ID (optional)</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="notifyManagerUserId" />
              </label>
              <label className="flex items-center gap-2 text-xs text-white">
                <input defaultChecked name="notifyEnabled" type="checkbox" />
                Notify manager about this informational signal
              </label>
              <Button type="submit" variant="secondary">Evaluate signal</Button>
            </form>
            <p className="mt-3 text-xs pq-copy-muted">
              This module does not claim council acceptance and does not auto-place properties.
            </p>
            <p className="mt-2">
              <Link className="text-sm text-[color:var(--pq-accent-strong)]" href="/internal/stock-room">
                Open stock room
              </Link>
            </p>
          </Card>
        </section>

        <Card title="Signals" eyebrow={`${rows.length} records`}>
          {rows.length === 0 ? (
            <EmptyState
              title="No economics signals"
              description="Store an approved rate and evaluate a property to generate informational deltas."
            />
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={row.signal.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-white">{row.property.title}</p>
                    <Badge tone="info">{row.signal.signalStatus}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-white">
                    band {row.signal.bedroomBand} | rent {(row.signal.knownRentCents / 100).toFixed(0)} GBP | rate {(row.signal.lhaRateCents / 100).toFixed(0)} GBP | diff {(row.signal.differenceCents / 100).toFixed(0)} GBP
                  </p>
                  <p className="text-xs pq-copy-muted">
                    source: {row.rate.rateSource} | ref: {row.rate.rateReference} | version: {row.rate.rateVersion}
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
