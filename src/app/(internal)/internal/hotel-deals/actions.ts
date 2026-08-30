"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createHotelDealIntelligenceService } from "@/server/services/hotel-deal-intelligence-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function importPqHotelInventoryAction() {
  const user = await requireCurrentUser();
  const service = createHotelDealIntelligenceService();

  await service.seedMasterInventory({
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePath("/internal/hotel-deals");
  revalidatePath("/internal/command-centre");
}

export async function createHotelHumanHandoffTaskAction(formData: FormData) {
  const user = await requireCurrentUser();
  const service = createHotelDealIntelligenceService();

  const leadId = readText(formData, "leadId");
  if (!leadId) {
    return;
  }

  const description = readText(formData, "description");

  await service.createHumanHandoffTask(
    {
      leadId,
      title: readText(formData, "title") ?? "RESPONDED - HUMAN ACTION REQUIRED",
      ...(description ? { description } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/hotel-deals");
}

export async function runHotelUnifiedCycleAction() {
  const user = await requireCurrentUser();
  const service = createHotelDealIntelligenceService();

  await service.runUnifiedCycle({
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePath("/internal/hotel-deals");
  revalidatePath("/internal/command-centre");
}
