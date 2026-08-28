import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import type {
  DiscoveryPipelineConnector,
  DiscoveryPipelineResult,
} from "@/domain/discovery/types";
import { appEnv } from "@/lib/env";
import { createDiscoveryPipelineRepository } from "@/server/repositories/discovery-pipeline-repository";
import { createEvidenceService } from "@/server/services/evidence-service";
import { createLeadScoringService } from "@/server/services/lead-scoring-service";
import { createResearchEngineService } from "@/server/services/research-engine-service";
import { createSourceRegistryService } from "@/server/services/source-registry-service";

import { createAuditService } from "./audit-event-service";

type DiscoveryPipelineRepositoryLike = ReturnType<
  typeof createDiscoveryPipelineRepository
>;

type DiscoveryPipelineServiceDependencies = {
  repository?: DiscoveryPipelineRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
  sourceService?: ReturnType<typeof createSourceRegistryService>;
  evidenceService?: ReturnType<typeof createEvidenceService>;
  researchService?: ReturnType<typeof createResearchEngineService>;
  scoringService?: ReturnType<typeof createLeadScoringService>;
  now?: () => Date;
};

function getRepository(repository?: DiscoveryPipelineRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createDiscoveryPipelineRepository(getDb());
}

async function retryWithPolicy<T>(
  maxRetries: number,
  operation: () => Promise<T>,
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt += 1;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unknown retry failure.");
}

function shouldQualify(features: {
  londonRelevance: boolean;
  bedroomsInRange: boolean;
  largerHome: boolean;
  multiUnitOpportunity: boolean;
  companyLetSuitability: boolean;
  timingSignal: boolean;
  contactability: boolean;
  supportedRelationship: boolean;
}) {
  const priorityCount = [
    features.londonRelevance,
    features.bedroomsInRange,
    features.companyLetSuitability,
    features.timingSignal,
    features.contactability,
  ].filter(Boolean).length;

  return (
    features.supportedRelationship &&
    priorityCount >= 4 &&
    (features.largerHome || features.multiUnitOpportunity)
  );
}

function inferDirectnessFromDiscovery(input: {
  summary: string;
  supportedRelationship: boolean;
}) {
  const lower = input.summary.toLowerCase();
  const intermediary =
    /\bestate agent\b|\bletting agent\b|\bbroker\b|\bsourcing\b|\bon behalf\b/.test(
      lower,
    );

  if (intermediary) {
    return {
      classification: "INTERMEDIARY" as const,
      verified: false,
      confidence: 85,
    };
  }

  if (input.supportedRelationship) {
    return {
      classification: "DIRECT" as const,
      verified: true,
      confidence: 80,
    };
  }

  return {
    classification: "UNKNOWN" as const,
    verified: false,
    confidence: 55,
  };
}

export function createDiscoveryPipelineService(
  dependencies: DiscoveryPipelineServiceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();
  const sourceService =
    dependencies.sourceService ?? createSourceRegistryService();
  const evidenceService =
    dependencies.evidenceService ?? createEvidenceService();
  const researchService =
    dependencies.researchService ?? createResearchEngineService();
  const scoringService =
    dependencies.scoringService ?? createLeadScoringService();
  const now = dependencies.now ?? (() => new Date());

  return {
    async listRecentRuns() {
      if (!repository) {
        return [];
      }

      return repository.listRecentJobRuns();
    },

    async run(
      input: {
        sourceId: string;
        idempotencyKey: string;
        connector: DiscoveryPipelineConnector;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" } = {
        type: "system",
        id: "discovery_pipeline",
      },
    ): Promise<DiscoveryPipelineResult> {
      if (!repository) {
        throw new Error("DATABASE_URL is required before discovery can run.");
      }

      const existing = await repository.findLatestByIdempotencyKey(
        input.idempotencyKey,
      );

      if (existing?.status === "succeeded") {
        return {
          jobRunId: existing.id,
          idempotencyKey: input.idempotencyKey,
          status: existing.status,
          processed: Number(existing.result["processed"] ?? 0),
          collapsedDuplicates: Number(
            existing.result["collapsedDuplicates"] ?? 0,
          ),
          createdSignals: Number(existing.result["createdSignals"] ?? 0),
          createdLeads: Number(existing.result["createdLeads"] ?? 0),
          qualifiedLeads: Number(existing.result["qualifiedLeads"] ?? 0),
          errors: Array.isArray(existing.result["errors"])
            ? (existing.result["errors"] as string[])
            : [],
        };
      }

      await sourceService.assertSourceJobAllowed(input.sourceId);
      const source = await repository.findSourceById(input.sourceId);

      if (!source) {
        throw new Error("Source not found.");
      }

      const createdAt = now();
      const createdJob = await repository.createJobRun({
        id: repository.createJobRunId(),
        workerName: "discovery",
        queueName: "default",
        ...(actor.userId ? { triggeredByUserId: actor.userId } : {}),
        idempotencyKey: input.idempotencyKey,
        jobName: "discovery.pipeline",
        status: "queued",
        attempt: 0,
        maxAttempts: Math.max(1, input.connector.maxRetries + 1),
        context: {
          sourceId: input.sourceId,
          sourceName: source.name,
          idempotencyKey: input.idempotencyKey,
          connector: input.connector.name,
        },
        result: {},
      });

      await repository.markJobRunRunning(createdJob.id, createdAt);

      const counters = {
        processed: 0,
        collapsedDuplicates: 0,
        createdSignals: 0,
        createdLeads: 0,
        qualifiedLeads: 0,
      };
      const errors: string[] = [];
      const runStarted = createdAt.getTime();

      try {
        const discovered = await retryWithPolicy(
          input.connector.maxRetries,
          () =>
            input.connector.fetch({
              sourceId: source.id,
              allowedData: source.allowedData
                ? source.allowedData
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : [],
              rateLimitPerMinute: source.rateLimitPerMinute ?? 30,
            }),
        );

        for (const item of discovered) {
          counters.processed += 1;

          const normalised = input.connector.normalise(item);
          const inferredDirectness = inferDirectnessFromDiscovery({
            summary: normalised.summary,
            supportedRelationship: normalised.features.supportedRelationship,
          });
          const existingLead = await repository.findLeadByIdentityKey(
            normalised.identityKey,
          );

          const lead =
            existingLead ??
            (await repository.createLeadForDiscovery(
              {
                sourceId: source.id,
                leadType: "supply",
                status: "researching",
                score: 0,
                confidence: Math.max(35, Math.round(normalised.confidence)),
                directnessClassification: inferredDirectness.classification,
                directnessVerified: inferredDirectness.verified,
                directnessConfidence: inferredDirectness.confidence,
                summary: normalised.leadLabel,
                receivedAt: item.capturedAt,
                outreachStatus: "not_started",
              },
              normalised.identityKey,
            ));

          if (!lead) {
            throw new Error("Lead creation failed during discovery.");
          }

          if (existingLead) {
            counters.collapsedDuplicates += 1;
          } else {
            counters.createdLeads += 1;
          }

          const pipelineSignalKey = `${lead.id}:${normalised.sourceReference}:${normalised.supplySignalType}`;
          const existingSignal =
            await repository.findSignalByPipelineKey(pipelineSignalKey);

          const signal =
            existingSignal ??
            (await repository.createSignal({
              sourceId: source.id,
              leadId: lead.id,
              type: normalised.signalType,
              status: "new",
              payload: {
                pipelineSignalKey,
                supplySignalType: normalised.supplySignalType,
                sourceProvenance: normalised.sourceProvenance,
                facts: normalised.facts,
                features: normalised.features,
                idempotencyKey: input.idempotencyKey,
                rawFields: normalised.rawFields,
              },
              detectedAt: item.capturedAt,
            }));

          if (!existingSignal) {
            counters.createdSignals += 1;
          } else {
            continue;
          }

          await evidenceService.recordEvidence(
            {
              sourceId: source.id,
              leadId: lead.id,
              signalId: signal.id,
              sourceReference: normalised.sourceReference,
              ...(normalised.sourceUrl
                ? { sourceUrl: normalised.sourceUrl }
                : {}),
              detectedAt: item.capturedAt,
              summary: normalised.summary,
              confidence: normalised.confidence,
              collectionMethod: "connector",
            },
            actor,
          );

          await researchService.runSignalResearch(
            {
              signalId: signal.id,
              leadId: lead.id,
            },
            actor,
          );

          await scoringService.scoreLead(lead.id, actor);

          if (shouldQualify(normalised.features)) {
            await repository.markLeadQualified(lead.id);
            counters.qualifiedLeads += 1;
          }
        }

        const finishedAt = now();
        const resultPayload = {
          ...counters,
          errors,
        };
        await repository.markJobRunSucceeded(createdJob.id, {
          finishedAt,
          durationMs: Math.max(1, finishedAt.getTime() - runStarted),
          result: resultPayload,
        });
        await repository.updateSourceHealth(source.id, {
          health: errors.length === 0 ? "healthy" : "degraded",
          lastScannedAt: finishedAt,
        });

        await auditService.recordEvent({
          actor,
          action: "discovery.pipeline.succeeded",
          entityType: "job_run",
          entityId: createdJob.id,
          metadata: {
            sourceId: source.id,
            idempotencyKey: input.idempotencyKey,
            ...resultPayload,
          },
        });

        return {
          jobRunId: createdJob.id,
          idempotencyKey: input.idempotencyKey,
          status: "succeeded",
          processed: counters.processed,
          collapsedDuplicates: counters.collapsedDuplicates,
          createdSignals: counters.createdSignals,
          createdLeads: counters.createdLeads,
          qualifiedLeads: counters.qualifiedLeads,
          errors,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Discovery failed.";
        errors.push(message);
        const finishedAt = now();

        await repository.markJobRunFailed(createdJob.id, {
          finishedAt,
          durationMs: Math.max(1, finishedAt.getTime() - runStarted),
          errorMessage: message,
          result: {
            ...counters,
            errors,
          },
        });
        await repository.updateSourceHealth(source.id, {
          health: "offline",
          lastScannedAt: finishedAt,
        });

        await auditService.recordEvent({
          actor,
          action: "discovery.pipeline.failed",
          entityType: "job_run",
          entityId: createdJob.id,
          metadata: {
            sourceId: source.id,
            idempotencyKey: input.idempotencyKey,
            error: message,
          },
        });

        return {
          jobRunId: createdJob.id,
          idempotencyKey: input.idempotencyKey,
          status: "failed",
          processed: counters.processed,
          collapsedDuplicates: counters.collapsedDuplicates,
          createdSignals: counters.createdSignals,
          createdLeads: counters.createdLeads,
          qualifiedLeads: counters.qualifiedLeads,
          errors,
        };
      }
    },
  };
}
