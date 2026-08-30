import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState, StatusPill } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createTenancyPaymentService } from "@/server/services/tenancy-payment-service";

import {
  createTenancyAction,
  createTenantDueAction,
  recordLandlordPaymentAction,
  recordTenantPaymentAction,
  updateTenancyStatusAction,
} from "./actions";

function pounds(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

type TenanciesPageProps = Readonly<{
  searchParams?: Promise<{
    tenancyId?: string;
    status?: string;
    q?: string;
  }>;
}>;

export default async function TenanciesPage({ searchParams }: TenanciesPageProps) {
  await requireCurrentUserPermission("sendOutreach");

  const params = searchParams ? await searchParams : undefined;
  const selectedStatus = params?.status ?? "all";
  const query = (params?.q ?? "").trim().toLowerCase();

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Tenancy workspace unavailable"
          description="Configure DATABASE_URL to operate tenancy and payment lifecycle."
        />
      </AppShell>
    );
  }

  const service = createTenancyPaymentService();
  const tenancies = await service.listTenancies();
  const snapshot = await service.getDashboardSnapshot();
  const alerts = await service.listAlerts(20);

  const filteredTenancies = tenancies.filter((row) => {
    if (selectedStatus !== "all" && row.tenancy.status !== selectedStatus) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      row.tenancy.id,
      row.property?.title ?? "",
      row.landlord?.name ?? "",
      row.deal?.id ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  const requestedTenancyId = params?.tenancyId;
  const hasRequested = requestedTenancyId
    ? filteredTenancies.some((row) => row.tenancy.id === requestedTenancyId)
    : false;
  const selectedTenancyId = hasRequested
    ? requestedTenancyId
    : filteredTenancies[0]?.tenancy.id;
  const ledger = selectedTenancyId ? await service.listLedger(selectedTenancyId) : [];
  const documents = selectedTenancyId
    ? await service.listTenancyDocuments(selectedTenancyId)
    : [];

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Operations"
          title="Tenancy Workspace"
          description="Create tenancy records, manage tenant and landlord payment flow, and monitor ledger evidence."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Outstanding" eyebrow="Tenant due not settled">
            <p className="text-2xl font-semibold text-white">{pounds(snapshot.totalOutstandingCents)}</p>
          </Card>
          <Card title="Landlord payable" eyebrow="Pending payout">
            <p className="text-2xl font-semibold text-white">{pounds(snapshot.totalLandlordPayableCents)}</p>
          </Card>
          <Card title="Overdue items" eyebrow="Requires immediate action">
            <p className="text-2xl font-semibold text-white">{snapshot.overdueEntries}</p>
          </Card>
          <Card title="Active tenancies" eyebrow="Currently live">
            <p className="text-2xl font-semibold text-white">{snapshot.activeTenancies}</p>
          </Card>
        </section>

        <Card title="Urgent payment alerts" eyebrow={`${alerts.length} item(s)`}>
          {alerts.length === 0 ? (
            <EmptyState
              title="No urgent payment alerts"
              description="No overdue, due-soon, or landlord-payable entries currently need action."
            />
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={alert.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{alert.entryType}</Badge>
                    <StatusPill
                      tone={
                        alert.computedStatus === "OVERDUE"
                          ? "danger"
                          : alert.computedStatus === "PAYABLE" || alert.computedStatus === "DUE_SOON"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {alert.computedStatus}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-xs pq-copy-muted">
                    tenancy {alert.tenancyId} | due {pounds(alert.amountDueCents)} | outstanding {pounds(alert.amountOutstandingCents)}
                  </p>
                  <div className="mt-2">
                    <Link
                      className="text-xs text-[color:var(--pq-accent-strong)]"
                      href={`/internal/tenancies?tenancyId=${alert.tenancyId}&status=all&q=`}
                    >
                      Focus tenancy
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Card title="Operational links" eyebrow="Related controls">
            <div className="space-y-3 text-sm">
              <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/rent-control">Open rent control centre</Link>
              <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/documents">Open document control</Link>
              <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/deals">Open deal room</Link>
            </div>
          </Card>

          <Card title="Create tenancy" eyebrow="Link to deal/property/company">
            <form action={createTenancyAction} className="grid gap-3 md:grid-cols-2">
              <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="dealId" placeholder="Deal ID" />
              <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="propertyId" placeholder="Property ID" />
              <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="landlordCompanyId" placeholder="Landlord company ID" />
              <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="tenantCompanyId" placeholder="Tenant company ID" />
              <select className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" defaultValue="monthly" name="rentFrequency">
                <option value="weekly">weekly</option>
                <option value="monthly">monthly</option>
                <option value="quarterly">quarterly</option>
              </select>
              <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="rentAmountCents" placeholder="Rent amount cents" type="number" required />
              <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="rentDueDayOfMonth" placeholder="Due day of month" type="number" />
              <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="landlordPaymentLeadDays" placeholder="Landlord payment lead days" type="number" />
              <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="tenancyStartDate" placeholder="Start date YYYY-MM-DD" required />
              <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="tenancyEndDate" placeholder="End date YYYY-MM-DD" />
              <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white md:col-span-2" name="paymentReference" placeholder="Payment reference" />
              <textarea className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-xs text-white md:col-span-2" name="notes" placeholder="Notes" />
              <Button type="submit">Create tenancy</Button>
            </form>
          </Card>
        </section>

        <Card title="Tenancies" eyebrow={`${tenancies.length} record(s)`}>
          <form className="mb-3 grid gap-2 md:grid-cols-4" method="get">
            <select
              className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white"
              defaultValue={selectedStatus}
              name="status"
            >
              <option value="all">all statuses</option>
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="ended">ended</option>
              <option value="cancelled">cancelled</option>
            </select>
            <input
              className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white md:col-span-2"
              defaultValue={params?.q ?? ""}
              name="q"
              placeholder="Filter by tenancy/property/landlord/deal"
            />
            <Button type="submit" variant="secondary">Apply filters</Button>
          </form>
          {filteredTenancies.length === 0 ? (
            <EmptyState title="No tenancies" description="Create the first tenancy to begin live rent ledger operations." />
          ) : (
            <div className="space-y-3">
              {filteredTenancies.map((row) => (
                <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={row.tenancy.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-white">
                      {row.property?.title ?? "Unknown property"} | landlord {row.landlord?.name ?? "unknown"}
                    </p>
                    <StatusPill tone={row.tenancy.status === "active" ? "success" : "neutral"}>
                      {row.tenancy.status}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-xs pq-copy-muted">
                    rent {row.tenancy.rentAmountCents ? pounds(row.tenancy.rentAmountCents) : "unknown"} | frequency {row.tenancy.rentFrequency}
                  </p>
                  <div className="mt-2">
                    <Link
                      className="text-xs text-[color:var(--pq-accent-strong)]"
                      href={`/internal/tenancies?tenancyId=${row.tenancy.id}&status=${selectedStatus}&q=${encodeURIComponent(params?.q ?? "")}`}
                    >
                      Focus this tenancy
                    </Link>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["draft", "active", "ended", "cancelled"] as const).map((status) => (
                      <form action={updateTenancyStatusAction} key={`${row.tenancy.id}-${status}`}>
                        <input name="tenancyId" type="hidden" value={row.tenancy.id} />
                        <input name="status" type="hidden" value={status} />
                        <Button type="submit" size="sm" variant="ghost">{status}</Button>
                      </form>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        {selectedTenancyId ? (
          <section className="grid gap-4 xl:grid-cols-2">
            <Card title="Create tenant due" eyebrow={selectedTenancyId}>
              <form action={createTenantDueAction} className="grid gap-2">
                <input name="tenancyId" type="hidden" value={selectedTenancyId} />
                <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="dueDate" placeholder="Due date YYYY-MM-DD" required />
                <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="amountDueCents" placeholder="Amount due cents" type="number" required />
                <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="paymentReference" placeholder="Payment reference" />
                <textarea className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-xs text-white" name="notes" placeholder="Notes" />
                <Button type="submit" variant="secondary">Add tenant due</Button>
              </form>
            </Card>

            <Card title="Ledger entries" eyebrow={`${ledger.length} entries`}>
              <div className="space-y-3">
                {ledger.length === 0 ? (
                  <EmptyState title="No ledger entries" description="Create a tenant due entry first." />
                ) : (
                  ledger.map((entry) => (
                    <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={entry.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="info">{entry.entryType}</Badge>
                        <StatusPill
                          tone={
                            entry.status === "OVERDUE"
                              ? "danger"
                              : entry.status === "PAYABLE" || entry.status === "DUE_SOON"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {entry.status}
                        </StatusPill>
                      </div>
                      <p className="mt-1 text-xs pq-copy-muted">
                        due {pounds(entry.amountDueCents)} | received {pounds(entry.amountReceivedCents)} | outstanding {pounds(entry.amountOutstandingCents)}
                      </p>
                      {entry.entryType === "tenant_due" ? (
                        <form action={recordTenantPaymentAction} className="mt-2 grid gap-2 md:grid-cols-4">
                          <input name="dueEntryId" type="hidden" value={entry.id} />
                          <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="amountReceivedCents" placeholder="Amount received cents" type="number" required />
                          <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="paymentDate" placeholder="Payment date YYYY-MM-DD" required />
                          <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="paymentReference" placeholder="Payment reference" />
                          <Button type="submit" size="sm" variant="ghost">Record tenant payment</Button>
                        </form>
                      ) : null}
                      {entry.entryType === "landlord_payable" ? (
                        <form action={recordLandlordPaymentAction} className="mt-2 grid gap-2 md:grid-cols-4">
                          <input name="payableEntryId" type="hidden" value={entry.id} />
                          <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="amountPaidCents" placeholder="Amount paid cents" type="number" required />
                          <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="paymentDate" placeholder="Payment date YYYY-MM-DD" required />
                          <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="paymentReference" placeholder="Payment reference" />
                          <Button type="submit" size="sm" variant="ghost">Record landlord payment</Button>
                        </form>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </Card>
          </section>
        ) : null}

        {selectedTenancyId ? (
          <Card title="Tenancy documents" eyebrow={`${documents.length} document(s)`}>
            {documents.length === 0 ? (
              <EmptyState
                title="No tenancy documents linked"
                description="Upload or link documents with tenancy ID from property/deal workflows."
              />
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-2" key={doc.id}>
                    <p className="text-xs text-white">{doc.title}</p>
                    <p className="text-xs pq-copy-muted">{doc.documentType} | status {doc.status} | v{doc.versionNumber}</p>
                  </article>
                ))}
              </div>
            )}
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
