import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState, StatusPill } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createOutreachService } from "@/server/services/outreach-service";

import {
  buildOutreachCampaignAction,
  launchCampaignAction,
  pauseCampaignAction,
  scheduleFollowUpAction,
  sendCampaignEmailAction,
} from "./actions";

type OutreachPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function asInteger(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function OutreachPage({
  searchParams,
}: OutreachPageProps) {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Outreach unavailable"
          description="Configure DATABASE_URL to manage campaigns and previews."
        />
      </AppShell>
    );
  }

  const params = await searchParams;
  const service = createOutreachService();
  const minimumScore = asInteger(readParam(params, "minimumScore")) ?? 70;
  const sendStatus = readParam(params, "sendStatus");
  const failedReasonsRaw = readParam(params, "failedReasons");
  const failedReasons = failedReasonsRaw
    ? failedReasonsRaw
        .split(",")
        .map((reason) => reason.trim())
        .filter(Boolean)
    : [];
  const sourceId = readParam(params, "sourceId");
  const location = readParam(params, "location");
  const bedroomsMin = asInteger(readParam(params, "bedroomsMin"));
  const bedroomsMax = asInteger(readParam(params, "bedroomsMax"));
  const unitCountMin = asInteger(readParam(params, "unitCountMin"));

  const preview = await service.previewEligibility({
    minimumScore,
    ...(sourceId ? { sourceId } : {}),
    ...(location ? { location } : {}),
    ...(bedroomsMin !== undefined ? { bedroomsMin } : {}),
    ...(bedroomsMax !== undefined ? { bedroomsMax } : {}),
    ...(unitCountMin !== undefined ? { unitCountMin } : {}),
  });
  const campaigns = await service.listCampaigns();

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Outreach"
          title="Campaign Builder"
          description="Build constrained campaigns with audience controls, human approval defaults, suppression safeguards, and eligibility previews."
        />

        {sendStatus === "blocked" ? (
          <Card title="Send blocked by policy gate" eyebrow="Server-side enforcement">
            <p className="text-sm text-white">
              This outbound was blocked. Fix the policy failures below before retrying.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {failedReasons.length > 0 ? (
                failedReasons.map((reason) => (
                  <Badge key={reason} tone="warning">{reason}</Badge>
                ))
              ) : (
                <Badge tone="warning">blocked</Badge>
              )}
            </div>
          </Card>
        ) : null}

        {sendStatus === "queued" ? (
          <Card title="Send queued" eyebrow="Policy checks passed">
            <p className="text-sm text-white">
              Outbound email was accepted by the policy gate and queued.
            </p>
          </Card>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Card title="Build campaign" eyebrow="Prompt 22">
            <form
              action={buildOutreachCampaignAction}
              className="grid gap-3 md:grid-cols-2"
            >
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Name</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="name"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Channel</span>
                <select
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="email"
                  name="channel"
                >
                  <option value="email">email</option>
                  <option value="sms">sms</option>
                  <option value="whatsapp">whatsapp</option>
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs pq-copy-subtle">Objective</span>
                <textarea
                  className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                  name="objective"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Audience</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="demand_verified"
                  name="audience"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">
                  Source ID (optional)
                </span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="sourceId"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Minimum score</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="70"
                  min="0"
                  name="minimumScore"
                  type="number"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Location filter</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="location"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Bedrooms min</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="bedroomsMin"
                  type="number"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Bedrooms max</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="bedroomsMax"
                  type="number"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Unit count min</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="unitCountMin"
                  type="number"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Daily limit</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="25"
                  min="1"
                  name="dailyLimit"
                  type="number"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">
                  Start hour (HH:mm)
                </span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="09:00"
                  name="startHour"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">End hour (HH:mm)</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="17:00"
                  name="endHour"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Approval mode</span>
                <select
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="HUMAN_APPROVAL"
                  name="approvalMode"
                >
                  <option value="HUMAN_APPROVAL">HUMAN_APPROVAL</option>
                  <option value="AUTO_APPROVAL">AUTO_APPROVAL</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Autonomy level</span>
                <select
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="LEVEL_1_HUMAN_APPROVAL"
                  name="autonomyLevel"
                >
                  <option value="LEVEL_0_DRAFT_ONLY">LEVEL_0_DRAFT_ONLY</option>
                  <option value="LEVEL_1_HUMAN_APPROVAL">LEVEL_1_HUMAN_APPROVAL</option>
                  <option value="LEVEL_2_CONTROLLED_AUTO_FOLLOW_UP">LEVEL_2_CONTROLLED_AUTO_FOLLOW_UP</option>
                  <option value="LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS">LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS</option>
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs pq-copy-subtle">Weekday rules</span>
                <div className="flex flex-wrap gap-3 text-sm text-white">
                  {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(
                    (day) => (
                      <label className="flex items-center gap-2" key={day}>
                        <input
                          defaultChecked={[
                            "MON",
                            "TUE",
                            "WED",
                            "THU",
                            "FRI",
                          ].includes(day)}
                          name="weekdayRules"
                          type="checkbox"
                          value={day}
                        />
                        {day}
                      </label>
                    ),
                  )}
                </div>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs pq-copy-subtle">
                  Sequence steps JSON
                </span>
                <textarea
                  className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                  defaultValue='[{"dayOffset":0,"template":"intro"},{"dayOffset":3,"template":"follow_up"}]'
                  name="sequenceSteps"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs pq-copy-subtle">
                  Suppression policy
                </span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="respect_global_suppression"
                  name="suppressionPolicy"
                />
              </label>
              <div>
                <Button type="submit">Create campaign draft</Button>
              </div>
            </form>
          </Card>

          <Card title="Eligibility preview" eyebrow={`${preview.length} leads`}>
            <form className="grid gap-3" method="get">
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Minimum score</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue={String(minimumScore)}
                  name="minimumScore"
                  type="number"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Source ID</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue={sourceId ?? ""}
                  name="sourceId"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs pq-copy-subtle">Location</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue={location ?? ""}
                  name="location"
                />
              </label>
              <div className="flex gap-3">
                <Button type="submit" variant="secondary">
                  Refresh preview
                </Button>
                <Link
                  className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                  href="/internal/inbox"
                >
                  Open inbox
                </Link>
              </div>
            </form>
            <div className="mt-4 space-y-2">
              {preview.slice(0, 8).map((item) => (
                <article
                  className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3"
                  key={item.leadId}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="success">Score {item.leadScore}</Badge>
                    <Badge tone="info">{item.relationshipType}</Badge>
                    <Badge
                      tone={
                        item.directRelationshipVerified ? "success" : "warning"
                      }
                    >
                      {item.directRelationshipVerified
                        ? "direct verified"
                        : "needs review"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs pq-copy-muted">
                    {item.contactName}{" "}
                    {item.contactEmail ? `(${item.contactEmail})` : ""}
                  </p>
                  <p className="text-xs text-white">
                    {item.companyName ?? "No company"}{" "}
                    {item.preferredArea ? `| ${item.preferredArea}` : ""}
                  </p>
                </article>
              ))}
              {preview.length === 0 ? (
                <EmptyState
                  title="No eligible leads"
                  description="Adjust score/source/location filters to preview campaign audience."
                />
              ) : null}
            </div>
          </Card>
        </section>

        <Card title="Campaigns" eyebrow={`${campaigns.length} records`}>
          {campaigns.length === 0 ? (
            <EmptyState
              title="No campaigns"
              description="Create a campaign draft with explicit audience and sequencing controls."
            />
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <article
                  className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3"
                  key={campaign.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {campaign.name}
                      </p>
                      <p className="text-xs pq-copy-muted">
                        {campaign.objective ?? "No objective"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{campaign.channel}</Badge>
                      <Badge tone="warning">
                        min score {campaign.minimumScore}
                      </Badge>
                      <Badge tone="info">{campaign.autonomyLevel}</Badge>
                      <Badge tone="neutral">{campaign.approvalMode}</Badge>
                      <StatusPill
                        tone={
                          campaign.status === "running"
                            ? "success"
                            : campaign.status === "paused"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {campaign.status}
                      </StatusPill>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={launchCampaignAction}>
                      <input
                        name="campaignId"
                        type="hidden"
                        value={campaign.id}
                      />
                      <Button type="submit" variant="secondary">
                        Launch
                      </Button>
                    </form>
                    <form action={pauseCampaignAction}>
                      <input
                        name="campaignId"
                        type="hidden"
                        value={campaign.id}
                      />
                      <Button type="submit" variant="ghost">
                        Pause
                      </Button>
                    </form>
                  </div>
                  <div className="mt-4 grid gap-3 border-t border-[color:var(--pq-border)] pt-3 md:grid-cols-2">
                    <form action={sendCampaignEmailAction} className="grid gap-2">
                      <input name="campaignId" type="hidden" value={campaign.id} />
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">Lead ID</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          name="leadId"
                          required
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">Subject</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={campaign.name}
                          name="subject"
                          required
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">Body</span>
                        <textarea
                          className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                          name="bodyText"
                          required
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-white">
                        <input defaultChecked name="approved" type="checkbox" />
                        Human approval confirmed
                      </label>
                      <Button type="submit" variant="secondary">
                        Send controlled email
                      </Button>
                    </form>

                    <form action={scheduleFollowUpAction} className="grid gap-2">
                      <input name="campaignId" type="hidden" value={campaign.id} />
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">Lead ID</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          name="leadId"
                          required
                        />
                      </label>
                      <Button type="submit" variant="ghost">
                        Schedule follow-up sequence
                      </Button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
