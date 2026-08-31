import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  EvidenceTimeline,
  StatusPill,
} from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import type { LeadRoomView } from "@/domain/lead/types";
import { appEnv } from "@/lib/env";
import { createDirectnessVerificationService } from "@/server/services/directness-verification-service";
import { createLeadRoomService } from "@/server/services/lead-room-service";

import {
  extractDirectDemandAction,
  transitionLeadStatusAction,
  updateLeadPlanAction,
} from "../../leads/actions";
import { assessDirectnessAction } from "../../leads/directness-actions";

type LeadsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const views: ReadonlyArray<{ value: LeadRoomView; label: string }> = [
  { value: "supply", label: "Supply Leads" },
  { value: "demand", label: "Demand Leads" },
  { value: "qualified", label: "Qualified" },
];

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  return Array.isArray(value) ? value[0] : value;
}

function asView(value: string | undefined): LeadRoomView {
  if (views.some((view) => view.value === value)) {
    return value as LeadRoomView;
  }

  return "qualified";
}

function asPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function formatWhen(value: Date | null) {
  return value ? value.toLocaleString("en-GB") : "No signals";
}

export default async function HotelQualifiedLeadsPage({ searchParams }: LeadsPageProps) {
  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Qualified leads unavailable"
          description="Configure DATABASE_URL to load the production Hotel supply and demand lead workflow."
        />
      </AppShell>
    );
  }

  const params = await searchParams;
  const search = readParam(params, "search") ?? "";
  const selectedView = asView(readParam(params, "view"));
  const selectedLeadId = readParam(params, "lead");
  const page = asPositiveInt(readParam(params, "page"), 1);
  const pageSize = Math.min(50, asPositiveInt(readParam(params, "pageSize"), 25));

  let leadService: ReturnType<typeof createLeadRoomService> | null = null;
  let directnessService: ReturnType<typeof createDirectnessVerificationService> | null = null;

  let leads: Awaited<ReturnType<ReturnType<typeof createLeadRoomService>["listView"]>> = [];
  let drawer: Awaited<ReturnType<ReturnType<typeof createLeadRoomService>["getLeadDrawer"]>> = null;
  let directnessAssessments: Awaited<
    ReturnType<ReturnType<typeof createDirectnessVerificationService>["listAssessments"]>
  > = [];

  try {
    leadService = createLeadRoomService();
    directnessService = createDirectnessVerificationService();

    leads = await leadService.listView(selectedView, search, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    if (selectedLeadId) {
      [drawer, directnessAssessments] = await Promise.all([
        leadService.getLeadDrawer(selectedLeadId),
        directnessService.listAssessments(selectedLeadId),
      ]);
    }
  } catch (error) {
    console.error("Failed to load Hotel qualified leads.", error);
    leadService = null;
    directnessService = null;
    leads = [];
    drawer = null;
    directnessAssessments = [];
  }

  const leadRoomError = !leads.length && selectedLeadId === null && !search;

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Hotel Engine"
          title="Qualified Leads"
          description="Production direct-only lead board for hotel supply and demand qualification."
        />

        {leadRoomError ? (
          <Card title="Lead room status">
            <div className="space-y-2">
              <p className="text-sm text-amber-300">
                The Hotel lead board is temporarily unavailable while live data catches up.
              </p>
              <p className="text-xs pq-copy-subtle">
                The production workflow will recover automatically once the schema is aligned.
              </p>
            </div>
          </Card>
        ) : null}

        <Card title="Views and search">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {views.map((view) => (
                <Link
                  className={`inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border px-4 text-sm ${selectedView === view.value ? "border-[color:var(--pq-accent)] bg-[color:var(--pq-accent)] text-black" : "border-[color:var(--pq-border)] text-white"}`}
                  href={`/internal/hotel-deals/qualified-leads?view=${view.value}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                  key={view.value}
                >
                  {view.label}
                </Link>
              ))}
            </div>
            <form className="grid gap-3 md:grid-cols-[1fr_auto_auto]" method="get">
              <input name="view" type="hidden" value={selectedView} />
              <input name="page" type="hidden" value="1" />
              <input name="pageSize" type="hidden" value={pageSize} />
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={search}
                name="search"
                placeholder="Search hotel lead identity"
              />
              <Button type="submit" variant="secondary">
                Search
              </Button>
              <Link
                className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                href={`/internal/hotel-deals/qualified-leads?view=${selectedView}&page=1&pageSize=${pageSize}`}
              >
                Reset
              </Link>
            </form>
          </div>
        </Card>

        <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card title={`${views.find((view) => view.value === selectedView)?.label} (${leads.length})`}>
            {leads.length === 0 ? (
              <EmptyState title="No leads" description="No lead records currently match this view and search query." />
            ) : (
              <div className="space-y-3">
                {leads.map((lead) => (
                  <article className="rounded-[var(--pq-radius-md)] border border-[color:var(--pq-border)] p-4" key={lead.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{lead.leadLabel}</p>
                        <p className="text-xs pq-copy-subtle">Source: {lead.sourceName}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="info">{lead.leadType}</Badge>
                        <Badge tone="success">Score: {lead.score}</Badge>
                        <Badge tone="info">Confidence: {lead.confidence}</Badge>
                        <Badge tone="warning">Evidence: {lead.evidenceCount}</Badge>
                        <Badge tone="neutral">Directness: {lead.directnessClassification}</Badge>
                        <StatusPill tone={lead.status === "qualified" ? "success" : lead.status === "disqualified" ? "danger" : "neutral"}>
                          {lead.status}
                        </StatusPill>
                      </div>
                    </div>
                    <p className="mt-2 text-xs pq-copy-muted">Last signal: {formatWhen(lead.lastSignalAt)}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Link
                        className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                        href={`/internal/hotel-deals/qualified-leads?view=${selectedView}&lead=${lead.id}&page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                      >
                        Open drawer
                      </Link>
                      {lead.leadType === "demand" ? (
                        <form action={extractDirectDemandAction}>
                          <input name="leadId" type="hidden" value={lead.id} />
                          <Button type="submit" variant="secondary">Extract direct requirement</Button>
                        </form>
                      ) : null}
                      <form action={transitionLeadStatusAction} className="flex flex-wrap gap-2">
                        <input name="leadId" type="hidden" value={lead.id} />
                        <input name="status" type="hidden" value="researching" />
                        <Button type="submit" variant="ghost">Set researching</Button>
                      </form>
                      <form action={transitionLeadStatusAction} className="flex flex-wrap gap-2">
                        <input name="leadId" type="hidden" value={lead.id} />
                        <input name="status" type="hidden" value="qualified" />
                        <Button type="submit" variant="secondary">Set qualified</Button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[color:var(--pq-border)] pt-3">
              <div className="text-xs pq-copy-subtle">Page {page} • {pageSize} per page</div>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                    href={`/internal/hotel-deals/qualified-leads?view=${selectedView}&page=${page - 1}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm pq-copy-subtle">Previous</span>
                )}
                {leads.length === pageSize ? (
                  <Link
                    className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                    href={`/internal/hotel-deals/qualified-leads?view=${selectedView}&page=${page + 1}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                  >
                    Next
                  </Link>
                ) : (
                  <span className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm pq-copy-subtle">Next</span>
                )}
              </div>
            </div>
          </Card>

          <Card title="Lead drawer" eyebrow="Identity, provenance, and action plan">
            {drawer ? (
              <div className="space-y-4 text-sm">
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-white">{drawer.contactName ?? drawer.companyName ?? drawer.propertyTitle ?? drawer.id}</p>
                  <p className="pq-copy-muted">Lead ID: {drawer.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="info">Type: {drawer.leadType}</Badge>
                  <Badge tone="success">Score: {drawer.score}</Badge>
                  <Badge tone="info">Confidence: {drawer.confidence}</Badge>
                  <Badge tone="neutral">Directness: {drawer.directnessClassification}</Badge>
                  <Badge tone="neutral">Score version: {drawer.scoreVersion ?? "unscored"}</Badge>
                  <StatusPill tone={drawer.status === "qualified" ? "success" : "neutral"}>{drawer.status}</StatusPill>
                </div>
                <dl className="grid gap-2">
                  <div className="flex items-center justify-between gap-3"><dt className="pq-copy-subtle">Linked company</dt><dd>{drawer.companyName ?? "Unlinked"}</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="pq-copy-subtle">Linked contact</dt><dd>{drawer.contactName ?? "Unlinked"}</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="pq-copy-subtle">Linked property</dt><dd>{drawer.propertyTitle ?? "Unlinked"}</dd></div>
                </dl>
                <Card title="Source provenance" eyebrow={drawer.sourceName}>
                  <p className="pq-copy-muted">{drawer.sourceProvenance}</p>
                </Card>
                <Card title="Directness verification gate">
                  <p className="pq-copy-muted text-sm">Automated outreach requires DIRECT classification, verified status, and supporting evidence.</p>
                  <form action={assessDirectnessAction} className="mt-3 grid gap-3">
                    <input name="leadId" type="hidden" value={drawer.id} />
                    <label className="space-y-1"><span className="text-xs pq-copy-subtle">Entity</span><input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="entityName" required /></label>
                    <label className="space-y-1"><span className="text-xs pq-copy-subtle">Person (optional)</span><input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="personName" /></label>
                    <label className="space-y-1"><span className="text-xs pq-copy-subtle">Role</span><input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="roleTitle" /></label>
                    <label className="space-y-1"><span className="text-xs pq-copy-subtle">Relationship to property/company</span><input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="relationshipToPropertyOrCompany" required /></label>
                    <label className="space-y-1"><span className="text-xs pq-copy-subtle">Evidence source</span><input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="evidenceSource" required /></label>
                    <label className="space-y-1"><span className="text-xs pq-copy-subtle">Evidence reference</span><input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="evidenceReference" required /></label>
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="space-y-1"><span className="text-xs pq-copy-subtle">Evidence type</span><input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue="ownership_record" name="evidenceType" required /></label>
                      <label className="space-y-1"><span className="text-xs pq-copy-subtle">Evidence date</span><input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" name="evidenceDate" type="date" required /></label>
                      <label className="space-y-1"><span className="text-xs pq-copy-subtle">Confidence</span><input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue="75" max="100" min="0" name="confidence" type="number" required /></label>
                    </div>
                    <label className="space-y-1"><span className="text-xs pq-copy-subtle">Proposed classification</span><select className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue="UNKNOWN" name="proposedClassification"><option value="DIRECT">DIRECT</option><option value="INTERMEDIARY">INTERMEDIARY</option><option value="UNKNOWN">UNKNOWN</option><option value="SUPPRESSED">SUPPRESSED</option></select></label>
                    <label className="space-y-1"><span className="text-xs pq-copy-subtle">Explanation</span><textarea className="min-h-24 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white" name="explanation" required /></label>
                    <div><Button type="submit" variant="secondary">Save directness assessment</Button></div>
                  </form>
                </Card>
                <Card title="WHY IS THIS LEAD DIRECT?">
                  {directnessAssessments.length === 0 ? (
                    <p className="pq-copy-muted">No directness assessments recorded yet. Add evidence before any automated outreach.</p>
                  ) : (
                    <div className="space-y-3">
                      {directnessAssessments.map((assessment) => (
                        <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={assessment.id}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="neutral">{assessment.classification}</Badge>
                            <Badge tone="info">{assessment.verificationStatus}</Badge>
                            <Badge tone="warning">Confidence: {assessment.confidence}</Badge>
                          </div>
                          <p className="mt-2 text-xs text-white">{assessment.explanation}</p>
                          <p className="mt-1 text-xs pq-copy-subtle">Entity: {assessment.entityName}{assessment.personName ? ` | Person: ${assessment.personName}` : ""}{assessment.roleTitle ? ` | Role: ${assessment.roleTitle}` : ""}</p>
                          <p className="mt-1 text-xs pq-copy-subtle">Relationship: {assessment.relationshipToPropertyOrCompany}</p>
                          <p className="mt-1 text-xs pq-copy-subtle">Source: {assessment.evidenceSource} | Ref: {assessment.evidenceReference}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </Card>
                <Card title="AI explanation placeholder">
                  {drawer.qualificationGuard.canUseForHighConfidenceQualification ? (
                    <p className="pq-copy-muted">High-confidence qualification can use supported AI conclusions ({drawer.qualificationGuard.supportedConclusionCount}).</p>
                  ) : (
                    <p className="pq-copy-muted">No supported AI conclusion is currently eligible for high-confidence qualification.</p>
                  )}
                </Card>
                <Card title="Action plan">
                  <form action={updateLeadPlanAction} className="space-y-3">
                    <input name="leadId" type="hidden" value={drawer.id} />
                    <label className="space-y-1"><span className="text-xs pq-copy-subtle">Plan</span><textarea className="min-h-24 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white" defaultValue={drawer.plan ?? ""} name="plan" /></label>
                    <Button type="submit" variant="secondary">Save action plan</Button>
                  </form>
                </Card>
                <EvidenceTimeline items={drawer.evidence} />
              </div>
            ) : (
              <EmptyState title="No lead selected" description="Choose a lead from the list to review the identity, provenance, and directness checks." />
            )}
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
