import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  pqQuestObjectives,
  pqQuestProfiles,
  pqQuestXpEvents,
  questChapterEnum,
} from "@/db/schema";

type QuestChapter = (typeof questChapterEnum.enumValues)[number];

export function createPqQuestRepository(db: PQCommandDb) {
  return {
    async getProfile(userId: string) {
      const [row] = await db
        .select()
        .from(pqQuestProfiles)
        .where(eq(pqQuestProfiles.userId, userId))
        .limit(1);

      return row;
    },

    async createProfile(userId: string) {
      const [created] = await db
        .insert(pqQuestProfiles)
        .values({
          id: createEntityId("pqp"),
          userId,
          totalXp: 0,
          level: 1,
          streakDays: 0,
          unlockedChapters: ["The Scout"],
        })
        .returning();

      return created;
    },

    async updateProfile(
      userId: string,
      patch: Partial<
        Pick<
          typeof pqQuestProfiles.$inferInsert,
          "totalXp" | "level" | "streakDays" | "lastXpAt" | "unlockedChapters"
        >
      >,
    ) {
      const [row] = await db
        .update(pqQuestProfiles)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(pqQuestProfiles.userId, userId))
        .returning();

      return row;
    },

    async findXpEventBySourceEventId(sourceEventId: string) {
      const [row] = await db
        .select({ id: pqQuestXpEvents.id })
        .from(pqQuestXpEvents)
        .where(eq(pqQuestXpEvents.sourceEventId, sourceEventId))
        .limit(1);

      return row;
    },

    async createXpEvent(input: {
      userId: string;
      sourceEventId: string;
      sourceAction: string;
      chapter: QuestChapter;
      xpAwarded: number;
      metadata?: Record<string, unknown>;
    }) {
      const [created] = await db
        .insert(pqQuestXpEvents)
        .values({
          id: createEntityId("pqe"),
          userId: input.userId,
          sourceEventId: input.sourceEventId,
          sourceAction: input.sourceAction,
          chapter: input.chapter,
          xpAwarded: input.xpAwarded,
          metadata: input.metadata ?? {},
        })
        .returning();

      return created;
    },

    async listRecentXpEvents(userId: string, limit = 30) {
      return db
        .select()
        .from(pqQuestXpEvents)
        .where(eq(pqQuestXpEvents.userId, userId))
        .orderBy(desc(pqQuestXpEvents.createdAt))
        .limit(limit);
    },

    async listObjectives(userId: string) {
      return db
        .select()
        .from(pqQuestObjectives)
        .where(eq(pqQuestObjectives.ownerUserId, userId))
        .orderBy(asc(pqQuestObjectives.createdAt));
    },

    async upsertObjective(input: {
      userId: string;
      chapter: QuestChapter;
      title: string;
      objectiveType: string;
      targetCount: number;
      bossObjective: boolean;
    }) {
      const [existing] = await db
        .select()
        .from(pqQuestObjectives)
        .where(
          and(
            eq(pqQuestObjectives.ownerUserId, input.userId),
            eq(pqQuestObjectives.objectiveType, input.objectiveType),
            eq(pqQuestObjectives.chapter, input.chapter),
          ),
        )
        .limit(1);

      if (existing) {
        return existing;
      }

      const [created] = await db
        .insert(pqQuestObjectives)
        .values({
          id: createEntityId("pqo"),
          ownerUserId: input.userId,
          chapter: input.chapter,
          title: input.title,
          objectiveType: input.objectiveType,
          targetCount: input.targetCount,
          currentCount: 0,
          bossObjective: input.bossObjective,
        })
        .returning();

      return created;
    },

    async incrementObjectiveProgress(userId: string, objectiveType: string) {
      const [objective] = await db
        .select()
        .from(pqQuestObjectives)
        .where(
          and(
            eq(pqQuestObjectives.ownerUserId, userId),
            eq(pqQuestObjectives.objectiveType, objectiveType),
          ),
        )
        .limit(1);

      if (!objective) {
        return null;
      }

      const nextCount = objective.currentCount + 1;
      const completedAt =
        nextCount >= objective.targetCount && !objective.completedAt
          ? new Date()
          : objective.completedAt;

      const [updated] = await db
        .update(pqQuestObjectives)
        .set({
          currentCount: nextCount,
          ...(completedAt ? { completedAt } : {}),
          updatedAt: new Date(),
        })
        .where(eq(pqQuestObjectives.id, objective.id))
        .returning();

      return updated;
    },

    async countCompletedObjectives(userId: string) {
      const [row] = await db
        .select({ count: count(pqQuestObjectives.id) })
        .from(pqQuestObjectives)
        .where(
          and(
            eq(pqQuestObjectives.ownerUserId, userId),
            sql`${pqQuestObjectives.completedAt} is not null`,
          ),
        );

      return row?.count ?? 0;
    },
  };
}

export type PqQuestRepository = ReturnType<typeof createPqQuestRepository>;
