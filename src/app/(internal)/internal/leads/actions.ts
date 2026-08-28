"use server";

import { revalidatePath } from "next/cache";

import type { LeadOutreachStatus, LeadStatus } from "@/domain/lead/types";
import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createDirectDemandDiscoveryService } from "@/server/services/direct-demand-discovery-service";
import { createLeadRoomService } from "@/server/services/lead-room-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function revalidateLeads() {
  revalidatePath("/internal/leads");
}

export async function transitionLeadStatusAction(formData: FormData) {
  const leadId = readText(formData, "leadId");
  const status = readText(formData, "status") as LeadStatus | undefined;

  if (!leadId || !status) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createLeadRoomService();

  await service.transitionStatus(leadId, status, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateLeads();
}

export async function updateLeadPlanAction(formData: FormData) {
  const leadId = readText(formData, "leadId");

  if (!leadId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createLeadRoomService();

  const patch: {
    nextAction?: string;
    outreachStatus?: LeadOutreachStatus;
  } = {};
  const nextAction = readText(formData, "nextAction");
  const outreachStatus = readText(formData, "outreachStatus") as
    LeadOutreachStatus | undefined;

  if (nextAction !== undefined) {
    patch.nextAction = nextAction;
  }

  if (outreachStatus !== undefined) {
    patch.outreachStatus = outreachStatus;
  }

  await service.updateNextAction(leadId, patch, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateLeads();
}

export async function extractDirectDemandAction(formData: FormData) {
  const leadId = readText(formData, "leadId");

  if (!leadId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createDirectDemandDiscoveryService();

  await service.discover(
    {
      leadId,
      ownerUserId: user.id,
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidateLeads();
}
