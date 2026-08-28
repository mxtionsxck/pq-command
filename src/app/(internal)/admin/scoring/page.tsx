import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createLeadScoringService } from "@/server/services/lead-scoring-service";

import {
  activateScoringConfigAction,
  saveScoringConfigAction,
} from "./actions";

export default async function LeadScoringAdminPage() {
  await requireCurrentUserPermission("manageSources");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Lead scoring unavailable"
          description="Configure DATABASE_URL to manage scoring configs."
        />
      </AppShell>
    );
  }

  const service = createLeadScoringService();
  const configs = await service.listConfigs();
  const defaults = service.getDefaultConfig();

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin"
          title="Lead Scoring Config"
          description="Versioned deterministic scoring weights and thresholds with explicit activation controls."
        />

        <Card title="Create or update config">
          <form
            action={saveScoringConfigAction}
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          >
            <label className="space-y-2 xl:col-span-2">
              <span className="text-xs pq-copy-subtle">Version</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={defaults.version}
                name="version"
                required
              />
            </label>
            <label className="space-y-2 xl:col-span-2">
              <span className="text-xs pq-copy-subtle">Notes</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                name="notes"
              />
            </label>

            {Object.entries(defaults.weights).map(([key, value]) => (
              <label className="space-y-2" key={key}>
                <span className="text-xs pq-copy-subtle">weight {key}</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue={value}
                  min="0"
                  name={`weight_${key}`}
                  step="1"
                  type="number"
                />
              </label>
            ))}

            {Object.entries(defaults.thresholds).map(([key, value]) => (
              <label className="space-y-2" key={key}>
                <span className="text-xs pq-copy-subtle">threshold {key}</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue={value}
                  max="100"
                  min="0"
                  name={`threshold_${key}`}
                  step="1"
                  type="number"
                />
              </label>
            ))}

            <div className="xl:col-span-4">
              <Button type="submit">Save scoring config</Button>
            </div>
          </form>
        </Card>

        <Card title="Version history" eyebrow={`${configs.length} configs`}>
          {configs.length === 0 ? (
            <EmptyState
              title="No scoring config yet"
              description="Create and activate a config to control deterministic lead scoring."
            />
          ) : (
            <div className="space-y-3">
              {configs.map((config) => (
                <article
                  className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-4"
                  key={config.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {config.version}
                      </p>
                      <p className="text-xs pq-copy-muted">
                        Updated {config.updatedAt.toLocaleString("en-GB")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={config.active ? "success" : "neutral"}>
                        {config.active ? "active" : "inactive"}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-xs pq-copy-muted">
                    {config.notes ?? "No notes"}
                  </p>
                  <form action={activateScoringConfigAction} className="mt-3">
                    <input name="configId" type="hidden" value={config.id} />
                    <Button type="submit" variant="secondary">
                      Activate
                    </Button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
