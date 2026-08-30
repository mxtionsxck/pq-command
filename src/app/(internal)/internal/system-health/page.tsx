import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Card, StatCard, StatusPill } from "@/components/ui";
import { listAiProviders } from "@/ai";
import { listJobs } from "@/jobs";
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

function labelFromStatus(status: "connected" | "configuration_required" | "failed" | "not_enabled") {
  if (status === "connected") {
    return "CONNECTED";
  }

  if (status === "configuration_required") {
    return "CONFIGURATION REQUIRED";
  }

  if (status === "failed") {
    return "FAILED";
  }

  return "NOT ENABLED";
}

export default async function SystemHealthPage() {
  await requireCurrentUserPermission("sendOutreach");

  const integrations = listIntegrations(appEnv);
  const connected = integrations.filter((item) => item.status === "connected").length;
  const attention = integrations.filter(
    (item) => item.status === "configuration_required" || item.status === "failed",
  ).length;
  const aiProviders = listAiProviders(appEnv);
  const jobs = listJobs();

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Operations"
          title="System Health"
          description="Truthful live status for integrations, AI providers, and background job coverage."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Integrations connected" value={`${connected}/${integrations.length}`} />
          <StatCard label="Needs attention" value={String(attention)} />
          <StatCard label="AI providers visible" value={String(aiProviders.length)} />
          <StatCard label="Background jobs" value={String(jobs.length)} />
        </section>

        <Card title="Integration status" eyebrow="No fake green lights">
          <div className="space-y-3">
            {integrations.map((integration) => (
              <article
                className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3"
                key={integration.name}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-white">{integration.name}</p>
                  <StatusPill tone={toneFromStatus(integration.status)}>
                    {labelFromStatus(integration.status)}
                  </StatusPill>
                </div>
                <p className="mt-1 text-xs pq-copy-muted">{integration.detail}</p>
              </article>
            ))}
          </div>
        </Card>

        <Card title="AI routing" eyebrow="Primary and fallback aware">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">primary: {appEnv.AI_PROVIDER ?? "unset"}</Badge>
            <Badge tone="info">fallback: {appEnv.AI_FALLBACK_PROVIDER ?? "unset"}</Badge>
            <Badge tone="info">model: {appEnv.AI_MODEL ?? "provider-default"}</Badge>
          </div>
          <p className="mt-3 text-sm pq-copy-muted">
            Configure Gemini and OpenAI keys to enable resilient multi-model routing for company-let lead intelligence.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
