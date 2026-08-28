"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createShortageIntelligenceService } from "@/server/services/shortage-intelligence-service";

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

function buildFilter(formData: FormData) {
  const borough = readText(formData, "borough");
  const area = readText(formData, "area");
  const bedroomsMin = readInteger(formData, "bedroomsMin");
  const bedroomsMax = readInteger(formData, "bedroomsMax");
  const unitCountMin = readInteger(formData, "unitCountMin");
  const budgetBand = readText(formData, "budgetBand") as
    | "under_1500"
    | "1500_2500"
    | "2500_3500"
    | "3500_plus"
    | undefined;
  const availabilityWindow = readText(formData, "availabilityWindow") as
    | "now"
    | "within_30_days"
    | "31_90_days"
    | "future"
    | undefined;

  return {
    ...(borough ? { borough } : {}),
    ...(area ? { area } : {}),
    ...(bedroomsMin !== undefined ? { bedroomsMin } : {}),
    ...(bedroomsMax !== undefined ? { bedroomsMax } : {}),
    ...(unitCountMin !== undefined ? { unitCountMin } : {}),
    ...(budgetBand ? { budgetBand } : {}),
    ...(availabilityWindow ? { availabilityWindow } : {}),
  };
}

export async function recalculateShortageAction(formData: FormData) {
  const user = await requireCurrentUser();
  const service = createShortageIntelligenceService();

  await service.recalculate(buildFilter(formData), {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePath("/internal/shortage-intelligence");
}

export async function convertShortageTargetAction(formData: FormData) {
  const shortageId = readText(formData, "shortageId");
  if (!shortageId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createShortageIntelligenceService();

  await service.convertToTarget(
    {
      shortageId,
      createObjective: formData.get("createObjective") === "on",
      createCampaignTarget: formData.get("createCampaignTarget") === "on",
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/shortage-intelligence");
}
