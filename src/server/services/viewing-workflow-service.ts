import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { createViewingWorkflowRepository } from "@/server/repositories/viewing-workflow-repository";

import { createAuditService } from "./audit-event-service";

type ViewingRepositoryLike = ReturnType<typeof createViewingWorkflowRepository>;

type ViewingDependencies = {
  repository?: ViewingRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function getRepository(repository?: ViewingRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createViewingWorkflowRepository(getDb());
}

function ensureAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (!actor.role || !canSendOutreach(actor.role)) {
    throw new Error("Only authorised users can manage viewings.");
  }
}

function canEditCommercialNotes(role: "ADMIN" | "MANAGER" | "AGENT" | undefined) {
  return role === "ADMIN" || role === "MANAGER";
}

function parseAttendees(raw: string | undefined) {
  if (!raw) {
    return [] as Array<{ name: string; role?: string }>;
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => ({ name: entry }));
}

export function createViewingWorkflowService(
  dependencies: ViewingDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();

  return {
    async scheduleViewing(
      input: {
        propertyId: string;
        requirementId?: string;
        companyId?: string;
        contactId?: string;
        scheduledFor: Date;
        attendeesRaw?: string;
        notes?: string;
        reminderAt?: Date;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before viewing workflow can run.");
      }

      const viewing = await repository.createViewing({
        propertyId: input.propertyId,
        requirementId: input.requirementId ?? null,
        companyId: input.companyId ?? null,
        contactId: input.contactId ?? null,
        scheduledByUserId: actor.userId ?? null,
        status: "scheduled",
        scheduledFor: input.scheduledFor,
        attendees: parseAttendees(input.attendeesRaw),
        notes: input.notes ?? null,
        reminderAt: input.reminderAt ?? null,
      });

      await auditService.recordEvent({
        actor,
        action: "viewing.scheduled",
        entityType: "viewing",
        entityId: viewing?.id ?? "unknown",
        metadata: {
          propertyId: input.propertyId,
          requirementId: input.requirementId,
          companyId: input.companyId,
        },
      });

      return viewing;
    },

    async listViewings(input?: { from?: Date; to?: Date }) {
      if (!repository) {
        return [];
      }

      return repository.listViewings(input);
    },

    async getViewingBrief(viewingId: string) {
      if (!repository) {
        return null;
      }

      const row = await repository.getViewingById(viewingId);
      if (!row) {
        return null;
      }

      return {
        viewing: row.viewing,
        property: row.property,
        requirement: row.requirement,
        company: row.company,
        contact: row.contact,
        brief: {
          summary: `${row.property?.title ?? "Property"} with ${row.company?.name ?? "company"}`,
          notes: row.viewing.notes,
          attendees: row.viewing.attendees,
        },
      };
    },

    async createReminder(
      input: {
        viewingId: string;
        userId: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before viewing workflow can run.");
      }

      const row = await repository.getViewingById(input.viewingId);
      if (!row) {
        throw new Error("Viewing not found.");
      }

      const reminder = await repository.createReminder({
        userId: input.userId,
        viewingId: row.viewing.id,
        title: "Viewing reminder",
        body: `Upcoming viewing for ${row.property?.title ?? "property"} at ${row.viewing.scheduledFor.toISOString()}.`,
        linkHref: `/internal/viewings?viewingId=${row.viewing.id}`,
      });

      await repository.updateViewing(row.viewing.id, {
        status: "reminded",
      });

      await auditService.recordEvent({
        actor,
        action: "viewing.reminder.created",
        entityType: "viewing",
        entityId: row.viewing.id,
        metadata: {
          reminderId: reminder?.id,
        },
      });

      return reminder;
    },

    async saveOutcome(
      input: {
        viewingId: string;
        outcome: string;
        nextAction?: string;
        notes?: string;
        commercialNotes?: string;
        createTask: boolean;
        taskAssigneeUserId?: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before viewing workflow can run.");
      }

      const existing = await repository.getViewingById(input.viewingId);
      if (!existing) {
        throw new Error("Viewing not found.");
      }

      if (input.commercialNotes && !canEditCommercialNotes(actor.role)) {
        throw new Error("Only authorised agents can edit commercial notes.");
      }

      const updated = await repository.updateViewing(input.viewingId, {
        status: "completed",
        completedAt: new Date(),
        outcome: input.outcome,
        nextAction: input.nextAction ?? null,
        notes: input.notes ?? existing.viewing.notes,
        ...(input.commercialNotes
          ? { commercialNotes: input.commercialNotes }
          : {}),
      });

      let taskId: string | undefined;
      if (input.createTask) {
        const task = await repository.createTask({
          title: `Post-viewing: ${input.nextAction ?? "follow up"}`,
          viewingId: input.viewingId,
          ...(input.outcome ? { description: input.outcome } : {}),
          ...(input.taskAssigneeUserId
            ? { assignedToUserId: input.taskAssigneeUserId }
            : {}),
          ...(actor.userId ? { createdByUserId: actor.userId } : {}),
          dueAt: new Date(Date.now() + 2 * 86_400_000),
          priority: "high",
        });

        taskId = task?.id;
      }

      await auditService.recordEvent({
        actor,
        action: "viewing.outcome.saved",
        entityType: "viewing",
        entityId: input.viewingId,
        metadata: {
          taskId,
          outcome: input.outcome,
        },
      });

      return {
        viewing: updated,
        taskId,
      };
    },
  };
}
