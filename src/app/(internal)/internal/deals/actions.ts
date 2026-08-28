"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createDealRoomService } from "@/server/services/deal-room-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readDate(formData: FormData, key: string) {
  const value = readText(formData, key);
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function createDealAction(formData: FormData) {
  const user = await requireCurrentUser();
  const service = createDealRoomService();
  const companyId = readText(formData, "companyId");
  const propertyId = readText(formData, "propertyId");
  const requirementId = readText(formData, "requirementId");
  const leadId = readText(formData, "leadId");
  const contactId = readText(formData, "contactId");
  const summary = readText(formData, "summary");
  const commercialSummary = readText(formData, "commercialSummary");
  const nextAction = readText(formData, "nextAction");
  const blockersRaw = readText(formData, "blockers");

  await service.createDeal(
    {
      ...(companyId ? { companyId } : {}),
      ...(propertyId ? { propertyId } : {}),
      ...(requirementId ? { requirementId } : {}),
      ...(leadId ? { leadId } : {}),
      ownerUserId: readText(formData, "ownerUserId") ?? user.id,
      ...(contactId ? { contactId } : {}),
      ...(summary ? { summary } : {}),
      ...(commercialSummary ? { commercialSummary } : {}),
      ...(nextAction ? { nextAction } : {}),
      ...(blockersRaw ? { blockersRaw } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/deals");
}

export async function transitionDealStageAction(formData: FormData) {
  const dealId = readText(formData, "dealId");
  const toStage = readText(formData, "toStage") as
    | "MATCHED"
    | "VIEWING"
    | "OFFER"
    | "NEGOTIATION"
    | "AGREED"
    | "CONTRACT"
    | "LIVE"
    | "COMPLETED"
    | "LOST"
    | undefined;

  if (!dealId || !toStage) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createDealRoomService();

  await service.transitionStage(
    {
      dealId,
      toStage,
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/deals");
}

export async function updateDealDetailsAction(formData: FormData) {
  const dealId = readText(formData, "dealId");
  if (!dealId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createDealRoomService();
  const commercialSummary = readText(formData, "commercialSummary");
  const blockersRaw = readText(formData, "blockers");
  const nextAction = readText(formData, "nextAction");
  const summary = readText(formData, "summary");

  await service.updateDealDetails(
    {
      dealId,
      ...(commercialSummary ? { commercialSummary } : {}),
      ...(blockersRaw ? { blockersRaw } : {}),
      ...(nextAction ? { nextAction } : {}),
      ...(summary ? { summary } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/deals");
}

export async function createDealTaskAction(formData: FormData) {
  const dealId = readText(formData, "dealId");
  const title = readText(formData, "title");

  if (!dealId || !title) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createDealRoomService();
  const description = readText(formData, "description");
  const dueAt = readDate(formData, "dueAt");

  await service.createDealTask(
    {
      dealId,
      title,
      ...(description ? { description } : {}),
      ...(dueAt ? { dueAt } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/deals");
}
