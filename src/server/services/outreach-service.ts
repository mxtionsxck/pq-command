import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { NewOutreachCampaign, OutreachCampaign } from "@/db/models";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canManageUsers, requirePermission } from "@/server/auth/rbac";
import { createOutreachRepository } from "@/server/repositories/outreach-repository";

import { createAuditService } from "./audit-event-service";

type OutreachCampaignRepositoryLike = ReturnType<
  typeof createOutreachRepository
>;

type LegacyOutreachCampaignRepositoryLike = {
  create: (input: NewOutreachCampaign) => Promise<OutreachCampaign>;
};

type OutreachServiceDependencies = {
  repository?:
    OutreachCampaignRepositoryLike | LegacyOutreachCampaignRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function isLegacyRepository(
  repository:
    OutreachCampaignRepositoryLike | LegacyOutreachCampaignRepositoryLike,
): repository is LegacyOutreachCampaignRepositoryLike {
  return "create" in repository;
}

function asModernRepository(
  repository:
    | OutreachCampaignRepositoryLike
    | LegacyOutreachCampaignRepositoryLike
    | null,
) {
  if (!repository || isLegacyRepository(repository)) {
    return null;
  }

  return repository;
}

function getRepository(
  repository?:
    OutreachCampaignRepositoryLike | LegacyOutreachCampaignRepositoryLike,
) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createOutreachRepository(getDb());
}

type CampaignBuilderInput = {
  ownerUserId?: string;
  sourceId?: string;
  name: string;
  channel?: "email" | "sms" | "whatsapp";
  objective?: string;
  audience?: string;
  minimumScore?: number;
  location?: string;
  bedroomsMin?: number;
  bedroomsMax?: number;
  unitCountMin?: number;
  startHour?: string;
  endHour?: string;
  weekdayRules?: string[];
  dailyLimit?: number;
  sequenceSteps?: Array<{ dayOffset: number; template: string }>;
  approvalMode?: "HUMAN_APPROVAL" | "AUTO_APPROVAL";
  autonomyLevel?:
    | "LEVEL_0_DRAFT_ONLY"
    | "LEVEL_1_HUMAN_APPROVAL"
    | "LEVEL_2_CONTROLLED_AUTO_FOLLOW_UP"
    | "LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS";
  suppressionPolicy?: string;
  scheduledAt?: Date;
};

function resolveAutonomyDefaults(
  level:
    | "LEVEL_0_DRAFT_ONLY"
    | "LEVEL_1_HUMAN_APPROVAL"
    | "LEVEL_2_CONTROLLED_AUTO_FOLLOW_UP"
    | "LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS",
) {
  if (level === "LEVEL_0_DRAFT_ONLY") {
    return {
      minimumScoreFloor: 0,
      dailyLimitCap: 1,
      approvalMode: "HUMAN_APPROVAL" as const,
    };
  }

  if (level === "LEVEL_1_HUMAN_APPROVAL") {
    return {
      minimumScoreFloor: 70,
      dailyLimitCap: 25,
      approvalMode: "HUMAN_APPROVAL" as const,
    };
  }

  if (level === "LEVEL_2_CONTROLLED_AUTO_FOLLOW_UP") {
    return {
      minimumScoreFloor: 75,
      dailyLimitCap: 20,
      approvalMode: "AUTO_APPROVAL" as const,
    };
  }

  return {
    minimumScoreFloor: 80,
    dailyLimitCap: 10,
    approvalMode: "AUTO_APPROVAL" as const,
  };
}

export function createOutreachService({
  repository: inputRepository,
  auditService = createAuditService(),
}: OutreachServiceDependencies = {}) {
  const repository = getRepository(inputRepository);

  return {
    async listCampaigns() {
      const modernRepository = asModernRepository(repository);

      if (!modernRepository) {
        return [];
      }

      return modernRepository.listCampaigns();
    },

    async previewEligibility(input: {
      minimumScore?: number;
      sourceId?: string;
      location?: string;
      bedroomsMin?: number;
      bedroomsMax?: number;
      unitCountMin?: number;
    }) {
      const modernRepository = asModernRepository(repository);

      if (!modernRepository) {
        return [];
      }

      return modernRepository.previewEligibleLeads({
        minimumScore: Math.max(0, input.minimumScore ?? 0),
        ...(input.sourceId ? { sourceId: input.sourceId } : {}),
        ...(input.location ? { location: input.location } : {}),
        ...(input.bedroomsMin !== undefined
          ? { bedroomsMin: input.bedroomsMin }
          : {}),
        ...(input.bedroomsMax !== undefined
          ? { bedroomsMax: input.bedroomsMax }
          : {}),
        ...(input.unitCountMin !== undefined
          ? { unitCountMin: input.unitCountMin }
          : {}),
      });
    },

    async buildCampaign(
      input: CampaignBuilderInput,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<OutreachCampaign> {
      const modernRepository = asModernRepository(repository);

      if (!modernRepository) {
        throw new Error("DATABASE_URL is required before outreach can run.");
      }

      requirePermission(
        {
          id: actor.id,
          email: "audit@local",
          name: null,
          image: null,
          role: actor.role ?? "AGENT",
        },
        "sendOutreach",
      );

      const autonomyLevel = input.autonomyLevel ?? "LEVEL_1_HUMAN_APPROVAL";
      const autonomyDefaults = resolveAutonomyDefaults(autonomyLevel);
      const requestedScore = Math.max(0, input.minimumScore ?? 0);
      const requestedDailyLimit = Math.max(1, input.dailyLimit ?? 25);
      const configuredLevel3 = await modernRepository.isGlobalLevel3Enabled();

      if (
        autonomyLevel === "LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS" &&
        !configuredLevel3
      ) {
        throw new Error("Level 3 autonomy is disabled until admin enables it globally.");
      }

      if (
        autonomyLevel === "LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS" &&
        !canManageUsers(actor.role ?? null)
      ) {
        throw new Error("Only admins can create Level 3 campaigns.");
      }

      const campaign = await modernRepository.createCampaign({
        name: input.name,
        channel: input.channel ?? "email",
        status: "draft",
        ...((input.ownerUserId ?? actor.userId)
          ? { ownerUserId: input.ownerUserId ?? actor.userId }
          : {}),
        ...(input.sourceId ? { sourceId: input.sourceId } : {}),
        ...(input.objective ? { objective: input.objective } : {}),
        ...(input.audience ? { audience: input.audience } : {}),
        minimumScore: Math.max(autonomyDefaults.minimumScoreFloor, requestedScore),
        ...(input.location ? { location: input.location } : {}),
        ...(input.bedroomsMin !== undefined
          ? { bedroomsMin: input.bedroomsMin }
          : {}),
        ...(input.bedroomsMax !== undefined
          ? { bedroomsMax: input.bedroomsMax }
          : {}),
        ...(input.unitCountMin !== undefined
          ? { unitCountMin: input.unitCountMin }
          : {}),
        ...(input.startHour ? { startHour: input.startHour } : {}),
        ...(input.endHour ? { endHour: input.endHour } : {}),
        weekdayRules: input.weekdayRules ?? ["MON", "TUE", "WED", "THU", "FRI"],
        dailyLimit: Math.min(autonomyDefaults.dailyLimitCap, requestedDailyLimit),
        sequenceSteps: input.sequenceSteps ?? [
          { dayOffset: 0, template: "intro" },
        ],
        approvalMode: input.approvalMode ?? autonomyDefaults.approvalMode,
        autonomyLevel,
        suppressionPolicy:
          input.suppressionPolicy ?? "respect_global_suppression",
        ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
        active: false,
      });

      await auditService.recordEvent({
        actor,
        action: "outreach.campaign.built",
        entityType: "outreach_campaign",
        entityId: campaign.id,
        metadata: {
          autonomyLevel: campaign.autonomyLevel,
          approvalMode: campaign.approvalMode,
          minimumScore: campaign.minimumScore,
          dailyLimit: campaign.dailyLimit,
        },
      });

      return campaign;
    },

    async createCampaign(
      input: NewOutreachCampaign,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<OutreachCampaign> {
      if (!repository) {
        throw new Error("DATABASE_URL is required before outreach can run.");
      }

      if (actor.role) {
        requirePermission(
          {
            id: actor.id,
            email: "audit@local",
            name: null,
            image: null,
            role: actor.role,
          },
          "sendOutreach",
        );
      }

      const campaignFromLegacy = isLegacyRepository(repository)
        ? await repository.create(input)
        : await repository.createCampaign(input);

      await auditService.recordEvent({
        actor,
        action: "outreach.campaign.created",
        entityType: "outreach_campaign",
        entityId: campaignFromLegacy.id,
        metadata: {
          channel: campaignFromLegacy.channel,
          status: campaignFromLegacy.status,
          sourceId: campaignFromLegacy.sourceId,
        },
        afterState: {
          status: campaignFromLegacy.status,
          ownerUserId: campaignFromLegacy.ownerUserId,
        },
      });

      return campaignFromLegacy;
    },

    async launchCampaign(
      campaignId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      const modernRepository = asModernRepository(repository);

      if (!modernRepository) {
        throw new Error("DATABASE_URL is required before outreach can run.");
      }

      const campaign = await modernRepository.findCampaignById(campaignId);
      if (!campaign) {
        throw new Error("Campaign not found.");
      }

      const eligible = await modernRepository.previewEligibleLeads({
        minimumScore: campaign.minimumScore,
        ...(campaign.sourceId ? { sourceId: campaign.sourceId } : {}),
        ...(campaign.location ? { location: campaign.location } : {}),
        ...(campaign.bedroomsMin !== null
          ? { bedroomsMin: campaign.bedroomsMin }
          : {}),
        ...(campaign.bedroomsMax !== null
          ? { bedroomsMax: campaign.bedroomsMax }
          : {}),
        ...(campaign.unitCountMin !== null
          ? { unitCountMin: campaign.unitCountMin }
          : {}),
      });

      const launched = await modernRepository.markCampaignRunning(
        campaignId,
        new Date(),
      );

      await auditService.recordEvent({
        actor,
        action: "outreach.campaign.launched",
        entityType: "outreach_campaign",
        entityId: campaignId,
        metadata: {
          eligibleLeadCount: eligible.length,
          approvalMode: campaign.approvalMode,
        },
      });

      return {
        campaign: launched,
        eligibleLeadCount: eligible.length,
      };
    },

    async pauseCampaign(
      campaignId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      const modernRepository = asModernRepository(repository);

      if (!modernRepository) {
        throw new Error("DATABASE_URL is required before outreach can run.");
      }

      const paused = await modernRepository.pauseCampaign(campaignId);
      if (!paused) {
        return undefined;
      }

      await auditService.recordEvent({
        actor,
        action: "outreach.campaign.paused",
        entityType: "outreach_campaign",
        entityId: campaignId,
      });

      return paused;
    },

    async setGlobalLevel3Enabled(
      enabled: boolean,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      requirePermission(
        {
          id: actor.id,
          email: "audit@local",
          name: null,
          image: null,
          role: actor.role ?? "AGENT",
        },
        "manageUsers",
      );

      const modernRepository = asModernRepository(repository);
      if (!modernRepository) {
        throw new Error("DATABASE_URL is required before outreach can run.");
      }

      const row = await modernRepository.setGlobalLevel3Enabled({ enabled });

      await auditService.recordEvent({
        actor,
        action: "outreach.autonomy.level3.global.updated",
        entityType: "outreach_autonomy",
        entityId: "global_level3_switch",
        metadata: {
          enabled,
        },
      });

      return row;
    },

    async getGlobalLevel3Enabled() {
      const modernRepository = asModernRepository(repository);
      if (!modernRepository) {
        return false;
      }

      return modernRepository.isGlobalLevel3Enabled();
    },
  };
}
