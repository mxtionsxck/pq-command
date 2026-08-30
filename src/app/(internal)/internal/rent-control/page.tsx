import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, EmptyState, StatCard, StatusPill } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createTenancyPaymentService } from "@/server/services/tenancy-payment-service";

function pounds(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export default async function RentControlPage() {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Rent control unavailable"
          description="Configure DATABASE_URL to track live and completed deal rent metrics."
        />
      </AppShell>
    );
  }

  const service = createTenancyPaymentService();
  const snapshot = await service.getDashboardSnapshot();
  const alerts = await service.listAlerts(30);

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Operations"
          title="Rent Control Centre"
          description="End-to-end money flow: tenant due, tenant received, landlord payable, landlord paid."
        />

        <Card title="Payment alerts" eyebrow={`${alerts.length} alert item(s)`}>
          <div className="mb-3">
            <Link
              className="text-sm text-[color:var(--pq-accent-strong)]"
              href="/internal/tenancies"
            >
              Open tenancy workspace
            </Link>
          </div>
          {alerts.length === 0 ? (
            <EmptyState
              title="No payment alerts"
              description="No due/overdue/payable ledger items currently need action."
            />
          ) : (
            <div className="space-y-3">
              {alerts.map((row) => (
                <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={row.id}>
                  <p className="text-sm text-white">
                    tenancy {row.tenancyId} | {row.entryType}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill
                      tone={
                        row.computedStatus === "OVERDUE"
                          ? "danger"
                          : row.computedStatus === "DUE_SOON" || row.computedStatus === "PAYABLE"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {row.computedStatus}
                    </StatusPill>
                    {row.requiresPaymentReference ? (
                      <StatusPill tone="warning">MISSING PAYMENT REFERENCE</StatusPill>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs pq-copy-muted">
                    due {row.amountDueCents ? pounds(row.amountDueCents) : pounds(0)} | received {pounds(row.amountReceivedCents)} | outstanding {pounds(row.amountOutstandingCents)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Total outstanding" value={pounds(snapshot.totalOutstandingCents)} />
          <StatCard label="Overdue items" value={String(snapshot.overdueEntries)} />
          <StatCard label="Landlord payable" value={pounds(snapshot.totalLandlordPayableCents)} />
          <StatCard label="Due this week" value={String(snapshot.dueThisWeek)} />
          <StatCard label="Due this month" value={String(snapshot.dueThisMonth)} />
          <StatCard label="Active tenancies" value={String(snapshot.activeTenancies)} />
          <StatCard label="Total rent due" value={pounds(snapshot.totalRentDueCents)} />
          <StatCard label="Total rent received" value={pounds(snapshot.totalRentReceivedCents)} />
          <StatCard label="Paid to landlord" value={pounds(snapshot.totalPaidToLandlordCents)} />
        </section>
      </div>
    </AppShell>
  );
}
