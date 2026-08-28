import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canManageSources } from "@/server/auth/rbac";
import {
  createAcquisitionEngineRepository,
  type AcquisitionEngineRepository,
} from "@/server/repositories/acquisition-engine-repository";

import { createAuditService } from "./audit-event-service";
import { createBackgroundJobInfrastructureService } from "./background-job-infrastructure-service";
import { createDemandIntelligenceService } from "./demand-intelligence-service";

type OrchestratorDependencies = {
  repository?: AcquisitionEngineRepository;
  auditService?: ReturnType<typeof createAuditService>;
  jobsService?: ReturnType<typeof createBackgroundJobInfrastructureService>;
  demandIntelligenceService?: ReturnType<typeof createDemandIntelligenceService>;
  now?: () => Date;
};

const SPECIALISED_WORKERS = [
  { key: "SCOUT_AGENT", mission: "Discover potential supply and demand opportunities" },
  { key: "RESEARCH_AGENT", mission: "Investigate each candidate and gather evidence" },
  { key: "DIRECTNESS_VERIFICATION_AGENT", mission: "Determine whether candidate is genuinely direct" },
  { key: "QUALIFICATION_AGENT", mission: "Determine fit for PQ company-let requirements" },
  { key: "SCORING_AGENT", mission: "Rank opportunities by evidence, fit, urgency, economics, conversion" },
  { key: "OUTREACH_AGENT", mission: "Prepare and send outreach when policy allows" },
  { key: "CONVERSATION_AGENT", mission: "Interpret replies and derive next actions" },
  { key: "MATCHING_AGENT", mission: "Match verified stock to verified requirements" },
  { key: "MARKET_INTELLIGENCE_AGENT", mission: "Identify shortages and sourcing priorities" },
  { key: "RELATIONSHIP_AGENT", mission: "Find supported opportunities in existing relationships" },
] as const;

function getRepository(repository?: AcquisitionEngineRepository) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createAcquisitionEngineRepository(getDb());
}

function ensureAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (!actor.role || !canManageSources(actor.role)) {
    throw new Error("Only management can orchestrate autonomous acquisition missions.");
  }
}

export function createAiAcquisitionOrchestratorService(
  dependencies: OrchestratorDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();
  const jobsService =
    dependencies.jobsService ?? createBackgroundJobInfrastructureService();
  const demandIntelligenceService =
    dependencies.demandIntelligenceService ?? createDemandIntelligenceService();
  const now = dependencies.now ?? (() => new Date());

  return {
    specialisedWorkers: SPECIALISED_WORKERS,

    async createMission(
      input: {
        title: string;
        missionObjective: string;
        missionType: "SUPPLY" | "DEMAND" | "SHORTAGE" | "RELATIONSHIP";
        objectiveId?: string;
        ownerUserId?: string;
        targetQualifiedProspects: number;
        targetOutreachReadyProspects: number;
        scope?: Record<string, unknown>;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before orchestrating missions.");
      }

      const mission = await repository.createMission({
        title: input.title,
        missionObjective: input.missionObjective,
        missionType: input.missionType,
        ...(input.objectiveId ? { objectiveId: input.objectiveId } : {}),
        ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
        targetQualifiedProspects: input.targetQualifiedProspects,
        targetOutreachReadyProspects: input.targetOutreachReadyProspects,
        scope: input.scope ?? {},
      });

      await repository.createAgentMessage({
        type: "NEW_OBJECTIVE",
        title: "New AI acquisition mission",
        body: `${input.title}: ${input.missionObjective}`,
        severity: "info",
        ...(mission?.id ? { missionId: mission.id } : {}),
      });

      await auditService.recordEvent({
        actor,
        action: "acquisition.mission.created",
        entityType: "acquisition_mission",
        entityId: mission?.id ?? "unknown",
        metadata: {
          missionType: input.missionType,
          targetQualifiedProspects: input.targetQualifiedProspects,
          targetOutreachReadyProspects: input.targetOutreachReadyProspects,
        },
      });

      return mission;
    },

    async startMission(
      missionId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before orchestrating missions.");
      }

      const mission = await repository.getMission(missionId);
      if (!mission) {
        throw new Error("Mission not found.");
      }

      await repository.updateMission(missionId, {
        status: "running",
        startedAt: now(),
      });

      await auditService.recordEvent({
        actor,
        action: "acquisition.mission.started",
        entityType: "acquisition_mission",
        entityId: missionId,
      });
    },

    async runMissionCycle(
      missionId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before orchestrating missions.");
      }

      const mission = await repository.getMission(missionId);
      if (!mission) {
        throw new Error("Mission not found.");
      }

      const run = await repository.createMissionRun({
        missionId,
        status: "running",
        trace: {
          missionType: mission.missionType,
          objective: mission.missionObjective,
        },
      });

      try {
        const startedAt = mission.startedAt ?? mission.createdAt;

        if (mission.missionType === "SHORTAGE" || mission.missionType === "SUPPLY") {
          await demandIntelligenceService.refreshHeatmap(actor);
        }

        const [discovered, qualified, outreachReady, awaitingVerification] =
          await Promise.all([
            repository.countMissionDiscovered(startedAt),
            repository.countMissionQualified(startedAt),
            repository.countMissionOutreachReady(startedAt),
            repository.countMissionAwaitingVerification(startedAt),
          ]);

        const targetReached =
          qualified >= mission.targetQualifiedProspects &&
          outreachReady >= mission.targetOutreachReadyProspects;

        if (mission.status === "running") {
          if (mission.missionType === "SUPPLY" || mission.missionType === "SHORTAGE") {
            const key = `mission:${missionId}:${now().toISOString().slice(0, 13)}`;
            await jobsService.enqueueJob({
              workerName: "discovery",
              queueName: "acquisition",
              idempotencyKey: key,
              payload: {
                missionId,
                objective: mission.missionObjective,
                scope: mission.scope,
              },
            });
          }
        }

        const updated = await repository.updateMission(missionId, {
          candidatesDiscovered: discovered,
          qualifiedProspects: qualified,
          outreachReadyProspects: outreachReady,
          candidatesAwaitingVerification: awaitingVerification,
          status: targetReached ? "satisfied" : "running",
          ...(targetReached ? { endedAt: now(), stopReason: "objective_satisfied" } : {}),
        });

        if (run?.id) {
          await repository.updateMissionRun(run.id, {
            status: "succeeded",
            cycleEndedAt: now(),
            discovered,
            qualified,
            outreachReady,
            awaitingVerification,
            targetReached,
          });
        }

        if (targetReached) {
          await repository.createAgentMessage({
            type: "OBJECTIVE_SATISFIED",
            title: "Mission objective satisfied",
            body: `Mission ${mission.title} reached qualified and outreach-ready targets.`,
            severity: "info",
            missionId,
          });
        }

        await auditService.recordEvent({
          actor,
          action: "acquisition.mission.cycle",
          entityType: "acquisition_mission",
          entityId: missionId,
          metadata: {
            discovered,
            qualified,
            outreachReady,
            awaitingVerification,
            targetReached,
            runId: run?.id,
          },
        });

        return updated;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown mission cycle error";

        if (run?.id) {
          await repository.updateMissionRun(run.id, {
            status: "failed",
            cycleEndedAt: now(),
            errorMessage: message,
          });
        }

        await repository.createAgentMessage({
          type: "MISSION_CYCLE_FAILED",
          title: "Mission cycle failed",
          body: `Mission ${mission.title} failed: ${message}`,
          severity: "warning",
          missionId,
        });

        throw error;
      }
    },

    async stopMission(
      missionId: string,
      reason: "exhausted" | "cancelled",
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before orchestrating missions.");
      }

      const stopped = await repository.updateMission(missionId, {
        status: reason,
        endedAt: now(),
        stopReason: reason === "exhausted" ? "research_exhausted" : "cancelled_by_user",
      });

      await repository.createAgentMessage({
        type: "MISSION_STOPPED",
        title: "Mission stopped",
        body: `Mission ${missionId} stopped with status ${reason}.`,
        severity: reason === "exhausted" ? "warning" : "info",
        missionId,
      });

      await auditService.recordEvent({
        actor,
        action: "acquisition.mission.stopped",
        entityType: "acquisition_mission",
        entityId: missionId,
        metadata: { reason },
      });

      return stopped;
    },

    async listMissions() {
      if (!repository) {
        return [];
      }

      return repository.listMissions();
    },

    async listAgentMessages() {
      if (!repository) {
        return [];
      }

      return repository.listAgentMessages();
    },

    async listObjectiveBacklog() {
      if (!repository) {
        return [];
      }

      return repository.listObjectiveBacklog();
    },

    async getCommercialNorthStarSnapshot() {
      if (!repository) {
        return {
          weekStart: now(),
          weeklyTargetLow: 5,
          weeklyTargetHigh: 10,
          completedLetsThisWeek: 0,
          pipelineValueCents: 0,
          weightedPipelineValueCents: 0,
        };
      }

      return repository.getCommercialNorthStarSnapshot(now());
    },

    async listMissionRuns(missionId: string) {
      if (!repository) {
        return [];
      }

      return repository.listMissionRuns(missionId);
    },
  };
}
