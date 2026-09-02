import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui";
import { requireCurrentUserPermission } from "@/server/auth/session";

const settingsLinks = [
  {
    href: "/admin/integrations",
    label: "Integrations",
    description: "Connection status and configuration requirements for external services.",
  },
  {
    href: "/admin/sources",
    label: "Sources",
    description: "Connector governance, permissions, enablement, and source health.",
  },
  {
    href: "/admin/operations",
    label: "Operations",
    description: "AI activity, queue health, retries, and worker controls.",
  },
  {
    href: "/admin/scoring",
    label: "Lead Scoring",
    description: "Deterministic scoring configuration and activation history.",
  },
  {
    href: "/admin/users",
    label: "Users",
    description: "Admin-facing directory and access model scaffolding.",
  },
  {
    href: "/internal/system-health",
    label: "System Health",
    description: "Read-only operational status for integrations, AI providers, and jobs.",
  },
] as const;

export default async function SettingsPage() {
  await requireCurrentUserPermission("manageSources");

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Settings"
          title="Settings & Admin"
          description="Operational configuration surfaces for PQ COMMAND. Use these settings pages for governance, integrations, sources, and control-plane controls."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {settingsLinks.map((item) => (
            <Card key={item.href} title={item.label} eyebrow="Admin surface">
              <div className="space-y-3">
                <p className="text-sm pq-copy-muted">{item.description}</p>
                <Link
                  className="inline-flex min-h-10 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-3 text-sm text-white"
                  href={item.href}
                >
                  Open {item.label}
                </Link>
              </div>
            </Card>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
