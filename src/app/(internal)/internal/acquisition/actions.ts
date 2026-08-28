"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createAiAcquisitionOrchestratorService } from "@/server/services/ai-acquisition-orchestrator-service";
import { createDemandIntelligenceService } from "@/server/services/demand-intelligence-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readInteger(formData: FormData, key: string) {
  const value = readText(formData, key);
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function revalidateAcquisition() {
  revalidatePath("/internal/acquisition");
}

export async function createMissionAction(formData: FormData) {
  const title = readText(formData, "title");
  const missionObjective = readText(formData, "missionObjective");

  if (!title || !missionObjective) {
    return;
  }

  const missionType = (readText(formData, "missionType") ?? "SUPPLY") as
    | "SUPPLY"
    | "DEMAND"
    | "SHORTAGE"
    | "RELATIONSHIP";

  const targetQualifiedProspects = readInteger(formData, "targetQualifiedProspects") ?? 10;
  const targetOutreachReadyProspects = readInteger(formData, "targetOutreachReadyProspects") ?? 6;

  const user = await requireCurrentUserPermission("manageSources");
  const service = createAiAcquisitionOrchestratorService();

  await service.createMission(
    {
      title,
      missionObjective,
      missionType,
      targetQualifiedProspects,
      targetOutreachReadyProspects,
      ownerUserId: user.id,
      scope: {
        area: readText(formData, "area") ?? "M25",
        bedrooms: readText(formData, "bedrooms") ?? "4-5",
        budgetBand: readText(formData, "budgetBand") ?? "2500_3500",
        directOnly: true,
      },
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidateAcquisition();
}

export async function startMissionAction(formData: FormData) {
  const missionId = readText(formData, "missionId");
  if (!missionId) {
    return;
  }

  const user = await requireCurrentUserPermission("manageSources");
  const service = createAiAcquisitionOrchestratorService();

  await service.startMission(missionId, {
    ...createAuditActor(user),
    role: user.role,
  });

  await service.runMissionCycle(missionId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateAcquisition();
}

export async function runMissionCycleAction(formData: FormData) {
  const missionId = readText(formData, "missionId");
  if (!missionId) {
    return;
  }

  const user = await requireCurrentUserPermission("manageSources");
  const service = createAiAcquisitionOrchestratorService();

  await service.runMissionCycle(missionId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateAcquisition();
}

export async function stopMissionAction(formData: FormData) {
  const missionId = readText(formData, "missionId");
  if (!missionId) {
    return;
  }

  const reason = (readText(formData, "reason") ?? "cancelled") as
    | "exhausted"
    | "cancelled";

  const user = await requireCurrentUserPermission("manageSources");
  const service = createAiAcquisitionOrchestratorService();

  await service.stopMission(missionId, reason, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateAcquisition();
}

export async function refreshDemandHeatmapAction() {
  const user = await requireCurrentUserPermission("manageSources");
  const service = createDemandIntelligenceService();

  await service.refreshHeatmap({
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateAcquisition();
}
