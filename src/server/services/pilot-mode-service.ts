import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { createPilotModeRepository } from "@/server/repositories/pilot-mode-repository";

import { createAuditService } from "./audit-event-service";

type PilotWorkflowKey =
  | "review_overnight_leads"
  | "qualify_stock"
  | "review_direct_demand"
  | "approve_outreach"
  | "handle_hot_replies"
  | "create_requirement"
  | "review_matches"
  | "book_viewing"
  | "progress_deal"
  | "review_ai_errors";

type PilotModeRepositoryLike = ReturnType<typeof createPilotModeRepository>;

type PilotModeDependencies = {
  repository?: PilotModeRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
  now?: () => Date;
};

const workflows: Array<{
  key: PilotWorkflowKey;
  title: string;
  href: string;
  nextAction: string;
}> = [
  {
    key: "review_overnight_leads",
    title: "Review overnight leads",
    href: "/internal/leads?view=ai_discovered&page=1&pageSize=25",
    nextAction: "Validate new signals and route valid leads to researching.",
  },
  {
    key: "qualify_stock",
    title: "Qualify stock",
    href: "/internal/stock-room?page=1&pageSize=24&fit=review",
    nextAction: "Confirm property quality and set fit/status before matching.",
  },
  {
    key: "review_direct_demand",
    title: "Review direct demand",
    href: "/internal/leads?view=demand&page=1&pageSize=25",
    nextAction: "Run directness checks and promote only verified demand.",
  },
  {
    key: "approve_outreach",
    title: "Approve outreach",
    href: "/internal/outreach",
    nextAction: "Approve compliant drafts and keep suppression guards active.",
  },
  {
    key: "handle_hot_replies",
    title: "Handle hot replies",
    href: "/internal/inbox?category=HOT&page=1&pageSize=25",
    nextAction: "Assign owner, draft response, and protect opt-outs.",
  },
  {
    key: "create_requirement",
    title: "Create requirement",
    href: "/internal/inbox?category=INTERESTED&page=1&pageSize=25",
    nextAction: "Capture requirement from interest-qualified conversations.",
  },
  {
    key: "review_matches",
    title: "Review matches",
    href: "/internal/demand-room",
    nextAction: "Shortlist only high-confidence suggestions with rationale.",
  },
  {
    key: "book_viewing",
    title: "Book viewing",
    href: "/internal/viewings",
    nextAction: "Schedule viewing for shortlisted opportunities.",
  },
  {
    key: "progress_deal",
    title: "Progress deal",
    href: "/internal/deals",
    nextAction: "Advance negotiation and contract tasks with blockers cleared.",
  },
  {
    key: "review_ai_errors",
    title: "Review AI errors",
    href: "/admin/operations",
    nextAction: "Resolve failed/dead-letter runs before scaling autonomy.",
  },
];

function getRepository(repository?: PilotModeRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createPilotModeRepository(getDb());
}

function ensureAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authenticated team members can use pilot mode.");
  }
}

function trimOptional(value: string | undefined, maxLen: number) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.slice(0, maxLen);
}

export function createPilotModeService(dependencies: PilotModeDependencies = {}) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();
  const now = dependencies.now ?? (() => new Date());

  return {
    async getDashboard() {
      if (!repository) {
        return {
          workflows: workflows.map((item) => ({ ...item, queueCount: 0 })),
          feedbackSummary: {
            GOOD_AI: 0,
            WRONG: 0,
            MISSING: 0,
            NEEDS_HUMAN: 0,
          },
          dailySummary: {
            totalFeedback: 0,
            aiErrorsToday: 0,
            requirementsCreatedToday: 0,
            hotRepliesOpen: 0,
          },
          recentFeedback: [],
        };
      }

      const [counts, feedbackRows, recentFeedback] = await Promise.all([
        repository.workflowQueueCounts(now()),
        repository.listFeedbackSummaryForDay(now()),
        repository.listFeedbackEvents(30),
      ]);

      const feedbackSummary = {
        GOOD_AI: 0,
        WRONG: 0,
        MISSING: 0,
        NEEDS_HUMAN: 0,
      };

      for (const row of feedbackRows) {
        feedbackSummary[row.feedbackLabel] = row.total;
      }

      return {
        workflows: workflows.map((item) => ({
          ...item,
          queueCount: counts[item.key],
        })),
        feedbackSummary,
        dailySummary: {
          totalFeedback:
            feedbackSummary.GOOD_AI +
            feedbackSummary.WRONG +
            feedbackSummary.MISSING +
            feedbackSummary.NEEDS_HUMAN,
          aiErrorsToday: counts.review_ai_errors,
          requirementsCreatedToday: counts.create_requirement,
          hotRepliesOpen: counts.handle_hot_replies,
        },
        recentFeedback,
      };
    },

    async submitFeedback(
      input: {
        workflowKey: PilotWorkflowKey;
        feedbackLabel: "GOOD_AI" | "WRONG" | "MISSING" | "NEEDS_HUMAN";
        notes?: string;
        entityType?: string;
        entityId?: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before pilot mode can run.");
      }

      const notes = trimOptional(input.notes, 800);
      const entityType = trimOptional(input.entityType, 80);
      const entityId = trimOptional(input.entityId, 80);

      const row = await repository.addFeedback({
        workflowKey: input.workflowKey,
        feedbackLabel: input.feedbackLabel,
        ...(notes ? { notes } : {}),
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        submittedByUserId: actor.userId ?? actor.id,
      });

      await auditService.recordEvent({
        actor,
        action: "pilot.feedback.submitted",
        entityType: "pilot_feedback",
        entityId: row?.id ?? "unknown",
        metadata: {
          workflowKey: input.workflowKey,
          feedbackLabel: input.feedbackLabel,
        },
      });

      return row;
    },
  };
}
