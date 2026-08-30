import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import type {
  ResearchConnector,
  ResearchOutput,
} from "@/domain/research/types";
import { appEnv } from "@/lib/env";
import { createResearchEngineRepository } from "@/server/repositories/research-engine-repository";

import { resolveAiProvider } from "@/ai";
import { createEvidenceService } from "./evidence-service";

type ResearchRepositoryLike = ReturnType<typeof createResearchEngineRepository>;

type ResearchEngineDependencies = {
  repository?: ResearchRepositoryLike;
  connectors?: ResearchConnector[];
  evidenceService?: ReturnType<typeof createEvidenceService>;
};

function getRepository(repository?: ResearchRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createResearchEngineRepository(getDb());
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function createResearchEngineService(
  dependencies: ResearchEngineDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const evidenceService =
    dependencies.evidenceService ?? createEvidenceService();
  const connectors = dependencies.connectors ?? [];

  return {
    async runSignalResearch(
      input: { signalId: string; leadId?: string | null },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" } = {
        type: "system",
        id: "research_engine",
      },
    ): Promise<ResearchOutput> {
      if (!repository) {
        throw new Error("DATABASE_URL is required before research can run.");
      }

      const signal = await repository.findSignalById(input.signalId);

      if (!signal) {
        throw new Error("Signal not found.");
      }

      const leadId = input.leadId ?? signal.leadId;

      if (!leadId) {
        throw new Error(
          "Signal must be linked to a lead before research runs.",
        );
      }

      const lead = await repository.findLeadById(leadId);

      if (!lead) {
        throw new Error("Lead not found.");
      }

      const recoverableErrors: string[] = [];
      const evidenceItems = [] as Awaited<
        ReturnType<typeof evidenceService.recordEvidence>
      >[];
      const relevantFacts: ResearchOutput["relevantFacts"] = [];

      for (const connector of connectors) {
        try {
          const discovered = await connector.discoverFromSignal({
            signalId: signal.id,
            sourceId: signal.sourceId,
            payload: signal.payload,
          });

          for (const record of discovered) {
            const savedEvidence = await evidenceService.recordEvidence(
              {
                sourceId: signal.sourceId,
                leadId,
                signalId: signal.id,
                sourceReference: record.sourceReference,
                ...(record.sourceUrl ? { sourceUrl: record.sourceUrl } : {}),
                detectedAt: record.detectedAt,
                summary: record.summary,
                confidence: record.confidence,
                collectionMethod: "connector",
              },
              actor,
            );

            evidenceItems.push(savedEvidence);

            for (const fact of record.facts) {
              relevantFacts.push({
                id: `${savedEvidence.id}:${fact.field}`,
                kind: "source_fact",
                field: fact.field,
                value: fact.value,
                evidenceIds: [savedEvidence.id],
              });
            }
          }
        } catch (error) {
          recoverableErrors.push(
            error instanceof Error
              ? error.message
              : "Unknown connector failure during research.",
          );
        }
      }

      const provider = resolveAiProvider(appEnv);
      const factSummary = JSON.stringify(
        relevantFacts.slice(0, 12).map((fact) => ({
          field: fact.field,
          value: fact.value,
        })),
      );
      const advisory = await provider.summarisation({
        input:
          factSummary.length > 0
            ? [
                "You are PQ COMMAND's research copilot for live lead generation.",
                "Mission: source direct company-let demand and direct/mandated supply only.",
                "Hard constraints:",
                "- Reject intermediary/brokered/on-behalf records.",
                "- Reject non-company-let opportunities.",
                "- Never claim facts not present in evidence.",
                "Required output format:",
                "- 1 sentence with the best next action.",
                "- Include one missing-proof checkpoint if confidence is not sufficient.",
                `Evidence facts JSON: ${factSummary}`,
              ].join("\n")
            : "No facts discovered yet for company-let investor and stock sourcing.",
        maxLength: 180,
      });

      if (advisory.ok && evidenceItems.length > 0) {
        await evidenceService.recordAiConclusion(
          {
            leadId,
            signalId: signal.id,
            provider: advisory.metadata.provider,
            model: advisory.metadata.model,
            summary: advisory.output.summary,
            recommendation:
              evidenceItems.length >= 3 &&
              evidenceItems.some((item) => item.confidence >= 75)
                ? "qualify"
                : "research",
            confidence: Math.min(
              95,
              Math.max(
                35,
                Math.round(
                  (evidenceItems.length * 18 + relevantFacts.length * 4) / 2,
                ),
              ),
            ),
            evidenceIds: evidenceItems.map((item) => item.id),
            latencyMs: advisory.metadata.latencyMs,
            ...(advisory.metadata.tokenUsage
              ? { tokenUsage: advisory.metadata.tokenUsage }
              : {}),
            ...(advisory.metadata.costUsdMicros !== undefined
              ? { costUsdMicros: advisory.metadata.costUsdMicros }
              : {}),
          },
          actor,
        );
      } else if (!advisory.ok) {
        recoverableErrors.push(advisory.failure.message);
      }

      const confidence = clampPercent(
        evidenceItems.length * 18 +
          relevantFacts.length * 4 -
          recoverableErrors.length * 12,
      );

      const missingFields = [
        "decision_maker",
        "timing",
        "budget",
        "location",
      ].filter(
        (field) =>
          !relevantFacts.some(
            (fact) => fact.field.toLowerCase() === field.toLowerCase(),
          ),
      );

      const recommendedNextAction =
        confidence >= 75 && missingFields.length <= 1
          ? "Prepare qualification handoff with linked evidence."
          : missingFields.length > 0
            ? `Collect missing fields: ${missingFields.join(", ")}.`
            : "Continue research and validate contradictory facts.";

      await repository.updateLeadSummary(
        leadId,
        `Research confidence ${confidence}. ${recommendedNextAction}`,
      );

      return {
        signalId: signal.id,
        leadId,
        canonicalIdentity: {
          leadLabel: lead.summary ?? lead.id,
          sourceId: signal.sourceId,
        },
        relevantFacts,
        evidence: evidenceItems.map((item) => ({
          id: item.id,
          sourceId: item.sourceId,
          sourceReference: item.sourceReference,
          sourceUrl: item.sourceUrl,
          detectedAt: item.detectedAt,
          summary: item.summary,
          confidence: item.confidence,
          collectionMethod: item.collectionMethod,
          signalId: item.signalId,
        })),
        confidence,
        missingFields,
        recommendedNextAction,
        partial: recoverableErrors.length > 0,
        recoverableErrors,
      };
    },
  };
}
