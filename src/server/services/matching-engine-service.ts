import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { createMatchingRepository } from "@/server/repositories/matching-repository";

import { createAuditService } from "./audit-event-service";

type MatchingRepositoryLike = ReturnType<typeof createMatchingRepository>;

type MatchingEngineDependencies = {
  repository?: MatchingRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

const MATCH_VERSION = "matching-v1";

function getRepository(repository?: MatchingRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createMatchingRepository(getDb());
}

function ensureAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authenticated team members can run matching.");
  }
}

function textIncludes(haystack: string | null, needle: string | null) {
  if (!haystack || !needle) {
    return false;
  }

  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function scoreCandidate(input: {
  requirement: Awaited<ReturnType<MatchingRepositoryLike["getRequirement"]>>;
  property: Awaited<ReturnType<MatchingRepositoryLike["listCandidateProperties"]>>[number];
}) {
  const reasons: string[] = [];
  const gaps: string[] = [];

  let score = 0;

  if (textIncludes(input.property.city, input.requirement?.preferredArea ?? null)) {
    score += 18;
    reasons.push("location aligned");
  } else {
    gaps.push("location mismatch");
  }

  if (
    input.requirement?.bedroomsMin !== null &&
    input.requirement?.bedroomsMin !== undefined &&
    (input.property.bedrooms ?? 0) >= input.requirement.bedroomsMin
  ) {
    score += 14;
    reasons.push("bedrooms minimum met");
  } else if (input.requirement?.bedroomsMin) {
    gaps.push("bedrooms below minimum");
  }

  if (
    input.requirement?.budgetMaxCents !== null &&
    input.requirement?.budgetMaxCents !== undefined &&
    input.property.monthlyRentCents !== null &&
    input.property.monthlyRentCents <= input.requirement.budgetMaxCents
  ) {
    score += 16;
    reasons.push("budget within max");
  } else if (input.requirement?.budgetMaxCents) {
    gaps.push("budget exceeds max");
  }

  if (
    input.requirement?.termMonths !== null &&
    input.requirement?.termMonths !== undefined &&
    input.property.termMonths !== null &&
    input.property.termMonths >= input.requirement.termMonths
  ) {
    score += 10;
    reasons.push("term compatible");
  } else if (input.requirement?.termMonths) {
    gaps.push("term shorter than requested");
  }

  if (input.property.availability === "available_now" || input.property.availability === "available_soon") {
    score += 10;
    reasons.push("availability suitable");
  } else {
    gaps.push("availability mismatch");
  }

  if (input.property.companyLetFit === "ideal") {
    score += 14;
    reasons.push("company-let ideal");
  } else if (input.property.companyLetFit === "strong") {
    score += 11;
    reasons.push("company-let strong");
  } else if (input.property.companyLetFit === "review") {
    score += 6;
    gaps.push("company-let needs review");
  } else {
    gaps.push("company-let unsuitable");
  }

  if (
    input.requirement?.unitCount !== null &&
    input.requirement?.unitCount !== undefined
  ) {
    score += input.requirement.unitCount > 1 ? 8 : 4;
    reasons.push("unit count considered");
  }

  if (input.property.furnished) {
    score += 4;
    reasons.push("furnished");
  }

  if (input.property.parking) {
    score += 3;
    reasons.push("parking available");
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  const confidence = Math.max(35, Math.min(95, 100 - gaps.length * 10));

  return {
    score: normalizedScore,
    confidence,
    reasons,
    gaps,
  };
}

export function createMatchingEngineService(
  dependencies: MatchingEngineDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();

  return {
    async runRequirementMatch(
      requirementId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before matching can run.");
      }

      const requirement = await repository.getRequirement(requirementId);
      if (!requirement) {
        throw new Error("Requirement not found.");
      }

      const properties = await repository.listCandidateProperties();

      const persisted: Array<
        NonNullable<Awaited<ReturnType<typeof repository.upsertMatch>>>
      > = [];

      for (const property of properties) {
        const candidate = scoreCandidate({ requirement, property });
        const match = await repository.upsertMatch({
          requirementId,
          propertyId: property.id,
          leadId: requirement.leadId,
          score: candidate.score,
          confidence: candidate.confidence,
          matchVersion: MATCH_VERSION,
          rationale: {
            reasons: candidate.reasons,
            gaps: candidate.gaps,
            factors: {
              location: requirement.preferredArea,
              bedrooms: requirement.bedroomsMin,
              unitCount: requirement.unitCount,
              budget: requirement.budgetMaxCents,
              availability: property.availability,
              term: requirement.termMonths,
              propertyType: property.propertyType,
              companyLetSuitability: property.companyLetFit,
              furnished: property.furnished,
              parking: property.parking,
            },
          },
        });

        if (match) {
          persisted.push(match);
        }
      }

      await auditService.recordEvent({
        actor,
        action: "matching.run.completed",
        entityType: "requirement",
        entityId: requirementId,
        metadata: {
          count: persisted.length,
          matchVersion: MATCH_VERSION,
          noAutomaticDealCreation: true,
        },
      });

      return [...persisted]
        .sort((a, b) => b.score - a.score)
        .map((item) => ({
          id: item.id,
          requirementId: item.requirementId,
          propertyId: item.propertyId,
          score: item.score,
          confidence: item.confidence,
          reasons: Array.isArray(item.rationale["reasons"])
            ? (item.rationale["reasons"] as string[])
            : [],
          gaps: Array.isArray(item.rationale["gaps"])
            ? (item.rationale["gaps"] as string[])
            : [],
          matchVersion: item.matchVersion,
        }));
    },
  };
}
