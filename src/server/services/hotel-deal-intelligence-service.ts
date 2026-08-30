import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import { createEntityId } from "@/db/ids";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import { PQ_SUPPLIED_HOTEL_INVENTORY_TEXT } from "@/server/hotel/pq-master-inventory";

import {
  conversations,
  deals,
  evidence,
  followUpQueue,
  leads,
  requirements,
  signals,
  sources,
  tasks,
} from "@/db/schema";
import { createAuditService } from "./audit-event-service";

type HotelClassification =
  | "DIRECT_OWNER"
  | "DIRECT_AUTHORISED_REPRESENTATIVE"
  | "VERIFIED_MANDATE"
  | "INTERMEDIARY_UNVERIFIED"
  | "UNKNOWN";

type InventoryStock = {
  inventoryRef: string;
  rawEntry: string;
  hotelName: string;
  location: string;
  country: string | null;
  keys: number | null;
  priceLabel: string | null;
  statusLabel: string | null;
  directness: HotelClassification;
  confidence: number;
  evidenceNotes: string[];
};

type BuyerProfile = {
  leadId: string;
  requirementId: string;
  label: string;
  locationTarget: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  directnessClassification: string;
  decisionMakerHint: string | null;
  confidence: number;
};

type MatchResult = {
  stock: InventoryStock;
  buyer: BuyerProfile;
  score: number;
  reasons: string[];
};

const INTERMEDIARY_TERMS = [
  "broker",
  "agent",
  "introducer",
  "consultant",
  "deal finder",
  "intermediary",
  "on behalf",
  "sourcing",
  "adviser",
  "advisor",
  "mandate available",
];

const MANDATE_TERMS = [
  "exclusive mandate",
  "verified mandate",
  "seller representation",
  "owner instruction",
  "direct mandate",
  "principals only",
];

function ensureAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authorised team users can run hotel intelligence actions.");
  }
}

function normalizeInventoryText() {
  return PQ_SUPPLIED_HOTEL_INVENTORY_TEXT.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function parseKeys(text: string) {
  const match = text.match(/(\d[\d,]*)\s*(?:\+)?\s*(?:keys|rooms|units)/i);
  const keyCount = match?.[1];
  if (!keyCount) {
    return null;
  }

  const parsed = Number.parseInt(keyCount.replace(/,/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCountry(location: string) {
  const parts = location.split(",").map((part) => part.trim());
  if (parts.length === 0) {
    return null;
  }

  return parts[parts.length - 1] ?? null;
}

function classifyStock(rawEntry: string): {
  classification: HotelClassification;
  confidence: number;
  notes: string[];
} {
  const lower = rawEntry.toLowerCase();
  const hasIntermediary = INTERMEDIARY_TERMS.some((term) => lower.includes(term));
  const hasMandate = MANDATE_TERMS.some((term) => lower.includes(term));
  const explicitlyDirect = /\bdirect\b|owner managed|principals only/i.test(rawEntry);

  if (hasIntermediary && !hasMandate) {
    return {
      classification: "INTERMEDIARY_UNVERIFIED",
      confidence: 70,
      notes: ["Intermediary language detected", "Mandate evidence still required"],
    };
  }

  if (hasMandate) {
    return {
      classification: "VERIFIED_MANDATE",
      confidence: 82,
      notes: ["Mandate language detected", "Owner authority still requires evidence chain"],
    };
  }

  if (explicitlyDirect) {
    return {
      classification: "DIRECT_OWNER",
      confidence: 78,
      notes: ["Direct/principal language detected", "Ownership must still be evidenced"],
    };
  }

  return {
    classification: "UNKNOWN",
    confidence: 55,
    notes: ["No directness confirmation found", "Verification required before outreach"],
  };
}

function parseInventoryEntry(rawEntry: string): InventoryStock {
  const parts = rawEntry
    .replace(/\.$/, "")
    .split(" - ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const hotelName = parts[0] ?? rawEntry;
  const location = parts[1] ?? "Unknown";

  const keys = parseKeys(rawEntry);
  const priceMatch = rawEntry.match(/(EUR|GBP|USD|CHF)\s*[\d.,]+\s*(?:m|bn|k)?/i);
  const priceLabel = priceMatch?.[0] ?? (rawEntry.match(/\bTBA\b|\bPOA\b|On LOI/i)?.[0] ?? null);

  const statusLabel =
    rawEntry.match(/Under Offer|On LOI|Off Market|On hold|Vacant Possession|Operating|Refurbishment/i)?.[0] ??
    null;

  const directness = classifyStock(rawEntry);

  return {
    inventoryRef: `pq-hotel-${slugify(`${hotelName}-${location}`)}`,
    rawEntry,
    hotelName,
    location,
    country: parseCountry(location),
    keys,
    priceLabel,
    statusLabel,
    directness: directness.classification,
    confidence: directness.confidence,
    evidenceNotes: directness.notes,
  };
}

function parseLocationFromLeadSummary(summary: string) {
  const parts = summary.split("|").map((part) => part.trim());
  if (parts.length >= 2) {
    return parts[1] ?? "Unknown";
  }

  return "Unknown";
}

function parsePriceLabelFromLeadSummary(summary: string) {
  const parts = summary.split("|").map((part) => part.trim());
  if (parts.length >= 3) {
    return parts[2] ?? null;
  }

  const match = summary.match(/(EUR|GBP|USD|CHF)\s*[\d.,]+\s*(?:m|bn|k)?/i);
  return match?.[0] ?? null;
}

function parseCurrencyToCents(priceLabel: string | null): number | null {
  if (!priceLabel) {
    return null;
  }

  const match = priceLabel.match(/(EUR|GBP|USD|CHF)\s*([\d.,]+)\s*(m|bn|k)?/i);
  if (!match) {
    return null;
  }

  const numericPart = match[2];
  if (!numericPart) {
    return null;
  }

  const raw = Number.parseFloat(numericPart.replace(/,/g, ""));
  if (!Number.isFinite(raw)) {
    return null;
  }

  const multiplier = match[3]?.toLowerCase() === "bn" ? 1_000_000_000 : match[3]?.toLowerCase() === "m" ? 1_000_000 : match[3]?.toLowerCase() === "k" ? 1_000 : 1;
  const base = raw * multiplier;

  return Math.round(base * 100);
}

function scoreMatch(input: { stock: InventoryStock; buyer: BuyerProfile }) {
  let score = 0;
  const reasons: string[] = [];

  if (input.buyer.locationTarget && input.stock.location.toLowerCase().includes(input.buyer.locationTarget.toLowerCase())) {
    score += 35;
    reasons.push("geography aligned");
  }

  const stockPrice = parseCurrencyToCents(input.stock.priceLabel);
  if (
    stockPrice !== null &&
    input.buyer.budgetMaxCents !== null &&
    stockPrice <= input.buyer.budgetMaxCents
  ) {
    score += 30;
    reasons.push("ticket size within buyer max");
  }

  if (
    stockPrice !== null &&
    input.buyer.budgetMinCents !== null &&
    stockPrice >= input.buyer.budgetMinCents
  ) {
    score += 12;
    reasons.push("ticket above buyer minimum");
  }

  if (input.stock.keys && input.stock.keys >= 100) {
    score += 12;
    reasons.push("institutional key count");
  }

  if (
    input.stock.directness === "DIRECT_OWNER" ||
    input.stock.directness === "VERIFIED_MANDATE" ||
    input.stock.directness === "DIRECT_AUTHORISED_REPRESENTATIVE"
  ) {
    score += 11;
    reasons.push("direct/mandated sell-side posture");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

function draftBuyerMessage(input: { buyerLabel: string; stock: InventoryStock; evidence: string[] }) {
  return [
    `Subject: Direct hotel opportunity alignment check`,
    "",
    `Hi ${input.buyerLabel},`,
    "",
    `I am reaching out because we have access to a direct hotel opportunity that may align with your acquisition criteria: ${input.stock.hotelName} (${input.stock.location}).`,
    `Current evidence status: ${input.stock.directness}.`,
    input.evidence.slice(0, 2).map((line) => `- ${line}`).join("\n"),
    "",
    "If useful, we can share a short evidence pack and confirm mandate chain before any introduction.",
    "",
    "Best regards,",
    "PQ Real Estate",
  ].join("\n");
}

function draftSellerMessage(input: { sellerLabel: string; buyerEvidence: string[] }) {
  return [
    "Subject: Direct investor introduction check",
    "",
    `Hi ${input.sellerLabel},`,
    "",
    "We are currently speaking with direct hospitality investors and decision-makers that may be relevant for this hotel opportunity.",
    input.buyerEvidence.slice(0, 2).map((line) => `- ${line}`).join("\n"),
    "",
    "If appropriate, we can proceed with a controlled introduction once authority and process details are confirmed.",
    "",
    "Best regards,",
    "PQ Real Estate",
  ].join("\n");
}

export function createHotelDealIntelligenceService() {
  const db = getDatabaseConfig(appEnv).configured ? getDb() : null;
  const auditService = createAuditService();

  return {
    listMasterInventory(limit = 200) {
      return normalizeInventoryText().slice(0, limit).map(parseInventoryEntry);
    },

    async seedMasterInventory(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
      ensureAccess(actor);

      if (!db) {
        throw new Error("DATABASE_URL is required before loading hotel master inventory.");
      }

      const [existingSource] = await db
        .select()
        .from(sources)
        .where(eq(sources.name, "PQ Existing Hotel Stock"))
        .limit(1);

      const source =
        existingSource ??
        (await db
          .insert(sources)
          .values({
            id: createEntityId("src"),
            name: "PQ Existing Hotel Stock",
            kind: "manual",
            status: "active",
            connectorKey: "hotel.master.inventory",
            permissionStatus: "APPROVED",
            enabled: true,
            health: "healthy",
            notes: "PQ supplied hotel stock inventory requiring verification.",
            allowedData: "Publicly shareable transaction teasers and internal supplied stock list.",
            config: {
              sourceClass: "PQ_EXISTING_HOTEL_STOCK",
              requiresVerification: true,
            },
          })
          .returning()
          .then((rows) => rows[0]));

      if (!source) {
        throw new Error("Failed to initialize hotel inventory source.");
      }

      const entries = this.listMasterInventory();
      let created = 0;
      let skipped = 0;

      for (const stock of entries) {
        const leadSummary = `[${stock.inventoryRef}] ${stock.hotelName} | ${stock.location} | ${stock.priceLabel ?? "price_tba"}`;
        const [existingLead] = await db
          .select()
          .from(leads)
          .where(and(eq(leads.sourceId, source.id), eq(leads.summary, leadSummary)))
          .limit(1);

        if (existingLead) {
          skipped += 1;
          continue;
        }

        const [lead] = await db
          .insert(leads)
          .values({
            id: createEntityId("led"),
            sourceId: source.id,
            leadType: "supply",
            status: "researching",
            score: 55,
            confidence: stock.confidence,
            outreachStatus: "not_started",
            directnessClassification: stock.directness === "INTERMEDIARY_UNVERIFIED" ? "INTERMEDIARY" : stock.directness === "UNKNOWN" ? "UNKNOWN" : "DIRECT",
            directnessConfidence: stock.confidence,
            directnessVerified: false,
            summary: leadSummary,
            nextAction: "Verify asset identity, owner, and mandate evidence chain.",
          })
          .returning();

        if (!lead) {
          continue;
        }

        const [signal] = await db
          .insert(signals)
          .values({
            id: createEntityId("sig"),
            sourceId: source.id,
            leadId: lead.id,
            type: "availability",
            status: "new",
            payload: {
              marketSegment: "hotel",
              side: "seller_stock",
              pqSupplied: true,
              inventoryRef: stock.inventoryRef,
              rawEntry: stock.rawEntry,
              parsed: {
                hotelName: stock.hotelName,
                location: stock.location,
                country: stock.country,
                keys: stock.keys,
                priceLabel: stock.priceLabel,
                statusLabel: stock.statusLabel,
              },
            },
            detectedAt: new Date(),
          })
          .returning();

        if (!signal) {
          continue;
        }

        await db.insert(evidence).values({
          id: createEntityId("evd"),
          sourceId: source.id,
          leadId: lead.id,
          signalId: signal.id,
          sourceReference: stock.inventoryRef,
          sourceUrl: null,
          detectedAt: new Date(),
          summary: `PQ supplied stock record imported. ${stock.rawEntry}`,
          confidence: stock.confidence,
          collectionMethod: "manual",
        });

        created += 1;
      }

      await auditService.recordEvent({
        actor,
        action: "hotel.master_inventory.seeded",
        entityType: "source",
        entityId: source.id,
        metadata: {
          created,
          skipped,
          total: entries.length,
        },
      });

      return { created, skipped, total: entries.length };
    },

    async getPipelineSnapshot() {
      const inventory = this.listMasterInventory();

      if (!db) {
        return {
          inventoryCount: inventory.length,
          hotDirectStock: inventory.filter((item) => item.directness === "DIRECT_OWNER" || item.directness === "VERIFIED_MANDATE").length,
          hotDirectBuyers: 0,
          newlyVerified: 0,
          respondedHumanActionRequired: 0,
          readyToReachOut: 0,
          followUps: 0,
          dealsInProgress: 0,
        };
      }

      const hotelLeadFilter = ilike(leads.summary, "%hotel%");

      const [hotDirectStockRow] = await db
        .select({ count: count(leads.id) })
        .from(leads)
        .where(
          and(
            eq(leads.leadType, "supply"),
            inArray(leads.directnessClassification, ["DIRECT"]),
            inArray(leads.status, ["new", "researching", "qualified"]),
            hotelLeadFilter,
            isNull(leads.archivedAt),
          ),
        );

      const [hotDirectBuyerRow] = await db
        .select({ count: count(requirements.id) })
        .from(requirements)
        .leftJoin(leads, eq(leads.id, requirements.leadId))
        .where(
          and(
            eq(requirements.relationshipType, "DIRECT"),
            eq(leads.directnessClassification, "DIRECT"),
            inArray(requirements.status, ["open", "matched"]),
            sql`${leads.summary} ilike '%hotel%'`,
          ),
        );

      const [newlyVerifiedRow] = await db
        .select({ count: count(leads.id) })
        .from(leads)
        .where(
          and(
            eq(leads.directnessVerified, true),
            hotelLeadFilter,
            sql`${leads.updatedAt} >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}`,
          ),
        );

      const [readyToReachOutRow] = await db
        .select({ count: count(leads.id) })
        .from(leads)
        .where(
          and(
            inArray(leads.status, ["qualified", "nurturing"]),
            inArray(leads.outreachStatus, ["not_started", "drafted"]),
            inArray(leads.directnessClassification, ["DIRECT"]),
            eq(leads.directnessVerified, true),
            hotelLeadFilter,
            isNull(leads.archivedAt),
          ),
        );

      const [respondedRow] = await db
        .select({ count: count(conversations.id) })
        .from(conversations)
        .leftJoin(leads, eq(leads.id, conversations.leadId))
        .where(
          and(
            inArray(conversations.inboxCategory, ["HOT", "INTERESTED"]),
            inArray(conversations.status, ["open", "pending"]),
            sql`${leads.summary} ilike '%hotel%'`,
          ),
        );

      const [followUpRow] = await db
        .select({ count: count(followUpQueue.id) })
        .from(followUpQueue)
        .leftJoin(leads, eq(leads.id, followUpQueue.leadId))
        .where(and(eq(followUpQueue.status, "scheduled"), sql`${leads.summary} ilike '%hotel%'`));

      const [dealsRow] = await db
        .select({ count: count(deals.id) })
        .from(deals)
        .leftJoin(leads, eq(leads.id, deals.leadId))
        .where(
          and(
            inArray(deals.status, ["MATCHED", "VIEWING", "OFFER", "NEGOTIATION", "AGREED", "CONTRACT", "LIVE"]),
            sql`${leads.summary} ilike '%hotel%'`,
          ),
        );

      return {
        inventoryCount: inventory.length,
        hotDirectStock: hotDirectStockRow?.count ?? 0,
        hotDirectBuyers: hotDirectBuyerRow?.count ?? 0,
        newlyVerified: newlyVerifiedRow?.count ?? 0,
        respondedHumanActionRequired: respondedRow?.count ?? 0,
        readyToReachOut: readyToReachOutRow?.count ?? 0,
        followUps: followUpRow?.count ?? 0,
        dealsInProgress: dealsRow?.count ?? 0,
      };
    },

    async listDirectBuyers(limit = 40): Promise<BuyerProfile[]> {
      if (!db) {
        return [];
      }

      const rows = await db
        .select({
          requirement: requirements,
          lead: leads,
        })
        .from(requirements)
        .leftJoin(leads, eq(leads.id, requirements.leadId))
        .where(
          and(
            eq(requirements.relationshipType, "DIRECT"),
            eq(leads.directnessClassification, "DIRECT"),
            inArray(requirements.status, ["open", "matched"]),
            sql`${leads.summary} ilike '%hotel%'`,
          ),
        )
        .orderBy(desc(requirements.updatedAt))
        .limit(limit);

      return rows.map((row) => ({
        leadId: row.requirement.leadId ?? "unknown",
        requirementId: row.requirement.id,
        label: row.lead?.summary ?? row.requirement.purpose ?? row.requirement.id,
        locationTarget: row.requirement.preferredArea,
        budgetMinCents: row.requirement.budgetMinCents,
        budgetMaxCents: row.requirement.budgetMaxCents,
        directnessClassification: row.lead?.directnessClassification ?? "UNKNOWN",
        decisionMakerHint: row.requirement.nextAction,
        confidence: Math.max(50, row.lead?.confidence ?? 50),
      }));
    },

    async listLiveStockUniverse(limit = 250): Promise<InventoryStock[]> {
      const master = this.listMasterInventory(limit);

      if (!db) {
        return master;
      }

      const discoveredLeads = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.leadType, "supply"),
            inArray(leads.status, ["new", "researching", "qualified", "nurturing"]),
            eq(leads.directnessClassification, "DIRECT"),
            eq(leads.directnessVerified, true),
            ilike(leads.summary, "%hotel%"),
            isNull(leads.archivedAt),
          ),
        )
        .orderBy(desc(leads.updatedAt))
        .limit(limit);

      const discovered: InventoryStock[] = discoveredLeads.map((lead) => {
        const summary = lead.summary ?? `discovered stock ${lead.id}`;
        return {
          inventoryRef: `lead-${lead.id}`,
          rawEntry: summary,
          hotelName: summary.split("|")[0]?.trim() ?? `hotel-${lead.id}`,
          location: parseLocationFromLeadSummary(summary),
          country: parseCountry(parseLocationFromLeadSummary(summary)),
          keys: parseKeys(summary),
          priceLabel: parsePriceLabelFromLeadSummary(summary),
          statusLabel: lead.status,
          directness: "DIRECT_OWNER",
          confidence: Math.max(60, lead.confidence),
          evidenceNotes: [
            "Discovered from verified direct supply lead.",
            "Lead-level evidence chain should be reviewed before introduction.",
          ],
        };
      });

      const merged = new Map<string, InventoryStock>();
      for (const item of master) {
        merged.set(item.inventoryRef, item);
      }
      for (const item of discovered) {
        merged.set(item.inventoryRef, item);
      }

      return Array.from(merged.values());
    },

    async generateMatches(limit = 25): Promise<MatchResult[]> {
      const stock = await this.listLiveStockUniverse();
      const buyers = await this.listDirectBuyers();

      const results: MatchResult[] = [];

      for (const buyer of buyers) {
        for (const item of stock) {
          const candidate = scoreMatch({ stock: item, buyer });
          if (candidate.score >= 45) {
            results.push({
              stock: item,
              buyer,
              score: candidate.score,
              reasons: candidate.reasons,
            });
          }
        }
      }

      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    },

    async runSellSideResearchCycle(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
      ensureAccess(actor);

      if (!db) {
        throw new Error("DATABASE_URL is required before sell-side research can run.");
      }

      const seed = await this.seedMasterInventory(actor);

      const unverifiedStockLeads = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.leadType, "supply"),
            ilike(leads.summary, "%hotel%"),
            or(eq(leads.directnessVerified, false), eq(leads.directnessClassification, "UNKNOWN")),
            isNull(leads.archivedAt),
          ),
        )
        .orderBy(desc(leads.updatedAt))
        .limit(120);

      let tasksCreated = 0;
      for (const lead of unverifiedStockLeads) {
        const created = await ensureTaskIfMissing({
          db,
          leadId: lead.id,
          title: "VERIFY HOTEL SELLER MANDATE",
          description:
            "Confirm owner entity, authority to sell, and mandate evidence chain before outreach.",
          ...(actor.userId ? { assignedToUserId: actor.userId } : {}),
          ...(actor.userId ? { createdByUserId: actor.userId } : {}),
          priority: "urgent",
        });

        if (created) {
          tasksCreated += 1;
        }
      }

      return {
        imported: seed,
        verificationQueue: unverifiedStockLeads.length,
        tasksCreated,
      };
    },

    async runBuySideResearchCycle(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
      ensureAccess(actor);

      if (!db) {
        throw new Error("DATABASE_URL is required before buy-side research can run.");
      }

      const candidateRequirements = await db
        .select({
          requirement: requirements,
          lead: leads,
        })
        .from(requirements)
        .leftJoin(leads, eq(leads.id, requirements.leadId))
        .where(
          and(
            inArray(requirements.status, ["open", "matched"]),
            isNull(requirements.archivedAt),
            or(
              sql`${leads.summary} ilike '%hotel%'`,
              sql`${requirements.purpose} ilike '%hotel%'`,
              sql`${requirements.nextAction} ilike '%hotel%'`,
            ),
          ),
        )
        .orderBy(desc(requirements.updatedAt))
        .limit(120);

      let directProfiles = 0;
      let decisionMakerTasks = 0;

      for (const row of candidateRequirements) {
        const lead = row.lead;
        if (lead?.directnessClassification === "DIRECT" && lead.directnessVerified) {
          directProfiles += 1;
          continue;
        }

        if (lead?.id) {
          const created = await ensureTaskIfMissing({
            db,
            leadId: lead.id,
            title: "VERIFY HOTEL BUYER DECISION-MAKER",
            description:
              "Confirm principal decision-maker, acquisition mandate, and direct contact route.",
            ...(actor.userId ? { assignedToUserId: actor.userId } : {}),
            ...(actor.userId ? { createdByUserId: actor.userId } : {}),
            priority: "urgent",
          });

          if (created) {
            decisionMakerTasks += 1;
          }
        }
      }

      return {
        candidateRequirements: candidateRequirements.length,
        directProfiles,
        decisionMakerTasks,
      };
    },

    async runLiveMatchCycle(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
      ensureAccess(actor);

      if (!db) {
        throw new Error("DATABASE_URL is required before match cycle can run.");
      }

      const matches = await this.generateMatches(40);
      let highConfidence = 0;
      let handoffTasks = 0;

      for (const match of matches) {
        if (match.score < 85) {
          continue;
        }

        highConfidence += 1;

        const leadId = match.buyer.leadId !== "unknown" ? match.buyer.leadId : null;

        const created = await ensureTaskIfMissing({
          db,
          ...(leadId ? { leadId } : {}),
          title: "HIGH-CONFIDENCE HOTEL MATCH",
          description: `${match.stock.hotelName} <-> ${match.buyer.label}. Reasons: ${match.reasons.join(", ")}.`,
          ...(actor.userId ? { assignedToUserId: actor.userId } : {}),
          ...(actor.userId ? { createdByUserId: actor.userId } : {}),
          priority: "urgent",
        });

        if (created) {
          handoffTasks += 1;
        }
      }

      return {
        matchesConsidered: matches.length,
        highConfidence,
        handoffTasks,
      };
    },

    async runUnifiedCycle(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
      const sell = await this.runSellSideResearchCycle(actor);
      const buy = await this.runBuySideResearchCycle(actor);
      const match = await this.runLiveMatchCycle(actor);

      return {
        sell,
        buy,
        match,
      };
    },

    buildOutreachPreview(input: { stock: InventoryStock; buyer: BuyerProfile }) {
      return {
        buyerMessage: draftBuyerMessage({
          buyerLabel: input.buyer.label,
          stock: input.stock,
          evidence: input.stock.evidenceNotes,
        }),
        sellerMessage: draftSellerMessage({
          sellerLabel: input.stock.hotelName,
          buyerEvidence: [
            `Buyer lead: ${input.buyer.label}`,
            `Directness: ${input.buyer.directnessClassification}`,
          ],
        }),
      };
    },

    async createHumanHandoffTask(
      input: { leadId: string; title: string; description?: string },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!db) {
        throw new Error("DATABASE_URL is required before creating handoff tasks.");
      }

      const [task] = await db
        .insert(tasks)
        .values({
          id: createEntityId("tsk"),
          leadId: input.leadId,
          createdByUserId: actor.userId ?? null,
          assignedToUserId: actor.userId ?? null,
          title: input.title,
          description:
            input.description ??
            "Lead responded. Human action required: verify context, prepare call, and progress transaction.",
          priority: "urgent",
          status: "todo",
          dueAt: new Date(),
        })
        .returning();

      if (!task) {
        throw new Error("Failed to create hotel handoff task.");
      }

      await auditService.recordEvent({
        actor,
        action: "hotel.human_handoff.task_created",
        entityType: "task",
        entityId: task.id,
        metadata: {
          leadId: input.leadId,
        },
      });

      return task;
    },
  };
}

async function ensureTaskIfMissing(input: {
  db: ReturnType<typeof getDb>;
  leadId?: string;
  title: string;
  description: string;
  createdByUserId?: string;
  assignedToUserId?: string;
  priority: "low" | "medium" | "high" | "urgent";
}) {
  if (!input.leadId) {
    return false;
  }

  const [existing] = await input.db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.leadId, input.leadId),
        eq(tasks.title, input.title),
        inArray(tasks.status, ["todo", "in_progress"]),
        isNull(tasks.archivedAt),
      ),
    )
    .limit(1);

  if (existing) {
    return false;
  }

  await input.db.insert(tasks).values({
    id: createEntityId("tsk"),
    leadId: input.leadId,
    title: input.title,
    description: input.description,
    status: "todo",
    priority: input.priority,
    dueAt: new Date(),
    createdByUserId: input.createdByUserId ?? null,
    assignedToUserId: input.assignedToUserId ?? null,
  });

  return true;
}
