import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createPilotModeService } from "@/server/services/pilot-mode-service";

import { submitPilotFeedbackAction } from "./actions";

const feedbackButtons = ["GOOD_AI", "WRONG", "MISSING", "NEEDS_HUMAN"] as const;

export default async function PilotModePage() {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Pilot mode unavailable"
          description="Configure DATABASE_URL to run guided workflows and feedback tracking."
        />
      </AppShell>
    );
  }

  const service = createPilotModeService();
  const dashboardResult = await Promise.allSettled([service.getDashboard()]);
  const dashboard =
    dashboardResult[0].status === "fulfilled"
      ? dashboardResult[0].value
      : {
          workflows: [],
          feedbackSummary: {
            GOOD_AI: 0,
            WRONG: 0,
            MISSING: 0,
            NEEDS_HUMAN: 0,
          },
          dailySummary: {
            totalFeedback: 0,
            aiErrorsToday: 0,
            requirementsCreatedToday: 0,
            hotRepliesOpen: 0,
          },
          recentFeedback: [],
        };

  if (dashboardResult[0].status === "rejected") {
    console.error("Pilot dashboard failed:", dashboardResult[0].reason);
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Pilot Mode"
          title="Guided agent workflows"
          description="Human-controlled execution queues with explicit feedback capture for training improvements."
        />

        <section className="grid gap-4 lg:grid-cols-4">
          <Card title="Feedback today" eyebrow="Signals">
            <div className="space-y-2 text-sm">
              <p className="pq-copy-muted">GOOD AI: {dashboard.feedbackSummary.GOOD_AI}</p>
              <p className="pq-copy-muted">WRONG: {dashboard.feedbackSummary.WRONG}</p>
              <p className="pq-copy-muted">MISSING: {dashboard.feedbackSummary.MISSING}</p>
              <p className="pq-copy-muted">NEEDS HUMAN: {dashboard.feedbackSummary.NEEDS_HUMAN}</p>
            </div>
          </Card>
          <Card title="Daily summary" eyebrow="Real counters">
            <div className="space-y-2 text-sm">
              <p className="pq-copy-muted">Total feedback: {dashboard.dailySummary.totalFeedback}</p>
              <p className="pq-copy-muted">Hot replies open: {dashboard.dailySummary.hotRepliesOpen}</p>
              <p className="pq-copy-muted">Requirements created today: {dashboard.dailySummary.requirementsCreatedToday}</p>
              <p className="pq-copy-muted">AI errors today: {dashboard.dailySummary.aiErrorsToday}</p>
            </div>
          </Card>
          <Card title="Control" eyebrow="Human in loop">
            <p className="text-sm pq-copy-muted">
              Pilot mode only routes work and records feedback. No autonomous execution is triggered here.
            </p>
          </Card>
          <Card title="Next actions" eyebrow="Operational">
            <p className="text-sm pq-copy-muted">
              Each workflow below shows its next human action and current queue size.
            </p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {dashboard.workflows.map((workflow) => (
            <Card key={workflow.key} title={workflow.title} eyebrow={workflow.key}>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">Queue: {workflow.queueCount}</Badge>
                  <Badge tone="warning">Human controlled</Badge>
                </div>
                <p className="pq-copy-muted">Next action: {workflow.nextAction}</p>
                <Link
                  className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                  href={workflow.href}
                >
                  Open workflow
                </Link>
                <div className="border-t border-[color:var(--pq-border)] pt-3">
                  <p className="mb-2 text-xs uppercase tracking-[0.2em] pq-copy-subtle">Feedback</p>
                  <div className="flex flex-wrap gap-2">
                    {feedbackButtons.map((label) => (
                      <form action={submitPilotFeedbackAction} key={label}>
                        <input name="workflowKey" type="hidden" value={workflow.key} />
                        <input name="feedbackLabel" type="hidden" value={label} />
                        <Button type="submit" variant={label === "GOOD_AI" ? "secondary" : "ghost"}>
                          {label.replaceAll("_", " ")}
                        </Button>
                      </form>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </section>

        <Card title="Recent feedback" eyebrow={`${dashboard.recentFeedback.length} events`}>
          {dashboard.recentFeedback.length === 0 ? (
            <EmptyState title="No feedback yet" description="Submit workflow feedback to start training signal capture." />
          ) : (
            <div className="space-y-2">
              {dashboard.recentFeedback.map((row) => (
                <article key={row.id} className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3 text-sm">
                  <p className="text-white">{row.workflowKey} • {row.feedbackLabel}</p>
                  <p className="pq-copy-subtle">{row.notes ?? "No note"}</p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
