import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createDemandRoomService } from "@/server/services/demand-room-service";

import {
  archiveRequirementAction,
  createRequirementAction,
  runMatchingAction,
  updateRequirementAction,
} from "./actions";

type DemandRoomPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function pounds(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export default async function DemandRoomPage({
  searchParams,
}: DemandRoomPageProps) {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Demand Room unavailable"
          description="Configure DATABASE_URL to manage direct demand requirements."
        />
      </AppShell>
    );
  }

  const params = await searchParams;
  const search = readParam(params, "search");
  const requirementId = readParam(params, "requirementId");

  const service = createDemandRoomService();
  const requirements = await service.listRequirements(search);
  const workspace = requirementId
    ? await service.getRequirementWorkspace(requirementId)
    : null;

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Demand"
          title="Direct Demand Room"
          description="Track company requirements, decisions, timelines, and linked inbox conversations before running matching."
        />

        <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Card title="Create requirement" eyebrow="Prompt 29">
            <form action={createRequirementAction} className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Lead ID (optional)</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="leadId" />
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
                <span className="text-xs pq-copy-subtle">Owner User ID (optional)</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="ownerUserId" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Preferred area</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="preferredArea" required />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Radius miles</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="radiusMiles" type="number" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Bedrooms min</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="bedroomsMin" type="number" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Bedrooms max</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="bedroomsMax" type="number" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Unit count</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="unitCount" type="number" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Budget min (GBP)</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="budgetMin" type="number" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Budget max (GBP)</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="budgetMax" type="number" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Term months</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="termMonths" type="number" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Start date</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="startDate" type="date" />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Urgency</span>
                <select className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue="MEDIUM" name="urgency">
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Relationship</span>
                <select className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue="UNKNOWN" name="relationshipType">
                  <option value="DIRECT">DIRECT</option>
                  <option value="INTRODUCER">INTRODUCER</option>
                  <option value="UNKNOWN">UNKNOWN</option>
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs pq-copy-subtle">Purpose</span>
                <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="purpose" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs pq-copy-subtle">Notes</span>
                <textarea className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white" name="notes" />
              </label>
              <label className="flex items-center gap-2 text-sm text-white md:col-span-2">
                <input name="directRelationshipVerified" type="checkbox" />
                Direct relationship verified
              </label>
              <div>
                <Button type="submit">Create requirement</Button>
              </div>
            </form>
          </Card>

          <Card title="Demand controls" eyebrow="Navigation">
            <div className="space-y-3 text-sm">
              <p className="pq-copy-muted">
                Use this room to curate requirements and linked context before launching match generation.
              </p>
              <Link className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-white" href="/internal/outreach">
                Open outreach
              </Link>
              <Link className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-white" href="/internal/inbox">
                Open inbox
              </Link>
            </div>
          </Card>
        </section>

        <Card title="Requirements" eyebrow={`${requirements.length} records`}>
          {requirements.length === 0 ? (
            <EmptyState
              title="No requirements"
              description="Create a requirement to start the demand workflow."
            />
          ) : (
            <div className="space-y-3">
              {requirements.map((item) => (
                <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={item.requirement.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {item.companyName ?? "Unknown company"}
                      </p>
                      <p className="text-xs pq-copy-muted">
                        {item.contactFirstName ?? ""} {item.contactLastName ?? ""} {item.contactEmail ? `(${item.contactEmail})` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="info">{item.requirement.relationshipType}</Badge>
                      <Badge tone="warning">{item.requirement.urgency}</Badge>
                      <Badge tone="neutral">{item.requirement.status}</Badge>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-white">
                    {item.requirement.preferredArea ?? "No area"} | beds {item.requirement.bedroomsMin ?? "-"}-{item.requirement.bedroomsMax ?? "-"} | units {item.requirement.unitCount ?? "-"} | max {pounds(item.requirement.budgetMaxCents)}
                  </p>

                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                    <form action={updateRequirementAction} className="grid gap-2 md:grid-cols-3">
                      <input name="requirementId" type="hidden" value={item.requirement.id} />
                      <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue={item.requirement.preferredArea ?? ""} name="preferredArea" />
                      <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue={item.requirement.budgetMaxCents ? String(Math.floor(item.requirement.budgetMaxCents / 100)) : ""} name="budgetMax" type="number" />
                      <select className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue={item.requirement.status} name="status">
                        <option value="open">open</option>
                        <option value="matched">matched</option>
                        <option value="on_hold">on_hold</option>
                        <option value="closed">closed</option>
                        <option value="archived">archived</option>
                      </select>
                      <Button type="submit" variant="secondary">Save</Button>
                    </form>
                    <form action={runMatchingAction}>
                      <input name="requirementId" type="hidden" value={item.requirement.id} />
                      <Button type="submit" variant="secondary">Run matching</Button>
                    </form>
                    <form action={archiveRequirementAction}>
                      <input name="requirementId" type="hidden" value={item.requirement.id} />
                      <Button type="submit" variant="ghost">Archive</Button>
                    </form>
                    <Link className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white" href={`/internal/demand-room?requirementId=${item.requirement.id}`}>
                      Open workspace
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        {workspace ? (
          <section className="grid gap-4 xl:grid-cols-2">
            <Card title="Timeline" eyebrow={`${workspace.timeline.length} events`}>
              <div className="space-y-2">
                {workspace.timeline.length === 0 ? (
                  <p className="text-sm pq-copy-muted">No audit events yet.</p>
                ) : (
                  workspace.timeline.map((event) => (
                    <article
                      className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3"
                      key={event.id}
                    >
                      <p className="text-xs text-white">{event.action}</p>
                      <p className="text-xs pq-copy-muted">{event.occurredAt.toISOString()}</p>
                    </article>
                  ))
                )}
              </div>
            </Card>
            <Card
              title="Linked conversations"
              eyebrow={`${workspace.conversations.length} threads`}
            >
              <div className="space-y-2">
                {workspace.conversations.length === 0 ? (
                  <p className="text-sm pq-copy-muted">No linked conversations.</p>
                ) : (
                  workspace.conversations.map((entry) => (
                    <article
                      className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3"
                      key={entry.conversation.id}
                    >
                      <p className="text-xs text-white">
                        {entry.companyName ?? "Unknown company"} {entry.contactEmail ? `(${entry.contactEmail})` : ""}
                      </p>
                      <p className="text-xs pq-copy-muted">
                        {entry.conversation.subject ?? "No subject"}
                      </p>
                      <div className="mt-2 space-y-1">
                        {entry.messages.map((message) => (
                          <p className="text-xs text-white" key={message.id}>
                            {message.direction}: {message.bodyText.slice(0, 120)}
                          </p>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
