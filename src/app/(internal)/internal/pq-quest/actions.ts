"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createPqQuestService } from "@/server/services/pq-quest-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function awardQuestXpAction(formData: FormData) {
  const sourceEventId = readText(formData, "sourceEventId");
  const sourceAction = readText(formData, "sourceAction");

  if (!sourceEventId || !sourceAction) {
    return;
  }

  const user = await requireCurrentUserPermission("sendOutreach");
  const service = createPqQuestService();

  await service.awardVerifiedEvent(
    {
      userId: user.id,
      sourceEventId,
      sourceAction,
    },
    createAuditActor(user),
  );

  revalidatePath("/internal/pq-quest");
}
