import assert from "node:assert/strict";
import test from "node:test";

import { createAiAcquisitionOrchestratorService } from "../src/server/services/ai-acquisition-orchestrator-service";
import { createControlledEmailSendingService } from "../src/server/services/controlled-email-sending-service";
import { createOutreachService } from "../src/server/services/outreach-service";

const actor = {
  type: "user" as const,
  id: "usr_1",
  userId: "usr_1",
  role: "MANAGER" as const,
};

test("prompt 41 mission cycle persists successful run", async () => {
  const runUpdates: Array<Record<string, unknown>> = [];

  const service = createAiAcquisitionOrchestratorService({
    repository: {
      async getMission() {
        return {
          id: "mis_1",
          title: "Supply mission",
          missionType: "SUPPLY" as const,
          missionObjective: "Find direct owners",
          targetQualifiedProspects: 5,
          targetOutreachReadyProspects: 3,
          startedAt: new Date("2026-01-05T09:00:00.000Z"),
          createdAt: new Date("2026-01-05T08:00:00.000Z"),
          status: "running" as const,
          scope: { area: "M25" },
        };
      },
      async createMissionRun() {
        return { id: "msr_1" };
      },
      async updateMissionRun(_runId: string, patch: Record<string, unknown>) {
        runUpdates.push(patch);
        return { id: "msr_1" };
      },
      async countMissionDiscovered() {
        return 9;
      },
      async countMissionQualified() {
        return 6;
      },
      async countMissionOutreachReady() {
        return 4;
      },
      async countMissionAwaitingVerification() {
        return 2;
      },
      async updateMission() {
        return { id: "mis_1", status: "satisfied" };
      },
      async createAgentMessage() {
        return { id: "agm_1" };
      },
      async listMissions() {
        return [];
      },
      async listAgentMessages() {
        return [];
      },
      async listObjectiveBacklog() {
        return [];
      },
      async listMissionRuns() {
        return [];
      },
      async getCommercialNorthStarSnapshot() {
        return {
          weekStart: new Date("2026-01-05T00:00:00.000Z"),
          weeklyTargetLow: 5,
          weeklyTargetHigh: 10,
          completedLetsThisWeek: 3,
          pipelineValueCents: 100_000,
          weightedPipelineValueCents: 70_000,
        };
      },
    } as never,
    jobsService: {
      async enqueueJob() {
        return { id: "que_1", duplicate: false };
      },
    } as never,
    demandIntelligenceService: {
      async refreshHeatmap() {
        return [];
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_1" };
      },
    } as never,
    now: () => new Date("2026-01-05T10:00:00.000Z"),
  });

  await service.runMissionCycle("mis_1", actor);

  assert.equal(runUpdates.length >= 1, true);
  const successPatch = runUpdates.find((patch) => patch["status"] === "succeeded");
  assert.equal(Boolean(successPatch), true);
  assert.equal(successPatch?.["targetReached"], true);
  assert.equal(successPatch?.["qualified"], 6);
});

test("prompt 41 mission cycle persists failed run", async () => {
  const runUpdates: Array<Record<string, unknown>> = [];

  const service = createAiAcquisitionOrchestratorService({
    repository: {
      async getMission() {
        return {
          id: "mis_2",
          title: "Demand mission",
          missionType: "DEMAND" as const,
          missionObjective: "Find direct corporate demand",
          targetQualifiedProspects: 8,
          targetOutreachReadyProspects: 5,
          startedAt: new Date("2026-01-05T09:00:00.000Z"),
          createdAt: new Date("2026-01-05T08:00:00.000Z"),
          status: "running" as const,
          scope: { area: "M25" },
        };
      },
      async createMissionRun() {
        return { id: "msr_2" };
      },
      async updateMissionRun(_runId: string, patch: Record<string, unknown>) {
        runUpdates.push(patch);
        return { id: "msr_2" };
      },
      async countMissionDiscovered() {
        throw new Error("forced metric failure");
      },
      async countMissionQualified() {
        return 0;
      },
      async countMissionOutreachReady() {
        return 0;
      },
      async countMissionAwaitingVerification() {
        return 0;
      },
      async updateMission() {
        return { id: "mis_2", status: "running" };
      },
      async createAgentMessage() {
        return { id: "agm_2" };
      },
      async listMissions() {
        return [];
      },
      async listAgentMessages() {
        return [];
      },
      async listObjectiveBacklog() {
        return [];
      },
      async listMissionRuns() {
        return [];
      },
      async getCommercialNorthStarSnapshot() {
        return {
          weekStart: new Date("2026-01-05T00:00:00.000Z"),
          weeklyTargetLow: 5,
          weeklyTargetHigh: 10,
          completedLetsThisWeek: 1,
          pipelineValueCents: 40_000,
          weightedPipelineValueCents: 18_000,
        };
      },
    } as never,
    jobsService: {
      async enqueueJob() {
        return { id: "que_2", duplicate: false };
      },
    } as never,
    demandIntelligenceService: {
      async refreshHeatmap() {
        return [];
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_2" };
      },
    } as never,
    now: () => new Date("2026-01-05T10:00:00.000Z"),
  });

  await assert.rejects(() => service.runMissionCycle("mis_2", actor), /forced metric failure/);

  const failedPatch = runUpdates.find((patch) => patch["status"] === "failed");
  assert.equal(Boolean(failedPatch), true);
  assert.match(String(failedPatch?.["errorMessage"] ?? ""), /forced metric failure/);
});

test("prompt 41 commercial north-star snapshot is exposed by orchestrator", async () => {
  const service = createAiAcquisitionOrchestratorService({
    repository: {
      async getCommercialNorthStarSnapshot() {
        return {
          weekStart: new Date("2026-01-05T00:00:00.000Z"),
          weeklyTargetLow: 5,
          weeklyTargetHigh: 10,
          completedLetsThisWeek: 4,
          pipelineValueCents: 220_000,
          weightedPipelineValueCents: 130_000,
        };
      },
      async listMissions() {
        return [];
      },
      async listAgentMessages() {
        return [];
      },
      async listObjectiveBacklog() {
        return [];
      },
      async listMissionRuns() {
        return [];
      },
      async getMission() {
        return undefined;
      },
      async createMission() {
        return undefined;
      },
      async updateMission() {
        return undefined;
      },
      async createMissionRun() {
        return undefined;
      },
      async updateMissionRun() {
        return undefined;
      },
      async countMissionDiscovered() {
        return 0;
      },
      async countMissionQualified() {
        return 0;
      },
      async countMissionOutreachReady() {
        return 0;
      },
      async countMissionAwaitingVerification() {
        return 0;
      },
      async createAgentMessage() {
        return undefined;
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_3" };
      },
    } as never,
    jobsService: {
      async enqueueJob() {
        return { id: "que_3", duplicate: false };
      },
    } as never,
    demandIntelligenceService: {
      async refreshHeatmap() {
        return [];
      },
    } as never,
  });

  const snapshot = await service.getCommercialNorthStarSnapshot();

  assert.equal(snapshot.completedLetsThisWeek, 4);
  assert.equal(snapshot.weeklyTargetLow, 5);
  assert.equal(snapshot.weeklyTargetHigh, 10);
});

test("prompt 41 outreach defaults to Level 1 and enforces floor/cap", async () => {
  const service = createOutreachService({
    repository: {
      async createCampaign(input: Record<string, unknown>) {
        return {
          id: "cam_41_1",
          ...input,
          status: "draft",
          createdAt: new Date("2026-01-05T10:00:00.000Z"),
          updatedAt: new Date("2026-01-05T10:00:00.000Z"),
          archivedAt: null,
          launchedAt: null,
          scheduledAt: null,
        };
      },
      async isGlobalLevel3Enabled() {
        return false;
      },
      async setGlobalLevel3Enabled() {
        return { id: "wct_41_1" };
      },
      async listCampaigns() {
        return [];
      },
      async previewEligibleLeads() {
        return [];
      },
      async findCampaignById() {
        return null;
      },
      async markCampaignRunning() {
        return undefined;
      },
      async pauseCampaign() {
        return undefined;
      },
      async updateCampaign() {
        return undefined;
      },
      async listLeadsByIds() {
        return [];
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_41_1" };
      },
    } as never,
  });

  const campaign = await service.buildCampaign(
    {
      name: "Level1 floor",
      minimumScore: 55,
      dailyLimit: 40,
    },
    { type: "user", id: "usr_41_mgr", userId: "usr_41_mgr", role: "MANAGER" },
  );

  assert.equal(campaign.autonomyLevel, "LEVEL_1_HUMAN_APPROVAL");
  assert.equal(campaign.approvalMode, "HUMAN_APPROVAL");
  assert.equal(campaign.minimumScore, 70);
  assert.equal(campaign.dailyLimit, 25);
});

test("prompt 41 level 3 campaign requires admin and global enablement", async () => {
  const service = createOutreachService({
    repository: {
      async createCampaign(input: Record<string, unknown>) {
        return {
          id: "cam_41_2",
          ...input,
          status: "draft",
          createdAt: new Date("2026-01-05T10:00:00.000Z"),
          updatedAt: new Date("2026-01-05T10:00:00.000Z"),
          archivedAt: null,
          launchedAt: null,
          scheduledAt: null,
        };
      },
      async isGlobalLevel3Enabled() {
        return false;
      },
      async setGlobalLevel3Enabled() {
        return { id: "wct_41_2" };
      },
      async listCampaigns() {
        return [];
      },
      async previewEligibleLeads() {
        return [];
      },
      async findCampaignById() {
        return null;
      },
      async markCampaignRunning() {
        return undefined;
      },
      async pauseCampaign() {
        return undefined;
      },
      async updateCampaign() {
        return undefined;
      },
      async listLeadsByIds() {
        return [];
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_41_2" };
      },
    } as never,
  });

  await assert.rejects(
    () =>
      service.buildCampaign(
        {
          name: "Level3 blocked",
          autonomyLevel: "LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS",
          approvalMode: "AUTO_APPROVAL",
        },
        { type: "user", id: "usr_41_admin", userId: "usr_41_admin", role: "ADMIN" },
      ),
    /Level 3 autonomy is disabled/i,
  );

  const adminService = createOutreachService({
    repository: {
      async createCampaign(input: Record<string, unknown>) {
        return {
          id: "cam_41_3",
          ...input,
          status: "draft",
          createdAt: new Date("2026-01-05T10:00:00.000Z"),
          updatedAt: new Date("2026-01-05T10:00:00.000Z"),
          archivedAt: null,
          launchedAt: null,
          scheduledAt: null,
        };
      },
      async isGlobalLevel3Enabled() {
        return true;
      },
      async setGlobalLevel3Enabled() {
        return { id: "wct_41_3" };
      },
      async listCampaigns() {
        return [];
      },
      async previewEligibleLeads() {
        return [];
      },
      async findCampaignById() {
        return null;
      },
      async markCampaignRunning() {
        return undefined;
      },
      async pauseCampaign() {
        return undefined;
      },
      async updateCampaign() {
        return undefined;
      },
      async listLeadsByIds() {
        return [];
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_41_3" };
      },
    } as never,
  });

  await assert.rejects(
    () =>
      adminService.setGlobalLevel3Enabled(true, {
        type: "user",
        id: "usr_41_mgr",
        userId: "usr_41_mgr",
        role: "MANAGER",
      }),
    /Missing permission: manageUsers/i,
  );

  const campaign = await adminService.buildCampaign(
    {
      name: "Level3 allowed",
      autonomyLevel: "LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS",
      approvalMode: "AUTO_APPROVAL",
      minimumScore: 79,
      dailyLimit: 99,
    },
    { type: "user", id: "usr_41_admin", userId: "usr_41_admin", role: "ADMIN" },
  );

  assert.equal(campaign.autonomyLevel, "LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS");
  assert.equal(campaign.minimumScore, 80);
  assert.equal(campaign.dailyLimit, 10);
});

test("prompt 41 send gate blocks level 0 and enforces level 2 follow-up-only auto", async () => {
  const serviceLevel0 = createControlledEmailSendingService({
    repository: {
      async getSendContext() {
        return {
          campaign: {
            id: "cam_41_send_0",
            status: "running",
            approvalMode: "HUMAN_APPROVAL",
            autonomyLevel: "LEVEL_0_DRAFT_ONLY",
            minimumScore: 70,
            weekdayRules: ["MON", "TUE", "WED", "THU", "FRI"],
            startHour: "08:30",
            endHour: "17:00",
            active: true,
            dailyLimit: 20,
          },
          lead: {
            id: "led_41",
            score: 90,
            directnessClassification: "DIRECT",
            directnessVerified: true,
            directnessConfidence: 90,
          },
          contact: { id: "ctc_41", email: "lead41@example.com" },
          source: { permissionStatus: "APPROVED", enabled: true, health: "healthy" },
          evidenceCount: 2,
          directnessEvidenceCount: 2,
          suppressed: false,
          optedOut: false,
        };
      },
      async getApprovedDraft() {
        return {
          id: "drf_41",
          subject: "Approved",
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
        return { id: "sat_41_0" };
      },
      async createOutreachMessage() {
        return { id: "omg_41_0" };
      },
      async findOrCreateConversation() {
        return { id: "cnv_41_0" };
      },
      async updateConversationOnOutbound() {
        return { id: "cnv_41_0" };
      },
    } as never,
    adapter: {
      providerName: "mock-email",
      async send() {
        return {
          providerMessageId: "m_41_0",
          threadId: "t_41_0",
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
        return { id: "aud_41_send_0" };
      },
    } as never,
    now: () => new Date("2026-01-05T10:00:00.000Z"),
  });

  const blocked = await serviceLevel0.sendCampaignEmail(
    {
      campaignId: "cam_41_send_0",
      leadId: "led_41",
      subject: "Intro",
      bodyText: "Hello",
      approved: true,
    },
    actor,
  );

  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.failedReasons.includes("autonomyLevelAllowsSend"), true);

  const serviceLevel2 = createControlledEmailSendingService({
    repository: {
      async getSendContext() {
        return {
          campaign: {
            id: "cam_41_send_2",
            status: "running",
            approvalMode: "AUTO_APPROVAL",
            autonomyLevel: "LEVEL_2_CONTROLLED_AUTO_FOLLOW_UP",
            minimumScore: 70,
            weekdayRules: ["MON", "TUE", "WED", "THU", "FRI"],
            startHour: "08:30",
            endHour: "17:00",
            active: true,
            dailyLimit: 20,
          },
          lead: {
            id: "led_42",
            score: 90,
            directnessClassification: "DIRECT",
            directnessVerified: true,
            directnessConfidence: 90,
          },
          contact: { id: "ctc_42", email: "lead42@example.com" },
          source: { permissionStatus: "APPROVED", enabled: true, health: "healthy" },
          evidenceCount: 2,
          directnessEvidenceCount: 2,
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
      async createSendAttempt() {
        return { id: "sat_41_2" };
      },
      async createOutreachMessage() {
        return { id: "omg_41_2" };
      },
      async findOrCreateConversation() {
        return { id: "cnv_41_2" };
      },
      async updateConversationOnOutbound() {
        return { id: "cnv_41_2" };
      },
    } as never,
    adapter: {
      providerName: "mock-email",
      async send() {
        return {
          providerMessageId: "m_41_2",
          threadId: "t_41_2",
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
        return { id: "aud_41_send_2" };
      },
    } as never,
    now: () => new Date("2026-01-05T10:00:00.000Z"),
  });

  const blockedLevel2 = await serviceLevel2.sendCampaignEmail(
    {
      campaignId: "cam_41_send_2",
      leadId: "led_42",
      subject: "Follow-up",
      bodyText: "Checking in",
      approved: false,
    },
    actor,
  );

  assert.equal(blockedLevel2.status, "blocked");
  assert.equal(
    blockedLevel2.failedReasons.includes("level2AutoFollowUpSatisfied"),
    true,
  );
});
