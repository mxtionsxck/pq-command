"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createBackgroundJobInfrastructureService } from "@/server/services/background-job-infrastructure-service";
import { createOutreachService } from "@/server/services/outreach-service";

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

function revalidateOperations() {
  revalidatePath("/admin/operations");
}

export async function scheduleDefaultJobsAction() {
  const user = await requireCurrentUserPermission("manageSources");
  const service = createBackgroundJobInfrastructureService();

  await service.scheduleDefaultJobs({
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateOperations();
}

export async function runDueJobsAction() {
  const user = await requireCurrentUserPermission("manageSources");
  const service = createBackgroundJobInfrastructureService();

  await service.runDueJobs(`manual-${user.id}`);
  revalidateOperations();
}

export async function setWorkerPausedAction(formData: FormData) {
  const workerName = readText(formData, "workerName") as
    | "discovery"
    | "research"
    | "scoring"
    | "outreach_planning"
    | "inbox_sync"
    | "reply_analysis"
    | "matching"
    | "shortage"
    | "deal_watcher"
    | "cleanup"
    | undefined;

  if (!workerName) {
    return;
  }

  const user = await requireCurrentUserPermission("manageSources");
  const service = createBackgroundJobInfrastructureService();
  const concurrencyLimit = readInteger(formData, "concurrencyLimit");

  await service.setWorkerPaused(
    {
      workerName,
      paused: formData.get("paused") === "on",
      ...(concurrencyLimit !== undefined ? { concurrencyLimit } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidateOperations();
}

export async function retryQueueItemAction(formData: FormData) {
  const queueItemId = readText(formData, "queueItemId");
  if (!queueItemId) {
    return;
  }

  const user = await requireCurrentUserPermission("manageSources");
  const service = createBackgroundJobInfrastructureService();

  await service.retryQueueItem(queueItemId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateOperations();
}

export async function requestGracefulShutdownAction() {
  await requireCurrentUserPermission("manageSources");
  const service = createBackgroundJobInfrastructureService();
  await service.requestGracefulShutdown();
  revalidateOperations();
}

export async function clearGracefulShutdownAction() {
  const user = await requireCurrentUserPermission("manageSources");
  const service = createBackgroundJobInfrastructureService();

  await service.clearGracefulShutdown({
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateOperations();
}

export async function setGlobalLevel3AutonomyAction(formData: FormData) {
  const user = await requireCurrentUserPermission("manageUsers");
  const service = createOutreachService();

  await service.setGlobalLevel3Enabled(formData.get("enabled") === "on", {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateOperations();
}
