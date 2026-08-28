import assert from "node:assert/strict";
import test from "node:test";

import type {
  DiscoveryPipelineConnector,
  DiscoverySourceItem,
  NormalisedDiscoveryItem,
} from "../src/domain/discovery/types";
import { createPermittedWebFramework } from "../src/integrations/connectors/permitted-web-framework";
import { createPublicBusinessDataConnector } from "../src/integrations/connectors/public-business-data-connector";
import { createDiscoveryPipelineService } from "../src/server/services/discovery-pipeline-service";
import { createSupplyDiscoveryService } from "../src/server/services/supply-discovery-service";

type JobRunRow = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  jobName: string;
  context: Record<string, unknown>;
  result: Record<string, unknown>;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
  triggeredByUserId: string | null;
};

type LeadRow = {
  id: string;
  sourceId: string;
  status:
    | "new"
    | "researching"
    | "qualified"
    | "nurturing"
    | "disqualified"
    | "archived";
  summary: string | null;
};

type SignalRow = {
  id: string;
  leadId: string | null;
  sourceId: string;
  payload: Record<string, unknown>;
};

function createPipelineHarness() {
  const jobs: JobRunRow[] = [];
  const leads: LeadRow[] = [];
  const signals: SignalRow[] = [];
  const evidenceCalls: Array<{
    sourceReference: string;
    sourceProvenance: string;
  }> = [];
  const scoreCalls: string[] = [];

  const repository = {
    async findSourceById(sourceId: string) {
      if (sourceId !== "src_approved") {
        return undefined;
      }

      return {
        id: "src_approved",
        name: "Approved source",
        allowedData: "id,name,city,postcode",
        rateLimitPerMinute: 30,
      };
    },
    async updateSourceHealth() {
      return undefined;
    },
    async createJobRun(input: {
      id: string;
      triggeredByUserId?: string;
      jobName: string;
      status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
      context: Record<string, unknown>;
      result: Record<string, unknown>;
    }) {
      const row: JobRunRow = {
        id: input.id,
        triggeredByUserId: input.triggeredByUserId ?? null,
        jobName: input.jobName,
        status: input.status,
        context: input.context,
        result: input.result,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        createdAt: new Date("2026-08-28T00:00:00.000Z"),
        updatedAt: new Date("2026-08-28T00:00:00.000Z"),
      };
      jobs.push(row);

      return row;
    },
    async findLatestByIdempotencyKey(idempotencyKey: string) {
      return jobs
        .filter((job) => job.context["idempotencyKey"] === idempotencyKey)
        .at(-1);
    },
    async markJobRunRunning(jobRunId: string, startedAt: Date) {
      const row = jobs.find((job) => job.id === jobRunId);
      if (!row) {
        return undefined;
      }

      row.status = "running";
      row.startedAt = startedAt;
      row.updatedAt = startedAt;
      return row;
    },
    async markJobRunSucceeded(
      jobRunId: string,
      input: {
        finishedAt: Date;
        durationMs: number;
        result: Record<string, unknown>;
      },
    ) {
      const row = jobs.find((job) => job.id === jobRunId);
      if (!row) {
        return undefined;
      }

      row.status = "succeeded";
      row.finishedAt = input.finishedAt;
      row.durationMs = input.durationMs;
      row.result = input.result;
      row.errorMessage = null;
      row.updatedAt = input.finishedAt;
      return row;
    },
    async markJobRunFailed(
      jobRunId: string,
      input: {
        finishedAt: Date;
        durationMs: number;
        errorMessage: string;
        result: Record<string, unknown>;
      },
    ) {
      const row = jobs.find((job) => job.id === jobRunId);
      if (!row) {
        return undefined;
      }

      row.status = "failed";
      row.finishedAt = input.finishedAt;
      row.durationMs = input.durationMs;
      row.result = input.result;
      row.errorMessage = input.errorMessage;
      row.updatedAt = input.finishedAt;
      return row;
    },
    async listRecentJobRuns() {
      return [...jobs].reverse();
    },
    async findLeadByIdentityKey(identityKey: string) {
      return leads.find((lead) =>
        lead.summary?.includes(`discovery:${identityKey}`),
      );
    },
    async createLeadForDiscovery(
      input: {
        sourceId: string;
        status: LeadRow["status"];
        summary?: string | null;
      },
      identityKey: string,
    ) {
      const lead: LeadRow = {
        id: `led_${leads.length + 1}`,
        sourceId: input.sourceId,
        status: input.status,
        summary: (input.summary ?? "") + ` | discovery:${identityKey}`,
      };
      leads.push(lead);
      return {
        id: lead.id,
        sourceId: lead.sourceId,
        status: lead.status,
      };
    },
    async createSignal(input: {
      sourceId: string;
      leadId?: string | null;
      payload: Record<string, unknown>;
    }) {
      const signal: SignalRow = {
        id: `sig_${signals.length + 1}`,
        sourceId: input.sourceId,
        leadId: input.leadId ?? null,
        payload: input.payload,
      };
      signals.push(signal);

      return {
        id: signal.id,
      };
    },
    async findSignalByPipelineKey(pipelineSignalKey: string) {
      const signal = signals.find(
        (item) => item.payload["pipelineSignalKey"] === pipelineSignalKey,
      );
      return signal ? { id: signal.id } : undefined;
    },
    async markLeadQualified(leadId: string) {
      const lead = leads.find((item) => item.id === leadId);
      if (!lead) {
        return undefined;
      }

      lead.status = "qualified";
      return {
        id: lead.id,
      };
    },
    createJobRunId() {
      return `job_${jobs.length + 1}`;
    },
  };

  const service = createDiscoveryPipelineService({
    repository: repository as never,
    sourceService: {
      async assertSourceJobAllowed(sourceId: string) {
        if (sourceId !== "src_approved") {
          throw new Error("Source blocked");
        }

        return undefined;
      },
    } as never,
    evidenceService: {
      async recordEvidence(input: {
        sourceReference: string;
        summary: string;
        sourceId: string;
        leadId?: string;
        signalId: string;
        sourceUrl?: string;
        detectedAt: Date;
        confidence: number;
        collectionMethod:
          "manual" | "connector" | "ai_extraction" | "ai_inference";
      }) {
        evidenceCalls.push({
          sourceReference: input.sourceReference,
          sourceProvenance: String(input.summary),
        });
        return {
          id: `evd_${evidenceCalls.length}`,
          sourceId: input.sourceId,
          leadId: input.leadId ?? null,
          signalId: input.signalId,
          sourceReference: input.sourceReference,
          sourceUrl: input.sourceUrl ?? null,
          detectedAt: input.detectedAt,
          summary: input.summary,
          confidence: input.confidence,
          collectionMethod: input.collectionMethod,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    } as never,
    researchService: {
      async runSignalResearch() {
        return {
          confidence: 70,
          relevantFacts: [],
          evidence: [],
          recoverableErrors: [],
          partial: false,
          signalId: "sig",
          leadId: "led",
          canonicalIdentity: { leadLabel: "Lead", sourceId: "src_approved" },
          missingFields: [],
          recommendedNextAction: "research",
        };
      },
    } as never,
    scoringService: {
      async scoreLead(leadId: string) {
        scoreCalls.push(leadId);
        return {
          leadId,
          score: 75,
          confidence: 80,
          reasonCodes: ["test"],
          missingData: [],
          scoringVersion: "v1",
          band: "QUALIFIED" as const,
        };
      },
    } as never,
    auditService: {
      async recordEvent() {
        return {
          id: "aud_1",
        };
      },
    } as never,
    now: () => new Date("2026-08-28T00:00:00.000Z"),
  });

  return {
    service,
    jobs,
    leads,
    signals,
    evidenceCalls,
    scoreCalls,
  };
}

function createRetryingMockConnector(): DiscoveryPipelineConnector {
  let fetchAttempts = 0;

  const records: DiscoverySourceItem[] = [
    {
      externalId: "a",
      capturedAt: new Date("2026-08-28T00:00:00.000Z"),
      title: "London landlord 5-bed",
      description: "Owner confirmed availability next month",
      contactEmail: "owner@example.org",
      companyName: "Owner Co",
      city: "London",
      postcode: "E1 1AA",
      bedrooms: 5,
      unitCount: 1,
      companyLetFit: "strong",
      confidence: 80,
      sourceProvenance: "mock",
      fields: { ownershipSignal: "explicit_owner_statement" },
    },
    {
      externalId: "a",
      capturedAt: new Date("2026-08-28T00:01:00.000Z"),
      title: "Duplicate London landlord 5-bed",
      description: "Owner confirmed availability next month",
      contactEmail: "owner@example.org",
      companyName: "Owner Co",
      city: "London",
      postcode: "E1 1AA",
      bedrooms: 5,
      unitCount: 1,
      companyLetFit: "strong",
      confidence: 80,
      sourceProvenance: "mock",
      fields: { ownershipSignal: "explicit_owner_statement" },
    },
  ];

  return {
    name: "retrying.mock",
    maxRetries: 1,
    async fetch() {
      fetchAttempts += 1;
      if (fetchAttempts === 1) {
        throw new Error("temporary fetch failure");
      }
      return records;
    },
    normalise(item: DiscoverySourceItem): NormalisedDiscoveryItem {
      return {
        identityKey: `identity:${item.contactEmail}`,
        leadLabel: item.companyName ?? item.title,
        signalType: "PRIVATE_LANDLORD",
        supplySignalType: "PRIVATE_LANDLORD",
        confidence: item.confidence,
        sourceReference: `mock:${item.externalId}`,
        summary: item.description,
        facts: [
          { field: "location", value: item.city ?? "" },
          { field: "bedrooms", value: String(item.bedrooms ?? 0) },
        ],
        features: {
          londonRelevance: true,
          bedroomsInRange: true,
          largerHome: true,
          multiUnitOpportunity: false,
          companyLetSuitability: true,
          timingSignal: true,
          contactability: true,
          supportedRelationship: true,
        },
        sourceProvenance: item.sourceProvenance,
        rawFields: item.fields,
      };
    },
  };
}

test("prompt 17 discovery pipeline runs end-to-end with retry, dedupe, and idempotency", async () => {
  const harness = createPipelineHarness();
  const connector = createRetryingMockConnector();

  const first = await harness.service.run({
    sourceId: "src_approved",
    idempotencyKey: "idem-1",
    connector,
  });

  assert.equal(first.status, "succeeded");
  assert.equal(first.processed, 2);
  assert.equal(first.createdLeads, 1);
  assert.equal(first.collapsedDuplicates, 1);
  assert.equal(first.createdSignals, 1);
  assert.equal(first.qualifiedLeads, 1);
  assert.equal(harness.jobs.at(-1)?.status, "succeeded");

  const second = await harness.service.run({
    sourceId: "src_approved",
    idempotencyKey: "idem-1",
    connector,
  });

  assert.equal(second.status, "succeeded");
  assert.equal(harness.jobs.length, 1);
  assert.equal(harness.scoreCalls.length, 1);
});

test("prompt 18 public business connector uses env credentials and allowed fields", async () => {
  let calls = 0;
  const connector = createPublicBusinessDataConnector({
    env: {
      PUBLIC_BUSINESS_DATA_API_URL: "https://api.public.example.org/businesses",
      PUBLIC_BUSINESS_DATA_API_KEY: "test-key",
    },
    fetcher: async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("retry me");
      }

      return {
        records: [
          {
            id: "biz_1",
            name: "London Lets Ltd",
            company_number: "1234",
            city: "London",
            postcode: "E1 7AA",
            sic_codes: ["68100"],
            officers: [{ name: "Alex Carter" }],
            updated_at: "2026-08-27T00:00:00.000Z",
            registered_address: "private",
          },
        ],
      };
    },
  });

  const records = await connector.discover({
    sourceId: "src",
    connectorKey: "public-business",
    allowedData: ["id", "name", "company_number", "city"],
    rateLimitPerMinute: 30,
  });

  assert.equal(calls, 2);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.id, "biz_1");
  assert.equal(records[0]?.name, "London Lets Ltd");
  assert.equal(records[0]?.postcode, "");
});

test("prompt 19 permitted web framework blocks restricted domains and canonicalises duplicates", async () => {
  const framework = createPermittedWebFramework();
  const fetched: string[] = [];

  const result = await framework.fetchPublicPages({
    sourceEnabled: true,
    urls: [
      "https://allowed.example.org/a?z=2&b=1#frag",
      "https://allowed.example.org/a?b=1&z=2",
      "https://blocked.example.org/private",
    ],
    domainRegistry: [
      {
        domain: "allowed.example.org",
        permissionStatus: "APPROVED",
        robotsAllowed: true,
        termsAllowed: true,
        crawlDelayMs: 0,
        maxRequestsPerMinute: 60,
      },
      {
        domain: "blocked.example.org",
        permissionStatus: "BLOCKED",
        robotsAllowed: true,
        termsAllowed: true,
        crawlDelayMs: 0,
        maxRequestsPerMinute: 60,
      },
    ],
    fetcher: async (url) => {
      fetched.push(url);
      return "<html><head><title>Listing</title></head><body><script>alert(1)</script><p>London 6-bed owner confirmed</p></body></html>";
    },
  });

  assert.equal(result.records.length, 1);
  assert.equal(
    result.records[0]?.canonicalUrl,
    "https://allowed.example.org/a?b=1&z=2",
  );
  assert.equal(fetched.length, 1);
  assert.equal(result.records[0]?.text.includes("script"), false);
  assert.equal(
    result.errors.some((item) => item.includes("BLOCKED")),
    true,
  );
});

test("prompt 20 supply discovery keeps weak ownership unresolved", async () => {
  const captured: Array<{ leadId: string; qualified: boolean }> = [];
  const pipelineService = createDiscoveryPipelineService({
    repository: {
      async findSourceById() {
        return {
          id: "src_approved",
          name: "Supply web",
          allowedData: "id,name,city",
          rateLimitPerMinute: 30,
        };
      },
      async updateSourceHealth() {
        return undefined;
      },
      async createJobRun(input: {
        id: string;
        status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
        context: Record<string, unknown>;
      }) {
        return {
          id: input.id,
          status: input.status,
          context: input.context,
          result: {},
        };
      },
      async findLatestByIdempotencyKey() {
        return undefined;
      },
      async markJobRunRunning() {
        return undefined;
      },
      async markJobRunSucceeded() {
        return undefined;
      },
      async markJobRunFailed() {
        return undefined;
      },
      async listRecentJobRuns() {
        return [];
      },
      async findLeadByIdentityKey() {
        return undefined;
      },
      async createLeadForDiscovery() {
        return {
          id: "led_1",
        };
      },
      async findSignalByPipelineKey() {
        return undefined;
      },
      async createSignal() {
        return {
          id: "sig_1",
        };
      },
      async markLeadQualified(leadId: string) {
        captured.push({ leadId, qualified: true });
        return {
          id: leadId,
        };
      },
      createJobRunId() {
        return "job_1";
      },
    } as never,
    sourceService: {
      async assertSourceJobAllowed() {
        return undefined;
      },
    } as never,
    evidenceService: {
      async recordEvidence() {
        return {
          id: "evd_1",
        };
      },
    } as never,
    researchService: {
      async runSignalResearch() {
        return {
          signalId: "sig_1",
          leadId: "led_1",
          canonicalIdentity: {
            leadLabel: "test",
            sourceId: "src_approved",
          },
          relevantFacts: [],
          evidence: [],
          confidence: 50,
          missingFields: [],
          recommendedNextAction: "research",
          partial: false,
          recoverableErrors: [],
        };
      },
    } as never,
    scoringService: {
      async scoreLead() {
        return {
          leadId: "led_1",
          score: 50,
          confidence: 60,
          reasonCodes: [],
          missingData: [],
          scoringVersion: "v1",
          band: "RESEARCH" as const,
        };
      },
    } as never,
    auditService: {
      async recordEvent() {
        return {
          id: "aud_1",
        };
      },
    } as never,
  });

  const service = createSupplyDiscoveryService(pipelineService);
  const result = await service.runSupplyDiscovery(
    {
      sourceId: "src_approved",
      idempotencyKey: "supply-1",
      urls: ["https://public.example.org/listing/weak"],
      domainRegistry: [
        {
          domain: "public.example.org",
          permissionStatus: "APPROVED",
          robotsAllowed: true,
          termsAllowed: true,
          crawlDelayMs: 0,
          maxRequestsPerMinute: 60,
        },
      ],
      fetcher: async () =>
        "<html><head><title>Portfolio update</title></head><body>London 5-bed re-listed availability. Mentioned by tenant forum without owner confirmation.</body></html>",
    },
    {
      type: "system",
      id: "supply-test",
    },
  );

  assert.equal(result.status, "succeeded");
  assert.equal(result.createdLeads, 1);
  assert.equal(result.createdSignals, 1);
  assert.equal(captured.length, 0);
});
