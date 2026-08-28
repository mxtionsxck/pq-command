import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { createDealRoomRepository } from "@/server/repositories/deal-room-repository";

import { createAuditService } from "./audit-event-service";

type DealRepositoryLike = ReturnType<typeof createDealRoomRepository>;

type DealDependencies = {
  repository?: DealRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

const stageOrder = [
  "MATCHED",
  "VIEWING",
  "OFFER",
  "NEGOTIATION",
  "AGREED",
  "CONTRACT",
  "LIVE",
  "COMPLETED",
  "LOST",
] as const;

type DealStage = (typeof stageOrder)[number];

function getRepository(repository?: DealRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createDealRoomRepository(getDb());
}

function ensureAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (!actor.role || !canSendOutreach(actor.role)) {
    throw new Error("Only authorised users can manage deals.");
  }
}

function canTransition(from: DealStage, to: DealStage) {
  if (from === to) {
    return true;
  }

  const fromIndex = stageOrder.indexOf(from);
  const toIndex = stageOrder.indexOf(to);

  if (from === "LOST" || from === "COMPLETED") {
    return false;
  }

  if (to === "LOST") {
    return true;
  }

  return toIndex === fromIndex + 1;
}

function parseBlockers(raw: string | undefined) {
  if (!raw) {
    return [] as string[];
  }

  return raw
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createDealRoomService(
  dependencies: DealDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();

  return {
    stageOrder,

    async listDeals() {
      if (!repository) {
        return [];
      }

      return repository.listDeals();
    },

    async getDealRoom(dealId: string) {
      if (!repository) {
        return null;
      }

      const deal = await repository.findDealById(dealId);
      if (!deal) {
        return null;
      }

      const timeline = await repository.listDealTimeline(dealId);
      const tasks = await repository.listDealTasks(dealId);
      const documents = await repository.listDealDocuments(dealId);

      return {
        deal,
        timeline,
        tasks,
        documents,
      };
    },

    async createDeal(
      input: {
        companyId?: string;
        propertyId?: string;
        requirementId?: string;
        leadId?: string;
        ownerUserId?: string;
        contactId?: string;
        summary?: string;
        commercialSummary?: string;
        nextAction?: string;
        blockersRaw?: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before deal room can run.");
      }

      const created = await repository.createDeal({
        companyId: input.companyId ?? null,
        propertyId: input.propertyId ?? null,
        requirementId: input.requirementId ?? null,
        leadId: input.leadId ?? null,
        ownerUserId: input.ownerUserId ?? actor.userId ?? null,
        contactId: input.contactId ?? null,
        status: "MATCHED",
        summary: input.summary ?? null,
        commercialSummary: input.commercialSummary ?? null,
        nextAction: input.nextAction ?? null,
        blockers: parseBlockers(input.blockersRaw),
      });

      await auditService.recordEvent({
        actor,
        action: "deal.created",
        entityType: "deal",
        entityId: created?.id ?? "unknown",
        afterState: {
          status: "MATCHED",
        },
      });

      return created;
    },

    async transitionStage(
      input: {
        dealId: string;
        toStage: DealStage;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before deal room can run.");
      }

      const deal = await repository.findDealById(input.dealId);
      if (!deal) {
        throw new Error("Deal not found.");
      }

      const fromStage = deal.status as DealStage;
      if (!canTransition(fromStage, input.toStage)) {
        throw new Error(`Invalid stage transition from ${fromStage} to ${input.toStage}.`);
      }

      const updated = await repository.updateDeal(input.dealId, {
        status: input.toStage,
        ...(input.toStage === "COMPLETED" ? { closedAt: new Date() } : {}),
      });

      await auditService.recordEvent({
        actor,
        action: "deal.stage.transitioned",
        entityType: "deal",
        entityId: input.dealId,
        beforeState: {
          status: fromStage,
        },
        afterState: {
          status: input.toStage,
        },
      });

      return updated;
    },

    async updateDealDetails(
      input: {
        dealId: string;
        commercialSummary?: string;
        blockersRaw?: string;
        nextAction?: string;
        summary?: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before deal room can run.");
      }

      const patch: {
        commercialSummary?: string | null;
        blockers?: string[];
        nextAction?: string | null;
        summary?: string | null;
      } = {};

      if (input.commercialSummary !== undefined) {
        patch.commercialSummary = input.commercialSummary;
      }

      if (input.blockersRaw !== undefined) {
        patch.blockers = parseBlockers(input.blockersRaw);
      }

      if (input.nextAction !== undefined) {
        patch.nextAction = input.nextAction;
      }

      if (input.summary !== undefined) {
        patch.summary = input.summary;
      }

      const updated = await repository.updateDeal(input.dealId, patch);

      await auditService.recordEvent({
        actor,
        action: "deal.updated",
        entityType: "deal",
        entityId: input.dealId,
        metadata: {
          fields: Object.keys(patch),
        },
      });

      return updated;
    },

    async createDealTask(
      input: {
        dealId: string;
        title: string;
        description?: string;
        dueAt?: Date;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before deal room can run.");
      }

      const task = await repository.createDealTask({
        dealId: input.dealId,
        title: input.title,
        ...(input.description ? { description: input.description } : {}),
        ...(input.dueAt ? { dueAt: input.dueAt } : {}),
        ...(actor.userId ? { createdByUserId: actor.userId } : {}),
        ...(actor.userId ? { assignedToUserId: actor.userId } : {}),
        priority: "high",
      });

      await auditService.recordEvent({
        actor,
        action: "deal.task.created",
        entityType: "deal",
        entityId: input.dealId,
        metadata: {
          taskId: task?.id,
        },
      });

      return task;
    },
  };
}
