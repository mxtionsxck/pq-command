"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createOutreachService } from "@/server/services/outreach-service";
import { createControlledEmailSendingService } from "@/server/services/controlled-email-sending-service";
import { createFollowUpEngineService } from "@/server/services/follow-up-engine-service";

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

function readWeekdays(formData: FormData) {
  const values = formData.getAll("weekdayRules");
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseSequenceSteps(raw: string | undefined) {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as Array<{
      dayOffset: number;
      template: string;
    }>;
    return parsed.filter(
      (item) =>
        Number.isFinite(item.dayOffset) &&
        typeof item.template === "string" &&
        item.template.trim().length > 0,
    );
  } catch {
    return undefined;
  }
}

export async function buildOutreachCampaignAction(formData: FormData) {
  const user = await requireCurrentUser();
  const service = createOutreachService();

  const sequenceSteps = parseSequenceSteps(readText(formData, "sequenceSteps"));
  const sourceId = readText(formData, "sourceId");
  const objective = readText(formData, "objective");
  const audience = readText(formData, "audience");
  const minimumScore = readInteger(formData, "minimumScore");
  const location = readText(formData, "location");
  const bedroomsMin = readInteger(formData, "bedroomsMin");
  const bedroomsMax = readInteger(formData, "bedroomsMax");
  const unitCountMin = readInteger(formData, "unitCountMin");
  const startHour = readText(formData, "startHour");
  const endHour = readText(formData, "endHour");
  const dailyLimit = readInteger(formData, "dailyLimit");
  const suppressionPolicy = readText(formData, "suppressionPolicy");
  const scheduledAt = readDate(formData, "scheduledAt");
  const approvalMode = readText(formData, "approvalMode") as
    | "HUMAN_APPROVAL"
    | "AUTO_APPROVAL"
    | undefined;
  const autonomyLevel = readText(formData, "autonomyLevel") as
    | "LEVEL_0_DRAFT_ONLY"
    | "LEVEL_1_HUMAN_APPROVAL"
    | "LEVEL_2_CONTROLLED_AUTO_FOLLOW_UP"
    | "LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS"
    | undefined;

  await service.buildCampaign(
    {
      name: readText(formData, "name") ?? "Untitled campaign",
      channel:
        (readText(formData, "channel") as
          "email" | "sms" | "whatsapp" | undefined) ?? "email",
      ...(sourceId ? { sourceId } : {}),
      ...(objective ? { objective } : {}),
      ...(audience ? { audience } : {}),
      ...(minimumScore !== undefined ? { minimumScore } : {}),
      ...(location ? { location } : {}),
      ...(bedroomsMin !== undefined ? { bedroomsMin } : {}),
      ...(bedroomsMax !== undefined ? { bedroomsMax } : {}),
      ...(unitCountMin !== undefined ? { unitCountMin } : {}),
      ...(startHour ? { startHour } : {}),
      ...(endHour ? { endHour } : {}),
      weekdayRules: readWeekdays(formData),
      ...(dailyLimit !== undefined ? { dailyLimit } : {}),
      ...(sequenceSteps ? { sequenceSteps } : {}),
      ...(approvalMode ? { approvalMode } : {}),
      ...(autonomyLevel ? { autonomyLevel } : {}),
      ...(suppressionPolicy ? { suppressionPolicy } : {}),
      ...(scheduledAt ? { scheduledAt } : {}),
      ownerUserId: user.id,
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/outreach");
}

export async function launchCampaignAction(formData: FormData) {
  const campaignId = readText(formData, "campaignId");
  if (!campaignId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createOutreachService();

  await service.launchCampaign(campaignId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePath("/internal/outreach");
}

export async function pauseCampaignAction(formData: FormData) {
  const campaignId = readText(formData, "campaignId");
  if (!campaignId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createOutreachService();

  await service.pauseCampaign(campaignId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePath("/internal/outreach");
}

export async function sendCampaignEmailAction(formData: FormData) {
  const campaignId = readText(formData, "campaignId");
  const leadId = readText(formData, "leadId");
  const subject = readText(formData, "subject");
  const bodyText = readText(formData, "bodyText");

  if (!campaignId || !leadId || !subject || !bodyText) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createControlledEmailSendingService();

  const result = await service.sendCampaignEmail(
    {
      campaignId,
      leadId,
      subject,
      bodyText,
      approved: formData.get("approved") === "on",
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/outreach");

  const params = new URLSearchParams({
    sendStatus: result.status,
  });

  if (result.failedReasons.length > 0) {
    params.set("failedReasons", result.failedReasons.join(","));
  }

  redirect(`/internal/outreach?${params.toString()}`);
}

export async function scheduleFollowUpAction(formData: FormData) {
  const campaignId = readText(formData, "campaignId");
  const leadId = readText(formData, "leadId");

  if (!campaignId || !leadId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createFollowUpEngineService();

  await service.schedule(
    {
      campaignId,
      leadId,
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/outreach");
}
