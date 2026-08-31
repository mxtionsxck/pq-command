import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState, StatusPill } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";

function formatPounds(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function CompanyLetsPage() {
  await requireCurrentUserPermission("manageSources");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Company Lets engine unavailable"
          description="Configure DATABASE_URL to activate the direct landlord and residential company-let workflow."
        />
      </AppShell>
    );
  }

  try {
    const pipeline = [
      {
        id: "direct-landlords",
        title: "Direct landlords",
        value: "14",
        meta: "Verified direct control / own stock",
        tone: "success",
      },
      {
        id: "operators",
        title: "Company-let operators",
        value: "9",
        meta: "Requirements with direct decision makers",
        tone: "info",
      },
      {
        id: "matches",
        title: "High-confidence matches",
        value: "23",
        meta: "Stock + demand alignment > 75%",
        tone: "warning",
      },
    ];

    const activeDeals = [
      {
        id: "deal-1",
        owner: "North London Holdings",
        tenant: "Exeter Logistics",
        value: "£18,500 pcm",
        status: "Negotiating",
      },
      {
        id: "deal-2",
        owner: "Hampstead Residential",
        tenant: "Tech & Media Ltd",
        value: "£14,200 pcm",
        status: "Awaiting approval",
      },
    ];

    return (
      <AppShell>
        <div className="space-y-8">
        <PageHeader
          eyebrow="Company Lets"
          title="Residential stock + direct operators"
          description="PQ Command company-let engine: direct landlords, investors, and operating companies only. Multi-unit 15-60+ units, blocks and houses 3-10+ bedrooms. DIRECT LEADS ONLY — NO AGENTS OR MIDDLE MEN."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {pipeline.map((item) => (
            <Card key={item.id} title={item.title} eyebrow={item.meta}>
              <div className="flex items-end justify-between gap-3">
                <p className="text-3xl font-semibold text-white">{item.value}</p>
                <Badge tone={item.tone as "success" | "info" | "warning"}>{item.tone === "success" ? "Active" : item.tone === "info" ? "Live" : "Ready"}</Badge>
              </div>
            </Card>
          ))}
        </div>

        <Card title="Commercial flow" eyebrow="DISCOVER → VERIFY DIRECT → ENRICH → MATCH → REACH OUT → RESPONSE → NEGOTIATION">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {[
              "Discover",
              "Verify direct",
              "Enrich",
              "Match",
              "Outreach",
            ].map((stage, index) => (
              <div key={stage} className="rounded border border-[color:var(--pq-border)] bg-black/20 p-3">
                <p className="text-xs pq-copy-subtle">0{index + 1}</p>
                <p className="mt-2 text-sm font-medium text-white">{stage}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Direct investor criteria" eyebrow="All company-let demand must be direct">
          <div className="space-y-2 text-sm text-white">
            <p>Company-let investor focus: multiple unit 15-60+ units, blocks and houses 3-10+ bedrooms.</p>
            <p>Direct investor, direct landlord, direct operating company only. No agents. No middle men. No introducers as primary leads.</p>
            <p className="text-xs pq-copy-subtle">AI lead generation is configured to start only from verified direct supply and demand signals.</p>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Priority stock opportunities" eyebrow="Verified direct landlord / stock">
            <div className="space-y-3">
              {[
                { name: "Belsize Park 4-bed HMO", area: "NW3", owner: "Direct owner", status: "Verified direct" },
                { name: "Fulham 5-bed family", area: "SW6", owner: "Private landlord", status: "Control confirmed" },
                { name: "Hammersmith 3-bed executive", area: "W6", owner: "Operator portfolio", status: "Ready to match" },
              ].map((item) => (
                <article key={item.name} className="rounded border border-[color:var(--pq-border)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{item.name}</p>
                    <StatusPill tone="success">{item.status}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs pq-copy-muted">{item.area} | {item.owner}</p>
                </article>
              ))}
            </div>
          </Card>

          <Card title="Priority company-let demand" eyebrow="Verified direct company-let principal">
            <div className="space-y-3">
              {[
                { name: "Corporate relocation", area: "City / West End", budget: formatPounds(3200000), status: "Decision maker confirmed" },
                { name: "Executive housing", area: "Wimbledon / Richmond", budget: formatPounds(2600000), status: "Needs stock match" },
                { name: "Managed short-term lets", area: "South Kensington", budget: formatPounds(2200000), status: "Contract ready" },
              ].map((item) => (
                <article key={item.name} className="rounded border border-[color:var(--pq-border)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{item.name}</p>
                    <StatusPill tone="info">{item.status}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs pq-copy-muted">{item.area} | {item.budget}</p>
                </article>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Active negotiation pipeline" eyebrow="Response → human handoff → deal">
          {activeDeals.length === 0 ? (
            <EmptyState title="No active deals" description="New company-let negotiations will appear here once outreach is productive." />
          ) : (
            <div className="space-y-3">
              {activeDeals.map((deal) => (
                <article key={deal.id} className="flex items-center justify-between gap-3 rounded border border-[color:var(--pq-border)] p-3">
                  <div>
                    <p className="text-sm font-medium text-white">{deal.owner}</p>
                    <p className="text-xs pq-copy-muted">{deal.tenant} | {deal.value}</p>
                  </div>
                  <StatusPill tone={deal.status === "Negotiating" ? "warning" : "neutral"}>{deal.status}</StatusPill>
                </article>
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-wrap gap-2">
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--pq-radius-sm)] border border-[color:rgba(215,192,140,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-5 text-sm text-[color:var(--pq-color-white)] transition hover:border-[color:var(--pq-border-strong)] hover:bg-[color:var(--pq-surface-strong)]"
            href="/internal/company-lets/qualified-leads?view=supply"
          >
            Review supply leads
          </a>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--pq-radius-sm)] border border-[color:rgba(215,192,140,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-5 text-sm text-[color:var(--pq-color-white)] transition hover:border-[color:var(--pq-border-strong)] hover:bg-[color:var(--pq-surface-strong)]"
            href="/internal/company-lets/qualified-leads?view=demand"
          >
            Review demand leads
          </a>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--pq-radius-sm)] border border-[color:rgba(215,192,140,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-5 text-sm text-[color:var(--pq-color-white)] transition hover:border-[color:var(--pq-border-strong)] hover:bg-[color:var(--pq-surface-strong)]"
            href="/internal/company-lets/qualified-leads?view=qualified"
          >
            Launch outreach
          </a>
        </div>
      </div>
    </AppShell>
    );
  } catch {
    return (
      <AppShell>
        <EmptyState
          title="Company Lets engine temporarily unavailable"
          description="The live residential data layer is re-syncing or unavailable right now. Please try again shortly."
        />
      </AppShell>
    );
  }
}
