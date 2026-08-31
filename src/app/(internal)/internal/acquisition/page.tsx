import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState, StatusPill } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createAiAcquisitionOrchestratorService } from "@/server/services/ai-acquisition-orchestrator-service";
import { createDemandIntelligenceService } from "@/server/services/demand-intelligence-service";

import {
  createMissionAction,
  refreshDemandHeatmapAction,
  runMissionCycleAction,
  startMissionAction,
  stopMissionAction,
} from "./actions";

function formatPounds(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function AcquisitionPage() {
  await requireCurrentUserPermission("manageSources");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Acquisition engine unavailable"
          description="Configure DATABASE_URL to run objective-driven AI acquisition missions."
        />
      </AppShell>
    );
  }

  try {
    const orchestrator = createAiAcquisitionOrchestratorService();
    const demandService = createDemandIntelligenceService();

    const [missions, messages, heatmap, suggestions, northStar] = await Promise.all([
      orchestrator.listMissions(),
      orchestrator.listAgentMessages(),
      demandService.listHeatmap(),
      demandService.buildShortageMissionSuggestions(),
      orchestrator.getCommercialNorthStarSnapshot(),
    ]);

    const latestRunByMission = new Map(
      (
        await Promise.all(
          missions.map(async (mission) => {
            const runs = await orchestrator.listMissionRuns(mission.id);
            return [mission.id, runs[0]] as const;
          }),
        )
      ).map(([missionId, latestRun]) => [missionId, latestRun]),
    );

    return (
      <AppShell>
        <div className="space-y-8">
        <PageHeader
          eyebrow="AI Acquisition Engine"
          title="Objective-driven acquisition"
          description="PQ objective -> AI mission -> discovery/research/verification -> directness gate -> qualification -> outreach eligibility."
        />

        <Card title="Weekly north-star" eyebrow="5-10 completed lets target">
          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded border border-[color:var(--pq-border)] p-3">
              <p className="text-xs pq-copy-subtle">Completed lets this week</p>
              <p className="text-xl font-semibold text-white">{northStar.completedLetsThisWeek}</p>
              <p className="text-xs pq-copy-muted">target {northStar.weeklyTargetLow}-{northStar.weeklyTargetHigh}</p>
            </article>
            <article className="rounded border border-[color:var(--pq-border)] p-3">
              <p className="text-xs pq-copy-subtle">Pipeline value</p>
              <p className="text-xl font-semibold text-white">{formatPounds(northStar.pipelineValueCents)}</p>
              <p className="text-xs pq-copy-muted">active deals value</p>
            </article>
            <article className="rounded border border-[color:var(--pq-border)] p-3">
              <p className="text-xs pq-copy-subtle">Weighted pipeline</p>
              <p className="text-xl font-semibold text-white">{formatPounds(northStar.weightedPipelineValueCents)}</p>
              <p className="text-xs pq-copy-muted">stage-weighted confidence</p>
            </article>
          </div>
        </Card>

        <Card title="Create mission" eyebrow="Goal-driven, not source-driven">
          <form action={createMissionAction} className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs pq-copy-subtle">Title</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                name="title"
                placeholder="Find 10 verified DIRECT landlords/developers within the M25"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Mission type</span>
              <select
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue="SUPPLY"
                name="missionType"
              >
                <option value="SUPPLY">SUPPLY</option>
                <option value="DEMAND">DEMAND</option>
                <option value="SHORTAGE">SHORTAGE</option>
                <option value="RELATIONSHIP">RELATIONSHIP</option>
              </select>
            </label>
            <label className="space-y-1 md:col-span-3">
              <span className="text-xs pq-copy-subtle">Objective</span>
              <textarea
                className="min-h-24 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                name="missionObjective"
                placeholder="Find 10 verified DIRECT landlords/developers within the M25 who control suitable 4-5 bed stock where PQ has unmet company-let demand"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Area</span>
              <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue="M25" name="area" />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Bedrooms</span>
              <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue="4-5" name="bedrooms" />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Budget band</span>
              <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue="2500_3500" name="budgetBand" />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Target qualified prospects</span>
              <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue="10" min="1" name="targetQualifiedProspects" type="number" />
            </label>
            <label className="space-y-1">
              <span className="text-xs pq-copy-subtle">Target outreach-ready prospects</span>
              <input className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white" defaultValue="6" min="1" name="targetOutreachReadyProspects" type="number" />
            </label>
            <div className="self-end">
              <Button type="submit">Create mission</Button>
            </div>
          </form>
        </Card>

        <Card title="Demand heatmap" eyebrow={`${heatmap.length} cells`}>
          <form action={refreshDemandHeatmapAction} className="mb-3">
            <Button type="submit" variant="secondary">Refresh heatmap</Button>
          </form>
          {heatmap.length === 0 ? (
            <EmptyState
              title="No heatmap cells"
              description="Refresh demand heatmap to generate shortage intelligence for M25 areas."
            />
          ) : (
            <div className="space-y-2">
              {heatmap.slice(0, 15).map((cell) => (
                <article key={cell.id} className="rounded border border-[color:var(--pq-border)] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-white">{cell.area ?? cell.borough ?? cell.town ?? "M25"} | {cell.bedroomsBand} | {cell.budgetBand}</p>
                    <StatusPill tone={cell.status === "CRITICAL_SHORTAGE" ? "danger" : cell.status === "SHORTAGE" ? "warning" : "neutral"}>{cell.status}</StatusPill>
                  </div>
                  <p className="text-xs pq-copy-muted">requirements {cell.requirementsCount} | suitable {cell.suitablePropertiesCount} | ratio {cell.shortageRatio}</p>
                </article>
              ))}
            </div>
          )}
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] pq-copy-subtle">Suggested shortage missions</p>
            {suggestions.map((item, index) => (
              <p className="text-xs text-white" key={`${item.title}-${index}`}>{item.title} | {item.area ?? "M25"} | {item.budgetBand}</p>
            ))}
          </div>
        </Card>

        <Card title="Active missions" eyebrow={`${missions.length} total`}>
          {missions.length === 0 ? (
            <EmptyState title="No missions" description="Create an objective-driven mission to begin autonomous acquisition cycles." />
          ) : (
            <div className="space-y-3">
              {missions.map((mission) => (
                <article key={mission.id} className="rounded border border-[color:var(--pq-border)] p-3">
                  {(() => {
                    const latestRun = latestRunByMission.get(mission.id);

                    return (
                      <p className="mb-2 text-xs pq-copy-muted">
                        latest cycle {latestRun?.status ?? "not run"}
                        {latestRun?.errorMessage ? ` | ${latestRun.errorMessage}` : ""}
                      </p>
                    );
                  })()}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-white">{mission.title}</p>
                    <Badge tone="info">{mission.missionType}</Badge>
                  </div>
                  <p className="mt-1 text-xs pq-copy-muted">{mission.missionObjective}</p>
                  <p className="mt-1 text-xs pq-copy-muted">status {mission.status} | discovered {mission.candidatesDiscovered} | qualified {mission.qualifiedProspects} | outreach-ready {mission.outreachReadyProspects}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={startMissionAction}>
                      <input type="hidden" name="missionId" value={mission.id} />
                      <Button type="submit" variant="secondary">Start</Button>
                    </form>
                    <form action={runMissionCycleAction}>
                      <input type="hidden" name="missionId" value={mission.id} />
                      <Button type="submit" variant="ghost">Run cycle</Button>
                    </form>
                    <form action={stopMissionAction}>
                      <input type="hidden" name="missionId" value={mission.id} />
                      <input type="hidden" name="reason" value="exhausted" />
                      <Button type="submit" variant="ghost">Stop exhausted</Button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card title="Agent message box" eyebrow={`${messages.length} events`}>
          {messages.length === 0 ? (
            <EmptyState title="No agent messages" description="Messages appear as AI workers detect events requiring attention." />
          ) : (
            <div className="space-y-2">
              {messages.slice(0, 20).map((message) => (
                <article key={message.id} className="rounded border border-[color:var(--pq-border)] p-2">
                  <p className="text-xs text-white">{message.type} | {message.title}</p>
                  <p className="text-xs pq-copy-muted">{message.body}</p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
    );
  } catch {
    return (
      <AppShell>
        <EmptyState
          title="Acquisition engine temporarily unavailable"
          description="The live acquisition data layer is re-syncing or unavailable right now. Please try again shortly."
        />
      </AppShell>
    );
  }
}
