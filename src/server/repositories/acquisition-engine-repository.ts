import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  acquisitionMissionRuns,
  acquisitionExclusions,
  acquisitionMissions,
  agentMessages,
  demandHeatmapCells,
  deals,
  directnessAssessments,
  leads,
  objectives,
  requirements,
  suppressionList,
} from "@/db/schema";

export function createAcquisitionEngineRepository(db: PQCommandDb) {
  return {
    async createMission(input: {
      ownerUserId?: string;
      objectiveId?: string;
      missionType: "SUPPLY" | "DEMAND" | "SHORTAGE" | "RELATIONSHIP";
      title: string;
      missionObjective: string;
      scope?: Record<string, unknown>;
      targetQualifiedProspects: number;
      targetOutreachReadyProspects: number;
    }) {
      const [created] = await db
        .insert(acquisitionMissions)
        .values({
          id: createEntityId("mis"),
          ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
          ...(input.objectiveId ? { objectiveId: input.objectiveId } : {}),
          missionType: input.missionType,
          status: "draft",
          title: input.title,
          missionObjective: input.missionObjective,
          scope: input.scope ?? {},
          targetQualifiedProspects: input.targetQualifiedProspects,
          targetOutreachReadyProspects: input.targetOutreachReadyProspects,
        })
        .returning();

      return created;
    },

    async updateMission(
      missionId: string,
      patch: Partial<typeof acquisitionMissions.$inferInsert>,
    ) {
      const [updated] = await db
        .update(acquisitionMissions)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(acquisitionMissions.id, missionId))
        .returning();

      return updated;
    },

    async getMission(missionId: string) {
      const [mission] = await db
        .select()
        .from(acquisitionMissions)
        .where(eq(acquisitionMissions.id, missionId))
        .limit(1);

      return mission;
    },

    async listMissions(limit = 50) {
      return db
        .select()
        .from(acquisitionMissions)
        .orderBy(desc(acquisitionMissions.updatedAt), desc(acquisitionMissions.createdAt))
        .limit(limit);
    },

    async createMissionRun(input: {
      missionId: string;
      status?: "running" | "succeeded" | "failed";
      trace?: Record<string, unknown>;
    }) {
      const [created] = await db
        .insert(acquisitionMissionRuns)
        .values({
          id: createEntityId("msr"),
          missionId: input.missionId,
          status: input.status ?? "running",
          trace: input.trace ?? {},
        })
        .returning();

      return created;
    },

    async updateMissionRun(
      runId: string,
      patch: Partial<typeof acquisitionMissionRuns.$inferInsert>,
    ) {
      const [updated] = await db
        .update(acquisitionMissionRuns)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(acquisitionMissionRuns.id, runId))
        .returning();

      return updated;
    },

    async listMissionRuns(missionId: string, limit = 15) {
      return db
        .select()
        .from(acquisitionMissionRuns)
        .where(eq(acquisitionMissionRuns.missionId, missionId))
        .orderBy(desc(acquisitionMissionRuns.createdAt))
        .limit(limit);
    },

    async listObjectiveBacklog() {
      return db
        .select({
          id: objectives.id,
          title: objectives.title,
          status: objectives.status,
        })
        .from(objectives)
        .where(inArray(objectives.status, ["draft", "active"]))
        .orderBy(desc(objectives.updatedAt))
        .limit(25);
    },

    async countLeadEvidence(leadId: string) {
      const [row] = await db
        .select({ count: count(directnessAssessments.id) })
        .from(directnessAssessments)
        .where(eq(directnessAssessments.leadId, leadId));

      return row?.count ?? 0;
    },

    async getLeadEligibilityContext(leadId: string) {
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1);

      if (!lead) {
        return null;
      }

      const [suppression] = await db
        .select({ id: suppressionList.id })
        .from(suppressionList)
        .where(
          and(
            eq(suppressionList.contactId, lead.contactId ?? ""),
            isNull(suppressionList.archivedAt),
          ),
        )
        .limit(1);

      const assessmentRows = await db
        .select()
        .from(directnessAssessments)
        .where(eq(directnessAssessments.leadId, leadId))
        .orderBy(desc(directnessAssessments.createdAt))
        .limit(20);

      return {
        lead,
        suppressed: Boolean(suppression),
        assessments: assessmentRows,
      };
    },

    async recordDirectnessAssessment(input: {
      leadId: string;
      entityName: string;
      personName?: string;
      roleTitle?: string;
      relationshipToPropertyOrCompany: string;
      evidenceSource: string;
      evidenceReference: string;
      evidenceType: string;
      evidenceDate: Date;
      explanation: string;
      confidence: number;
      classification: "DIRECT" | "INTERMEDIARY" | "UNKNOWN" | "SUPPRESSED";
      verificationStatus:
        | "unverified"
        | "partially_verified"
        | "verified"
        | "conflicted";
      conflictDetected: boolean;
    }) {
      const [created] = await db
        .insert(directnessAssessments)
        .values({
          id: createEntityId("das"),
          leadId: input.leadId,
          entityName: input.entityName,
          ...(input.personName ? { personName: input.personName } : {}),
          ...(input.roleTitle ? { roleTitle: input.roleTitle } : {}),
          relationshipToPropertyOrCompany:
            input.relationshipToPropertyOrCompany,
          evidenceSource: input.evidenceSource,
          evidenceReference: input.evidenceReference,
          evidenceType: input.evidenceType,
          evidenceDate: input.evidenceDate,
          explanation: input.explanation,
          confidence: input.confidence,
          classification: input.classification,
          verificationStatus: input.verificationStatus,
          conflictDetected: input.conflictDetected,
        })
        .returning();

      return created;
    },

    async updateLeadDirectness(input: {
      leadId: string;
      classification: "DIRECT" | "INTERMEDIARY" | "UNKNOWN" | "SUPPRESSED";
      confidence: number;
      verified: boolean;
    }) {
      const [updated] = await db
        .update(leads)
        .set({
          directnessClassification: input.classification,
          directnessConfidence: Math.max(0, Math.min(100, input.confidence)),
          directnessVerified: input.verified,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.leadId))
        .returning();

      return updated;
    },

    async countMissionOutreachReady(since: Date) {
      const [row] = await db
        .select({ count: count(leads.id) })
        .from(leads)
        .where(
          and(
            gte(leads.updatedAt, since),
            eq(leads.directnessClassification, "DIRECT"),
            eq(leads.directnessVerified, true),
            eq(leads.status, "qualified"),
          ),
        );

      return row?.count ?? 0;
    },

    async countMissionQualified(since: Date) {
      const [row] = await db
        .select({ count: count(leads.id) })
        .from(leads)
        .where(and(gte(leads.updatedAt, since), eq(leads.status, "qualified")));

      return row?.count ?? 0;
    },

    async countMissionDiscovered(since: Date) {
      const [row] = await db
        .select({ count: count(leads.id) })
        .from(leads)
        .where(gte(leads.createdAt, since));

      return row?.count ?? 0;
    },

    async countMissionAwaitingVerification(since: Date) {
      const [row] = await db
        .select({ count: count(leads.id) })
        .from(leads)
        .where(
          and(
            gte(leads.updatedAt, since),
            eq(leads.directnessClassification, "UNKNOWN"),
          ),
        );

      return row?.count ?? 0;
    },

    async getCommercialNorthStarSnapshot(now: Date) {
      const day = now.getUTCDay();
      const startOfWeek = new Date(now);
      startOfWeek.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
      startOfWeek.setUTCHours(0, 0, 0, 0);

      const activeStatuses = [
        "MATCHED",
        "VIEWING",
        "OFFER",
        "NEGOTIATION",
        "AGREED",
        "CONTRACT",
        "LIVE",
      ] as const;

      const [completedRow, pipelineRow, weightedRow] = await Promise.all([
        db
          .select({ count: count(deals.id) })
          .from(deals)
          .where(and(eq(deals.status, "COMPLETED"), gte(deals.updatedAt, startOfWeek)))
          .then((rows) => rows[0]),
        db
          .select({
            value: sql<number>`coalesce(sum(${deals.valueCents}), 0)`,
          })
          .from(deals)
          .where(inArray(deals.status, [...activeStatuses]))
          .then((rows) => rows[0]),
        db
          .select({
            value: sql<number>`coalesce(sum(case
              when ${deals.status} = 'LIVE' then coalesce(${deals.valueCents}, 0) * 0.90
              when ${deals.status} = 'CONTRACT' then coalesce(${deals.valueCents}, 0) * 0.80
              when ${deals.status} = 'AGREED' then coalesce(${deals.valueCents}, 0) * 0.70
              when ${deals.status} = 'NEGOTIATION' then coalesce(${deals.valueCents}, 0) * 0.55
              when ${deals.status} = 'OFFER' then coalesce(${deals.valueCents}, 0) * 0.45
              when ${deals.status} = 'VIEWING' then coalesce(${deals.valueCents}, 0) * 0.30
              when ${deals.status} = 'MATCHED' then coalesce(${deals.valueCents}, 0) * 0.20
              else 0
            end), 0)`,
          })
          .from(deals)
          .where(inArray(deals.status, [...activeStatuses]))
          .then((rows) => rows[0]),
      ]);

      return {
        weekStart: startOfWeek,
        weeklyTargetLow: 5,
        weeklyTargetHigh: 10,
        completedLetsThisWeek: completedRow?.count ?? 0,
        pipelineValueCents: Number(pipelineRow?.value ?? 0),
        weightedPipelineValueCents: Math.round(Number(weightedRow?.value ?? 0)),
      };
    },

    async recordExclusion(input: {
      leadId?: string;
      missionId?: string;
      reason:
        | "INTERMEDIARY"
        | "WRONG_PROPERTY"
        | "WRONG_AREA"
        | "WRONG_BEDROOM_COUNT"
        | "UNREALISTIC_RENT"
        | "DUPLICATE"
        | "SUPPRESSED"
        | "INSUFFICIENT_EVIDENCE"
        | "LOW_CONFIDENCE"
        | "REPEATEDLY_NON_RESPONSIVE"
        | "POOR_HISTORICAL_CONVERSION";
      explanation: string;
      confidence: number;
    }) {
      const [created] = await db
        .insert(acquisitionExclusions)
        .values({
          id: createEntityId("aex"),
          ...(input.leadId ? { leadId: input.leadId } : {}),
          ...(input.missionId ? { missionId: input.missionId } : {}),
          reason: input.reason,
          explanation: input.explanation,
          confidence: Math.max(0, Math.min(100, input.confidence)),
        })
        .returning();

      return created;
    },

    async upsertDemandHeatmapCell(input: {
      area?: string;
      borough?: string;
      town?: string;
      postcode?: string;
      bedroomsBand: string;
      propertyType:
        | "apartment"
        | "house"
        | "studio"
        | "maisonette"
        | "townhouse"
        | "other";
      budgetBand: string;
      corporateRequirementLabel?: string;
      requirementsCount: number;
      suitablePropertiesCount: number;
      shortageRatio: number;
      demandTrendScore: number;
      status:
        | "BALANCED"
        | "HIGH_DEMAND"
        | "SHORTAGE"
        | "CRITICAL_SHORTAGE"
        | "EMERGING_SHORTAGE";
      trace: Record<string, unknown>;
    }) {
      const [upserted] = await db
        .insert(demandHeatmapCells)
        .values({
          id: createEntityId("dhm"),
          ...(input.area ? { area: input.area } : {}),
          ...(input.borough ? { borough: input.borough } : {}),
          ...(input.town ? { town: input.town } : {}),
          ...(input.postcode ? { postcode: input.postcode } : {}),
          bedroomsBand: input.bedroomsBand,
          propertyType: input.propertyType,
          budgetBand: input.budgetBand,
          ...(input.corporateRequirementLabel
            ? { corporateRequirementLabel: input.corporateRequirementLabel }
            : {}),
          requirementsCount: input.requirementsCount,
          suitablePropertiesCount: input.suitablePropertiesCount,
          shortageRatio: input.shortageRatio,
          demandTrendScore: input.demandTrendScore,
          status: input.status,
          trace: input.trace,
        })
        .onConflictDoUpdate({
          target: [
            demandHeatmapCells.area,
            demandHeatmapCells.borough,
            demandHeatmapCells.town,
            demandHeatmapCells.postcode,
            demandHeatmapCells.bedroomsBand,
            demandHeatmapCells.propertyType,
            demandHeatmapCells.budgetBand,
          ],
          set: {
            requirementsCount: input.requirementsCount,
            suitablePropertiesCount: input.suitablePropertiesCount,
            shortageRatio: input.shortageRatio,
            demandTrendScore: input.demandTrendScore,
            status: input.status,
            trace: input.trace,
            updatedAt: new Date(),
          },
        })
        .returning();

      return upserted;
    },

    async listHeatmap(statuses?: Array<
      "BALANCED" | "HIGH_DEMAND" | "SHORTAGE" | "CRITICAL_SHORTAGE" | "EMERGING_SHORTAGE"
    >) {
      return db
        .select()
        .from(demandHeatmapCells)
        .where(statuses?.length ? inArray(demandHeatmapCells.status, statuses) : sql`true`)
        .orderBy(desc(demandHeatmapCells.shortageRatio), desc(demandHeatmapCells.updatedAt))
        .limit(300);
    },

    async listRequirementDemandSnapshot() {
      return db
        .select({
          area: requirements.preferredArea,
          bedroomsMin: requirements.bedroomsMin,
          bedroomsMax: requirements.bedroomsMax,
          budgetMinCents: requirements.budgetMinCents,
          budgetMaxCents: requirements.budgetMaxCents,
          requirementCount: count(requirements.id),
        })
        .from(requirements)
        .where(inArray(requirements.status, ["open", "matched"]))
        .groupBy(
          requirements.preferredArea,
          requirements.bedroomsMin,
          requirements.bedroomsMax,
          requirements.budgetMinCents,
          requirements.budgetMaxCents,
        );
    },

    async createAgentMessage(input: {
      type: string;
      title: string;
      body: string;
      severity: "info" | "warning" | "critical";
      leadId?: string;
      missionId?: string;
    }) {
      const [created] = await db
        .insert(agentMessages)
        .values({
          id: createEntityId("agm"),
          type: input.type,
          title: input.title,
          body: input.body,
          severity: input.severity,
          ...(input.leadId ? { leadId: input.leadId } : {}),
          ...(input.missionId ? { missionId: input.missionId } : {}),
        })
        .returning();

      return created;
    },

    async listAgentMessages(limit = 100) {
      return db
        .select()
        .from(agentMessages)
        .orderBy(desc(agentMessages.createdAt))
        .limit(limit);
    },

    async listRecentAssessments(leadId: string) {
      return db
        .select()
        .from(directnessAssessments)
        .where(eq(directnessAssessments.leadId, leadId))
        .orderBy(desc(directnessAssessments.createdAt))
        .limit(20);
    },
  };
}

export type AcquisitionEngineRepository = ReturnType<
  typeof createAcquisitionEngineRepository
>;
