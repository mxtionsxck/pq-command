import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Card, EmptyState, StatusPill } from "@/components/ui";
import { listIntegrations } from "@/integrations";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";

function toneFromStatus(status: "connected" | "configuration_required" | "failed" | "not_enabled") {
  if (status === "connected") {
    return "success" as const;
  }

  if (status === "configuration_required") {
    return "warning" as const;
  }

  if (status === "failed") {
    return "danger" as const;
  }

  return "neutral" as const;
}

export default async function AdminIntegrationsPage() {
  await requireCurrentUserPermission("manageSources");

  const integrations = listIntegrations(appEnv);
  const connected = integrations.filter((item) => item.status === "connected").length;

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin"
          title="Integrations"
          description="Single source of truth for connection status and setup requirements."
        />

        {integrations.length === 0 ? (
          <EmptyState
            title="No integrations registered"
            description="Configure at least one external integration to enable live AI and outreach workflows."
          />
        ) : (
          <>
            <Card title="Status summary" eyebrow={`${connected}/${integrations.length} connected`}>
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">Connected: {connected}</Badge>
                <Badge tone="warning">
                  Needs config: {integrations.filter((item) => item.status === "configuration_required").length}
                </Badge>
                <Badge tone="warning">
                  Not enabled: {integrations.filter((item) => item.status === "not_enabled").length}
                </Badge>
              </div>
            </Card>

            <Card title="Integration checklist" eyebrow="Truthful states only">
              <div className="space-y-3">
                {integrations.map((integration) => (
                  <article
                    className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3"
                    key={integration.name}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-white">{integration.name}</p>
                      <StatusPill tone={toneFromStatus(integration.status)}>
                        {integration.status.replaceAll("_", " ").toUpperCase()}
                      </StatusPill>
                    </div>
                    <p className="mt-1 text-xs pq-copy-muted">{integration.detail}</p>
                  </article>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
