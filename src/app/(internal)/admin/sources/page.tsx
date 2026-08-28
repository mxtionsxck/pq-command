import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState, StatusPill } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createDiscoveryPipelineService } from "@/server/services/discovery-pipeline-service";
import { createSourceRegistryService } from "@/server/services/source-registry-service";

import {
  archiveSourceAction,
  assertSourceJobAllowedAction,
  createSourceAction,
  disableSourceAction,
  updateSourceAction,
} from "./actions";
import {
  runConfiguredDiscoveryPipelineAction,
  runMockDiscoveryPipelineAction,
} from "./pipeline-actions";

type SourceRegistryPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  return Array.isArray(value) ? value[0] : value;
}

export default async function SourceRegistryPage({
  searchParams,
}: SourceRegistryPageProps) {
  await requireCurrentUserPermission("manageSources");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Source Registry unavailable"
          description="Configure DATABASE_URL to manage source connectors and permissions."
        />
      </AppShell>
    );
  }

  const params = await searchParams;
  const search = readParam(params, "search") ?? "";
  const service = createSourceRegistryService();
  const pipelineService = createDiscoveryPipelineService();
  const sources = await service.listSources(search);
  const jobRuns = await pipelineService.listRecentRuns();

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin"
          title="Source Registry"
          description="Connector governance with permission statuses, allowed data boundaries, and immediate disable controls."
        />

        <Card title="Search sources">
          <form className="grid gap-3 md:grid-cols-[1fr_auto]" method="get">
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={search}
              name="search"
              placeholder="Search by name, connector key, allowed data"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </Card>

        <Card title="Create source">
          <form
            action={createSourceAction}
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          >
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Name</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                name="name"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Type</span>
              <select
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue="manual"
                name="kind"
              >
                <option value="portal">portal</option>
                <option value="manual">manual</option>
                <option value="referral">referral</option>
                <option value="partner">partner</option>
                <option value="website">website</option>
                <option value="other">other</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Connector key</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                name="connectorKey"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Permission status</span>
              <select
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue="REVIEW_REQUIRED"
                name="permissionStatus"
              >
                <option value="APPROVED">APPROVED</option>
                <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
                <option value="BLOCKED">BLOCKED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Allowed data</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                name="allowedData"
                placeholder="listings, contact_info"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">
                Rate limit / minute
              </span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue="30"
                min="1"
                name="rateLimitPerMinute"
                type="number"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Health</span>
              <select
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue="unknown"
                name="health"
              >
                <option value="healthy">healthy</option>
                <option value="degraded">degraded</option>
                <option value="offline">offline</option>
                <option value="unknown">unknown</option>
              </select>
            </label>
            <label className="flex items-center gap-3 text-sm text-white">
              <input defaultChecked name="enabled" type="checkbox" /> Enabled
            </label>
            <label className="space-y-2 xl:col-span-3">
              <span className="text-xs pq-copy-subtle">Notes</span>
              <textarea
                className="min-h-24 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                name="notes"
              />
            </label>
            <label className="space-y-2 xl:col-span-3">
              <span className="text-xs pq-copy-subtle">Config JSON</span>
              <textarea
                className="min-h-32 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                defaultValue='{"urls":["https://www.gumtree.com/search?search_category=property-to-rent"],"domainRegistry":[{"domain":"www.gumtree.com","permissionStatus":"REVIEW_REQUIRED","robotsAllowed":false,"termsAllowed":false,"crawlDelayMs":1000,"maxRequestsPerMinute":6}],"sourceProvenance":"portal_public"}'
                name="configJson"
              />
            </label>
            <div>
              <Button type="submit">Create source</Button>
            </div>
          </form>
        </Card>

        <Card title="Registered sources" eyebrow={`${sources.length} records`}>
          {sources.length === 0 ? (
            <EmptyState
              title="No sources"
              description="Create a source to activate connector governance."
            />
          ) : (
            <div className="space-y-4">
              {sources.map((source) => (
                <article
                  className="rounded-[var(--pq-radius-md)] border border-[color:var(--pq-border)] p-4"
                  key={source.id}
                >
                  <form
                    action={updateSourceAction}
                    className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                  >
                    <input name="sourceId" type="hidden" value={source.id} />
                    <label className="space-y-1">
                      <span className="text-xs pq-copy-subtle">Name</span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={source.name}
                        name="name"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs pq-copy-subtle">Type</span>
                      <select
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={source.kind}
                        name="kind"
                      >
                        <option value="portal">portal</option>
                        <option value="manual">manual</option>
                        <option value="referral">referral</option>
                        <option value="partner">partner</option>
                        <option value="website">website</option>
                        <option value="other">other</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs pq-copy-subtle">
                        Connector key
                      </span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={source.connectorKey ?? ""}
                        name="connectorKey"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs pq-copy-subtle">Permission</span>
                      <select
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={source.permissionStatus}
                        name="permissionStatus"
                      >
                        <option value="APPROVED">APPROVED</option>
                        <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
                        <option value="BLOCKED">BLOCKED</option>
                        <option value="DISABLED">DISABLED</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs pq-copy-subtle">
                        Allowed data
                      </span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={source.allowedData ?? ""}
                        name="allowedData"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs pq-copy-subtle">
                        Rate limit/min
                      </span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={source.rateLimitPerMinute ?? ""}
                        name="rateLimitPerMinute"
                        type="number"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs pq-copy-subtle">Health</span>
                      <select
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={source.health}
                        name="health"
                      >
                        <option value="healthy">healthy</option>
                        <option value="degraded">degraded</option>
                        <option value="offline">offline</option>
                        <option value="unknown">unknown</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-3 text-sm text-white">
                      <input
                        defaultChecked={source.enabled}
                        name="enabled"
                        type="checkbox"
                      />{" "}
                      Enabled
                    </label>
                    <label className="space-y-1 xl:col-span-3">
                      <span className="text-xs pq-copy-subtle">Notes</span>
                      <textarea
                        className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                        defaultValue={source.notes ?? ""}
                        name="notes"
                      />
                    </label>
                    <label className="space-y-1 xl:col-span-3">
                      <span className="text-xs pq-copy-subtle">Config JSON</span>
                      <textarea
                        className="min-h-28 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                        defaultValue={JSON.stringify(source.config ?? {}, null, 2)}
                        name="configJson"
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2 xl:col-span-3">
                      <Badge tone="info">{source.permissionStatus}</Badge>
                      <Badge tone={source.enabled ? "success" : "warning"}>
                        {source.enabled ? "enabled" : "disabled"}
                      </Badge>
                      <StatusPill
                        tone={
                          source.health === "healthy"
                            ? "success"
                            : source.health === "offline"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {source.health}
                      </StatusPill>
                    </div>
                    <div className="flex flex-wrap gap-3 xl:col-span-3">
                      <Button type="submit" variant="secondary">
                        Save source
                      </Button>
                    </div>
                  </form>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <form action={disableSourceAction}>
                      <input name="sourceId" type="hidden" value={source.id} />
                      <Button type="submit" variant="ghost">
                        Disable immediately
                      </Button>
                    </form>
                    <form action={assertSourceJobAllowedAction}>
                      <input name="sourceId" type="hidden" value={source.id} />
                      <Button type="submit" variant="ghost">
                        Check job eligibility
                      </Button>
                    </form>
                    <form action={archiveSourceAction}>
                      <input name="sourceId" type="hidden" value={source.id} />
                      <Button type="submit" variant="ghost">
                        Archive source
                      </Button>
                    </form>
                    <form action={runMockDiscoveryPipelineAction}>
                      <input name="sourceId" type="hidden" value={source.id} />
                      <input
                        name="idempotencyKey"
                        type="hidden"
                        value={`mock-${source.id}`}
                      />
                      <Button type="submit" variant="secondary">
                        Run mock discovery pipeline
                      </Button>
                    </form>
                    <form action={runConfiguredDiscoveryPipelineAction}>
                      <input name="sourceId" type="hidden" value={source.id} />
                      <input
                        name="idempotencyKey"
                        type="hidden"
                        value={`configured-${source.id}`}
                      />
                      <Button type="submit" variant="secondary">
                        Run configured source
                      </Button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card title="Discovery job status" eyebrow={`${jobRuns.length} runs`}>
          {jobRuns.length === 0 ? (
            <EmptyState
              title="No discovery jobs"
              description="Run the mock discovery pipeline from a source record to create a job run."
            />
          ) : (
            <div className="space-y-3">
              {jobRuns.map((run) => (
                <article
                  className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3"
                  key={run.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-white">{run.id}</p>
                    <StatusPill
                      tone={
                        run.status === "succeeded"
                          ? "success"
                          : run.status === "failed"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {run.status}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-xs pq-copy-muted">
                    {run.startedAt?.toLocaleString("en-GB") ?? "Not started"}
                  </p>
                  <p className="mt-1 text-xs pq-copy-muted">
                    {run.errorMessage ?? "No error"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card title="Hosted sourcing note" eyebrow="Policy-aware">
          <p className="text-sm pq-copy-muted">
            Sources like Gumtree and other landlord portals can be configured here,
            but they will only run when the source and each domain policy are explicitly
            approved. REVIEW_REQUIRED or policy-disallowed domains stay blocked by design.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
