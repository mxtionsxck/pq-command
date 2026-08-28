import assert from "node:assert/strict";
import test from "node:test";

import { createMockAiProvider } from "../src/ai/mock-ai-provider";
import type {
  AiConclusion,
  AuditEvent,
  Evidence,
  Lead,
  NewAiConclusion,
  NewEvidence,
  Signal,
} from "../src/db/models";
import {
  createAuditService,
  type AuditCreateInput,
} from "../src/server/services/audit-event-service";
import { createEvidenceService } from "../src/server/services/evidence-service";
import { createLeadScoringService } from "../src/server/services/lead-scoring-service";
import { createResearchEngineService } from "../src/server/services/research-engine-service";

function createAuditMemoryService() {
  const events: AuditEvent[] = [];

  return createAuditService({
    repository: {
      async create(input: AuditCreateInput) {
        const occurredAt =
          input.occurredAt ?? new Date("2026-08-28T00:00:00.000Z");
        const event: AuditEvent = {
          id: input.id ?? `aud_${events.length + 1}`,
          actorType: input.actorType ?? "user",
          actorId: input.actorId,
          actorUserId: input.actorUserId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          occurredAt,
          metadata: input.metadata ?? {},
          beforeState: input.beforeState ?? null,
          afterState: input.afterState ?? null,
          requestId: input.requestId ?? null,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        };

        events.push(event);

        return event;
      },
      async listRecent() {
        return [...events];
      },
    },
  });
}

function buildEvidenceRow(
  input: Omit<NewEvidence, "id" | "createdAt" | "updatedAt"> & { id?: string },
  idx: number,
): Evidence {
  return {
    id: input.id ?? `evd_${idx}`,
    sourceId: input.sourceId,
    leadId: input.leadId ?? null,
    signalId: input.signalId,
    sourceReference: input.sourceReference,
    sourceUrl: input.sourceUrl ?? null,
    detectedAt: input.detectedAt,
    summary: input.summary,
    confidence: input.confidence ?? 50,
    collectionMethod: input.collectionMethod ?? "connector",
    archivedAt: null,
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
  };
}

function buildConclusionRow(
  input: Omit<NewAiConclusion, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  },
  idx: number,
): AiConclusion {
  return {
    id: input.id ?? `aic_${idx}`,
    leadId: input.leadId,
    signalId: input.signalId ?? null,
    provider: input.provider,
    model: input.model,
    summary: input.summary,
    recommendation: input.recommendation,
    confidence: input.confidence ?? 0,
    evidenceIds: input.evidenceIds ?? [],
    supported: input.supported ?? false,
    status: input.status ?? "advisory",
    failureReason: input.failureReason ?? null,
    latencyMs: input.latencyMs ?? null,
    tokenUsage: input.tokenUsage ?? null,
    costUsdMicros: input.costUsdMicros ?? null,
    archivedAt: null,
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
  };
}

test("prompt 13 evidence service enforces support guard for conclusions", async () => {
  const evidenceRows: Evidence[] = [];
  const conclusionRows: AiConclusion[] = [];

  const service = createEvidenceService({
    auditService: createAuditMemoryService(),
    repository: {
      async createEvidence(input) {
        const row = buildEvidenceRow(input, evidenceRows.length + 1);
        evidenceRows.push(row);
        return row;
      },
      async findEvidenceBySignalReference(signalId, sourceReference) {
        return evidenceRows.find(
          (row) =>
            row.signalId === signalId &&
            row.sourceReference === sourceReference,
        );
      },
      async listLeadEvidence(leadId) {
        return evidenceRows.filter((row) => row.leadId === leadId);
      },
      async countEvidenceIds(evidenceIds) {
        return evidenceRows.filter((row) => evidenceIds.includes(row.id))
          .length;
      },
      async createConclusion(input) {
        const row = buildConclusionRow(input, conclusionRows.length + 1);
        conclusionRows.push(row);
        return row;
      },
      async listLeadConclusions(leadId) {
        return conclusionRows.filter((row) => row.leadId === leadId);
      },
      async findConclusionById(id) {
        return conclusionRows.find((row) => row.id === id);
      },
      async updateConclusionStatus(conclusionId, status) {
        const row = conclusionRows.find((item) => item.id === conclusionId);

        if (!row) {
          return undefined;
        }

        row.status = status;

        return row;
      },
      async hasSupportedConclusionForLead() {
        return false;
      },
    },
  });

  const actor = {
    type: "user" as const,
    id: "usr_agent",
    userId: "usr_agent",
    role: "AGENT" as const,
  };

  const evidence = await service.recordEvidence(
    {
      sourceId: "src_1",
      leadId: "led_1",
      signalId: "sig_1",
      sourceReference: "listing:42",
      sourceUrl: "https://example.com/listing/42",
      detectedAt: new Date("2026-08-27T00:00:00.000Z"),
      summary: "Owner confirms availability from next month",
      confidence: 83,
      collectionMethod: "connector",
    },
    actor,
  );

  const supportedConclusion = await service.recordAiConclusion(
    {
      leadId: "led_1",
      signalId: "sig_1",
      provider: "mock",
      model: "mock-v1",
      summary: "Evidence supports qualification",
      recommendation: "qualify",
      confidence: 80,
      evidenceIds: [evidence.id],
    },
    actor,
  );

  const unsupportedConclusion = await service.recordAiConclusion(
    {
      leadId: "led_1",
      signalId: "sig_1",
      provider: "mock",
      model: "mock-v1",
      summary: "No evidence provided",
      recommendation: "qualify",
      confidence: 80,
      evidenceIds: ["evd_missing"],
    },
    actor,
  );

  const guard = await service.getQualificationGuard("led_1", 70);

  assert.equal(supportedConclusion.supported, true);
  assert.equal(unsupportedConclusion.status, "unsupported");
  assert.equal(guard.canUseForHighConfidenceQualification, true);

  await assert.rejects(
    () =>
      service.promoteConclusionToMasterFacts(unsupportedConclusion.id, actor),
    /Unsupported conclusion/,
  );

  const promoted = await service.promoteConclusionToMasterFacts(
    supportedConclusion.id,
    actor,
  );
  assert.equal(promoted.status, "promoted");
});

test("prompt 14 mock AI provider returns advisory metadata and validation failures", async () => {
  const provider = createMockAiProvider();
  const valid = await provider.structuredExtraction({
    input: JSON.stringify({ disposition: "research" }),
    schemaName: "disposition-v1",
    validator: (value: unknown): value is { disposition: string } => {
      return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as { disposition?: unknown }).disposition === "string"
      );
    },
  });

  const invalid = await provider.scoringRecommendation({
    input: JSON.stringify({ foo: "bar" }),
    schemaName: "score-rec-v1",
    validator: (value: unknown): value is { scoreHint: number } => {
      return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as { scoreHint?: unknown }).scoreHint === "number"
      );
    },
  });

  assert.equal(valid.ok, true);
  assert.equal(valid.advisory, true);

  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.failure.type, "validation_failed");
    assert.equal(invalid.advisory, true);
  }
});

test("prompt 15 research engine returns evidence-linked facts and partial errors", async () => {
  const signal: Signal = {
    id: "sig_1",
    sourceId: "src_1",
    leadId: "led_1",
    contactId: null,
    propertyId: null,
    createdByUserId: null,
    type: "availability",
    status: "new",
    payload: { postcode: "E1" },
    detectedAt: new Date("2026-08-28T00:00:00.000Z"),
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
  };

  const lead: Lead = {
    id: "led_1",
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    archivedAt: null,
    sourceId: "src_1",
    companyId: null,
    contactId: null,
    propertyId: null,
    ownerUserId: null,
    leadType: "supply",
    status: "researching",
    score: 20,
    confidence: 40,
    nextAction: null,
    outreachStatus: "not_started",
    scoreVersion: null,
    lastScoredAt: null,
    directnessClassification: "UNKNOWN",
    directnessConfidence: 50,
    directnessVerified: false,
    summary: null,
    receivedAt: new Date("2026-08-28T00:00:00.000Z"),
  };

  const evidenceRows: Evidence[] = [];
  const conclusions: AiConclusion[] = [];

  const researchService = createResearchEngineService({
    repository: {
      async findSignalById(id) {
        return id === signal.id ? signal : undefined;
      },
      async findLeadById(id) {
        return id === lead.id ? lead : undefined;
      },
      async updateLeadSummary() {
        return lead;
      },
    },
    evidenceService: createEvidenceService({
      auditService: createAuditMemoryService(),
      repository: {
        async createEvidence(input) {
          const row = buildEvidenceRow(input, evidenceRows.length + 1);
          evidenceRows.push(row);
          return row;
        },
        async findEvidenceBySignalReference(signalId, sourceReference) {
          return evidenceRows.find(
            (row) =>
              row.signalId === signalId &&
              row.sourceReference === sourceReference,
          );
        },
        async listLeadEvidence(leadId) {
          return evidenceRows.filter((row) => row.leadId === leadId);
        },
        async countEvidenceIds(evidenceIds) {
          return evidenceRows.filter((row) => evidenceIds.includes(row.id))
            .length;
        },
        async createConclusion(input) {
          const row = buildConclusionRow(input, conclusions.length + 1);
          conclusions.push(row);
          return row;
        },
        async listLeadConclusions(leadId) {
          return conclusions.filter((row) => row.leadId === leadId);
        },
        async findConclusionById() {
          return undefined;
        },
        async updateConclusionStatus() {
          return undefined;
        },
        async hasSupportedConclusionForLead() {
          return false;
        },
      },
    }),
    connectors: [
      {
        async discoverFromSignal() {
          return [
            {
              sourceReference: "listing:abc",
              sourceUrl: "https://example.com/listing/abc",
              detectedAt: new Date("2026-08-28T00:00:00.000Z"),
              summary: "4-bed available in E1 from September",
              confidence: 82,
              facts: [
                { field: "location", value: "E1" },
                { field: "timing", value: "September" },
              ],
            },
          ];
        },
      },
      {
        async discoverFromSignal() {
          throw new Error("Connector timeout");
        },
      },
    ],
  });

  const result = await researchService.runSignalResearch({
    signalId: signal.id,
  });

  assert.equal(result.evidence.length, 1);
  assert.equal(result.relevantFacts[0]?.kind, "source_fact");
  assert.equal(result.partial, true);
  assert.equal(result.recoverableErrors[0], "Connector timeout");

  const secondResult = await researchService.runSignalResearch({
    signalId: signal.id,
  });
  assert.equal(secondResult.evidence.length, 1);
  assert.equal(evidenceRows.length, 1);
});

test("prompt 16 deterministic scoring maps to threshold bands and persists version", async () => {
  const updates: Array<{
    score: number;
    confidence: number;
    scoreVersion: string;
  }> = [];

  const service = createLeadScoringService({
    now: () => new Date("2026-08-28T00:00:00.000Z"),
    auditService: createAuditMemoryService(),
    repository: {
      async listConfigs() {
        return [];
      },
      async getActiveConfig() {
        return {
          id: "lsc_1",
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          updatedAt: new Date("2026-08-28T00:00:00.000Z"),
          archivedAt: null,
          createdByUserId: "usr_admin",
          version: "v2",
          active: true,
          weights: {
            companyLetFit: 20,
            location: 10,
            bedroomsUnits: 8,
            timing: 8,
            commercialFit: 8,
            evidenceStrength: 18,
            decisionMakerConfidence: 10,
            recency: 8,
            contactability: 6,
            historicalConversionLikelihood: 4,
          },
          thresholds: {
            IGNORE: 0,
            MONITOR: 30,
            RESEARCH: 50,
            QUALIFIED: 70,
            PRIORITY: 85,
          },
          notes: null,
        };
      },
      async findConfigByVersion() {
        return undefined;
      },
      async saveConfig(input) {
        return {
          id: "lsc_2",
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          updatedAt: new Date("2026-08-28T00:00:00.000Z"),
          archivedAt: null,
          createdByUserId: input.createdByUserId ?? null,
          version: input.version,
          active: input.active ?? false,
          weights: input.weights ?? {},
          thresholds: input.thresholds ?? {},
          notes: input.notes ?? null,
        };
      },
      async setConfigActive() {
        return undefined;
      },
      async getLeadScoringInput() {
        return {
          lead: {
            id: "led_1",
            createdAt: new Date("2026-08-28T00:00:00.000Z"),
            updatedAt: new Date("2026-08-28T00:00:00.000Z"),
            archivedAt: null,
            sourceId: "src_1",
            companyId: "co_1",
            contactId: "ctc_1",
            propertyId: "prp_1",
            ownerUserId: null,
            leadType: "supply" as const,
            status: "researching" as const,
            score: 0,
            confidence: 0,
            nextAction: null,
            outreachStatus: "not_started" as const,
            scoreVersion: null,
            lastScoredAt: null,
            directnessClassification: "DIRECT" as const,
            directnessConfidence: 85,
            directnessVerified: true,
            summary: null,
            receivedAt: new Date("2026-08-26T00:00:00.000Z"),
          },
          propertyCompanyLetFit: "ideal" as const,
          propertyCity: "London",
          propertyPostcode: "E1 1AA",
          propertyBedrooms: 4,
          contactConfidence: 78,
          contactSuppressionStatus: "clear" as const,
          contactEmail: "alex@example.com",
          contactPhone: null,
          sourceKind: "referral" as const,
          evidenceCount: 4,
          latestEvidenceAt: new Date("2026-08-28T00:00:00.000Z"),
          supportedConclusionCount: 2,
        };
      },
      async updateLeadScore(_leadId, input) {
        updates.push({
          score: input.score,
          confidence: input.confidence,
          scoreVersion: input.scoreVersion,
        });

        return {
          id: "led_1",
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          updatedAt: new Date("2026-08-28T00:00:00.000Z"),
          archivedAt: null,
          sourceId: "src_1",
          companyId: null,
          contactId: null,
          propertyId: null,
          ownerUserId: null,
          leadType: "supply" as const,
          status: "researching" as const,
          score: input.score,
          confidence: input.confidence,
          nextAction: null,
          outreachStatus: "not_started" as const,
          scoreVersion: input.scoreVersion,
          lastScoredAt: input.lastScoredAt,
          directnessClassification: "DIRECT" as const,
          directnessConfidence: 85,
          directnessVerified: true,
          summary: null,
          receivedAt: new Date("2026-08-26T00:00:00.000Z"),
        };
      },
      async listLeadsByIds() {
        return [];
      },
    },
  });

  const actor = {
    type: "user" as const,
    id: "usr_agent",
    userId: "usr_agent",
    role: "AGENT" as const,
  };

  const first = await service.scoreLead("led_1", actor);
  const second = await service.scoreLead("led_1", actor);

  assert.equal(first.score, second.score);
  assert.equal(first.band, second.band);
  assert.equal(first.scoringVersion, "v2");
  assert.equal(updates[0]?.scoreVersion, "v2");
});
