import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, EmptyState } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createHotelDealIntelligenceService } from "@/server/services/hotel-deal-intelligence-service";

export default async function HotelStockSubPage() {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Hotel stock unavailable"
          description="Configure DATABASE_URL to load the direct hotel stock view."
        />
      </AppShell>
    );
  }

  try {
    const service = createHotelDealIntelligenceService();
    const [stockResult, buyersResult, matchesResult] = await Promise.allSettled([
      service.listLiveStockUniverse(50),
      service.listDirectBuyers(25),
      service.generateMatches(10),
    ]);

    const stock = stockResult.status === "fulfilled" ? stockResult.value : [];
    const buyers = buyersResult.status === "fulfilled" ? buyersResult.value : [];
    const matches = matchesResult.status === "fulfilled" ? matchesResult.value : [];
    const contacts: Array<Record<string, unknown>> = [];

    return (
      <AppShell>
        <div className="space-y-8">
          <PageHeader
            eyebrow="Hotels"
            title="Current PQ Hotel Stock"
            description="Direct hotel, hospitality, and development stock. PQ supplied records remain verification-required until direct principal evidence is established."
          />

          <Card title="Direct-only hotel stock" eyebrow="DIRECT LEADS • NO AGENTS • NO MIDDLE MEN">
            <div className="space-y-3">
              <p className="text-sm text-white">
                Supply and demand remains restricted to direct principal leads only. Intermediaries, agents, and brokers are not accepted as primary leads.
              </p>
              <p className="text-xs pq-copy-subtle">
                Verification Required • Direct seller and decision-maker evidence required before outreach.
              </p>
            </div>
          </Card>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card title="Stock" eyebrow={String(stock.length)}>
              <p className="text-sm text-white">{stock.length === 0 ? "Stock temporarily unavailable" : "Records loaded"}</p>
            </Card>
            <Card title="Buyers" eyebrow={String(buyers.length)}>
              <p className="text-sm text-white">{buyers.length === 0 ? "No direct buyers currently available" : "Buyer profiles loaded"}</p>
            </Card>
            <Card title="Matches" eyebrow={String(matches.length)}>
              <p className="text-sm text-white">{matches.length === 0 ? "No matches yet" : "Matches available"}</p>
            </Card>
            <Card title="Contacts" eyebrow={String(contacts.length)}>
              <p className="text-sm text-white">{contacts.length === 0 ? "No verified contacts available" : "Contacts loaded"}</p>
            </Card>
          </section>
        </div>
      </AppShell>
    );
  } catch {
    return (
      <AppShell>
        <EmptyState
          title="Hotel stock temporarily unavailable"
          description="The hotel stock data layer is re-syncing or unavailable right now. Please try again shortly."
        />
      </AppShell>
    );
  }
}
