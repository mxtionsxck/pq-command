import assert from "node:assert/strict";
import test from "node:test";

import type { AuditEvent } from "../src/db/models";
import { AuthorizationError } from "../src/server/auth/rbac";
import {
  createAuditService,
  type AuditCreateInput,
} from "../src/server/services/audit-event-service";

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

test("audit service redacts sensitive payloads before persistence", async () => {
  const store = createAuditMemoryRepository();
  const auditService = createAuditService({
    now: () => new Date("2026-08-28T00:00:00.000Z"),
    repository: store.repository,
  });

  await auditService.recordEvent({
    actor: {
      type: "user",
      id: "usr_admin",
      userId: "usr_admin",
    },
    action: "property.created",
    entityType: "property",
    entityId: "prp_1",
    metadata: {
      password: "hidden",
      authToken: "secret-token",
      safe: "visible",
    },
  });

  assert.equal(store.events.length, 1);
  assert.equal(store.events[0]?.metadata["password"], "[redacted]");
  assert.equal(store.events[0]?.metadata["authToken"], "[redacted]");
  assert.equal(store.events[0]?.metadata["safe"], "visible");
});

test("agents cannot manage audit history", () => {
  const store = createAuditMemoryRepository();
  const auditService = createAuditService({ repository: store.repository });

  assert.throws(
    () =>
      auditService.assertCanManageHistory({
        id: "usr_agent",
        email: "agent@pqrealestate.example",
        name: "Agent",
        image: null,
        role: "AGENT",
      }),
    AuthorizationError,
  );
});

test("audit service does not crash when database is absent", async () => {
  const auditService = createAuditService();

  await assert.doesNotReject(() =>
    auditService.recordEvent({
      actor: {
        type: "user",
        id: "usr_admin",
        userId: "usr_admin",
      },
      action: "page.viewed",
      entityType: "page",
      entityId: "/internal/hotel-deals",
      metadata: { ok: true },
    }),
  );
});
