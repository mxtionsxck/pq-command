import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  notExists,
  sql,
} from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import {
  companies,
  contacts,
  leads,
  outreachCampaigns,
  requirements,
  sources,
  suppressionList,
  workerControls,
} from "@/db/schema";

type EligibilityFilter = {
  minimumScore: number;
  sourceId?: string;
  location?: string;
  bedroomsMin?: number;
  bedroomsMax?: number;
  unitCountMin?: number;
};

function compactConditions<T>(values: Array<T | undefined>) {
  return values.filter((value): value is T => value !== undefined);
}

export function createOutreachRepository(db: PQCommandDb) {
  type CampaignCreateInput = Omit<
    typeof outreachCampaigns.$inferInsert,
    "createdAt" | "updatedAt" | "id"
  > & {
    id?: string;
  };

  type CampaignUpdateInput = Partial<
    Omit<
      typeof outreachCampaigns.$inferInsert,
      "createdAt" | "updatedAt" | "id"
    >
  >;

  return {
    async createCampaign(input: CampaignCreateInput) {
      const [created] = await db
        .insert(outreachCampaigns)
        .values({
          ...input,
          id: input.id ?? createEntityId("cam"),
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create outreach campaign.");
      }

      return created;
    },

    async updateCampaign(campaignId: string, input: CampaignUpdateInput) {
      const [updated] = await db
        .update(outreachCampaigns)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(outreachCampaigns.id, campaignId))
        .returning();

      return updated;
    },

    async findCampaignById(campaignId: string) {
      const [campaign] = await db
        .select()
        .from(outreachCampaigns)
        .where(eq(outreachCampaigns.id, campaignId))
        .limit(1);

      return campaign;
    },

    async listCampaigns(limit = 100) {
      return db
        .select()
        .from(outreachCampaigns)
        .where(isNull(outreachCampaigns.archivedAt))
        .orderBy(
          desc(outreachCampaigns.updatedAt),
          desc(outreachCampaigns.createdAt),
        )
        .limit(limit);
    },

    async previewEligibleLeads(filter: EligibilityFilter) {
      const conditions = compactConditions([
        isNull(leads.archivedAt),
        eq(leads.leadType, "demand"),
        gte(leads.score, filter.minimumScore),
        filter.sourceId ? eq(leads.sourceId, filter.sourceId) : undefined,
        filter.location
          ? ilike(requirements.preferredArea, `%${filter.location}%`)
          : undefined,
        filter.bedroomsMin !== undefined
          ? gte(requirements.bedroomsMin, filter.bedroomsMin)
          : undefined,
        filter.bedroomsMax !== undefined
          ? sql<boolean>`${requirements.bedroomsMax} <= ${filter.bedroomsMax}`
          : undefined,
        filter.unitCountMin !== undefined
          ? gte(requirements.unitCount, filter.unitCountMin)
          : undefined,
        notExists(
          db
            .select({ id: suppressionList.id })
            .from(suppressionList)
            .where(
              and(
                eq(suppressionList.channel, "email"),
                eq(suppressionList.value, contacts.email),
                isNull(suppressionList.archivedAt),
              ),
            ),
        ),
      ]);

      return db
        .select({
          leadId: leads.id,
          leadScore: leads.score,
          leadStatus: leads.status,
          sourceName: sources.name,
          contactId: contacts.id,
          contactEmail: contacts.email,
          contactName: sql<string>`concat(${contacts.firstName}, ' ', ${contacts.lastName})`,
          companyId: companies.id,
          companyName: companies.name,
          requirementId: requirements.id,
          preferredArea: requirements.preferredArea,
          bedroomsMin: requirements.bedroomsMin,
          bedroomsMax: requirements.bedroomsMax,
          unitCount: requirements.unitCount,
          relationshipType: requirements.relationshipType,
          directRelationshipVerified: requirements.directRelationshipVerified,
        })
        .from(leads)
        .leftJoin(contacts, eq(contacts.id, leads.contactId))
        .leftJoin(companies, eq(companies.id, leads.companyId))
        .leftJoin(sources, eq(sources.id, leads.sourceId))
        .leftJoin(
          requirements,
          and(
            eq(requirements.leadId, leads.id),
            isNull(requirements.archivedAt),
          ),
        )
        .where(and(...conditions))
        .orderBy(desc(leads.score), desc(leads.updatedAt))
        .limit(300);
    },

    async markCampaignRunning(campaignId: string, launchedAt: Date) {
      return this.updateCampaign(campaignId, {
        status: "running",
        launchedAt,
        active: true,
      });
    },

    async pauseCampaign(campaignId: string) {
      return this.updateCampaign(campaignId, {
        status: "paused",
        active: false,
      });
    },

    async listLeadsByIds(leadIds: string[]) {
      if (leadIds.length === 0) {
        return [];
      }

      return db.select().from(leads).where(inArray(leads.id, leadIds));
    },

    async isGlobalLevel3Enabled() {
      const [row] = await db
        .select({ paused: workerControls.paused })
        .from(workerControls)
        .where(eq(workerControls.workerName, "outreach_level3_switch"))
        .limit(1);

      return row?.paused === false;
    },

    async setGlobalLevel3Enabled(input: { enabled: boolean }) {
      const [row] = await db
        .insert(workerControls)
        .values({
          id: createEntityId("wct"),
          workerName: "outreach_level3_switch",
          paused: !input.enabled,
          concurrencyLimit: 1,
          notes: "Global Level 3 autonomy switch",
        })
        .onConflictDoUpdate({
          target: workerControls.workerName,
          set: {
            paused: !input.enabled,
            notes: "Global Level 3 autonomy switch",
            updatedAt: new Date(),
          },
        })
        .returning();

      return row;
    },
  };
}

export type OutreachRepository = ReturnType<typeof createOutreachRepository>;
