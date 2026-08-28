import assert from "node:assert/strict";
import test from "node:test";

import { createControlledEmailSendingService } from "../src/server/services/controlled-email-sending-service";

const actor = {
  type: "user" as const,
  id: "usr_1",
  userId: "usr_1",
  role: "AGENT" as const,
};

function createServiceForGate(input: {
  directnessClassification: "DIRECT" | "INTERMEDIARY" | "UNKNOWN" | "SUPPRESSED";
  directnessVerified: boolean;
  directnessConfidence: number;
  directnessEvidenceCount: number;
  suppressed: boolean;
}) {
  return createControlledEmailSendingService({
    repository: {
      async getSendContext() {
        return {
          campaign: {
            id: "cam_gate",
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
            id: "led_gate",
            score: 90,
            directnessClassification: input.directnessClassification,
            directnessVerified: input.directnessVerified,
            directnessConfidence: input.directnessConfidence,
          },
          contact: { id: "ctc_gate", email: "lead@example.com" },
          source: { permissionStatus: "APPROVED", enabled: true, health: "healthy" },
          evidenceCount: 2,
          directnessEvidenceCount: input.directnessEvidenceCount,
          suppressed: input.suppressed,
          optedOut: false,
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

test("hard outreach gate blocks INTERMEDIARY", async () => {
  const service = createServiceForGate({
    directnessClassification: "INTERMEDIARY",
    directnessVerified: false,
    directnessConfidence: 85,
    directnessEvidenceCount: 2,
    suppressed: false,
  });

  const result = await service.sendCampaignEmail(
    {
      campaignId: "cam_gate",
      leadId: "led_gate",
      subject: "Intro",
      bodyText: "Hello",
      approved: true,
    },
    actor,
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.failedReasons.includes("directnessIsDirect"), true);
});

test("hard outreach gate blocks UNKNOWN", async () => {
  const service = createServiceForGate({
    directnessClassification: "UNKNOWN",
    directnessVerified: false,
    directnessConfidence: 60,
    directnessEvidenceCount: 1,
    suppressed: false,
  });

  const result = await service.sendCampaignEmail(
    {
      campaignId: "cam_gate",
      leadId: "led_gate",
      subject: "Intro",
      bodyText: "Hello",
      approved: true,
    },
    actor,
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.failedReasons.includes("directnessIsDirect"), true);
});

test("hard outreach gate blocks SUPPRESSED", async () => {
  const service = createServiceForGate({
    directnessClassification: "SUPPRESSED",
    directnessVerified: true,
    directnessConfidence: 90,
    directnessEvidenceCount: 2,
    suppressed: true,
  });

  const result = await service.sendCampaignEmail(
    {
      campaignId: "cam_gate",
      leadId: "led_gate",
      subject: "Intro",
      bodyText: "Hello",
      approved: true,
    },
    actor,
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.failedReasons.includes("notSuppressed"), true);
});

test("hard outreach gate blocks DIRECT without sufficient evidence", async () => {
  const service = createServiceForGate({
    directnessClassification: "DIRECT",
    directnessVerified: true,
    directnessConfidence: 65,
    directnessEvidenceCount: 0,
    suppressed: false,
  });

  const result = await service.sendCampaignEmail(
    {
      campaignId: "cam_gate",
      leadId: "led_gate",
      subject: "Intro",
      bodyText: "Hello",
      approved: true,
    },
    actor,
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.failedReasons.includes("sufficientDirectnessEvidence"), true);
});

test("hard outreach gate allows DIRECT with valid evidence when all gates pass", async () => {
  const service = createServiceForGate({
    directnessClassification: "DIRECT",
    directnessVerified: true,
    directnessConfidence: 90,
    directnessEvidenceCount: 2,
    suppressed: false,
  });

  const result = await service.sendCampaignEmail(
    {
      campaignId: "cam_gate",
      leadId: "led_gate",
      subject: "Intro",
      bodyText: "Hello",
      approved: true,
    },
    actor,
  );

  assert.equal(result.status, "queued");
});
