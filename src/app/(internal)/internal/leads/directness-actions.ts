"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createDirectnessVerificationService } from "@/server/services/directness-verification-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readDate(formData: FormData, key: string) {
  const raw = readText(formData, key);
  if (!raw) {
    return undefined;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function readInteger(formData: FormData, key: string) {
  const raw = readText(formData, key);
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function assessDirectnessAction(formData: FormData) {
  const leadId = readText(formData, "leadId");
  const entityName = readText(formData, "entityName");
  const relationshipToPropertyOrCompany = readText(
    formData,
    "relationshipToPropertyOrCompany",
  );
  const evidenceSource = readText(formData, "evidenceSource");
  const evidenceReference = readText(formData, "evidenceReference");
  const evidenceType = readText(formData, "evidenceType");
  const evidenceDate = readDate(formData, "evidenceDate");
  const explanation = readText(formData, "explanation");
  const proposedClassification = readText(formData, "proposedClassification") as
    | "DIRECT"
    | "INTERMEDIARY"
    | "UNKNOWN"
    | "SUPPRESSED"
    | undefined;

  if (
    !leadId ||
    !entityName ||
    !relationshipToPropertyOrCompany ||
    !evidenceSource ||
    !evidenceReference ||
    !evidenceType ||
    !evidenceDate ||
    !explanation ||
    !proposedClassification
  ) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createDirectnessVerificationService();
  const personName = readText(formData, "personName");
  const roleTitle = readText(formData, "roleTitle");

  await service.assess(
    {
      leadId,
      entityName,
      ...(personName ? { personName } : {}),
      ...(roleTitle ? { roleTitle } : {}),
      relationshipToPropertyOrCompany,
      evidenceSource,
      evidenceReference,
      evidenceType,
      evidenceDate,
      explanation,
      confidence: readInteger(formData, "confidence") ?? 70,
      proposedClassification,
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/leads");
}
