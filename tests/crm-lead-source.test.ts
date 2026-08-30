import assert from "node:assert/strict";
import test from "node:test";

import type {
  AuditEvent,
  Company,
  Contact,
  Lead,
  Source,
} from "../src/db/models";
import {
  createAuditService,
  type AuditCreateInput,
} from "../src/server/services/audit-event-service";
import { createCompanyContactService } from "../src/server/services/company-contact-service";
import { createLeadRoomService } from "../src/server/services/lead-room-service";
import { createSourceRegistryService } from "../src/server/services/source-registry-service";

function createAuditMemoryRepository() {
  const events: AuditEvent[] = [];

  return {
    events,
    repository: {
      async create(input: AuditCreateInput) {
        const at = input.occurredAt ?? new Date("2026-08-28T00:00:00.000Z");

        const event: AuditEvent = {
          id: input.id ?? `aud_${events.length + 1}`,
          actorType: input.actorType ?? "user",
          actorId: input.actorId,
          actorUserId: input.actorUserId ?? null,
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          occurredAt: at,
          metadata: input.metadata ?? {},
          beforeState: input.beforeState ?? null,
          afterState: input.afterState ?? null,
          requestId: input.requestId ?? null,
          createdAt: at,
          updatedAt: at,
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

function omitUndefined<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

test("company/contact CRM exposes duplicate and suppression indicators with audit", async () => {
  const store = createAuditMemoryRepository();
  const actor = {
    type: "user" as const,
    id: "usr_manager",
    userId: "usr_manager",
    role: "MANAGER" as const,
  };

  const companyA: Company = {
    id: "co_1",
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    archivedAt: null,
    ownerUserId: "usr_manager",
    name: "PQ Estates",
    legalName: "PQ Estates Ltd",
    tradingName: "PQ Estates",
    companyNumber: "12345678",
    slug: "pq-estates-ltd",
    companyType: "landlord",
    locations: "London",
    status: "active",
    website: "https://example.com",
    notes: null,
  };

  const companyB = {
    ...companyA,
    id: "co_2",
    slug: "pq-estates-ltd-2",
  };

  const contact: Contact = {
    id: "ctc_1",
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    archivedAt: null,
    companyId: "co_1",
    ownerUserId: "usr_manager",
    firstName: "Alex",
    lastName: "Owner",
    roleTitle: "Director",
    email: "alex@example.com",
    phone: null,
    source: "manual",
    confidence: 70,
    suppressionStatus: "clear",
    decisionMakerEvidence: null,
    status: "active",
    preferredChannel: null,
    notes: null,
  };

  const service = createCompanyContactService({
    auditService: createAuditService({ repository: store.repository }),
    repository: {
      async createCompany() {
        return companyA;
      },
      async updateCompany() {
        return companyA;
      },
      async findCompanyById() {
        return companyA;
      },
      async archiveCompany() {
        return { ...companyA, status: "archived", archivedAt: new Date() };
      },
      async listCompanies() {
        return [
          { ...companyA, contactCount: 1 },
          { ...companyB, contactCount: 0 },
        ];
      },
      async findCompanyDuplicates() {
        return [companyB];
      },
      async createContact() {
        return contact;
      },
      async updateContact() {
        return contact;
      },
      async findContactById() {
        return contact;
      },
      async archiveContact() {
        return { ...contact, status: "archived", archivedAt: new Date() };
      },
      async listContacts() {
        return [{ contact, companyName: companyA.name }];
      },
      async findContactDuplicates() {
        return [];
      },
      async listSuppressionMatches() {
        return new Set<string>(["ctc_1"]);
      },
    },
  });

  const companies = await service.listCompanies("pq");
  const contacts = await service.listContacts({ search: "alex" });

  assert.equal(companies[0]?.duplicateWarning, true);
  assert.equal(contacts[0]?.suppressionStatus, "suppressed");
  assert.equal(contacts[0]?.contactability, "suppressed");

  await service.createCompany(
    {
      legalName: "PQ Estates Ltd",
      status: "active",
    },
    actor,
  );
  await service.createContact(
    {
      firstName: "Alex",
      lastName: "Owner",
      confidence: 70,
      suppressionStatus: "clear",
      status: "active",
    },
    actor,
  );

  assert.deepEqual(
    store.events.map((event) => event.action),
    ["company.created", "contact.created"],
  );
});

test("lead room transitions are persisted and audited", async () => {
  const store = createAuditMemoryRepository();
  const actor = {
    type: "user" as const,
    id: "usr_agent",
    userId: "usr_agent",
    role: "AGENT" as const,
  };

  let currentLead: Lead = {
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
    status: "new",
    score: 22,
    confidence: 55,
    nextAction: null,
    outreachStatus: "not_started",
    scoreVersion: null,
    lastScoredAt: null,
    directnessClassification: "DIRECT",
    directnessConfidence: 82,
    directnessVerified: true,
    summary: null,
    receivedAt: null,
  };

  const service = createLeadRoomService({
    auditService: createAuditService({ repository: store.repository }),
    repository: {
      async createLead(input) {
        return {
          ...currentLead,
          ...omitUndefined(input),
          id: input.id ?? "led_1",
          archivedAt: input.archivedAt ?? currentLead.archivedAt,
          status: input.status ?? currentLead.status,
          sourceId: input.sourceId,
          companyId: input.companyId ?? currentLead.companyId,
          contactId: input.contactId ?? currentLead.contactId,
          propertyId: input.propertyId ?? currentLead.propertyId,
          ownerUserId: input.ownerUserId ?? currentLead.ownerUserId,
          leadType: input.leadType ?? currentLead.leadType,
          score: input.score ?? currentLead.score,
          confidence: input.confidence ?? currentLead.confidence,
          nextAction: input.nextAction ?? currentLead.nextAction,
          outreachStatus: input.outreachStatus ?? currentLead.outreachStatus,
          scoreVersion: input.scoreVersion ?? currentLead.scoreVersion,
          lastScoredAt: input.lastScoredAt ?? currentLead.lastScoredAt,
          directnessClassification:
            input.directnessClassification ?? currentLead.directnessClassification,
          directnessConfidence:
            input.directnessConfidence ?? currentLead.directnessConfidence,
          directnessVerified:
            input.directnessVerified ?? currentLead.directnessVerified,
          createdAt: currentLead.createdAt,
          summary: input.summary ?? currentLead.summary,
          receivedAt: input.receivedAt ?? currentLead.receivedAt,
        } satisfies Lead;
      },
      async updateLead(_id, input) {
        currentLead = {
          ...currentLead,
          ...omitUndefined(input),
          createdAt: currentLead.createdAt,
          archivedAt: input.archivedAt ?? currentLead.archivedAt,
          status: input.status ?? currentLead.status,
          sourceId: input.sourceId ?? currentLead.sourceId,
          companyId: input.companyId ?? currentLead.companyId,
          contactId: input.contactId ?? currentLead.contactId,
          propertyId: input.propertyId ?? currentLead.propertyId,
          ownerUserId: input.ownerUserId ?? currentLead.ownerUserId,
          leadType: input.leadType ?? currentLead.leadType,
          score: input.score ?? currentLead.score,
          confidence: input.confidence ?? currentLead.confidence,
          nextAction: input.nextAction ?? currentLead.nextAction,
          outreachStatus: input.outreachStatus ?? currentLead.outreachStatus,
          scoreVersion: input.scoreVersion ?? currentLead.scoreVersion,
          lastScoredAt: input.lastScoredAt ?? currentLead.lastScoredAt,
          directnessClassification:
            input.directnessClassification ?? currentLead.directnessClassification,
          directnessConfidence:
            input.directnessConfidence ?? currentLead.directnessConfidence,
          directnessVerified:
            input.directnessVerified ?? currentLead.directnessVerified,
          summary: input.summary ?? currentLead.summary,
          receivedAt: input.receivedAt ?? currentLead.receivedAt,
          updatedAt: new Date(),
        };

        return currentLead;
      },
      async findLeadById() {
        return currentLead;
      },
      async listLeads() {
        return [
          {
            lead: currentLead,
            sourceName: "Registry",
            companyName: null,
            contactName: null,
            propertyTitle: null,
            evidenceCount: 3,
            lastSignalAt: new Date("2026-08-28T01:00:00.000Z"),
          },
        ];
      },
      async getLeadDrawer() {
        return {
          leadRow: {
            lead: currentLead,
            sourceName: "Registry",
            sourceKind: "manual" as const,
            sourceConnectorKey: "manual.crm",
            companyName: null,
            contactFirstName: "Alex",
            contactLastName: "Owner",
            propertyTitle: null,
          },
          leadSignals: [],
          leadEvidence: [],
          supportedConclusionCount: 0,
        };
      },
      async archiveLead() {
        return { ...currentLead, status: "archived", archivedAt: new Date() };
      },
    },
  });

  const list = await service.listView("supply", "");
  assert.equal(list[0]?.evidenceCount, 3);

  await service.transitionStatus("led_1", "researching", actor);
  await service.transitionStatus("led_1", "qualified", actor);

  assert.equal(currentLead.status, "qualified");
  assert.deepEqual(
    store.events.map((event) => event.action),
    ["lead.status.transitioned", "lead.status.transitioned"],
  );
});

test("source registry blocks non-approved jobs and supports immediate disable", async () => {
  const store = createAuditMemoryRepository();
  const actor = {
    type: "user" as const,
    id: "usr_admin",
    userId: "usr_admin",
    role: "ADMIN" as const,
  };

  let source: Source = {
    id: "src_1",
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    archivedAt: null,
    createdByUserId: "usr_admin",
    name: "Portal Feed",
    kind: "portal",
    status: "active",
    connectorKey: "portal.feed",
    permissionStatus: "BLOCKED",
    allowedData: "listings",
    rateLimitPerMinute: 30,
    enabled: true,
    lastScannedAt: null,
    health: "degraded",
    notes: null,
    config: {},
    lastIngestedAt: null,
  };

  const service = createSourceRegistryService({
    auditService: createAuditService({ repository: store.repository }),
    repository: {
      async createSource() {
        return source;
      },
      async updateSource(_id, input) {
        source = {
          ...source,
          ...omitUndefined(input),
          createdByUserId: input.createdByUserId ?? source.createdByUserId,
          createdAt: source.createdAt,
          archivedAt: input.archivedAt ?? source.archivedAt,
          status: input.status ?? source.status,
          connectorKey: input.connectorKey ?? source.connectorKey,
          permissionStatus: input.permissionStatus ?? source.permissionStatus,
          allowedData: input.allowedData ?? source.allowedData,
          rateLimitPerMinute:
            input.rateLimitPerMinute ?? source.rateLimitPerMinute,
          enabled: input.enabled ?? source.enabled,
          lastScannedAt: input.lastScannedAt ?? source.lastScannedAt,
          health: input.health ?? source.health,
          notes: input.notes ?? source.notes,
          config: input.config ?? source.config,
          lastIngestedAt: input.lastIngestedAt ?? source.lastIngestedAt,
          updatedAt: new Date(),
        };

        return source;
      },
      async findSourceById() {
        return source;
      },
      async archiveSource() {
        return { ...source, status: "archived", permissionStatus: "DISABLED" };
      },
      async listSources() {
        return [source];
      },
      async findDuplicates() {
        return [];
      },
    },
  });

  await assert.rejects(() => service.assertSourceJobAllowed("src_1"));

  source = { ...source, permissionStatus: "APPROVED" };
  await assert.doesNotReject(() => service.assertSourceJobAllowed("src_1"));

  await service.disableSourceImmediately("src_1", actor);
  assert.equal(source.enabled, false);
  assert.equal(source.permissionStatus, "DISABLED");
  assert.equal(store.events.at(-1)?.action, "source.disabled");
});
