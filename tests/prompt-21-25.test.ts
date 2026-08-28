import assert from "node:assert/strict";
import test from "node:test";

import { createMockEmailProviderAdapter } from "../src/integrations/email";
import { createDirectDemandDiscoveryService } from "../src/server/services/direct-demand-discovery-service";
import { createInboxService } from "../src/server/services/inbox-service";
import { createOutreachDraftingService } from "../src/server/services/outreach-drafting-service";
import { createOutreachService } from "../src/server/services/outreach-service";

test("prompt 21 direct demand discovery extracts requirement and applies direct priority boost", async () => {
  const created: Array<Record<string, unknown>> = [];
  const repository = {
    async getLeadContext() {
      return {
        leadRow: {
          lead: {
            id: "led_1",
            summary:
              "We need 3-4 bed homes in London within 5 miles. Budget 3000-4500. Start 2026-10-01 for 12 months.",
            companyId: "co_1",
            contactId: "ctc_1",
            ownerUserId: "usr_1",
          },
        },
        leadEvidence: [
          {
            id: "evd_1",
            summary:
              "Our team needs staff housing in E1 1AA and we are looking directly.",
          },
        ],
        leadSignals: [],
        existingRequirement: null,
      };
    },
    async createRequirement(input: Record<string, unknown>) {
      created.push(input);
      return {
        id: "req_1",
      };
    },
    async updateRequirement() {
      throw new Error("should not update in this test");
    },
    async applyDirectPriorityBoost() {
      return { score: 81 };
    },
  };

  const service = createDirectDemandDiscoveryService({
    repository: repository as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_1" };
      },
    } as never,
    directnessService: {
      async assess() {
        return {
          id: "led_1",
          directnessClassification: "DIRECT",
          directnessConfidence: 82,
          directnessVerified: true,
        };
      },
      async listAssessments() {
        return [];
      },
    } as never,
  });

  const result = await service.discover(
    {
      leadId: "led_1",
    },
    {
      type: "user",
      id: "usr_1",
      userId: "usr_1",
      role: "AGENT",
    },
  );

  assert.equal(result.extracted, true);
  assert.equal(result.relationshipType, "DIRECT");
  assert.equal(result.directRelationshipVerified, true);
  assert.equal(result.updatedLeadScore, 81);
  assert.equal(created.length, 1);
  assert.equal(created[0]?.["relationshipType"], "DIRECT");
  assert.equal(created[0]?.["bedroomsMin"], 3);
  assert.equal(created[0]?.["bedroomsMax"], 4);
  assert.equal(created[0]?.["acceptableRadiusMiles"], 5);
});

test("prompt 21 guard skips generic company data extraction", async () => {
  const service = createDirectDemandDiscoveryService({
    repository: {
      async getLeadContext() {
        return {
          leadRow: {
            lead: {
              id: "led_2",
              summary:
                "Acme Holdings is active in London and has grown this year.",
              companyId: "co_2",
              contactId: "ctc_2",
              ownerUserId: "usr_1",
            },
          },
          leadEvidence: [],
          leadSignals: [],
          existingRequirement: null,
        };
      },
      async createRequirement() {
        throw new Error("must not create requirement");
      },
      async updateRequirement() {
        throw new Error("must not update requirement");
      },
      async applyDirectPriorityBoost() {
        throw new Error("must not boost score");
      },
    } as never,
    directnessService: {
      async assess() {
        return {
          id: "led_2",
          directnessClassification: "UNKNOWN",
          directnessConfidence: 55,
          directnessVerified: false,
        };
      },
      async listAssessments() {
        return [];
      },
    } as never,
  });

  const result = await service.discover(
    { leadId: "led_2" },
    { type: "user", id: "usr_1", userId: "usr_1", role: "AGENT" },
  );

  assert.equal(result.extracted, false);
  assert.match(result.reason ?? "", /insufficient direct demand evidence/i);
});

test("prompt 22 outreach campaign builder applies human approval default and preview", async () => {
  const service = createOutreachService({
    repository: {
      async createCampaign(input: Record<string, unknown>) {
        return {
          id: "cam_1",
          ...input,
          autonomyLevel: input["autonomyLevel"],
          approvalMode: input["approvalMode"],
          minimumScore: input["minimumScore"],
          dailyLimit: input["dailyLimit"],
          status: "draft",
          createdAt: new Date(),
          updatedAt: new Date(),
          archivedAt: null,
          launchedAt: null,
          scheduledAt: null,
        };
      },
      async previewEligibleLeads() {
        return [{ leadId: "led_1" }];
      },
      async listCampaigns() {
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
      async isGlobalLevel3Enabled() {
        return false;
      },
      async setGlobalLevel3Enabled() {
        return { id: "wct_1" };
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_1" };
      },
    } as never,
  });

  const campaign = await service.buildCampaign(
    {
      name: "Demand reach-out",
      minimumScore: 75,
    },
    { type: "user", id: "usr_1", userId: "usr_1", role: "MANAGER" },
  );

  const preview = await service.previewEligibility({ minimumScore: 75 });

  assert.equal(campaign.approvalMode, "HUMAN_APPROVAL");
  assert.equal(campaign.autonomyLevel, "LEVEL_1_HUMAN_APPROVAL");
  assert.equal(campaign.minimumScore, 75);
  assert.equal(preview.length, 1);
});

test("prompt 23 AI outreach drafting only accepts verified evidence ids", async () => {
  const service = createOutreachDraftingService({
    repository: {
      async findLeadById() {
        return { id: "led_1", summary: "Direct company demand" };
      },
      async listEvidenceByIds(ids: string[]) {
        if (ids.includes("missing")) {
          return [{ id: "evd_1", summary: "we need 3 bed homes" }];
        }

        return [
          { id: "evd_1", summary: "we need 3 bed homes" },
          { id: "evd_2", summary: "budget up to 4200" },
        ];
      },
      async createDraft(input: Record<string, unknown>) {
        return {
          id: "drf_1",
          ...input,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      async updateDraft() {
        return undefined;
      },
      async findDraftById() {
        return undefined;
      },
      async listEvidenceByLead() {
        return [];
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_1" };
      },
    } as never,
  });

  await assert.rejects(
    () =>
      service.createDraft(
        {
          leadId: "led_1",
          evidenceIds: ["evd_1", "missing"],
          provider: "openai",
          model: "gpt-test",
        },
        { type: "user", id: "usr_1", userId: "usr_1", role: "AGENT" },
      ),
    /verified evidence records/i,
  );

  const draft = await service.createDraft(
    {
      leadId: "led_1",
      evidenceIds: ["evd_1", "evd_2"],
      provider: "openai",
      model: "gpt-test",
    },
    { type: "user", id: "usr_1", userId: "usr_1", role: "AGENT" },
  );

  assert.equal(draft.status, "draft");
  assert.equal(draft.provider, "openai");
  assert.equal(draft.model, "gpt-test");
  assert.match(draft.whyThisLead, /we need 3 bed homes/i);
});

test("prompt 24 email provider adapter remains mock-only and maps status/threads", async () => {
  const adapter = createMockEmailProviderAdapter();

  const sendResult = await adapter.send({
    to: ["hello@example.com"],
    subject: "Intro",
    bodyText: "Draft body",
  });
  const synced = await adapter.syncInbox();
  const status = await adapter.getMessageStatus(sendResult.providerMessageId);

  assert.equal(adapter.providerName, "mock-email");
  assert.equal(sendResult.status, "queued");
  assert.equal(synced.synced, 1);
  assert.equal(status, "queued");
});

test("prompt 25 inbox service supports persistent assignment, snooze, drafts, links, tasks, requirements, and suppression", async () => {
  const calls: string[] = [];
  const service = createInboxService({
    repository: {
      async listConversations() {
        return [];
      },
      async getConversationById() {
        return {
          conversation: { id: "cnv_1", leadId: "led_1" },
          lead: null,
          contact: { id: "ctc_1", email: "inbox@example.com" },
          company: { id: "co_1" },
        };
      },
      async listMessages() {
        return [];
      },
      async updateConversation() {
        calls.push("category");
        return { id: "cnv_1" };
      },
      async assignConversation() {
        calls.push("assign");
        return { id: "cnv_1" };
      },
      async snoozeConversation() {
        calls.push("snooze");
        return { id: "cnv_1" };
      },
      async createReplyDraft() {
        calls.push("reply");
        return { id: "msg_1" };
      },
      async linkProperty() {
        calls.push("link_property");
        return { id: "led_1" };
      },
      async linkCompany() {
        calls.push("link_company");
        return { id: "led_1" };
      },
      async createRequirementFromConversation() {
        calls.push("requirement");
        return { id: "req_1" };
      },
      async createTaskFromConversation() {
        calls.push("task");
        return { id: "tsk_1" };
      },
      async suppressConversationContact() {
        calls.push("suppress");
        return { id: "cnv_1" };
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_1" };
      },
    } as never,
  });

  const actor = {
    type: "user" as const,
    id: "usr_1",
    userId: "usr_1",
    role: "AGENT" as const,
  };

  await service.setCategory("cnv_1", "HOT", actor);
  await service.assign("cnv_1", "usr_2", actor);
  await service.snooze("cnv_1", new Date(), actor);
  await service.saveReplyDraft("cnv_1", "reply draft", actor);
  await service.linkProperty("cnv_1", "pro_1", actor);
  await service.linkCompany("cnv_1", "co_1", actor);
  await service.createRequirement("cnv_1", "new req", actor);
  await service.createTask(
    {
      conversationId: "cnv_1",
      title: "Follow up",
    },
    actor,
  );
  await service.suppress("cnv_1", "opt_out", actor);

  assert.deepEqual(calls, [
    "category",
    "assign",
    "snooze",
    "reply",
    "link_property",
    "link_company",
    "requirement",
    "task",
    "suppress",
  ]);
});
