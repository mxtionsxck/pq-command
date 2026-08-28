import { and, desc, eq, ilike, inArray, isNull, max, sql } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import type { NewLead } from "@/db/models";
import {
  aiConclusions,
  companies,
  contacts,
  evidence,
  leads,
  properties,
  signals,
  sources,
} from "@/db/schema";
import type { LeadRoomView } from "@/domain/lead/types";

import { createRepository } from "./base-repository";

function compactConditions<T>(values: Array<T | undefined>): T[] {
  return values.filter((value): value is T => value !== undefined);
}

function viewCondition(view: LeadRoomView) {
  switch (view) {
    case "supply":
      return eq(leads.leadType, "supply");
    case "demand":
      return eq(leads.leadType, "demand");
    case "ai_discovered":
      return eq(leads.leadType, "ai_discovered");
    case "researching":
      return eq(leads.status, "researching");
    case "qualified":
      return eq(leads.status, "qualified");
  }
}

export function createLeadRoomRepository(db: PQCommandDb) {
  const leadRepository = createRepository(db, leads, "led");

  return {
    createLead(
      input: Omit<NewLead, "id" | "createdAt" | "updatedAt"> & { id?: string },
    ) {
      return leadRepository.create(
        input as Parameters<typeof leadRepository.create>[0],
      );
    },

    updateLead(id: string, input: Partial<NewLead>) {
      return leadRepository.updateById(id, input);
    },

    findLeadById(id: string) {
      return leadRepository.findById(id);
    },

    async listLeads(
      view: LeadRoomView,
      search?: string,
      pagination?: { limit?: number; offset?: number },
    ) {
      const conditions = compactConditions([
        isNull(leads.archivedAt),
        viewCondition(view),
        search
          ? ilike(
              sql<string>`concat(${contacts.firstName}, ' ', ${contacts.lastName})`,
              `%${search}%`,
            )
          : undefined,
      ]);

      const leadRows = await db
        .select({
          lead: leads,
          sourceName: sources.name,
          companyName: companies.name,
          contactFirstName: contacts.firstName,
          contactLastName: contacts.lastName,
          propertyTitle: properties.title,
        })
        .from(leads)
        .leftJoin(sources, eq(sources.id, leads.sourceId))
        .leftJoin(companies, eq(companies.id, leads.companyId))
        .leftJoin(contacts, eq(contacts.id, leads.contactId))
        .leftJoin(properties, eq(properties.id, leads.propertyId))
        .where(and(...conditions))
        .orderBy(desc(leads.updatedAt), desc(leads.createdAt))
        .limit(Math.max(1, Math.min(100, pagination?.limit ?? 25)))
        .offset(Math.max(0, pagination?.offset ?? 0));

      if (leadRows.length === 0) {
        return [];
      }

      const leadIds = leadRows.map((row) => row.lead.id);
      const evidenceRows = await db
        .select({
          leadId: evidence.leadId,
          evidenceCount: sql<number>`count(*)::int`,
          lastSignalAt: max(evidence.detectedAt),
        })
        .from(evidence)
        .where(inArray(evidence.leadId, leadIds))
        .groupBy(evidence.leadId);

      const evidenceByLeadId = new Map(
        evidenceRows
          .filter((row) => row.leadId)
          .map((row) => [
            row.leadId as string,
            {
              evidenceCount: row.evidenceCount,
              lastSignalAt: row.lastSignalAt,
            },
          ]),
      );

      return leadRows.map((row) => {
        const evidence = evidenceByLeadId.get(row.lead.id);
        const contactName =
          row.contactFirstName && row.contactLastName
            ? `${row.contactFirstName} ${row.contactLastName}`
            : (row.contactFirstName ?? row.contactLastName ?? null);

        return {
          lead: row.lead,
          sourceName: row.sourceName,
          companyName: row.companyName,
          contactName,
          propertyTitle: row.propertyTitle,
          evidenceCount: evidence?.evidenceCount ?? 0,
          lastSignalAt: evidence?.lastSignalAt ?? null,
        };
      });
    },

    async getLeadDrawer(id: string) {
      const [leadRow] = await db
        .select({
          lead: leads,
          sourceName: sources.name,
          sourceKind: sources.kind,
          sourceConnectorKey: sources.connectorKey,
          companyName: companies.name,
          contactFirstName: contacts.firstName,
          contactLastName: contacts.lastName,
          propertyTitle: properties.title,
        })
        .from(leads)
        .leftJoin(sources, eq(sources.id, leads.sourceId))
        .leftJoin(companies, eq(companies.id, leads.companyId))
        .leftJoin(contacts, eq(contacts.id, leads.contactId))
        .leftJoin(properties, eq(properties.id, leads.propertyId))
        .where(eq(leads.id, id))
        .limit(1);

      if (!leadRow) {
        return null;
      }

      const leadSignals = await db
        .select()
        .from(signals)
        .where(eq(signals.leadId, id))
        .orderBy(desc(signals.detectedAt), desc(signals.createdAt))
        .limit(50);

      const leadEvidence = await db
        .select()
        .from(evidence)
        .where(and(eq(evidence.leadId, id), isNull(evidence.archivedAt)))
        .orderBy(desc(evidence.detectedAt), desc(evidence.createdAt))
        .limit(50);

      const supportedConclusionRows = await db
        .select({ id: aiConclusions.id })
        .from(aiConclusions)
        .where(
          and(
            eq(aiConclusions.leadId, id),
            eq(aiConclusions.supported, true),
            eq(aiConclusions.status, "advisory"),
            isNull(aiConclusions.archivedAt),
          ),
        );

      return {
        leadRow,
        leadSignals,
        leadEvidence,
        supportedConclusionCount: supportedConclusionRows.length,
      };
    },

    async archiveLead(id: string) {
      const [lead] = await db
        .update(leads)
        .set({
          status: "archived",
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, id))
        .returning();

      return lead;
    },
  };
}

export type LeadRoomRepository = ReturnType<typeof createLeadRoomRepository>;
