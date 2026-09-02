import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createViewingWorkflowService } from "@/server/services/viewing-workflow-service";

import {
  createViewingReminderAction,
  saveViewingOutcomeAction,
  scheduleViewingAction,
} from "./actions";

type PageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ViewingsPage({ searchParams }: PageProps) {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Viewings unavailable"
          description="Configure DATABASE_URL to run viewing workflow."
        />
      </AppShell>
    );
  }

  const params = await searchParams;
  const selectedViewingId = readParam(params, "viewingId");

  const service = createViewingWorkflowService();
  const [viewingsResult, briefResult] = await Promise.allSettled([
    service.listViewings(),
    selectedViewingId ? service.getViewingBrief(selectedViewingId) : Promise.resolve(null),
  ]);

  const rows =
    viewingsResult.status === "fulfilled" && Array.isArray(viewingsResult.value)
      ? viewingsResult.value
      : [];
  const brief = briefResult.status === "fulfilled" ? briefResult.value ?? null : null;

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Prompt 33"
          title="Viewing Workflow"
          description="Schedule, brief, remind, and close viewing outcomes with task creation support."
        />

        <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
          <Card title="Schedule viewing" eyebrow="Calendar input">
            <form action={scheduleViewingAction} className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Property ID</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="propertyId" required />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Requirement ID</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="requirementId" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Company ID</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="companyId" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Contact ID</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="contactId" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Date/time (ISO)</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="scheduledFor" placeholder="2026-09-01T10:00:00.000Z" required />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Reminder at (ISO)</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="reminderAt" placeholder="2026-09-01T09:00:00.000Z" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs pq-copy-subtle">Attendees (comma separated)</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="attendees" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs pq-copy-subtle">Notes</span>
                <textarea className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white" name="notes" />
              </label>
              <div>
                <Button type="submit">Create viewing</Button>
              </div>
            </form>
          </Card>

          <Card title="Quick links" eyebrow="Related rooms">
            <div className="space-y-3 text-sm">
              <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/demand-room">
                Open demand room
              </Link>
              <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/stock-room">
                Open stock room
              </Link>
              <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/deals">
                Open deal room
              </Link>
            </div>
          </Card>
        </section>

        <Card title="Viewings list" eyebrow={`${rows.length} scheduled`}>
          {rows.length === 0 ? (
            <EmptyState
              title="No viewings"
              description="Create a viewing to start lifecycle tracking."
            />
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={row.viewing.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-white">
                      {row.property?.title ?? "Unknown property"} | {row.company?.name ?? "Unknown company"}
                    </p>
                    <Badge tone="info">{row.viewing.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-white">
                    {row.viewing.scheduledFor.toISOString()} | attendees {row.viewing.attendees.length}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link className="inline-flex min-h-10 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-3 text-xs text-white" href={`/internal/viewings?viewingId=${row.viewing.id}`}>
                      Open brief
                    </Link>
                    <form action={createViewingReminderAction}>
                      <input name="viewingId" type="hidden" value={row.viewing.id} />
                      <Button type="submit" variant="ghost" size="sm">Create reminder</Button>
                    </form>
                    <form action={saveViewingOutcomeAction} className="grid gap-2 md:grid-cols-4">
                      <input name="viewingId" type="hidden" value={row.viewing.id} />
                      <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="outcome" placeholder="Outcome" required />
                      <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="nextAction" placeholder="Next action" />
                      <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="taskAssigneeUserId" placeholder="Task assignee user ID" />
                      <input className="min-h-10 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-xs text-white" name="commercialNotes" placeholder="Commercial notes" />
                      <label className="flex items-center gap-2 text-xs text-white">
                        <input defaultChecked name="createTask" type="checkbox" />
                        Create task
                      </label>
                      <Button type="submit" variant="secondary" size="sm">Save outcome</Button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        {brief ? (
          <Card title="Viewing brief" eyebrow={brief.viewing.id}>
            <p className="text-sm text-white">{brief.brief.summary}</p>
            <p className="mt-2 text-xs pq-copy-muted">{brief.brief.notes ?? "No notes"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {brief.brief.attendees.map((attendee, index) => (
                <Badge key={`${attendee.name}-${index}`} tone="neutral">{attendee.name}</Badge>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
