import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { createDemandRoomRepository } from "@/server/repositories/demand-room-repository";

import { createAuditService } from "./audit-event-service";

type DemandRoomRepositoryLike = ReturnType<typeof createDemandRoomRepository>;

type DemandRoomServiceDependencies = {
  repository?: DemandRoomRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function getRepository(repository?: DemandRoomRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createDemandRoomRepository(getDb());
}

function ensureAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authenticated team members can manage demand room records.");
  }
}

export function createDemandRoomService(
  dependencies: DemandRoomServiceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();

  return {
    async listRequirements(search?: string) {
      if (!repository) {
        return [];
      }

      return repository.listRequirements(search);
    },

    async getRequirementWorkspace(requirementId: string) {
      if (!repository) {
        return null;
      }

      const requirement = await repository.getRequirement(requirementId);
      if (!requirement) {
        return null;
      }

      const timeline = await repository.getRequirementTimeline(requirementId);
      const conversations = await repository.listRequirementConversations(
        requirement.requirement.leadId,
      );

      return {
        requirement,
        timeline,
        conversations,
      };
    },

    async createRequirement(
      input: Omit<typeof import("@/db/schema").requirements.$inferInsert, "id" | "createdAt" | "updatedAt"> & { id?: string },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before demand room can run.");
      }

      const created = await repository.createRequirement(input);
      if (!created) {
        throw new Error("Failed to create requirement.");
      }

      await auditService.recordEvent({
        actor,
        action: "demand.requirement.created",
        entityType: "requirement",
        entityId: created.id,
        metadata: {
          relationshipType: created.relationshipType,
          status: created.status,
        },
      });

      return created;
    },

    async updateRequirement(
      requirementId: string,
      patch: Partial<Omit<typeof import("@/db/schema").requirements.$inferInsert, "id" | "createdAt" | "updatedAt">>,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before demand room can run.");
      }

      const before = await repository.getRequirement(requirementId);
      if (!before) {
        return undefined;
      }

      const updated = await repository.updateRequirement(requirementId, patch);
      if (!updated) {
        return undefined;
      }

      await auditService.recordEvent({
        actor,
        action: "demand.requirement.updated",
        entityType: "requirement",
        entityId: requirementId,
        metadata: {
          changedFields: Object.keys(patch),
        },
        beforeState: {
          status: before.requirement.status,
        },
        afterState: {
          status: updated.status,
        },
      });

      return updated;
    },

    async archiveRequirement(
      requirementId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before demand room can run.");
      }

      const archived = await repository.archiveRequirement(requirementId);
      if (!archived) {
        return undefined;
      }

      await auditService.recordEvent({
        actor,
        action: "demand.requirement.archived",
        entityType: "requirement",
        entityId: requirementId,
      });

      return archived;
    },
  };
}
