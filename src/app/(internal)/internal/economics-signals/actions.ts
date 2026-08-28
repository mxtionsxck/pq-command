"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createEconomicsSignalService } from "@/server/services/economics-signal-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readInteger(formData: FormData, key: string) {
  const raw = readText(formData, key);
  if (!raw) {
    return undefined;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : undefined;
}

function readDate(formData: FormData, key: string) {
  const value = readText(formData, key);
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function addLhaRateAction(formData: FormData) {
  const user = await requireCurrentUser();
  const service = createEconomicsSignalService();

  const borough = readText(formData, "borough");
  const area = readText(formData, "area");
  const monthlyRate = readInteger(formData, "monthlyRate");
  const rateDate = readDate(formData, "rateDate");
  const bedroomBand = readText(formData, "bedroomBand");
  const rateSource = readText(formData, "rateSource");
  const rateReference = readText(formData, "rateReference");
  const rateVersion = readText(formData, "rateVersion");
  const notes = readText(formData, "notes");

  if (
    monthlyRate === undefined ||
    !rateDate ||
    !bedroomBand ||
    !rateSource ||
    !rateReference ||
    !rateVersion
  ) {
    return;
  }

  await service.addLhaRate(
    {
      ...(borough ? { borough } : {}),
      ...(area ? { area } : {}),
      bedroomBand,
      monthlyRateCents: monthlyRate * 100,
      rateSource,
      rateReference,
      rateDate,
      rateVersion,
      sourceApproved: formData.get("sourceApproved") === "on",
      ...(notes ? { notes } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/economics-signals");
}

export async function evaluateEconomicsSignalAction(formData: FormData) {
  const user = await requireCurrentUser();
  const service = createEconomicsSignalService();

  const propertyId = readText(formData, "propertyId");
  const bedroomBand = readText(formData, "bedroomBand");
  const rateVersion = readText(formData, "rateVersion");
  if (!propertyId) {
    return;
  }

  await service.evaluateProperty(
    {
      propertyId,
      ...(bedroomBand ? { bedroomBand } : {}),
      ...(rateVersion ? { rateVersion } : {}),
      notifyManagerUserId: readText(formData, "notifyManagerUserId") ?? user.id,
      notifyEnabled: formData.get("notifyEnabled") === "on",
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/economics-signals");
}
