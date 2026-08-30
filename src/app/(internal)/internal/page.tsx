import { signOut } from "@/auth";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, StatusPill } from "@/components/ui";
import {
  canManageSources,
  canManageUsers,
  canSendOutreach,
} from "@/server/auth/rbac";
import { requireCurrentUser } from "@/server/auth/session";

async function signOutAction() {
  "use server";

  await signOut({ redirectTo: "/" });
}

export default async function InternalHomePage() {
  const user = await requireCurrentUser();

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Monday Morning"
          title="Team Operating Hub"
          description="Start with the most important screens first: qualified leads, inbox replies, and command centre priorities."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card
            eyebrow="Step 1"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/leads?view=qualified"
              >
                Open qualified leads
              </Link>
            }
            title="Qualified leads"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Review ready-to-contact opportunities first.
            </p>
          </Card>
          <Card
            eyebrow="Step 2"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/inbox"
              >
                Open inbox
              </Link>
            }
            title="Replies and messages"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Handle hot conversations and assign follow-ups.
            </p>
          </Card>
          <Card
            eyebrow="Step 3"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/command-centre"
              >
                Open command centre
              </Link>
            }
            title="Daily priorities"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Track shortages, queue depth, and top actions.
            </p>
          </Card>
          <Card
            eyebrow="Step 4"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/acquisition"
              >
                Open acquisition engine
              </Link>
            }
            title="Lead generation"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Check mission progress and outreach-ready pipeline.
            </p>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card
            eyebrow="Your account"
            footer={
              <form action={signOutAction}>
                <Button type="submit" variant="ghost">
                  Sign out
                </Button>
              </form>
            }
            title={user.name ?? "Team user"}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Badge tone="success">Authenticated</Badge>
                <Badge tone="info">Role: {user.role}</Badge>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="pq-copy-subtle">Email</dt>
                  <dd className="mt-1 text-white">{user.email}</dd>
                </div>
                <div>
                  <dt className="pq-copy-subtle">User ID</dt>
                  <dd className="mt-1 break-all text-white">{user.id}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card eyebrow="Quick links" title="Common team actions">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="pq-copy-muted">Lead room</span>
                <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/leads">
                  Open
                </Link>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="pq-copy-muted">Campaign builder</span>
                <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/outreach">
                  Open
                </Link>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="pq-copy-muted">Viewings</span>
                <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/viewings">
                  Open
                </Link>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="pq-copy-muted">Deal room</span>
                <Link className="text-[color:var(--pq-accent-strong)]" href="/internal/deals">
                  Open
                </Link>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Card eyebrow="Permission status" title="Source management">
            <StatusPill tone={canManageSources(user) ? "success" : "neutral"}>
              {canManageSources(user) ? "Enabled" : "Restricted"}
            </StatusPill>
          </Card>
          <Card eyebrow="Permission status" title="Outreach sending">
            <StatusPill tone={canSendOutreach(user) ? "success" : "neutral"}>
              {canSendOutreach(user) ? "Enabled" : "Restricted"}
            </StatusPill>
          </Card>
          <Card eyebrow="Permission status" title="User management">
            <StatusPill tone={canManageUsers(user) ? "success" : "neutral"}>
              {canManageUsers(user) ? "Enabled" : "Restricted"}
            </StatusPill>
          </Card>
        </section>

        <details className="rounded-[var(--pq-radius-md)] border border-[color:var(--pq-border)] bg-[rgba(255,255,255,0.02)] p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--pq-accent-strong)]">
            More tools
          </summary>
          <p className="mt-2 text-xs pq-copy-subtle">
            Open additional modules when needed. Daily work should start from the 4-step cards above.
          </p>
          <section className="mt-4 grid gap-4 md:grid-cols-2">
          <Card
            eyebrow="Inventory"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/stock-room"
              >
                Open Stock Room
              </Link>
            }
            title="Stock Room"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Visual property inventory with server-side filters, CRUD actions,
              and audit-backed mutations.
            </p>
          </Card>
          <Card
            eyebrow="Governance"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/admin/audit"
              >
                Open audit viewer
              </Link>
            }
            title="Audit history"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Privileged timeline view for operational mutations with sensitive
              metadata redacted before persistence.
            </p>
          </Card>
          <Card
            eyebrow="CRM"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/companies"
              >
                Open company/contact CRM
              </Link>
            }
            title="Companies and contacts"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Separate company and contact entities with relationships,
              suppression visibility, and duplicate awareness.
            </p>
          </Card>
          <Card
            eyebrow="Qualification"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/leads"
              >
                Open lead room
              </Link>
            }
            title="Lead room"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Multi-view lead operations with evidence counts, source
              provenance, and status transitions.
            </p>
          </Card>
          <Card
            eyebrow="Source governance"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/admin/sources"
              >
                Open source registry
              </Link>
            }
            title="Source registry"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Permissioned connector registry with immediate disable controls
              and blocked-source execution guards.
            </p>
          </Card>
          <Card
            eyebrow="Outreach"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/outreach"
              >
                Open campaign builder
              </Link>
            }
            title="Campaign builder"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Create outreach campaigns with human approval defaults, scheduling
              windows, and eligibility previews before launch.
            </p>
          </Card>
          <Card
            eyebrow="Reliability"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/system-health"
              >
                Open system health
              </Link>
            }
            title="System health"
          >
            <p className="pq-copy-muted text-sm leading-6">
              See truthful integration, AI provider, and background job status in one place.
            </p>
          </Card>
          <Card
            eyebrow="Admin"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/admin/integrations"
              >
                Open integrations
              </Link>
            }
            title="Integration setup"
          >
            <p className="pq-copy-muted text-sm leading-6">
              See connected, config-required, and disabled integrations without guesswork.
            </p>
          </Card>
          <Card
            eyebrow="Comms"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/inbox"
              >
                Open inbox
              </Link>
            }
            title="Inbox"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Three-pane conversation inbox with categorization, assignment,
              reply drafts, link actions, and suppression controls.
            </p>
          </Card>
          <Card
            eyebrow="Tenancy"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/rent-control"
              >
                Open rent control
              </Link>
            }
            title="Rent Control"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Track live/completed company-let rent metrics and high-value opportunities.
            </p>
          </Card>
          <Card
            eyebrow="Compliance"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/documents"
              >
                Open document control
              </Link>
            }
            title="Document Control"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Verify contract/compliance coverage and review recent operational documents.
            </p>
          </Card>
          <Card
            eyebrow="Pilot"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/pilot"
              >
                Open pilot mode
              </Link>
            }
            title="Agent pilot"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Guided workflows with human-controlled execution and explicit
              feedback capture for AI quality improvement.
            </p>
          </Card>
          <Card
            eyebrow="Demand"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/demand-room"
              >
                Open demand room
              </Link>
            }
            title="Demand room"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Manage live requirements, relationship confidence, timeline audit,
              and linked conversations before running matching.
            </p>
          </Card>
          <Card
            eyebrow="Shortage"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/shortage-intelligence"
              >
                Open shortage intelligence
              </Link>
            }
            title="Shortage intelligence"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Compare active direct demand and suitable stock with traceable gap
              buckets and convert shortages into sourcing targets.
            </p>
          </Card>
          <Card
            eyebrow="Economics"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/economics-signals"
              >
                Open economics signals
              </Link>
            }
            title="LHA signal module"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Approved-rate provenance and informational delta signals with
              optional manager notifications.
            </p>
          </Card>
          <Card
            eyebrow="Viewings"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/viewings"
              >
                Open viewings
              </Link>
            }
            title="Viewing workflow"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Manage viewing lifecycle, reminders, briefs, outcomes, and
              post-viewing tasks.
            </p>
          </Card>
          <Card
            eyebrow="Deals"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/deals"
              >
                Open deal room
              </Link>
            }
            title="Deal room"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Validate stage transitions with blockers, timeline, documents,
              and linked entities.
            </p>
          </Card>
          <Card
            eyebrow="Operations"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/admin/operations"
              >
                Open operations console
              </Link>
            }
            title="AI activity"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Worker status, queue depth, retries, dead-letter visibility, and
              pause or resume controls for governed background jobs.
            </p>
          </Card>
          <Card
            eyebrow="Intelligence"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/command-centre"
              >
                Open command centre
              </Link>
            }
            title="Command centre"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Live operational KPIs from qualified supply to active deals with
              worker health and action-led prioritization.
            </p>
          </Card>
          <Card
            eyebrow="Progression"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/pq-quest"
              >
                Open PQ Quest
              </Link>
            }
            title="PQ Quest"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Verified business outcomes award XP with source event dedupe,
              chapters, streaks, and objective tracking.
            </p>
          </Card>
          <Card
            eyebrow="Attribution"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/analytics"
              >
                Open analytics
              </Link>
            }
            title="Analytics funnel"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Reconciled source-to-deal funnel metrics computed from live data
              and persisted snapshots with trace metadata.
            </p>
          </Card>
          <Card
            eyebrow="Autonomy"
            footer={
              <Link
                className="text-sm text-[color:var(--pq-accent-strong)]"
                href="/internal/acquisition"
              >
                Open acquisition engine
              </Link>
            }
            title="AI acquisition missions"
          >
            <p className="pq-copy-muted text-sm leading-6">
              Objective-driven AI missions with worker orchestration, demand
              heatmap signals, and message-box visibility.
            </p>
          </Card>
          </section>
        </details>
      </div>
    </AppShell>
  );
}
