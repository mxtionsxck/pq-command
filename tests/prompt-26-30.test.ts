import assert from "node:assert/strict";
import test from "node:test";

import { createControlledEmailSendingService } from "../src/server/services/controlled-email-sending-service";
import { createDemandRoomService } from "../src/server/services/demand-room-service";
import { createFollowUpEngineService } from "../src/server/services/follow-up-engine-service";
import { createMatchingEngineService } from "../src/server/services/matching-engine-service";
import { createReplyIntelligenceService } from "../src/server/services/reply-intelligence-service";

const actor = {
  type: "user" as const,
  id: "usr_1",
  userId: "usr_1",
  role: "AGENT" as const,
};

test("prompt 26 reply intelligence extracts supported facts with confidence/source and suppresses OPT_OUT", async () => {
  let suppressed = false;
  let requirementUpdated = false;
  let eventFacts: Array<{
    type: string;
    value: string;
    confidence: number;
    sourceMessageId: string;
  }> = [];

  const service = createReplyIntelligenceService({
    repository: {
      async getMessageContext() {
        return {
          message: {
            id: "msg_1",
            direction: "inbound",
            bodyText:
              "Please unsubscribe me. We need 3 units in E1 1AA with 2-3 bed and budget 3000-4500. Move in next month.",
          },
          conversation: {
            id: "cnv_1",
            leadId: "led_1",
            contactId: "ctc_1",
          },
          contact: {
            id: "ctc_1",
            email: "reply@example.com",
          },
        };
      },
      async createReplyIntelligenceEvent(input: {
        extractedFacts: Array<{
          type: string;
          value: string;
          confidence: number;
          sourceMessageId: string;
        }>;
      }) {
        eventFacts = input.extractedFacts;
        return { id: "rie_1" };
      },
      async updateConversationCategory() {
        return { id: "cnv_1" };
      },
      async suppressContactImmediately() {
        suppressed = true;
      },
      async findRequirementByLead() {
        return { id: "req_1" };
      },
      async updateRequirement() {
        requirementUpdated = true;
        return { id: "req_1" };
      },
      async createRequirementForLead() {
        return { id: "req_1" };
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_1" };
      },
    } as never,
  });

  const result = await service.processInboundMessage({ messageId: "msg_1" }, actor);

  assert.equal(result.intent, "OPT_OUT");
  assert.equal(suppressed, true);
  assert.equal(requirementUpdated, true);
  assert.equal(eventFacts.length > 0, true);
  assert.equal(eventFacts.every((fact) => fact.confidence > 0), true);
  assert.equal(eventFacts.every((fact) => fact.sourceMessageId === "msg_1"), true);
  assert.equal(
    eventFacts.every((fact) =>
      [
        "availability",
        "unit_count",
        "bedrooms",
        "location",
        "budget",
        "timing",
        "next_step",
      ].includes(fact.type),
    ),
    true,
  );
});

test("prompt 26 UNCLEAR does not update critical requirement fields", async () => {
  let updated = false;

  const service = createReplyIntelligenceService({
    repository: {
      async getMessageContext() {
        return {
          message: {
            id: "msg_2",
            direction: "inbound",
            bodyText: "Thanks.",
          },
          conversation: {
            id: "cnv_2",
            leadId: "led_2",
            contactId: "ctc_2",
          },
          contact: {
            id: "ctc_2",
            email: "unclear@example.com",
          },
        };
      },
      async createReplyIntelligenceEvent() {
        return { id: "rie_2" };
      },
      async updateConversationCategory() {
        return { id: "cnv_2" };
      },
      async suppressContactImmediately() {
        return;
      },
      async findRequirementByLead() {
        return { id: "req_2" };
      },
      async updateRequirement() {
        updated = true;
        return { id: "req_2" };
      },
      async createRequirementForLead() {
        return { id: "req_2" };
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_2" };
      },
    } as never,
  });

  const result = await service.processInboundMessage({ messageId: "msg_2" }, actor);

  assert.equal(result.intent, "UNCLEAR");
  assert.equal(result.escalatedToHuman, true);
  assert.equal(updated, false);
});

test("prompt 27 controlled sending blocks without stored approval and before weekday 08:30", async () => {
  const statuses: string[] = [];

  const service = createControlledEmailSendingService({
    repository: {
      async getSendContext() {
        return {
          campaign: {
            id: "cam_1",
            status: "running",
            approvalMode: "HUMAN_APPROVAL",
            autonomyLevel: "LEVEL_1_HUMAN_APPROVAL",
            minimumScore: 70,
            weekdayRules: ["MON", "TUE", "WED", "THU", "FRI"],
            startHour: "08:30",
            endHour: "17:00",
            active: true,
            dailyLimit: 20,
          },
          lead: {
            id: "led_1",
            score: 85,
            directnessClassification: "DIRECT",
            directnessVerified: true,
            directnessConfidence: 80,
          },
          contact: { id: "ctc_1", email: "lead@example.com" },
          source: { permissionStatus: "APPROVED", enabled: true, health: "healthy" },
          evidenceCount: 2,
          directnessEvidenceCount: 1,
          suppressed: false,
          optedOut: false,
        };
      },
      async getApprovedDraft() {
        return undefined;
      },
      async countDailyAttempts() {
        return 0;
      },
      async countRecipientAttemptsSince() {
        return 0;
      },
      async countLeadAttempts() {
        return 0;
      },
      async isOutboundKillSwitchActive() {
        return false;
      },
      async isGlobalLevel3Enabled() {
        return true;
      },
      async hasRecentDuplicateSend() {
        return false;
      },
      async createSendAttempt(input: { status: string }) {
        statuses.push(input.status);
        return { id: "sat_1" };
      },
      async createOutreachMessage() {
        return { id: "omg_1" };
      },
      async findOrCreateConversation() {
        return { id: "cnv_1" };
      },
      async updateConversationOnOutbound() {
        return { id: "cnv_1" };
      },
    } as never,
    adapter: {
      providerName: "mock-email",
      async send() {
        return {
          providerMessageId: "m_1",
          threadId: "t_1",
          status: "queued" as const,
        };
      },
      async syncInbox() {
        return { synced: 0, messages: [] };
      },
      async mapThread() {
        return {};
      },
      async getMessageStatus() {
        return "queued" as const;
      },
      async pollWebhookEvents() {
        return [];
      },
    },
    auditService: {
      async recordEvent() {
        return { id: "aud_3" };
      },
    } as never,
    now: () => new Date("2026-01-05T08:20:00.000Z"),
  });

  const result = await service.sendCampaignEmail(
    {
      campaignId: "cam_1",
      leadId: "led_1",
      subject: "Intro",
      bodyText: "Hello",
      approved: true,
    },
    actor,
  );

  assert.equal(result.status, "blocked");
  assert.equal(statuses.includes("blocked"), true);
  assert.equal(result.failedReasons.includes("messageApproved"), true);
  assert.equal(result.failedReasons.includes("respects0830WeekdayRule"), true);
});

test("prompt 27 controlled sending uses approved draft and queues send", async () => {
  const statuses: string[] = [];
  let sentSubject = "";
  let sentBody = "";

  const service = createControlledEmailSendingService({
    repository: {
      async getSendContext() {
        return {
          campaign: {
            id: "cam_2",
            status: "running",
            approvalMode: "HUMAN_APPROVAL",
            autonomyLevel: "LEVEL_1_HUMAN_APPROVAL",
            minimumScore: 70,
            weekdayRules: ["MON", "TUE", "WED", "THU", "FRI"],
            startHour: "08:30",
            endHour: "17:00",
            active: true,
            dailyLimit: 20,
          },
          lead: {
            id: "led_2",
            score: 86,
            directnessClassification: "DIRECT",
            directnessVerified: true,
            directnessConfidence: 82,
          },
          contact: { id: "ctc_2", email: "lead2@example.com" },
          source: { permissionStatus: "APPROVED", enabled: true, health: "healthy" },
          evidenceCount: 2,
          directnessEvidenceCount: 1,
          suppressed: false,
          optedOut: false,
        };
      },
      async getApprovedDraft() {
        return {
          id: "drf_1",
          subject: "Approved Subject",
          bodyText: "Approved Body",
        };
      },
      async countDailyAttempts() {
        return 0;
      },
      async countRecipientAttemptsSince() {
        return 0;
      },
      async countLeadAttempts() {
        return 0;
      },
      async isOutboundKillSwitchActive() {
        return false;
      },
      async isGlobalLevel3Enabled() {
        return true;
      },
      async hasRecentDuplicateSend() {
        return false;
      },
      async createSendAttempt(input: { status: string }) {
        statuses.push(input.status);
        return { id: "sat_2" };
      },
      async createOutreachMessage() {
        return { id: "omg_2" };
      },
      async findOrCreateConversation() {
        return { id: "cnv_2" };
      },
      async updateConversationOnOutbound() {
        return { id: "cnv_2" };
      },
    } as never,
    adapter: {
      providerName: "mock-email",
      async send(input: { subject: string; bodyText: string }) {
        sentSubject = input.subject;
        sentBody = input.bodyText;
        return {
          providerMessageId: "m_2",
          threadId: "t_2",
          status: "queued" as const,
        };
      },
      async syncInbox() {
        return { synced: 0, messages: [] };
      },
      async mapThread() {
        return {};
      },
      async getMessageStatus() {
        return "queued" as const;
      },
      async pollWebhookEvents() {
        return [];
      },
    },
    auditService: {
      async recordEvent() {
        return { id: "aud_4" };
      },
    } as never,
    now: () => new Date("2026-01-05T09:00:00.000Z"),
  });

  const result = await service.sendCampaignEmail(
    {
      campaignId: "cam_2",
      leadId: "led_2",
      subject: "Original Subject",
      bodyText: "Original Body",
      approved: true,
    },
    actor,
  );

  assert.equal(result.status, "queued");
  assert.equal(statuses.includes("queued"), true);
  assert.equal(sentSubject, "Approved Subject");
  assert.equal(sentBody, "Approved Body");
});

test("prompt 28 follow-up engine dry run stops on reply and schedule mirrors preview", async () => {
  const upserts: string[] = [];

  const service = createFollowUpEngineService({
    repository: {
      async getCampaignLeadContext() {
        return {
          campaign: {
            id: "cam_1",
            status: "running",
            active: true,
            sequenceSteps: [
              { dayOffset: 0, template: "initial" },
              { dayOffset: 2, template: "follow-up" },
            ],
            startHour: "09:00",
            weekdayRules: ["MON", "TUE", "WED", "THU", "FRI"],
            dailyLimit: 10,
          },
          lead: {
            id: "led_1",
            status: "qualified",
          },
          contact: {
            id: "ctc_1",
            email: "fup@example.com",
          },
        };
      },
      async hasInboundReply() {
        return true;
      },
      async isOptedOut() {
        return false;
      },
      async countQueuedForDay() {
        return 0;
      },
      async countSentAttemptsForDay() {
        return 0;
      },
      async upsertFollowUp() {
        upserts.push("created");
        return { id: "fuq_1" };
      },
      async listFollowUps() {
        return [];
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_5" };
      },
    } as never,
    now: () => new Date("2026-01-05T09:30:00.000Z"),
  });

  const preview = await service.dryRunPreview(
    {
      campaignId: "cam_1",
      leadId: "led_1",
    },
    actor,
  );

  assert.equal(preview.stopped, true);
  assert.equal(preview.stopReason, "stop_on_reply");

  const scheduleResult = await service.schedule(
    {
      campaignId: "cam_1",
      leadId: "led_1",
    },
    actor,
  );

  assert.equal(scheduleResult.created, 0);
  assert.equal(upserts.length, 0);
  assert.equal(scheduleResult.preview.stopped, true);
});

test("prompt 29 demand room service creates and updates requirement with audit", async () => {
  const calls: string[] = [];

  const service = createDemandRoomService({
    repository: {
      async listRequirements() {
        return [];
      },
      async getRequirement() {
        return {
          requirement: {
            id: "req_1",
            status: "open",
            leadId: "led_1",
          },
        };
      },
      async getRequirementTimeline() {
        return [];
      },
      async listRequirementConversations() {
        return [];
      },
      async createRequirement() {
        calls.push("create");
        return { id: "req_1", relationshipType: "DIRECT", status: "open" };
      },
      async updateRequirement() {
        calls.push("update");
        return { id: "req_1", status: "matched" };
      },
      async archiveRequirement() {
        calls.push("archive");
        return { id: "req_1" };
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_6" };
      },
    } as never,
  });

  await service.createRequirement(
    {
      leadId: "led_1",
      companyId: "co_1",
      contactId: "ctc_1",
      ownerUserId: "usr_1",
      status: "open",
      budgetMinCents: null,
      budgetMaxCents: 400000,
      bedroomsMin: 2,
      bedroomsMax: 3,
      unitCount: 2,
      acceptableRadiusMiles: 5,
      preferredArea: "London",
      startDate: null,
      termMonths: 12,
      purpose: "corporate stay",
      urgency: "HIGH",
      relationshipType: "DIRECT",
      directRelationshipVerified: true,
      evidenceIds: [],
      nextAction: "confirm shortlist",
      notes: "created in test",
      archivedAt: null,
    },
    actor,
  );

  await service.updateRequirement(
    "req_1",
    {
      status: "matched",
      nextAction: "schedule viewing",
    },
    actor,
  );

  assert.deepEqual(calls, ["create", "update"]);
});

test("prompt 30 matching engine persists scored suggestions with confidence and version", async () => {
  const persisted: Array<{ score: number; confidence: number; matchVersion: string }> = [];

  const service = createMatchingEngineService({
    repository: {
      async getRequirement() {
        return {
          id: "req_1",
          leadId: "led_1",
          preferredArea: "London",
          bedroomsMin: 2,
          budgetMaxCents: 450000,
          termMonths: 12,
          unitCount: 2,
        };
      },
      async listCandidateProperties() {
        return [
          {
            id: "prp_1",
            city: "London",
            bedrooms: 2,
            monthlyRentCents: 420000,
            termMonths: 12,
            availability: "available_now",
            companyLetFit: "ideal",
            furnished: true,
            parking: true,
            propertyType: "apartment",
          },
        ];
      },
      async findExistingMatch() {
        return undefined;
      },
      async upsertMatch(input: { score: number; confidence: number; matchVersion: string }) {
        persisted.push({
          score: input.score,
          confidence: input.confidence,
          matchVersion: input.matchVersion,
        });
        return {
          id: "mat_1",
          requirementId: "req_1",
          propertyId: "prp_1",
          score: input.score,
          confidence: input.confidence,
          rationale: { reasons: ["location aligned"], gaps: [] },
          matchVersion: input.matchVersion,
        };
      },
      async listMatchesByRequirement() {
        return [];
      },
      async listMatchesByIds() {
        return [];
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_7" };
      },
    } as never,
  });

  const result = await service.runRequirementMatch("req_1", actor);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.matchVersion, "matching-v1");
  assert.equal((result[0]?.confidence ?? 0) > 0, true);
  assert.equal((result[0]?.score ?? 0) > 0, true);
  assert.equal(persisted.length, 1);
});