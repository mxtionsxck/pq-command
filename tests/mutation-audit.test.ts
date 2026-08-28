import assert from "node:assert/strict";
import test from "node:test";

import type {
  AuditEvent,
  Lead,
  NewLead,
  NewOutreachCampaign,
  NewProperty,
  OutreachCampaign,
  Property,
} from "../src/db/models";
import {
  createAuditService,
  type AuditCreateInput,
} from "../src/server/services/audit-event-service";
import { createLeadService } from "../src/server/services/lead-service";
import { createOutreachService } from "../src/server/services/outreach-service";
import { createPropertyService } from "../src/server/services/property-service";

function createAuditMemoryRepository() {
  const events: AuditEvent[] = [];

  return {
    events,
    repository: {
      async create(input: AuditCreateInput) {
        const actorType = input.actorType ?? "user";
        const occurredAt =
          input.occurredAt ?? new Date("2026-08-28T00:00:00.000Z");

        const event: AuditEvent = {
          id: input.id ?? `aud_${events.length + 1}`,
          actorType,
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
  };
}

test("property mutations generate audit events", async () => {
  const store = createAuditMemoryRepository();
  const auditService = createAuditService({
    repository: store.repository,
    now: () => new Date("2026-08-28T00:00:00.000Z"),
  });
  let property: Property | undefined;

  const propertyService = createPropertyService({
    auditService,
    repository: {
      async createWithDefaults(
        input: Omit<NewProperty, "id" | "createdAt" | "updatedAt"> & {
          id?: string;
        },
      ) {
        property = {
          id: input.id ?? "prp_1",
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          updatedAt: new Date("2026-08-28T00:00:00.000Z"),
          archivedAt: null,
          companyId: input.companyId ?? null,
          createdByUserId: input.createdByUserId ?? null,
          sourceId: input.sourceId ?? null,
          title: input.title,
          status: input.status ?? "draft",
          borough: input.borough ?? null,
          propertyType: input.propertyType ?? "other",
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          city: input.city,
          postcode: input.postcode,
          bedrooms: input.bedrooms ?? null,
          bathrooms: input.bathrooms ?? null,
          furnished: input.furnished ?? false,
          parking: input.parking ?? false,
          garden: input.garden ?? false,
          monthlyRentCents: input.monthlyRentCents ?? null,
          depositCents: input.depositCents ?? null,
          termMonths: input.termMonths ?? null,
          availability: input.availability ?? "available_now",
          availableFrom: input.availableFrom ?? null,
          billsSummary: input.billsSummary ?? null,
          companyLetFit: input.companyLetFit ?? "review",
          summary: input.summary ?? null,
        };

        return property;
      },
      async findById() {
        return property;
      },
      async listStockRoom() {
        return [];
      },
      async updateById(id, input) {
        property = {
          ...(property as Property),
          ...Object.fromEntries(
            Object.entries(input).filter(([, value]) => value !== undefined),
          ),
          id,
          updatedAt: new Date("2026-08-28T00:01:00.000Z"),
        } as Property;

        return property;
      },
      async archiveById(id) {
        property = {
          ...(property as Property),
          id,
          status: "archived",
          archivedAt: new Date("2026-08-28T00:02:00.000Z"),
          updatedAt: new Date("2026-08-28T00:02:00.000Z"),
        };

        return property;
      },
    },
  });

  const actor = {
    type: "user" as const,
    id: "usr_manager",
    userId: "usr_manager",
    role: "MANAGER" as const,
  };

  await propertyService.createProperty(
    {
      title: "Alpha House",
      addressLine1: "1 Alpha Street",
      city: "London",
      postcode: "E1 1AA",
      propertyType: "house",
      furnished: true,
      parking: false,
      garden: true,
      availability: "available_now",
      companyLetFit: "ideal",
      status: "active",
    },
    actor,
  );
  await propertyService.updateProperty(
    "prp_1",
    { monthlyRentCents: 325000 },
    actor,
  );
  await propertyService.archiveProperty("prp_1", actor);

  assert.deepEqual(
    store.events.map((event) => event.action),
    ["property.created", "property.updated", "property.archived"],
  );
});

test("lead and outreach mutations generate audit events", async () => {
  const store = createAuditMemoryRepository();
  const auditService = createAuditService({
    repository: store.repository,
    now: () => new Date("2026-08-28T00:00:00.000Z"),
  });

  const leadService = createLeadService({
    auditService,
    repository: {
      async create(input: NewLead): Promise<Lead> {
        return {
          id: input.id ?? "led_1",
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          updatedAt: new Date("2026-08-28T00:00:00.000Z"),
          archivedAt: null,
          sourceId: input.sourceId,
          companyId: input.companyId ?? null,
          contactId: input.contactId ?? null,
          propertyId: input.propertyId ?? null,
          ownerUserId: input.ownerUserId ?? null,
          leadType: input.leadType ?? "supply",
          status: input.status ?? "new",
          score: input.score ?? 0,
          confidence: input.confidence ?? 50,
          nextAction: input.nextAction ?? null,
          outreachStatus: input.outreachStatus ?? "not_started",
          scoreVersion: input.scoreVersion ?? null,
          lastScoredAt: input.lastScoredAt ?? null,
          directnessClassification: input.directnessClassification ?? "UNKNOWN",
          directnessConfidence: input.directnessConfidence ?? 50,
          directnessVerified: input.directnessVerified ?? false,
          summary: input.summary ?? null,
          receivedAt: input.receivedAt ?? null,
        };
      },
    },
  });

  const outreachService = createOutreachService({
    auditService,
    repository: {
      async create(input: NewOutreachCampaign): Promise<OutreachCampaign> {
        return {
          id: input.id ?? "cam_1",
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          updatedAt: new Date("2026-08-28T00:00:00.000Z"),
          archivedAt: null,
          ownerUserId: input.ownerUserId ?? null,
          sourceId: input.sourceId ?? null,
          name: input.name,
          channel: input.channel ?? "email",
          status: input.status ?? "draft",
          objective: input.objective ?? null,
          audience: input.audience ?? null,
          minimumScore: input.minimumScore ?? 0,
          location: input.location ?? null,
          bedroomsMin: input.bedroomsMin ?? null,
          bedroomsMax: input.bedroomsMax ?? null,
          unitCountMin: input.unitCountMin ?? null,
          startHour: input.startHour ?? null,
          endHour: input.endHour ?? null,
          weekdayRules: input.weekdayRules ?? [],
          dailyLimit: input.dailyLimit ?? 25,
          sequenceSteps: input.sequenceSteps ?? [],
          approvalMode: input.approvalMode ?? "HUMAN_APPROVAL",
          autonomyLevel: input.autonomyLevel ?? "LEVEL_1_HUMAN_APPROVAL",
          suppressionPolicy:
            input.suppressionPolicy ?? "respect_global_suppression",
          active: input.active ?? false,
          scheduledAt: input.scheduledAt ?? null,
          launchedAt: input.launchedAt ?? null,
        };
      },
    },
  });

  const actor = {
    type: "user" as const,
    id: "usr_manager",
    userId: "usr_manager",
    role: "MANAGER" as const,
  };

  await leadService.createLead(
    {
      id: "led_1",
      sourceId: "src_1",
      status: "new",
      score: 12,
    },
    actor,
  );

  await outreachService.createCampaign(
    {
      id: "cam_1",
      name: "Mayfair shortlist",
      channel: "email",
      status: "draft",
    },
    actor,
  );

  assert.deepEqual(
    store.events.map((event) => event.action),
    ["lead.created", "outreach.campaign.created"],
  );
});
