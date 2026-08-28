import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { Source } from "@/db/models";
import type { AuditActor } from "@/domain/audit/types";
import type { SourceRegistryMutationInput } from "@/domain/source/types";
import { appEnv } from "@/lib/env";
import { canManageSources } from "@/server/auth/rbac";
import { createSourceRegistryRepository } from "@/server/repositories/source-registry-repository";

import { createAuditService } from "./audit-event-service";

type SourceRegistryRepositoryLike = ReturnType<
  typeof createSourceRegistryRepository
>;

type SourceRegistryServiceDependencies = {
  repository?: SourceRegistryRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function getRepository(repository?: SourceRegistryRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createSourceRegistryRepository(getDb());
}

function ensureSourceAccess(
  actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
) {
  if (actor.role && !canManageSources(actor.role)) {
    throw new Error("Only managers and admins can mutate sources.");
  }
}

function cleanOptional(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export function createSourceRegistryService(
  dependencies: SourceRegistryServiceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const getAuditService = () =>
    dependencies.auditService ?? createAuditService();

  return {
    async listSources(search?: string) {
      if (!repository) {
        return [];
      }

      const rows = await repository.listSources(search ? { search } : {});

      return rows.map((row) => ({
        ...row,
        duplicateWarning: false,
      }));
    },

    async createSource(
      input: SourceRegistryMutationInput,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<{ source: Source; duplicateCount: number }> {
      ensureSourceAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before sources can be managed.",
        );
      }

      const duplicates = await repository.findDuplicates({
        name: input.name,
        ...(input.connectorKey ? { connectorKey: input.connectorKey } : {}),
      });

      const source = await repository.createSource({
        createdByUserId: actor.userId,
        name: input.name,
        kind: input.kind,
        status: input.enabled ? "active" : "paused",
        connectorKey: cleanOptional(input.connectorKey),
        permissionStatus: input.permissionStatus,
        allowedData: cleanOptional(input.allowedData),
        rateLimitPerMinute: input.rateLimitPerMinute,
        enabled: input.enabled,
        health: input.health,
        notes: cleanOptional(input.notes),
        config: input.config ?? {},
      });

      await getAuditService().recordEvent({
        actor,
        action: "source.created",
        entityType: "source",
        entityId: source.id,
        metadata: {
          permissionStatus: source.permissionStatus,
          duplicateCount: duplicates.length,
        },
        afterState: {
          enabled: source.enabled,
          health: source.health,
        },
      });

      return {
        source,
        duplicateCount: duplicates.length,
      };
    },

    async updateSource(
      sourceId: string,
      input: Partial<SourceRegistryMutationInput>,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureSourceAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before sources can be managed.",
        );
      }

      const before = await repository.findSourceById(sourceId);

      if (!before) {
        return undefined;
      }

      const duplicates =
        input.name !== undefined
          ? await repository.findDuplicates({
              name: input.name,
              ...(input.connectorKey
                ? { connectorKey: input.connectorKey }
                : {}),
              excludeId: sourceId,
            })
          : [];

      const updated = await repository.updateSource(sourceId, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.connectorKey !== undefined
          ? { connectorKey: cleanOptional(input.connectorKey) }
          : {}),
        ...(input.permissionStatus !== undefined
          ? { permissionStatus: input.permissionStatus }
          : {}),
        ...(input.allowedData !== undefined
          ? { allowedData: cleanOptional(input.allowedData) }
          : {}),
        ...(input.rateLimitPerMinute !== undefined
          ? { rateLimitPerMinute: input.rateLimitPerMinute }
          : {}),
        ...(input.enabled !== undefined
          ? {
              enabled: input.enabled,
              status: input.enabled ? "active" : "paused",
            }
          : {}),
        ...(input.health !== undefined ? { health: input.health } : {}),
        ...(input.notes !== undefined
          ? { notes: cleanOptional(input.notes) }
          : {}),
        ...(input.config !== undefined ? { config: input.config } : {}),
      });

      if (!updated) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "source.updated",
        entityType: "source",
        entityId: updated.id,
        metadata: {
          changedFields: Object.keys(input),
          duplicateCount: duplicates.length,
        },
        beforeState: {
          permissionStatus: before.permissionStatus,
          enabled: before.enabled,
          health: before.health,
        },
        afterState: {
          permissionStatus: updated.permissionStatus,
          enabled: updated.enabled,
          health: updated.health,
        },
      });

      return {
        source: updated,
        duplicateCount: duplicates.length,
      };
    },

    async archiveSource(
      sourceId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureSourceAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before sources can be managed.",
        );
      }

      const before = await repository.findSourceById(sourceId);

      if (!before) {
        return undefined;
      }

      const archived = await repository.archiveSource(sourceId);

      if (!archived) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "source.archived",
        entityType: "source",
        entityId: archived.id,
        metadata: {
          name: archived.name,
        },
        beforeState: {
          status: before.status,
          permissionStatus: before.permissionStatus,
          enabled: before.enabled,
        },
        afterState: {
          status: archived.status,
          permissionStatus: archived.permissionStatus,
          enabled: archived.enabled,
        },
      });

      return archived;
    },

    async disableSourceImmediately(
      sourceId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureSourceAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before sources can be managed.",
        );
      }

      const before = await repository.findSourceById(sourceId);

      if (!before) {
        return undefined;
      }

      const updated = await repository.updateSource(sourceId, {
        enabled: false,
        status: "paused",
        permissionStatus: "DISABLED",
      });

      if (!updated) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "source.disabled",
        entityType: "source",
        entityId: sourceId,
        metadata: {
          reason: "admin_manual_disable",
        },
        beforeState: {
          enabled: before.enabled,
          permissionStatus: before.permissionStatus,
        },
        afterState: {
          enabled: updated.enabled,
          permissionStatus: updated.permissionStatus,
        },
      });

      return updated;
    },

    async assertSourceJobAllowed(sourceId: string) {
      if (!repository) {
        throw new Error("DATABASE_URL is required before source jobs can run.");
      }

      const source = await repository.findSourceById(sourceId);

      if (!source) {
        throw new Error("Source not found.");
      }

      if (!source.enabled || source.permissionStatus === "DISABLED") {
        throw new Error("Source is disabled and cannot run jobs.");
      }

      if (source.permissionStatus === "BLOCKED") {
        throw new Error("Source is blocked and cannot run jobs.");
      }

      if (source.permissionStatus === "REVIEW_REQUIRED") {
        throw new Error("Source requires review before running jobs.");
      }

      return source;
    },
  };
}
