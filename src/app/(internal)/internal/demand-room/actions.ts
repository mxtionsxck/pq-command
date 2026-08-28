"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createDemandRoomService } from "@/server/services/demand-room-service";
import { createMatchingEngineService } from "@/server/services/matching-engine-service";

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

function readDate(formData: FormData, key: string) {
  const value = readText(formData, key);
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function createRequirementAction(formData: FormData) {
  const user = await requireCurrentUser();
  const service = createDemandRoomService();

  await service.createRequirement(
    {
      leadId: readText(formData, "leadId") ?? null,
      companyId: readText(formData, "companyId") ?? null,
      contactId: readText(formData, "contactId") ?? null,
      ownerUserId: readText(formData, "ownerUserId") ?? user.id,
      status: "open",
      budgetMinCents:
        readInteger(formData, "budgetMin") !== undefined
          ? (readInteger(formData, "budgetMin") as number) * 100
          : null,
      budgetMaxCents:
        readInteger(formData, "budgetMax") !== undefined
          ? (readInteger(formData, "budgetMax") as number) * 100
          : null,
      bedroomsMin: readInteger(formData, "bedroomsMin") ?? null,
      bedroomsMax: readInteger(formData, "bedroomsMax") ?? null,
      unitCount: readInteger(formData, "unitCount") ?? null,
      acceptableRadiusMiles: readInteger(formData, "radiusMiles") ?? null,
      preferredArea: readText(formData, "preferredArea") ?? null,
      startDate: readDate(formData, "startDate") ?? null,
      termMonths: readInteger(formData, "termMonths") ?? null,
      purpose: readText(formData, "purpose") ?? null,
      urgency:
        (readText(formData, "urgency") as
          | "LOW"
          | "MEDIUM"
          | "HIGH"
          | "URGENT"
          | undefined) ?? "MEDIUM",
      relationshipType:
        (readText(formData, "relationshipType") as
          | "DIRECT"
          | "INTRODUCER"
          | "UNKNOWN"
          | undefined) ?? "UNKNOWN",
      directRelationshipVerified: formData.get("directRelationshipVerified") === "on",
      evidenceIds: [],
      notes: readText(formData, "notes") ?? null,
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/demand-room");
}

export async function updateRequirementAction(formData: FormData) {
  const requirementId = readText(formData, "requirementId");
  if (!requirementId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createDemandRoomService();

  await service.updateRequirement(
    requirementId,
    {
      status:
        (readText(formData, "status") as
          | "open"
          | "matched"
          | "on_hold"
          | "closed"
          | "archived"
          | undefined) ?? undefined,
      preferredArea: readText(formData, "preferredArea") ?? undefined,
      budgetMaxCents:
        readInteger(formData, "budgetMax") !== undefined
          ? (readInteger(formData, "budgetMax") as number) * 100
          : undefined,
      bedroomsMin: readInteger(formData, "bedroomsMin") ?? undefined,
      bedroomsMax: readInteger(formData, "bedroomsMax") ?? undefined,
      unitCount: readInteger(formData, "unitCount") ?? undefined,
      termMonths: readInteger(formData, "termMonths") ?? undefined,
      purpose: readText(formData, "purpose") ?? undefined,
      urgency:
        (readText(formData, "urgency") as
          | "LOW"
          | "MEDIUM"
          | "HIGH"
          | "URGENT"
          | undefined) ?? undefined,
      notes: readText(formData, "notes") ?? undefined,
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/demand-room");
}

export async function archiveRequirementAction(formData: FormData) {
  const requirementId = readText(formData, "requirementId");
  if (!requirementId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createDemandRoomService();

  await service.archiveRequirement(requirementId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePath("/internal/demand-room");
}

export async function runMatchingAction(formData: FormData) {
  const requirementId = readText(formData, "requirementId");
  if (!requirementId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createMatchingEngineService();

  await service.runRequirementMatch(requirementId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePath("/internal/demand-room");
}
