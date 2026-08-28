"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createAnalyticsAttributionService } from "@/server/services/analytics-attribution-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readDate(formData: FormData, key: string, fallback: Date) {
  const value = readText(formData, key);
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function refreshAnalyticsSnapshotAction(formData: FormData) {
  const user = await requireCurrentUserPermission("sendOutreach");
  const service = createAnalyticsAttributionService();

  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sourceId = readText(formData, "sourceId");
  const campaignId = readText(formData, "campaignId");
  const leadType = readText(formData, "leadType") as
    | "supply"
    | "demand"
    | "ai_discovered"
    | undefined;
  const area = readText(formData, "area");
  const bedroomsBand = readText(formData, "bedroomsBand");
  const agentUserId = readText(formData, "agentUserId");

  await service.persistSnapshot(
    {
      periodStart: readDate(formData, "periodStart", defaultStart),
      periodEnd: readDate(formData, "periodEnd", now),
      ...(sourceId ? { sourceId } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(leadType ? { leadType } : {}),
      ...(area ? { area } : {}),
      ...(bedroomsBand ? { bedroomsBand } : {}),
      ...(agentUserId ? { agentUserId } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/analytics");
}
