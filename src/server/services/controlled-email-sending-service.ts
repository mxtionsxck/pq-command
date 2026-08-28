import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import type { EmailProviderAdapter } from "@/integrations/email";
import { createMockEmailProviderAdapter } from "@/integrations/email";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { createControlledEmailRepository } from "@/server/repositories/controlled-email-repository";

import { createAuditService } from "./audit-event-service";
import { createOutreachEligibilityGateService } from "./outreach-eligibility-gate-service";

type ControlledEmailRepositoryLike = ReturnType<
  typeof createControlledEmailRepository
>;

type ControlledEmailSendingDependencies = {
  repository?: ControlledEmailRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
  adapter?: EmailProviderAdapter;
  now?: () => Date;
};

function getRepository(repository?: ControlledEmailRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createControlledEmailRepository(getDb());
}

function ensureAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authenticated team members can send outreach.");
  }
}

function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

function isWithinWindow(input: {
  now: Date;
  weekdayRules: string[];
  startHour: string | null;
  endHour: string | null;
}) {
  const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const weekday = weekdays[input.now.getUTCDay()] ?? "SUN";

  if (input.weekdayRules.length > 0 && !input.weekdayRules.includes(weekday)) {
    return false;
  }

  const start = parseClockMinutes(input.startHour);
  const end = parseClockMinutes(input.endHour);

  if (start === undefined || end === undefined) {
    return true;
  }

  const nowMinutes = input.now.getUTCHours() * 60 + input.now.getUTCMinutes();
  return nowMinutes >= start && nowMinutes <= end;
}

function meetsWeekday0830Rule(value: Date) {
  const day = value.getUTCDay();
  const isWeekday = day >= 1 && day <= 5;
  const minuteOfDay = value.getUTCHours() * 60 + value.getUTCMinutes();

  return isWeekday && minuteOfDay >= 8 * 60 + 30;
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function reasonOrDefault(reasons: string[]) {
  return reasons.length > 0 ? reasons.join("; ") : "blocked";
}

function isLevel3Autonomy(level: string | null) {
  return level === "LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS";
}

function isLevel2Autonomy(level: string | null) {
  return level === "LEVEL_2_CONTROLLED_AUTO_FOLLOW_UP";
}

export function createControlledEmailSendingService(
  dependencies: ControlledEmailSendingDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();
  const adapter = dependencies.adapter ?? createMockEmailProviderAdapter();
  const now = dependencies.now ?? (() => new Date());
  const gateService = createOutreachEligibilityGateService();

  return {
    async sendCampaignEmail(
      input: {
        campaignId: string;
        leadId: string;
        subject: string;
        bodyText: string;
        approved: boolean;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before sending outreach.");
      }

      const current = now();
      const context = await repository.getSendContext(input.campaignId, input.leadId);
      if (!context) {
        throw new Error("Campaign or lead not found.");
      }

      const recipient = context.contact?.email?.trim().toLowerCase() ?? "";
      const dedupeKey = `${input.campaignId}:${input.leadId}:${recipient}:${input.subject.trim().toLowerCase()}`;
      const approvedDraft =
        context.campaign.approvalMode === "HUMAN_APPROVAL"
          ? await repository.getApprovedDraft({
              campaignId: input.campaignId,
              leadId: input.leadId,
            })
          : undefined;

      const sourceAllowed =
        context.source?.permissionStatus === "APPROVED" &&
        context.source?.enabled === true;
      const connectorHealthy = context.source?.health === "healthy";
      const campaignStatusAllowed = context.campaign.status === "running";
      const scoreThresholdMet =
        context.lead.score >= context.campaign.minimumScore;
      const hasEvidence = context.evidenceCount > 0;
      const messageApproved =
        context.campaign.approvalMode === "HUMAN_APPROVAL"
          ? input.approved && Boolean(approvedDraft)
          : true;
      const withinWindow = isWithinWindow({
        now: current,
        weekdayRules: context.campaign.weekdayRules,
        startHour: context.campaign.startHour,
        endHour: context.campaign.endHour,
      });
      const respects0830WeekdayRule = meetsWeekday0830Rule(current);
      const campaignActive = context.campaign.active;
      const recipientValid = isEmailValid(recipient);

      const priorLeadAttempts = await repository.countLeadAttempts(
        input.campaignId,
        input.leadId,
      );
      const autonomyLevel = context.campaign.autonomyLevel ?? "LEVEL_1_HUMAN_APPROVAL";
      const level3Enabled = isLevel3Autonomy(autonomyLevel)
        ? await repository.isGlobalLevel3Enabled()
        : true;
      const level2AutoFollowUpSatisfied =
        !isLevel2Autonomy(autonomyLevel) ||
        context.campaign.approvalMode !== "AUTO_APPROVAL" ||
        priorLeadAttempts > 0;
      const autonomyLevelAllowsSend = autonomyLevel !== "LEVEL_0_DRAFT_ONLY";

      const approvalModeAllowed =
        context.campaign.approvalMode === "HUMAN_APPROVAL"
          ? input.approved && Boolean(approvedDraft)
          : context.campaign.approvalMode === "AUTO_APPROVAL" &&
              (autonomyLevel === "LEVEL_2_CONTROLLED_AUTO_FOLLOW_UP" ||
                autonomyLevel === "LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS");

      const dailyAttempts = await repository.countDailyAttempts(
        input.campaignId,
        startOfUtcDay(current),
      );
      const dailyLimitNotExceeded = dailyAttempts < context.campaign.dailyLimit;

      const recipientAttemptsLast24h = await repository.countRecipientAttemptsSince(
        recipient,
        new Date(current.getTime() - 86_400_000),
      );
      const frequencyLimitNotExceeded = recipientAttemptsLast24h < 1;

      const killSwitchActive = await repository.isOutboundKillSwitchActive();

      const hasRecentDuplicate = await repository.hasRecentDuplicateSend(
        input.campaignId,
        recipient,
        dedupeKey,
        new Date(current.getTime() - 86_400_000),
      );

      const gate = gateService.evaluate({
        globalKillSwitchOff: !killSwitchActive,
        directnessClassification: context.lead.directnessClassification,
        directnessVerified: context.lead.directnessVerified,
        directnessConfidence: context.lead.directnessConfidence,
        directnessEvidenceCount: context.directnessEvidenceCount,
        suppressed: context.suppressed,
        optedOut: context.optedOut,
        sourceAllowed,
        connectorHealthy,
        campaignStatusAllowed,
        campaignActive,
        scoreThresholdMet,
        hasEvidence,
        messageApproved,
        withinWindow,
        respects0830WeekdayRule,
        dailyLimitNotExceeded,
        frequencyLimitNotExceeded,
        noRecentDuplicateSend: !hasRecentDuplicate,
        recipientValid,
        approvalModeAllowed,
        autonomyLevelAllowsSend,
        level3GlobalEnabledForCampaign: level3Enabled,
        level2AutoFollowUpSatisfied,
      });

      const failedReasons = gate.failedReasons;

      if (failedReasons.length > 0) {
        await repository.createSendAttempt({
          campaignId: input.campaignId,
          leadId: input.leadId,
          ...(context.contact?.id ? { contactId: context.contact.id } : {}),
          recipient,
          dedupeKey,
          status: "blocked",
          reason: reasonOrDefault(failedReasons),
          policySnapshot: {
            checks: gate.checks,
            campaignDailyLimit: context.campaign.dailyLimit,
            dailyAttempts,
            recipientAttemptsLast24h,
            killSwitchActive,
            autonomyLevel,
            level3Enabled,
            priorLeadAttempts,
            directnessClassification: context.lead.directnessClassification,
            directnessVerified: context.lead.directnessVerified,
            directnessConfidence: context.lead.directnessConfidence,
            directnessEvidenceCount: context.directnessEvidenceCount,
            connectorHealth: context.source?.health ?? null,
            campaignStatus: context.campaign.status,
            optedOut: context.optedOut,
          },
          attemptedAt: current,
        });

        await auditService.recordEvent({
          actor,
          action: "outreach.send.blocked",
          entityType: "outreach_campaign",
          entityId: input.campaignId,
          metadata: {
            leadId: input.leadId,
            recipient,
            failedReasons,
            directnessClassification: context.lead.directnessClassification,
            killSwitchActive,
            campaignStatus: context.campaign.status,
            optedOut: context.optedOut,
            autonomyLevel,
            level3Enabled,
          },
        });

        return {
          status: "blocked" as const,
          failedReasons,
        };
      }

      const conversation = await repository.findOrCreateConversation({
        leadId: input.leadId,
        ...(context.contact?.id ? { contactId: context.contact.id } : {}),
        subject: input.subject,
      });

      const approvedSubject = approvedDraft?.subject ?? input.subject;
      const approvedBody = approvedDraft?.bodyText ?? input.bodyText;

      const sendResult = await adapter.send({
        ...(conversation?.id ? { threadId: conversation.id } : {}),
        to: [recipient],
        subject: approvedSubject,
        bodyText: approvedBody,
        metadata: {
          campaignId: input.campaignId,
          leadId: input.leadId,
        },
      });

      const message = await repository.createOutreachMessage({
        campaignId: input.campaignId,
        leadId: input.leadId,
        ...(context.contact?.id ? { contactId: context.contact.id } : {}),
        ...(actor.userId ? { createdByUserId: actor.userId } : {}),
        subject: approvedSubject,
        bodyText: approvedBody,
        externalMessageId: sendResult.providerMessageId,
        status: sendResult.status === "queued" ? "queued" : "sent",
        sentAt: current,
      });

      await repository.createSendAttempt({
        campaignId: input.campaignId,
        leadId: input.leadId,
        ...(context.contact?.id ? { contactId: context.contact.id } : {}),
        ...(conversation?.id ? { conversationId: conversation.id } : {}),
        ...(message?.id ? { outreachMessageId: message.id } : {}),
        recipient,
        dedupeKey,
        status: sendResult.status === "queued" ? "queued" : "sent",
        policySnapshot: {
          checks: gate.checks,
          campaignDailyLimit: context.campaign.dailyLimit,
          dailyAttempts: dailyAttempts + 1,
          autonomyLevel,
          level3Enabled,
          priorLeadAttempts,
        },
        attemptedAt: current,
      });

      if (conversation) {
        await repository.updateConversationOnOutbound(conversation.id, current);
      }

      await auditService.recordEvent({
        actor,
        action: "outreach.send.queued",
        entityType: "outreach_campaign",
        entityId: input.campaignId,
        metadata: {
          leadId: input.leadId,
          recipient,
          provider: adapter.providerName,
          externalMessageId: sendResult.providerMessageId,
        },
      });

      return {
        status: "queued" as const,
        failedReasons: [] as string[],
        outboundMessageId: message?.id,
        externalMessageId: sendResult.providerMessageId,
      };
    },
  };
}
