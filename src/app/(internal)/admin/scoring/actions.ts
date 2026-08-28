"use server";

import { revalidatePath } from "next/cache";

import type {
  LeadScoringConfigShape,
  LeadScoringThresholds,
  LeadScoringWeights,
} from "@/domain/scoring/types";
import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createLeadScoringService } from "@/server/services/lead-scoring-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(formData: FormData, key: string) {
  const value = readText(formData, key);

  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseConfig(formData: FormData): LeadScoringConfigShape {
  const service = createLeadScoringService();
  const defaults = service.getDefaultConfig();

  const weights: LeadScoringWeights = {
    companyLetFit:
      readNumber(formData, "weight_companyLetFit") ??
      defaults.weights.companyLetFit,
    location:
      readNumber(formData, "weight_location") ?? defaults.weights.location,
    bedroomsUnits:
      readNumber(formData, "weight_bedroomsUnits") ??
      defaults.weights.bedroomsUnits,
    timing: readNumber(formData, "weight_timing") ?? defaults.weights.timing,
    commercialFit:
      readNumber(formData, "weight_commercialFit") ??
      defaults.weights.commercialFit,
    evidenceStrength:
      readNumber(formData, "weight_evidenceStrength") ??
      defaults.weights.evidenceStrength,
    decisionMakerConfidence:
      readNumber(formData, "weight_decisionMakerConfidence") ??
      defaults.weights.decisionMakerConfidence,
    recency: readNumber(formData, "weight_recency") ?? defaults.weights.recency,
    contactability:
      readNumber(formData, "weight_contactability") ??
      defaults.weights.contactability,
    historicalConversionLikelihood:
      readNumber(formData, "weight_historicalConversionLikelihood") ??
      defaults.weights.historicalConversionLikelihood,
  };

  const thresholds: LeadScoringThresholds = {
    IGNORE:
      readNumber(formData, "threshold_IGNORE") ?? defaults.thresholds.IGNORE,
    MONITOR:
      readNumber(formData, "threshold_MONITOR") ?? defaults.thresholds.MONITOR,
    RESEARCH:
      readNumber(formData, "threshold_RESEARCH") ??
      defaults.thresholds.RESEARCH,
    QUALIFIED:
      readNumber(formData, "threshold_QUALIFIED") ??
      defaults.thresholds.QUALIFIED,
    PRIORITY:
      readNumber(formData, "threshold_PRIORITY") ??
      defaults.thresholds.PRIORITY,
  };

  return {
    version: readText(formData, "version") ?? defaults.version,
    weights,
    thresholds,
  };
}

function revalidateScoring() {
  revalidatePath("/admin/scoring");
}

export async function saveScoringConfigAction(formData: FormData) {
  const user = await requireCurrentUserPermission("manageSources");
  const service = createLeadScoringService();
  const config = parseConfig(formData);
  const notes = readText(formData, "notes");

  await service.saveConfig(
    {
      ...config,
      ...(notes !== undefined ? { notes } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidateScoring();
}

export async function activateScoringConfigAction(formData: FormData) {
  const configId = readText(formData, "configId");

  if (!configId) {
    return;
  }

  const user = await requireCurrentUserPermission("manageSources");
  const service = createLeadScoringService();

  await service.activateConfig(configId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateScoring();
}
