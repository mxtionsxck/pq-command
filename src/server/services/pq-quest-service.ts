import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { createPqQuestRepository, type PqQuestRepository } from "@/server/repositories/pq-quest-repository";

import { createAuditService } from "./audit-event-service";

type AwardRule = {
  chapter:
    | "The Scout"
    | "The Qualifier"
    | "The Outreach Run"
    | "The Match"
    | "The Viewing"
    | "The Deal"
    | "The Shortage"
    | "The Flywheel";
  xp: number;
};

const VERIFIED_XP_RULES: Record<string, AwardRule> = {
  "lead.qualified": { chapter: "The Qualifier", xp: 20 },
  "reply.positive": { chapter: "The Outreach Run", xp: 25 },
  "requirement.verified": { chapter: "The Scout", xp: 20 },
  "match.created": { chapter: "The Match", xp: 30 },
  "viewing.completed": { chapter: "The Viewing", xp: 35 },
  "deal.offer_made": { chapter: "The Deal", xp: 40 },
  "deal.completed": { chapter: "The Flywheel", xp: 100 },
  "shortage.converted": { chapter: "The Shortage", xp: 30 },
};

const CHAPTER_UNLOCK_BY_LEVEL: Array<{ level: number; chapter: AwardRule["chapter"] }> = [
  { level: 1, chapter: "The Scout" },
  { level: 2, chapter: "The Qualifier" },
  { level: 3, chapter: "The Outreach Run" },
  { level: 4, chapter: "The Match" },
  { level: 5, chapter: "The Viewing" },
  { level: 6, chapter: "The Deal" },
  { level: 7, chapter: "The Shortage" },
  { level: 8, chapter: "The Flywheel" },
];

type QuestDependencies = {
  repository?: PqQuestRepository;
  auditService?: ReturnType<typeof createAuditService>;
  now?: () => Date;
};

function getRepository(repository?: PqQuestRepository) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createPqQuestRepository(getDb());
}

function levelFromXp(totalXp: number) {
  return Math.max(1, Math.floor(totalXp / 100) + 1);
}

function computeStreak(previous: Date | null, current: Date) {
  if (!previous) {
    return 1;
  }

  const previousDay = new Date(previous);
  previousDay.setHours(0, 0, 0, 0);

  const currentDay = new Date(current);
  currentDay.setHours(0, 0, 0, 0);

  const deltaDays = Math.round((currentDay.getTime() - previousDay.getTime()) / 86_400_000);

  if (deltaDays <= 0) {
    return null;
  }

  if (deltaDays === 1) {
    return "increment" as const;
  }

  return "reset" as const;
}

function objectiveTypeForAction(action: string) {
  return `verified:${action}`;
}

export function createPqQuestService(dependencies: QuestDependencies = {}) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();
  const now = dependencies.now ?? (() => new Date());

  return {
    async ensureProfile(userId: string) {
      if (!repository) {
        throw new Error("DATABASE_URL is required before PQ Quest can run.");
      }

      const profile =
        (await repository.getProfile(userId)) ??
        (await repository.createProfile(userId));

      if (!profile) {
        throw new Error("Unable to initialize PQ Quest profile.");
      }

      const seedObjectives = [
        { chapter: "The Scout", title: "Verify 5 requirements", action: "requirement.verified", target: 5 },
        { chapter: "The Qualifier", title: "Qualify 10 leads", action: "lead.qualified", target: 10 },
        { chapter: "The Match", title: "Create 5 matches", action: "match.created", target: 5 },
        { chapter: "The Viewing", title: "Complete 5 viewings", action: "viewing.completed", target: 5 },
        { chapter: "The Deal", title: "Close 1 deal", action: "deal.completed", target: 1 },
      ] as const;

      for (const seed of seedObjectives) {
        await repository.upsertObjective({
          userId,
          chapter: seed.chapter,
          title: seed.title,
          objectiveType: objectiveTypeForAction(seed.action),
          targetCount: seed.target,
          bossObjective: seed.action === "deal.completed",
        });
      }

      return profile;
    },

    async awardVerifiedEvent(input: {
      userId: string;
      sourceEventId: string;
      sourceAction: string;
      metadata?: Record<string, unknown>;
    }, actor: AuditActor) {
      if (!repository) {
        throw new Error("DATABASE_URL is required before PQ Quest can run.");
      }

      const rule = VERIFIED_XP_RULES[input.sourceAction];
      if (!rule) {
        return {
          awarded: false,
          reason: "event_not_rewardable",
        } as const;
      }

      const existing = await repository.findXpEventBySourceEventId(input.sourceEventId);
      if (existing) {
        return {
          awarded: false,
          reason: "duplicate_source_event",
        } as const;
      }

      const profile = await this.ensureProfile(input.userId);
      const at = now();

      await repository.createXpEvent({
        userId: input.userId,
        sourceEventId: input.sourceEventId,
        sourceAction: input.sourceAction,
        chapter: rule.chapter,
        xpAwarded: rule.xp,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      });

      const totalXp = profile.totalXp + rule.xp;
      const level = levelFromXp(totalXp);
      const streakDelta = computeStreak(profile.lastXpAt ?? null, at);
      const streakDays =
        streakDelta === "increment"
          ? profile.streakDays + 1
          : streakDelta === "reset"
            ? 1
            : profile.streakDays;

      const unlocked = new Set(profile.unlockedChapters);
      for (const item of CHAPTER_UNLOCK_BY_LEVEL) {
        if (level >= item.level) {
          unlocked.add(item.chapter);
        }
      }

      const updatedProfile = await repository.updateProfile(input.userId, {
        totalXp,
        level,
        streakDays,
        lastXpAt: at,
        unlockedChapters: Array.from(unlocked),
      });

      await repository.incrementObjectiveProgress(
        input.userId,
        objectiveTypeForAction(input.sourceAction),
      );

      await auditService.recordEvent({
        actor,
        action: "pq_quest.xp_awarded",
        entityType: "pq_quest_profile",
        entityId: input.userId,
        metadata: {
          sourceEventId: input.sourceEventId,
          sourceAction: input.sourceAction,
          xp: rule.xp,
          totalXp,
          level,
        },
      });

      return {
        awarded: true,
        xpAwarded: rule.xp,
        profile: updatedProfile,
      } as const;
    },

    async dashboard(userId: string) {
      if (!repository) {
        return {
          profile: null,
          recentEvents: [],
          objectives: [],
          completedObjectives: 0,
        };
      }

      await this.ensureProfile(userId);
      const profile = await repository.getProfile(userId);
      const [recentEvents, objectives, completedObjectives] = await Promise.all([
        repository.listRecentXpEvents(userId),
        repository.listObjectives(userId),
        repository.countCompletedObjectives(userId),
      ]);

      return {
        profile,
        recentEvents,
        objectives,
        completedObjectives,
      };
    },
  };
}
