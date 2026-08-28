import assert from "node:assert/strict";
import test from "node:test";

import { createControlledEmailSendingService } from "../src/server/services/controlled-email-sending-service";
import { createOutreachEligibilityGateService } from "../src/server/services/outreach-eligibility-gate-service";

const actor = {
  type: "user" as const,
  id: "usr_1",
  userId: "usr_1",
  role: "AGENT" as const,
};

test("prompt 40 policy engine exposes explicit reasons for every gate", () => {
  const gate = createOutreachEligibilityGateService();
  const base: {
    globalKillSwitchOff: boolean;
    directnessClassification: "DIRECT" | "INTERMEDIARY" | "UNKNOWN" | "SUPPRESSED";
    directnessVerified: boolean;
    directnessConfidence: number;
    directnessEvidenceCount: number;
    suppressed: boolean;
    optedOut: boolean;
    sourceAllowed: boolean;
    connectorHealthy: boolean;
    campaignStatusAllowed: boolean;
    campaignActive: boolean;
    scoreThresholdMet: boolean;
    hasEvidence: boolean;
    messageApproved: boolean;
    withinWindow: boolean;
    respects0830WeekdayRule: boolean;
    dailyLimitNotExceeded: boolean;
    frequencyLimitNotExceeded: boolean;
    noRecentDuplicateSend: boolean;
    recipientValid: boolean;
    approvalModeAllowed: boolean;
    autonomyLevelAllowsSend: boolean;
    level3GlobalEnabledForCampaign: boolean;
    level2AutoFollowUpSatisfied: boolean;
  } = {
    globalKillSwitchOff: true,
    directnessClassification: "DIRECT",
    directnessVerified: true,
    directnessConfidence: 85,
    directnessEvidenceCount: 1,
    suppressed: false,
    optedOut: false,
    sourceAllowed: true,
    connectorHealthy: true,
    campaignStatusAllowed: true,
    campaignActive: true,
    scoreThresholdMet: true,
    hasEvidence: true,
    messageApproved: true,
    withinWindow: true,
    respects0830WeekdayRule: true,
    dailyLimitNotExceeded: true,
    frequencyLimitNotExceeded: true,
    noRecentDuplicateSend: true,
    recipientValid: true,
    approvalModeAllowed: true,
    autonomyLevelAllowsSend: true,
    level3GlobalEnabledForCampaign: true,
    level2AutoFollowUpSatisfied: true,
  };

  const failingCases: Array<{
    expectedReason: string;
    input: typeof base;
  }> = [
    { expectedReason: "globalKillSwitchOff", input: { ...base, globalKillSwitchOff: false } },
    { expectedReason: "directnessIsDirect", input: { ...base, directnessClassification: "UNKNOWN" } },
    { expectedReason: "directnessVerified", input: { ...base, directnessVerified: false } },
    { expectedReason: "sufficientDirectnessEvidence", input: { ...base, directnessEvidenceCount: 0 } },
    { expectedReason: "notSuppressed", input: { ...base, suppressed: true } },
    { expectedReason: "notOptedOut", input: { ...base, optedOut: true } },
    { expectedReason: "sourceAllowed", input: { ...base, sourceAllowed: false } },
    { expectedReason: "connectorHealthy", input: { ...base, connectorHealthy: false } },
    { expectedReason: "campaignStatusAllowed", input: { ...base, campaignStatusAllowed: false } },
    { expectedReason: "campaignActive", input: { ...base, campaignActive: false } },
    { expectedReason: "scoreThresholdMet", input: { ...base, scoreThresholdMet: false } },
    { expectedReason: "hasEvidence", input: { ...base, hasEvidence: false } },
    { expectedReason: "messageApproved", input: { ...base, messageApproved: false } },
    { expectedReason: "withinWindow", input: { ...base, withinWindow: false } },
    { expectedReason: "respects0830WeekdayRule", input: { ...base, respects0830WeekdayRule: false } },
    { expectedReason: "dailyLimitNotExceeded", input: { ...base, dailyLimitNotExceeded: false } },
    { expectedReason: "frequencyLimitNotExceeded", input: { ...base, frequencyLimitNotExceeded: false } },
    { expectedReason: "noRecentDuplicateSend", input: { ...base, noRecentDuplicateSend: false } },
    { expectedReason: "recipientValid", input: { ...base, recipientValid: false } },
    { expectedReason: "approvalModeAllowed", input: { ...base, approvalModeAllowed: false } },
    {
      expectedReason: "autonomyLevelAllowsSend",
      input: { ...base, autonomyLevelAllowsSend: false },
    },
    {
      expectedReason: "level3GlobalEnabledForCampaign",
      input: { ...base, level3GlobalEnabledForCampaign: false },
    },
    {
      expectedReason: "level2AutoFollowUpSatisfied",
      input: { ...base, level2AutoFollowUpSatisfied: false },
    },
  ];

  for (const testCase of failingCases) {
    const result = gate.evaluate(testCase.input);
    assert.equal(result.eligible, false);
    assert.equal(result.failedReasons.includes(testCase.expectedReason), true);
  }
});

function buildService(input?: {
  campaignStatus?: "draft" | "scheduled" | "running" | "paused" | "completed" | "archived";
  connectorHealth?: "healthy" | "degraded" | "offline" | "unknown";
  optedOut?: boolean;
  killSwitchActive?: boolean;
  recentRecipientAttempts?: number;
}) {
  return createControlledEmailSendingService({
    repository: {
      async getSendContext() {
        return {
          campaign: {
            id: "cam_1",
            status: input?.campaignStatus ?? "running",
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
            score: 90,
            directnessClassification: "DIRECT",
            directnessVerified: true,
            directnessConfidence: 85,
          },
          contact: { id: "ctc_1", email: "lead@example.com" },
          source: {
            permissionStatus: "APPROVED",
            enabled: true,
            health: input?.connectorHealth ?? "healthy",
          },
          evidenceCount: 2,
          directnessEvidenceCount: 2,
          suppressed: false,
          optedOut: input?.optedOut ?? false,
        };
      },
      async getApprovedDraft() {
        return {
          id: "drf_1",
          subject: "Approved subject",
          bodyText: "Approved body",
        };
      },
      async countDailyAttempts() {
        return 0;
      },
      async countRecipientAttemptsSince() {
        return input?.recentRecipientAttempts ?? 0;
      },
      async countLeadAttempts() {
        return 0;
      },
      async isOutboundKillSwitchActive() {
        return input?.killSwitchActive ?? false;
      },
      async isGlobalLevel3Enabled() {
        return true;
      },
      async hasRecentDuplicateSend() {
        return false;
      },
      async createSendAttempt() {
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
        return { id: "aud_1" };
      },
    } as never,
    now: () => new Date("2026-01-05T10:00:00.000Z"),
  });
}

test("prompt 40 global kill switch blocks outbound", async () => {
  const service = buildService({ killSwitchActive: true });
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
  assert.equal(result.failedReasons.includes("globalKillSwitchOff"), true);
});

test("prompt 40 opt-out blocks outbound", async () => {
  const service = buildService({ optedOut: true });
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
  assert.equal(result.failedReasons.includes("notOptedOut"), true);
});

test("prompt 40 connector health gate blocks degraded source", async () => {
  const service = buildService({ connectorHealth: "degraded" });
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
  assert.equal(result.failedReasons.includes("connectorHealthy"), true);
});

test("prompt 40 frequency limit blocks repeated recipient within 24h", async () => {
  const service = buildService({ recentRecipientAttempts: 1 });
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
  assert.equal(result.failedReasons.includes("frequencyLimitNotExceeded"), true);
});

test("prompt 40 campaign status gate blocks non-running campaign", async () => {
  const service = buildService({ campaignStatus: "paused" });
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
  assert.equal(result.failedReasons.includes("campaignStatusAllowed"), true);
});