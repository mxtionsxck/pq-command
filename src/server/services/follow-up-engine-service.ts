import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { createFollowUpRepository } from "@/server/repositories/follow-up-repository";

import { createAuditService } from "./audit-event-service";

type FollowUpRepositoryLike = ReturnType<typeof createFollowUpRepository>;

type FollowUpEngineDependencies = {
  repository?: FollowUpRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
  now?: () => Date;
};

function getRepository(repository?: FollowUpRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createFollowUpRepository(getDb());
}

function ensureAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authenticated team members can schedule follow-ups.");
  }
}

function parseClockMinutes(value: string | null) {
  if (!value) {
    return undefined;
  }

  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number.parseInt(hourRaw ?? "", 10);
  const minute = Number.parseInt(minuteRaw ?? "", 10);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return undefined;
  }

  return hour * 60 + minute;
}

function isWeekdayAllowed(value: Date, weekdayRules: string[]) {
  if (weekdayRules.length === 0) {
    return true;
  }

  const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const code = weekdays[value.getUTCDay()] ?? "SUN";
  return weekdayRules.includes(code);
}

function applyWindow(base: Date, startHour: string | null) {
  const minutes = parseClockMinutes(startHour);
  if (minutes === undefined) {
    return base;
  }

  const clone = new Date(base);
  clone.setUTCHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return clone;
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function defaultSequence() {
  return [
    { dayOffset: 0, template: "initial" },
    { dayOffset: 2, template: "follow-up 1" },
    { dayOffset: 5, template: "follow-up 2" },
    { dayOffset: 9, template: "close loop" },
    { dayOffset: 16, template: "nurture" },
  ];
}

export function createFollowUpEngineService(
  dependencies: FollowUpEngineDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();
  const now = dependencies.now ?? (() => new Date());

  return {
    async dryRunPreview(
      input: {
        campaignId: string;
        leadId: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before follow-up scheduling can run.");
      }

      const context = await repository.getCampaignLeadContext(input.campaignId, input.leadId);
      if (!context) {
        throw new Error("Campaign or lead not found.");
      }

      const nowValue = now();
      const hasReply = await repository.hasInboundReply(input.leadId, context.contact?.id);
      const optedOut = await repository.isOptedOut(context.contact?.email);

      const stopReason =
        hasReply
          ? "stop_on_reply"
          : optedOut
            ? "stop_on_opt_out"
            : context.campaign.status === "paused" || !context.campaign.active
              ? "stop_on_campaign_paused"
              : context.lead.status === "disqualified"
                ? "stop_on_disqualified"
                : null;

      if (stopReason) {
        return {
          scheduled: [],
          stopped: true,
          stopReason,
        };
      }

      const sequence =
        context.campaign.sequenceSteps.length > 0
          ? context.campaign.sequenceSteps
          : defaultSequence();

      const scheduled: Array<{
        stepKey: string;
        scheduledFor: Date;
        blocked: boolean;
        reason?: string;
      }> = [];

      for (const step of sequence) {
        const candidate = applyWindow(
          new Date(nowValue.getTime() + step.dayOffset * 86_400_000),
          context.campaign.startHour,
        );

        if (!isWeekdayAllowed(candidate, context.campaign.weekdayRules)) {
          scheduled.push({
            stepKey: step.template,
            scheduledFor: candidate,
            blocked: true,
            reason: "outside_weekday_window",
          });
          continue;
        }

        const startDay = startOfUtcDay(candidate);
        const queued = await repository.countQueuedForDay(input.campaignId, startDay);
        const sent = await repository.countSentAttemptsForDay(input.campaignId, startDay);

        if (queued + sent >= context.campaign.dailyLimit) {
          scheduled.push({
            stepKey: step.template,
            scheduledFor: candidate,
            blocked: true,
            reason: "daily_limit_exceeded",
          });
          continue;
        }

        scheduled.push({
          stepKey: step.template,
          scheduledFor: candidate,
          blocked: false,
        });
      }

      return {
        scheduled,
        stopped: false,
      };
    },

    async schedule(
      input: {
        campaignId: string;
        leadId: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      const preview = await this.dryRunPreview(input, actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before follow-up scheduling can run.");
      }

      if (preview.stopped) {
        await auditService.recordEvent({
          actor,
          action: "outreach.follow_up.stopped",
          entityType: "outreach_campaign",
          entityId: input.campaignId,
          metadata: {
            leadId: input.leadId,
            reason: preview.stopReason,
          },
        });

        return {
          created: 0,
          preview,
        };
      }

      let createdCount = 0;
      for (const item of preview.scheduled) {
        if (item.blocked) {
          continue;
        }

        const dedupeKey = `${input.campaignId}:${input.leadId}:${item.stepKey}:${item.scheduledFor.toISOString()}`;
        const created = await repository.upsertFollowUp({
          campaignId: input.campaignId,
          leadId: input.leadId,
          stepKey: item.stepKey,
          scheduledFor: item.scheduledFor,
          dedupeKey,
          status: "scheduled",
        });

        if (created) {
          createdCount += 1;
        }
      }

      await auditService.recordEvent({
        actor,
        action: "outreach.follow_up.scheduled",
        entityType: "outreach_campaign",
        entityId: input.campaignId,
        metadata: {
          leadId: input.leadId,
          createdCount,
          previewCount: preview.scheduled.length,
        },
      });

      return {
        created: createdCount,
        preview,
      };
    },
  };
}
