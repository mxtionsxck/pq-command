"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createViewingWorkflowService } from "@/server/services/viewing-workflow-service";

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

export async function scheduleViewingAction(formData: FormData) {
  const propertyId = readText(formData, "propertyId");
  const scheduledFor = readDate(formData, "scheduledFor");

  if (!propertyId || !scheduledFor) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createViewingWorkflowService();
  const requirementId = readText(formData, "requirementId");
  const companyId = readText(formData, "companyId");
  const contactId = readText(formData, "contactId");
  const attendeesRaw = readText(formData, "attendees");
  const notes = readText(formData, "notes");
  const reminderAt = readDate(formData, "reminderAt");

  await service.scheduleViewing(
    {
      propertyId,
      scheduledFor,
      ...(requirementId ? { requirementId } : {}),
      ...(companyId ? { companyId } : {}),
      ...(contactId ? { contactId } : {}),
      ...(attendeesRaw ? { attendeesRaw } : {}),
      ...(notes ? { notes } : {}),
      ...(reminderAt ? { reminderAt } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/viewings");
}

export async function createViewingReminderAction(formData: FormData) {
  const viewingId = readText(formData, "viewingId");
  if (!viewingId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createViewingWorkflowService();

  await service.createReminder(
    {
      viewingId,
      userId: readText(formData, "userId") ?? user.id,
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/viewings");
}

export async function saveViewingOutcomeAction(formData: FormData) {
  const viewingId = readText(formData, "viewingId");
  const outcome = readText(formData, "outcome");

  if (!viewingId || !outcome) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createViewingWorkflowService();
  const nextAction = readText(formData, "nextAction");
  const notes = readText(formData, "notes");
  const commercialNotes = readText(formData, "commercialNotes");
  const taskAssigneeUserId = readText(formData, "taskAssigneeUserId") ?? user.id;

  await service.saveOutcome(
    {
      viewingId,
      outcome,
      ...(nextAction ? { nextAction } : {}),
      ...(notes ? { notes } : {}),
      ...(commercialNotes ? { commercialNotes } : {}),
      createTask: formData.get("createTask") === "on",
      ...(taskAssigneeUserId ? { taskAssigneeUserId } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/viewings");
}
