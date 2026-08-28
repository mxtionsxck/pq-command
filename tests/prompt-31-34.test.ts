import assert from "node:assert/strict";
import test from "node:test";

import { createDealRoomService } from "../src/server/services/deal-room-service";
import { createEconomicsSignalService } from "../src/server/services/economics-signal-service";
import { createShortageIntelligenceService } from "../src/server/services/shortage-intelligence-service";
import { createViewingWorkflowService } from "../src/server/services/viewing-workflow-service";

const managerActor = {
  type: "user" as const,
  id: "usr_1",
  userId: "usr_1",
  role: "MANAGER" as const,
};

const agentActor = {
  type: "user" as const,
  id: "usr_2",
  userId: "usr_2",
  role: "AGENT" as const,
};

test("prompt 31 shortage intelligence computes traceable gap rows and converts to sourcing targets", async () => {
  const stored: Array<{ trace: Record<string, unknown>; estimatedGap: number }> = [];

  const service = createShortageIntelligenceService({
    repository: {
      async listActiveDemandRequirements() {
        return [
          {
            id: "req_1",
            preferredArea: "London",
            bedroomsMin: 2,
            bedroomsMax: 3,
            unitCount: 3,
            budgetMinCents: 250000,
            budgetMaxCents: 350000,
            startDate: new Date("2026-09-05"),
          },
          {
            id: "req_2",
            preferredArea: "London",
            bedroomsMin: 2,
            bedroomsMax: 3,
            unitCount: 3,
            budgetMinCents: 250000,
            budgetMaxCents: 350000,
            startDate: new Date("2026-09-05"),
          },
        ];
      },
      async listSuitableStock() {
        return [
          {
            id: "prp_1",
            borough: null,
            city: "London",
            bedrooms: 2,
            monthlyRentCents: 260000,
            availability: "available_now",
            availableFrom: null,
          },
        ];
      },
      async upsertShortageRow(input: {
        estimatedGap: number;
        trace: Record<string, unknown>;
      }) {
        stored.push({ trace: input.trace, estimatedGap: input.estimatedGap });
        return {
          id: "shr_1",
          borough: null,
          area: "London",
          bedroomsBand: "2-3",
          unitCountBand: "2-3",
          budgetBand: "2500_3500",
          availabilityWindow: "within_30_days",
          activeDemand: 2,
          suitableStock: 1,
          estimatedGap: input.estimatedGap,
          priority: "LOW" as const,
          trace: input.trace,
        };
      },
      async listShortageRows() {
        return [];
      },
      async getShortageById() {
        return {
          id: "shr_1",
          area: "London",
          borough: null,
          bedroomsBand: "2-3",
          unitCountBand: "2-3",
          budgetBand: "2500_3500",
          availabilityWindow: "within_30_days",
          estimatedGap: 1,
          activeDemand: 2,
          suitableStock: 1,
        };
      },
      async createObjectiveFromShortage() {
        return { id: "obj_1" };
      },
      async createCampaignTarget() {
        return { id: "cam_1" };
      },
      async markShortageConverted() {
        return { id: "shr_1" };
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_1" };
      },
    } as never,
  });

  const rows = await service.recalculate({ area: "London" }, managerActor);
  assert.equal(rows.length > 0, true);
  assert.equal(stored[0]?.estimatedGap, 2);
  assert.equal(Array.isArray(stored[0]?.trace["demandRequirementIds"]), true);
  assert.equal(Array.isArray(stored[0]?.trace["stockPropertyIds"]), true);

  const conversion = await service.convertToTarget(
    {
      shortageId: "shr_1",
      createObjective: true,
      createCampaignTarget: true,
    },
    managerActor,
  );

  assert.equal(conversion.objectiveId, "obj_1");
  assert.equal(conversion.campaignId, "cam_1");
});

test("prompt 32 economics signal stores provenance, computes difference, and optional notification", async () => {
  let notificationCalled = false;

  const service = createEconomicsSignalService({
    repository: {
      async createLhaRate() {
        return { id: "lha_1" };
      },
      async getProperty() {
        return {
          id: "prp_1",
          title: "Flat 1",
          borough: "Tower Hamlets",
          city: "London",
          bedrooms: 2,
          monthlyRentCents: 220000,
        };
      },
      async findLhaRate() {
        return {
          id: "lha_1",
          monthlyRateCents: 260000,
          sourceApproved: true,
          rateVersion: "2026-Q3",
        };
      },
      async upsertEconomicsSignal(input: { differenceCents: number }) {
        return { id: "eco_1", differenceCents: input.differenceCents };
      },
      async createNotification() {
        notificationCalled = true;
        return { id: "ntf_1" };
      },
      async listSignals() {
        return [];
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_2" };
      },
    } as never,
  });

  await service.addLhaRate(
    {
      area: "London",
      bedroomBand: "2",
      monthlyRateCents: 260000,
      rateSource: "Approved bulletin",
      rateReference: "https://example.test/rates",
      rateDate: new Date("2026-08-01"),
      rateVersion: "2026-Q3",
      sourceApproved: true,
    },
    managerActor,
  );

  const result = await service.evaluateProperty(
    {
      propertyId: "prp_1",
      notifyManagerUserId: "usr_1",
      notifyEnabled: true,
    },
    managerActor,
  );

  assert.equal(result.signal?.differenceCents, 40000);
  assert.equal(notificationCalled, true);
});

test("prompt 33 viewing lifecycle supports brief, reminders, outcomes, and task creation", async () => {
  let taskCreated = false;

  const service = createViewingWorkflowService({
    repository: {
      async createViewing() {
        return {
          id: "viw_1",
          notes: "Brief notes",
          attendees: [{ name: "Alex" }],
        };
      },
      async listViewings() {
        return [];
      },
      async getViewingById() {
        return {
          viewing: {
            id: "viw_1",
            notes: "Brief notes",
            attendees: [{ name: "Alex" }],
            scheduledFor: new Date("2026-09-01T10:00:00.000Z"),
          },
          property: { id: "prp_1", title: "Flat 1" },
          requirement: { id: "req_1" },
          company: { id: "co_1", name: "PQ Client" },
          contact: { id: "ctc_1" },
        };
      },
      async updateViewing() {
        return { id: "viw_1" };
      },
      async createReminder() {
        return { id: "ntf_1" };
      },
      async createTask() {
        taskCreated = true;
        return { id: "tsk_1" };
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_3" };
      },
    } as never,
  });

  const created = await service.scheduleViewing(
    {
      propertyId: "prp_1",
      scheduledFor: new Date("2026-09-01T10:00:00.000Z"),
      attendeesRaw: "Alex, Sam",
    },
    agentActor,
  );
  assert.equal(created?.id, "viw_1");

  const brief = await service.getViewingBrief("viw_1");
  assert.equal(brief?.property?.id, "prp_1");

  await service.createReminder(
    {
      viewingId: "viw_1",
      userId: "usr_2",
    },
    agentActor,
  );

  await service.saveOutcome(
    {
      viewingId: "viw_1",
      outcome: "Positive viewing",
      nextAction: "Prepare offer",
      createTask: true,
      taskAssigneeUserId: "usr_2",
    },
    agentActor,
  );

  assert.equal(taskCreated, true);
});

test("prompt 33 commercial notes edit blocked for non-authorized role", async () => {
  const service = createViewingWorkflowService({
    repository: {
      async createViewing() {
        return { id: "viw_1" };
      },
      async listViewings() {
        return [];
      },
      async getViewingById() {
        return {
          viewing: {
            id: "viw_1",
            notes: null,
            attendees: [],
            scheduledFor: new Date("2026-09-01T10:00:00.000Z"),
          },
          property: { id: "prp_1", title: "Flat 1" },
          requirement: null,
          company: null,
          contact: null,
        };
      },
      async updateViewing() {
        return { id: "viw_1" };
      },
      async createReminder() {
        return { id: "ntf_1" };
      },
      async createTask() {
        return { id: "tsk_1" };
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_4" };
      },
    } as never,
  });

  await assert.rejects(
    () =>
      service.saveOutcome(
        {
          viewingId: "viw_1",
          outcome: "test",
          commercialNotes: "secret",
          createTask: false,
        },
        agentActor,
      ),
    /only authorised agents can edit commercial notes/i,
  );
});

test("prompt 34 deal room validates transitions and exposes room details", async () => {
  const audits: string[] = [];

  const service = createDealRoomService({
    repository: {
      async listDeals() {
        return [];
      },
      async createDeal() {
        return { id: "del_1", status: "MATCHED" };
      },
      async findDealById() {
        return { id: "del_1", status: "MATCHED" };
      },
      async updateDeal(_dealId: string, patch: { status?: string }) {
        return { id: "del_1", status: patch.status ?? "MATCHED" };
      },
      async listDealTimeline() {
        return [{ id: "aud_1" }];
      },
      async listDealTasks() {
        return [{ id: "tsk_1" }];
      },
      async listDealDocuments() {
        return [{ id: "doc_1" }];
      },
      async createDealTask() {
        return { id: "tsk_2" };
      },
    } as never,
    auditService: {
      async recordEvent(input: { action: string }) {
        audits.push(input.action);
        return { id: "aud_x" };
      },
    } as never,
  });

  const created = await service.createDeal(
    {
      companyId: "co_1",
      propertyId: "prp_1",
      requirementId: "req_1",
      blockersRaw: "Awaiting docs",
    },
    managerActor,
  );
  assert.equal(created?.status, "MATCHED");

  const transitioned = await service.transitionStage(
    {
      dealId: "del_1",
      toStage: "VIEWING",
    },
    managerActor,
  );
  assert.equal(transitioned?.status, "VIEWING");

  await assert.rejects(
    () =>
      service.transitionStage(
        {
          dealId: "del_1",
          toStage: "CONTRACT",
        },
        managerActor,
      ),
    /invalid stage transition/i,
  );

  const room = await service.getDealRoom("del_1");
  assert.equal(room?.timeline.length, 1);
  assert.equal(room?.tasks.length, 1);
  assert.equal(room?.documents.length, 1);
  assert.equal(audits.includes("deal.stage.transitioned"), true);
});
