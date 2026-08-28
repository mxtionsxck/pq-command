import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { createInboxRepository } from "@/server/repositories/inbox-repository";

import { createAuditService } from "./audit-event-service";

type InboxRepositoryLike = ReturnType<typeof createInboxRepository>;

export type InboxCategory =
  | "HOT"
  | "INTERESTED"
  | "FUTURE"
  | "QUESTION"
  | "UNCLEAR"
  | "NOT_INTERESTED"
  | "OPT_OUT";

type InboxServiceDependencies = {
  repository?: InboxRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function getRepository(repository?: InboxRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createInboxRepository(getDb());
}

function ensureAccess(
  actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authenticated team members can manage inbox.");
  }
}

export function createInboxService(
  dependencies: InboxServiceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const getAuditService = () =>
    dependencies.auditService ?? createAuditService();

  return {
    async listConversations(input: {
      category?: InboxCategory;
      search?: string;
      page?: number;
      pageSize?: number;
    }) {
      if (!repository) {
        return [];
      }

      const page = Math.max(1, input.page ?? 1);
      const pageSize = Math.max(1, Math.min(100, input.pageSize ?? 25));
      const rows = await repository.listConversations({
        ...input,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return rows.map((row) => ({
        id: row.conversation.id,
        leadId: row.conversation.leadId,
        status: row.conversation.status,
        subject: row.conversation.subject,
        category: row.conversation.inboxCategory,
        lastMessageAt: row.conversation.lastMessageAt,
        snoozedUntil: row.conversation.snoozedUntil,
        aiSummary: row.conversation.aiSummary,
        companyName: row.companyName,
        contactName: [row.contactFirstName, row.contactLastName]
          .filter(Boolean)
          .join(" "),
        contactEmail: row.contactEmail,
        leadSummary: row.leadSummary,
      }));
    },

    async getThread(conversationId: string) {
      if (!repository) {
        return null;
      }

      const conversation = await repository.getConversationById(conversationId);
      if (!conversation) {
        return null;
      }

      const threadMessages = await repository.listMessages(conversationId);

      return {
        conversation,
        messages: threadMessages,
      };
    },

    async setCategory(
      conversationId: string,
      category: InboxCategory,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before inbox can run.");
      }

      const updated = await repository.updateConversation(conversationId, {
        inboxCategory: category,
      });

      if (!updated) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "inbox.category.updated",
        entityType: "conversation",
        entityId: conversationId,
        metadata: { category },
      });

      return updated;
    },

    async assign(
      conversationId: string,
      ownerUserId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before inbox can run.");
      }

      const updated = await repository.assignConversation(
        conversationId,
        ownerUserId,
      );

      if (updated) {
        await getAuditService().recordEvent({
          actor,
          action: "inbox.assigned",
          entityType: "conversation",
          entityId: conversationId,
          metadata: {
            ownerUserId,
          },
        });
      }

      return updated;
    },

    async snooze(
      conversationId: string,
      snoozedUntil: Date,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before inbox can run.");
      }

      const updated = await repository.snoozeConversation(
        conversationId,
        snoozedUntil,
      );

      if (updated) {
        await getAuditService().recordEvent({
          actor,
          action: "inbox.snoozed",
          entityType: "conversation",
          entityId: conversationId,
          metadata: {
            snoozedUntil: snoozedUntil.toISOString(),
          },
        });
      }

      return updated;
    },

    async saveReplyDraft(
      conversationId: string,
      bodyText: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before inbox can run.");
      }

      const draft = await repository.createReplyDraft(
        conversationId,
        actor.userId ?? actor.id,
        bodyText,
      );

      if (!draft) {
        throw new Error("Failed to persist reply draft.");
      }

      await getAuditService().recordEvent({
        actor,
        action: "inbox.reply.draft.saved",
        entityType: "message",
        entityId: draft.id,
        metadata: {
          conversationId,
        },
      });

      return draft;
    },

    async linkProperty(
      conversationId: string,
      propertyId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before inbox can run.");
      }

      const updated = await repository.linkProperty(conversationId, propertyId);
      await getAuditService().recordEvent({
        actor,
        action: "inbox.linked.property",
        entityType: "conversation",
        entityId: conversationId,
        metadata: {
          propertyId,
        },
      });
      return updated;
    },

    async linkCompany(
      conversationId: string,
      companyId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before inbox can run.");
      }

      const updated = await repository.linkCompany(conversationId, companyId);
      await getAuditService().recordEvent({
        actor,
        action: "inbox.linked.company",
        entityType: "conversation",
        entityId: conversationId,
        metadata: {
          companyId,
        },
      });
      return updated;
    },

    async createRequirement(
      conversationId: string,
      notes: string | undefined,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before inbox can run.");
      }

      const requirement = await repository.createRequirementFromConversation({
        conversationId,
        ...(actor.userId ? { ownerUserId: actor.userId } : {}),
        ...(notes ? { notes } : {}),
      });

      if (requirement) {
        await getAuditService().recordEvent({
          actor,
          action: "inbox.requirement.created",
          entityType: "requirement",
          entityId: requirement.id,
          metadata: {
            conversationId,
          },
        });
      }

      return requirement;
    },

    async createTask(
      input: {
        conversationId: string;
        title: string;
        description?: string;
        assignedToUserId?: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before inbox can run.");
      }

      const task = await repository.createTaskFromConversation({
        conversationId: input.conversationId,
        title: input.title,
        ...(input.description ? { description: input.description } : {}),
        ...(input.assignedToUserId
          ? { assignedToUserId: input.assignedToUserId }
          : {}),
        createdByUserId: actor.userId ?? actor.id,
      });

      if (task) {
        await getAuditService().recordEvent({
          actor,
          action: "inbox.task.created",
          entityType: "task",
          entityId: task.id,
          metadata: {
            conversationId: input.conversationId,
          },
        });
      }

      return task;
    },

    async suppress(
      conversationId: string,
      reason: "bounced" | "opt_out" | "manual" | "legal",
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before inbox can run.");
      }

      const updated = await repository.suppressConversationContact({
        conversationId,
        reason,
        createdByUserId: actor.userId ?? actor.id,
      });

      if (updated) {
        await getAuditService().recordEvent({
          actor,
          action: "inbox.contact.suppressed",
          entityType: "conversation",
          entityId: conversationId,
          metadata: {
            reason,
          },
        });
      }

      return updated;
    },
  };
}
