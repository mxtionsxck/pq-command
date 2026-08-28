import { and, desc, eq } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import type { AuditEvent, NewAuditEvent } from "@/db/models";
import { auditEvents } from "@/db/schema";

type NewAuditEventInput = Omit<
  NewAuditEvent,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  limit?: number;
}

export function createAuditRepository(db: PQCommandDb) {
  return {
    async create(input: NewAuditEventInput): Promise<AuditEvent> {
      const [event] = await db
        .insert(auditEvents)
        .values({
          ...input,
          id: input.id ?? createEntityId("aud"),
        })
        .returning();

      if (!event) {
        throw new Error("Failed to persist audit event.");
      }

      return event;
    },

    async listRecent(query: AuditQuery = {}): Promise<AuditEvent[]> {
      const conditions = [
        query.entityType
          ? eq(auditEvents.entityType, query.entityType)
          : undefined,
        query.entityId ? eq(auditEvents.entityId, query.entityId) : undefined,
      ].filter(Boolean);

      return db
        .select()
        .from(auditEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.createdAt))
        .limit(query.limit ?? 100);
    },
  };
}

export type AuditRepository = ReturnType<typeof createAuditRepository>;
