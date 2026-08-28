import { getDatabaseConfig } from "@/db/config";
import type { AuditEvent, NewAuditEvent } from "@/db/models";
import type { AuditEventInput } from "@/domain/audit/types";
import type { CurrentUser } from "@/domain/auth/types";
import { appEnv } from "@/lib/env";
import { requirePermission } from "@/server/auth/rbac";
import { createRepositories } from "@/server/repositories";

type SanitizedValue =
  | string
  | number
  | boolean
  | null
  | SanitizedValue[]
  | { [key: string]: SanitizedValue };

export type AuditCreateInput = Omit<
  NewAuditEvent,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

export type AuditRepositoryLike = {
  create: (input: AuditCreateInput) => Promise<AuditEvent>;
  listRecent: (query?: {
    entityType?: string;
    entityId?: string;
    limit?: number;
  }) => Promise<AuditEvent[]>;
};

type AuditServiceDependencies = {
  repository?: AuditRepositoryLike;
  now?: () => Date;
};

const sensitiveKeyPattern =
  /(secret|token|password|authorization|cookie|api[-_]?key|session)/i;

function sanitizeValue(value: unknown, key = "", depth = 0): SanitizedValue {
  if (depth > 4) {
    return "[truncated]";
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (sensitiveKeyPattern.test(key)) {
    return "[redacted]";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([entryKey, entryValue]) =>
        [entryKey, sanitizeValue(entryValue, entryKey, depth + 1)] as const,
    );

    return Object.fromEntries(entries);
  }

  if (typeof value === "string") {
    return value.length > 400 ? `${value.slice(0, 397)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return String(value);
}

function sanitizeRecord(
  value: Record<string, unknown> | undefined,
): Record<string, SanitizedValue> | undefined {
  if (!value) {
    return undefined;
  }

  return sanitizeValue(value) as Record<string, SanitizedValue>;
}

function getRepository(repository?: AuditRepositoryLike): AuditRepositoryLike {
  if (repository) {
    return repository;
  }

  const database = getDatabaseConfig(appEnv);

  if (!database.configured) {
    throw new Error(
      "DATABASE_URL is required before audit events can be persisted.",
    );
  }

  return createRepositories().auditEvents;
}

export function createAuditService(
  dependencies: AuditServiceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const now = dependencies.now ?? (() => new Date());

  return {
    async recordEvent(input: AuditEventInput): Promise<AuditEvent> {
      return repository.create({
        actorType: input.actor.type,
        actorId: input.actor.id,
        actorUserId: input.actor.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        occurredAt: input.occurredAt ?? now(),
        metadata: sanitizeRecord(input.metadata) ?? {},
        beforeState: sanitizeRecord(input.beforeState),
        afterState: sanitizeRecord(input.afterState),
        requestId: input.requestId,
      });
    },

    async listRecent(options?: {
      entityType?: string;
      entityId?: string;
      limit?: number;
    }) {
      return repository.listRecent(options);
    },

    assertCanManageHistory(user: CurrentUser | null | undefined) {
      return requirePermission(user, "manageAuditHistory");
    },
  };
}
