import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState, StatusPill } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createPqQuestService } from "@/server/services/pq-quest-service";

import { awardQuestXpAction } from "./actions";

export default async function PqQuestPage() {
  const user = await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="PQ Quest unavailable"
          description="Configure DATABASE_URL to persist verified quest events."
        />
      </AppShell>
    );
  }

  const service = createPqQuestService();
  const dashboardResult = await Promise.allSettled([service.dashboard(user.id)]);
  const dashboard =
    dashboardResult[0].status === "fulfilled"
      ? dashboardResult[0].value
      : {
          profile: null,
          objectives: [],
          recentEvents: [],
        };

  if (dashboardResult[0].status === "rejected") {
    console.error("PQ Quest dashboard failed:", dashboardResult[0].reason);
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Prompt 38"
          title="PQ Quest"
          description="XP is only awarded from verified business events and deduplicated by source event ID."
        />

        <Card title="Profile" eyebrow="Live progression">
          {!dashboard.profile ? (
            <EmptyState title="No profile" description="Profile will be created automatically on first verified event." />
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded border border-[color:var(--pq-border)] p-3">
                <p className="text-xs pq-copy-subtle">Level</p>
                <p className="mt-1 text-2xl text-white">{dashboard.profile.level}</p>
              </div>
              <div className="rounded border border-[color:var(--pq-border)] p-3">
                <p className="text-xs pq-copy-subtle">Total XP</p>
                <p className="mt-1 text-2xl text-white">{dashboard.profile.totalXp}</p>
              </div>
              <div className="rounded border border-[color:var(--pq-border)] p-3">
                <p className="text-xs pq-copy-subtle">Streak</p>
                <p className="mt-1 text-2xl text-white">{dashboard.profile.streakDays} days</p>
              </div>
              <div className="rounded border border-[color:var(--pq-border)] p-3">
                <p className="text-xs pq-copy-subtle">Unlocked Chapters</p>
                <p className="mt-1 text-sm text-white">{dashboard.profile.unlockedChapters.join(", ")}</p>
              </div>
            </div>
          )}
        </Card>

        <Card title="Award verified event" eyebrow="No scraping-volume rewards">
          <form action={awardQuestXpAction} className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Source event ID</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                name="sourceEventId"
                placeholder="evt_deal_completed_123"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Verified action</span>
              <select
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                name="sourceAction"
                defaultValue="lead.qualified"
              >
                <option value="lead.qualified">lead.qualified</option>
                <option value="reply.positive">reply.positive</option>
                <option value="requirement.verified">requirement.verified</option>
                <option value="match.created">match.created</option>
                <option value="viewing.completed">viewing.completed</option>
                <option value="deal.offer_made">deal.offer_made</option>
                <option value="deal.completed">deal.completed</option>
                <option value="shortage.converted">shortage.converted</option>
              </select>
            </label>
            <div className="self-end">
              <Button type="submit">Award XP</Button>
            </div>
          </form>
        </Card>

        <Card title="Objectives" eyebrow={`${dashboard.objectives.length} missions`}>
          {dashboard.objectives.length === 0 ? (
            <EmptyState title="No objectives" description="Objectives are seeded when profile is initialized." />
          ) : (
            <div className="space-y-3">
              {dashboard.objectives.map((objective) => {
                const completed = objective.completedAt !== null;
                return (
                  <article
                    key={objective.id}
                    className="rounded border border-[color:var(--pq-border)] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-white">{objective.title}</p>
                      <StatusPill tone={completed ? "success" : "neutral"}>
                        {completed ? "completed" : "active"}
                      </StatusPill>
                    </div>
                    <p className="mt-1 text-xs pq-copy-muted">
                      {objective.chapter} | {objective.currentCount}/{objective.targetCount}
                    </p>
                    {objective.bossObjective ? <Badge tone="warning">Boss objective</Badge> : null}
                  </article>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Recent XP events" eyebrow={`${dashboard.recentEvents.length} events`}>
          {dashboard.recentEvents.length === 0 ? (
            <EmptyState title="No XP events" description="Submit a verified event to start progression." />
          ) : (
            <div className="space-y-2">
              {dashboard.recentEvents.map((event) => (
                <article key={event.id} className="rounded border border-[color:var(--pq-border)] p-2">
                  <p className="text-xs text-white">{event.sourceAction} | +{event.xpAwarded} XP</p>
                  <p className="text-xs pq-copy-muted">{event.sourceEventId}</p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
