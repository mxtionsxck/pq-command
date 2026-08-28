"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createPilotModeService } from "@/server/services/pilot-mode-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function submitPilotFeedbackAction(formData: FormData) {
  const user = await requireCurrentUserPermission("sendOutreach");
  const workflowKey = readText(formData, "workflowKey") as
    | "review_overnight_leads"
    | "qualify_stock"
    | "review_direct_demand"
    | "approve_outreach"
    | "handle_hot_replies"
    | "create_requirement"
    | "review_matches"
    | "book_viewing"
    | "progress_deal"
    | "review_ai_errors"
    | undefined;
  const feedbackLabel = readText(formData, "feedbackLabel") as
    | "GOOD_AI"
    | "WRONG"
    | "MISSING"
    | "NEEDS_HUMAN"
    | undefined;

  if (!workflowKey || !feedbackLabel) {
    return;
  }

  const service = createPilotModeService();

  const notes = readText(formData, "notes");
  const entityType = readText(formData, "entityType");
  const entityId = readText(formData, "entityId");

  await service.submitFeedback(
    {
      workflowKey,
      feedbackLabel,
      ...(notes ? { notes } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/pilot");
}
