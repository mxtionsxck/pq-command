import { and, asc, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import { createEntityId } from "@/db/ids";
import {
  companies,
  deals,
  documents,
  properties,
  rentLedgerEntries,
  tenancies,
} from "@/db/schema";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";

import { createAuditService } from "./audit-event-service";

function getDbOrNull() {
  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return getDb();
}

function ensureAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authorised team users can manage tenancy payments.");
  }
}

function toDateOnly(input: Date) {
  return input.toISOString().slice(0, 10);
}

function statusFromOutstanding(input: {
  entryType: "tenant_due" | "tenant_received" | "landlord_payable" | "landlord_paid";
  amountDueCents: number;
  amountReceivedCents: number;
  dueDate?: Date | null;
  now: Date;
}) {
  if (input.entryType === "landlord_paid") {
    return "PAID_TO_LANDLORD" as const;
  }

  if (input.entryType === "landlord_payable") {
    return input.amountReceivedCents >= input.amountDueCents
      ? ("PAID_TO_LANDLORD" as const)
      : ("PAYABLE" as const);
  }

  const outstanding = Math.max(0, input.amountDueCents - input.amountReceivedCents);
  if (outstanding <= 0) {
    return "PAID" as const;
  }

  if (input.amountReceivedCents > 0) {
    return "PARTIALLY_PAID" as const;
  }

  if (!input.dueDate) {
    return "UPCOMING" as const;
  }

  const nowDate = toDateOnly(input.now);
  const due = toDateOnly(input.dueDate);

  if (due < nowDate) {
    return "OVERDUE" as const;
  }

  const soonThreshold = new Date(input.now);
  soonThreshold.setDate(soonThreshold.getDate() + 3);
  if (due <= toDateOnly(soonThreshold)) {
    return "DUE_SOON" as const;
  }

  return "DUE" as const;
}

export function createTenancyPaymentService() {
  const db = getDbOrNull();
  const auditService = createAuditService();

  return {
    async createTenancy(
      input: {
        dealId?: string;
        propertyId?: string;
        landlordCompanyId?: string;
        tenantCompanyId?: string;
        ownerUserId?: string;
        rentFrequency: "weekly" | "monthly" | "quarterly";
        rentAmountCents: number;
        rentDueDayOfMonth?: number;
        tenancyStartDate: Date;
        tenancyEndDate?: Date;
        landlordPaymentLeadDays?: number;
        paymentReference?: string;
        notes?: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!db) {
        throw new Error("DATABASE_URL is required before tenancy payment lifecycle can run.");
      }

      const [tenancy] = await db
        .insert(tenancies)
        .values({
          id: createEntityId("ten"),
          dealId: input.dealId ?? null,
          propertyId: input.propertyId ?? null,
          landlordCompanyId: input.landlordCompanyId ?? null,
          tenantCompanyId: input.tenantCompanyId ?? null,
          ownerUserId: input.ownerUserId ?? actor.userId ?? null,
          status: "draft",
          rentFrequency: input.rentFrequency,
          rentAmountCents: input.rentAmountCents,
          rentDueDayOfMonth: input.rentDueDayOfMonth ?? null,
          tenancyStartDate: input.tenancyStartDate,
          tenancyEndDate: input.tenancyEndDate ?? null,
          landlordPaymentLeadDays: input.landlordPaymentLeadDays ?? 2,
          paymentReference: input.paymentReference ?? null,
          notes: input.notes ?? null,
        })
        .returning();

      await auditService.recordEvent({
        actor,
        action: "tenancy.created",
        entityType: "tenancy",
        entityId: tenancy?.id ?? "unknown",
      });

      return tenancy;
    },

    async setTenancyStatus(
      tenancyId: string,
      status: "draft" | "active" | "ended" | "cancelled",
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!db) {
        throw new Error("DATABASE_URL is required before tenancy payment lifecycle can run.");
      }

      const [row] = await db
        .update(tenancies)
        .set({ status, updatedAt: new Date() })
        .where(eq(tenancies.id, tenancyId))
        .returning();

      await auditService.recordEvent({
        actor,
        action: "tenancy.status.updated",
        entityType: "tenancy",
        entityId: tenancyId,
        metadata: { status },
      });

      return row;
    },

    async createTenantDueEntry(
      input: {
        tenancyId: string;
        dueDate: Date;
        amountDueCents: number;
        paymentReference?: string;
        notes?: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!db) {
        throw new Error("DATABASE_URL is required before tenancy payment lifecycle can run.");
      }

      const [tenancy] = await db
        .select()
        .from(tenancies)
        .where(and(eq(tenancies.id, input.tenancyId), isNull(tenancies.archivedAt)))
        .limit(1);

      if (!tenancy) {
        throw new Error("Tenancy not found.");
      }

      const [entry] = await db
        .insert(rentLedgerEntries)
        .values({
          id: createEntityId("rnt"),
          tenancyId: tenancy.id,
          dealId: tenancy.dealId,
          propertyId: tenancy.propertyId,
          entryType: "tenant_due",
          status: statusFromOutstanding({
            entryType: "tenant_due",
            amountDueCents: input.amountDueCents,
            amountReceivedCents: 0,
            dueDate: input.dueDate,
            now: new Date(),
          }),
          dueDate: input.dueDate,
          amountDueCents: input.amountDueCents,
          amountReceivedCents: 0,
          amountOutstandingCents: input.amountDueCents,
          paymentReference: input.paymentReference ?? tenancy.paymentReference,
          notes: input.notes ?? null,
        })
        .returning();

      await auditService.recordEvent({
        actor,
        action: "rent.tenant_due.created",
        entityType: "tenancy",
        entityId: tenancy.id,
        metadata: {
          ledgerEntryId: entry?.id,
          amountDueCents: input.amountDueCents,
        },
      });

      return entry;
    },

    async recordTenantPayment(
      input: {
        dueEntryId: string;
        amountReceivedCents: number;
        paymentDate: Date;
        paymentReference?: string;
        notes?: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!db) {
        throw new Error("DATABASE_URL is required before tenancy payment lifecycle can run.");
      }

      const [dueEntry] = await db
        .select()
        .from(rentLedgerEntries)
        .where(eq(rentLedgerEntries.id, input.dueEntryId))
        .limit(1);

      if (!dueEntry || dueEntry.entryType !== "tenant_due") {
        throw new Error("Tenant due ledger entry not found.");
      }

      const newReceived = Math.max(0, dueEntry.amountReceivedCents + input.amountReceivedCents);
      const outstanding = Math.max(0, dueEntry.amountDueCents - newReceived);
      const updatedStatus = statusFromOutstanding({
        entryType: "tenant_due",
        amountDueCents: dueEntry.amountDueCents,
        amountReceivedCents: newReceived,
        dueDate: dueEntry.dueDate,
        now: input.paymentDate,
      });

      const [updatedDue] = await db
        .update(rentLedgerEntries)
        .set({
          amountReceivedCents: newReceived,
          amountOutstandingCents: outstanding,
          paymentDate: input.paymentDate,
          paymentReference: input.paymentReference ?? dueEntry.paymentReference,
          notes: input.notes ?? dueEntry.notes,
          status: updatedStatus,
          updatedAt: new Date(),
        })
        .where(eq(rentLedgerEntries.id, dueEntry.id))
        .returning();

      const [receivedEntry] = await db
        .insert(rentLedgerEntries)
        .values({
          id: createEntityId("rnt"),
          tenancyId: dueEntry.tenancyId,
          dealId: dueEntry.dealId,
          propertyId: dueEntry.propertyId,
          entryType: "tenant_received",
          status: "PAID",
          paymentDate: input.paymentDate,
          amountDueCents: input.amountReceivedCents,
          amountReceivedCents: input.amountReceivedCents,
          amountOutstandingCents: 0,
          paymentReference: input.paymentReference ?? dueEntry.paymentReference,
          notes: input.notes ?? null,
        })
        .returning();

      const payableDate = new Date(input.paymentDate);
      payableDate.setDate(payableDate.getDate() + 2);

      const [payableEntry] = await db
        .insert(rentLedgerEntries)
        .values({
          id: createEntityId("rnt"),
          tenancyId: dueEntry.tenancyId,
          dealId: dueEntry.dealId,
          propertyId: dueEntry.propertyId,
          entryType: "landlord_payable",
          status: "PAYABLE",
          dueDate: payableDate,
          amountDueCents: input.amountReceivedCents,
          amountReceivedCents: 0,
          amountOutstandingCents: input.amountReceivedCents,
          paymentReference: input.paymentReference ?? dueEntry.paymentReference,
          notes: "Generated from tenant payment.",
        })
        .returning();

      await auditService.recordEvent({
        actor,
        action: "rent.tenant_payment.recorded",
        entityType: "tenancy",
        entityId: dueEntry.tenancyId,
        metadata: {
          dueEntryId: dueEntry.id,
          receivedEntryId: receivedEntry?.id,
          payableEntryId: payableEntry?.id,
          amountReceivedCents: input.amountReceivedCents,
        },
      });

      return {
        dueEntry: updatedDue,
        receivedEntry,
        payableEntry,
      };
    },

    async recordLandlordPayment(
      input: {
        payableEntryId: string;
        amountPaidCents: number;
        paymentDate: Date;
        paymentReference?: string;
        notes?: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!db) {
        throw new Error("DATABASE_URL is required before tenancy payment lifecycle can run.");
      }

      const [payableEntry] = await db
        .select()
        .from(rentLedgerEntries)
        .where(eq(rentLedgerEntries.id, input.payableEntryId))
        .limit(1);

      if (!payableEntry || payableEntry.entryType !== "landlord_payable") {
        throw new Error("Landlord payable entry not found.");
      }

      const newPaid = Math.max(0, payableEntry.amountReceivedCents + input.amountPaidCents);
      const outstanding = Math.max(0, payableEntry.amountDueCents - newPaid);
      const status = outstanding === 0 ? "PAID_TO_LANDLORD" : "PAYABLE";

      const [updatedPayable] = await db
        .update(rentLedgerEntries)
        .set({
          amountReceivedCents: newPaid,
          amountOutstandingCents: outstanding,
          paymentDate: input.paymentDate,
          paymentReference: input.paymentReference ?? payableEntry.paymentReference,
          notes: input.notes ?? payableEntry.notes,
          status,
          updatedAt: new Date(),
        })
        .where(eq(rentLedgerEntries.id, payableEntry.id))
        .returning();

      const [paidEntry] = await db
        .insert(rentLedgerEntries)
        .values({
          id: createEntityId("rnt"),
          tenancyId: payableEntry.tenancyId,
          dealId: payableEntry.dealId,
          propertyId: payableEntry.propertyId,
          entryType: "landlord_paid",
          status: "PAID_TO_LANDLORD",
          paymentDate: input.paymentDate,
          amountDueCents: input.amountPaidCents,
          amountReceivedCents: input.amountPaidCents,
          amountOutstandingCents: 0,
          paymentReference: input.paymentReference ?? payableEntry.paymentReference,
          notes: input.notes ?? null,
        })
        .returning();

      await auditService.recordEvent({
        actor,
        action: "rent.landlord_payment.recorded",
        entityType: "tenancy",
        entityId: payableEntry.tenancyId,
        metadata: {
          payableEntryId: payableEntry.id,
          paidEntryId: paidEntry?.id,
          amountPaidCents: input.amountPaidCents,
        },
      });

      return {
        payableEntry: updatedPayable,
        paidEntry,
      };
    },

    async listTenancies(limit = 80) {
      if (!db) {
        return [];
      }

      return db
        .select({
          tenancy: tenancies,
          deal: deals,
          property: properties,
          landlord: companies,
        })
        .from(tenancies)
        .leftJoin(deals, eq(deals.id, tenancies.dealId))
        .leftJoin(properties, eq(properties.id, tenancies.propertyId))
        .leftJoin(companies, eq(companies.id, tenancies.landlordCompanyId))
        .where(isNull(tenancies.archivedAt))
        .orderBy(desc(tenancies.updatedAt), desc(tenancies.createdAt))
        .limit(limit);
    },

    async listLedger(tenancyId: string) {
      if (!db) {
        return [];
      }

      const now = new Date();
      const rows = await db
        .select()
        .from(rentLedgerEntries)
        .where(and(eq(rentLedgerEntries.tenancyId, tenancyId), isNull(rentLedgerEntries.archivedAt)))
        .orderBy(desc(rentLedgerEntries.createdAt), desc(rentLedgerEntries.updatedAt));

      return rows.map((row) => {
        if (row.entryType === "tenant_due" || row.entryType === "landlord_payable") {
          const status = statusFromOutstanding({
            entryType: row.entryType,
            amountDueCents: row.amountDueCents,
            amountReceivedCents: row.amountReceivedCents,
            dueDate: row.dueDate,
            now,
          });

          return row.status === status
            ? row
            : {
                ...row,
                status,
              };
        }

        return row;
      });
    },

    async getDashboardSnapshot() {
      if (!db) {
        return {
          activeTenancies: 0,
          totalRentDueCents: 0,
          totalRentReceivedCents: 0,
          totalOutstandingCents: 0,
          totalLandlordPayableCents: 0,
          totalPaidToLandlordCents: 0,
          overdueEntries: 0,
          dueThisWeek: 0,
          dueThisMonth: 0,
        };
      }

      const today = new Date();
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const monthEnd = new Date(today);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const [activeTenanciesRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tenancies)
        .where(and(eq(tenancies.status, "active"), isNull(tenancies.archivedAt)));

      const [moneyRow] = await db
        .select({
          totalRentDueCents:
            sql<number>`coalesce(sum(case when ${rentLedgerEntries.entryType} = 'tenant_due' then ${rentLedgerEntries.amountDueCents} else 0 end), 0)`,
          totalRentReceivedCents:
            sql<number>`coalesce(sum(case when ${rentLedgerEntries.entryType} = 'tenant_received' then ${rentLedgerEntries.amountReceivedCents} else 0 end), 0)`,
          totalOutstandingCents:
            sql<number>`coalesce(sum(case when ${rentLedgerEntries.entryType} = 'tenant_due' then ${rentLedgerEntries.amountOutstandingCents} else 0 end), 0)`,
          totalLandlordPayableCents:
            sql<number>`coalesce(sum(case when ${rentLedgerEntries.entryType} = 'landlord_payable' then ${rentLedgerEntries.amountOutstandingCents} else 0 end), 0)`,
          totalPaidToLandlordCents:
            sql<number>`coalesce(sum(case when ${rentLedgerEntries.entryType} = 'landlord_paid' then ${rentLedgerEntries.amountReceivedCents} else 0 end), 0)`,
        })
        .from(rentLedgerEntries)
        .where(isNull(rentLedgerEntries.archivedAt));

      const [overdueRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(rentLedgerEntries)
        .where(
          and(
            inArray(rentLedgerEntries.entryType, ["tenant_due", "landlord_payable"]),
            lte(rentLedgerEntries.dueDate, today),
            sql<boolean>`${rentLedgerEntries.amountOutstandingCents} > 0`,
            isNull(rentLedgerEntries.archivedAt),
          ),
        );

      const [weekRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(rentLedgerEntries)
        .where(
          and(
            inArray(rentLedgerEntries.entryType, ["tenant_due", "landlord_payable"]),
            lte(rentLedgerEntries.dueDate, weekEnd),
            sql<boolean>`${rentLedgerEntries.amountOutstandingCents} > 0`,
            isNull(rentLedgerEntries.archivedAt),
          ),
        );

      const [monthRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(rentLedgerEntries)
        .where(
          and(
            inArray(rentLedgerEntries.entryType, ["tenant_due", "landlord_payable"]),
            lte(rentLedgerEntries.dueDate, monthEnd),
            sql<boolean>`${rentLedgerEntries.amountOutstandingCents} > 0`,
            isNull(rentLedgerEntries.archivedAt),
          ),
        );

      return {
        activeTenancies: Number(activeTenanciesRow?.count ?? 0),
        totalRentDueCents: Number(moneyRow?.totalRentDueCents ?? 0),
        totalRentReceivedCents: Number(moneyRow?.totalRentReceivedCents ?? 0),
        totalOutstandingCents: Number(moneyRow?.totalOutstandingCents ?? 0),
        totalLandlordPayableCents: Number(moneyRow?.totalLandlordPayableCents ?? 0),
        totalPaidToLandlordCents: Number(moneyRow?.totalPaidToLandlordCents ?? 0),
        overdueEntries: Number(overdueRow?.count ?? 0),
        dueThisWeek: Number(weekRow?.count ?? 0),
        dueThisMonth: Number(monthRow?.count ?? 0),
      };
    },

    async listAlerts(limit = 40) {
      if (!db) {
        return [];
      }

      const rows = await db
        .select()
        .from(rentLedgerEntries)
        .where(
          and(
            inArray(rentLedgerEntries.entryType, ["tenant_due", "landlord_payable"]),
            sql<boolean>`${rentLedgerEntries.amountOutstandingCents} > 0`,
            isNull(rentLedgerEntries.archivedAt),
          ),
        )
        .orderBy(asc(rentLedgerEntries.dueDate), desc(rentLedgerEntries.updatedAt))
        .limit(limit);

      const now = new Date();

      return rows.map((row) => ({
        ...row,
        computedStatus: statusFromOutstanding({
          entryType: row.entryType,
          amountDueCents: row.amountDueCents,
          amountReceivedCents: row.amountReceivedCents,
          dueDate: row.dueDate,
          now,
        }),
        requiresPaymentReference:
          (row.entryType === "tenant_received" || row.entryType === "landlord_paid") &&
          !row.paymentReference,
      }));
    },

    async listTenancyDocuments(tenancyId: string) {
      if (!db) {
        return [];
      }

      return db
        .select()
        .from(documents)
        .where(and(eq(documents.tenancyId, tenancyId), isNull(documents.archivedAt)))
        .orderBy(desc(documents.updatedAt), desc(documents.createdAt));
    },
  };
}
