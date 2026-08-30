"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createTenancyPaymentService } from "@/server/services/tenancy-payment-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readInt(formData: FormData, key: string) {
  const text = readText(formData, key);
  if (!text) {
    return undefined;
  }

  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) ? value : undefined;
}

function readDate(formData: FormData, key: string) {
  const text = readText(formData, key);
  if (!text) {
    return undefined;
  }

  const value = new Date(text);
  return Number.isNaN(value.getTime()) ? undefined : value;
}

export async function createTenancyAction(formData: FormData) {
  const user = await requireCurrentUser();
  const service = createTenancyPaymentService();

  const rentAmountCents = readInt(formData, "rentAmountCents");
  const tenancyStartDate = readDate(formData, "tenancyStartDate");
  const rentFrequency = readText(formData, "rentFrequency") as
    | "weekly"
    | "monthly"
    | "quarterly"
    | undefined;

  if (!rentAmountCents || !tenancyStartDate || !rentFrequency) {
    return;
  }

  const dealId = readText(formData, "dealId");
  const propertyId = readText(formData, "propertyId");
  const landlordCompanyId = readText(formData, "landlordCompanyId");
  const tenantCompanyId = readText(formData, "tenantCompanyId");
  const rentDueDayOfMonth = readInt(formData, "rentDueDayOfMonth");
  const tenancyEndDate = readDate(formData, "tenancyEndDate");
  const landlordPaymentLeadDays = readInt(formData, "landlordPaymentLeadDays");
  const paymentReference = readText(formData, "paymentReference");
  const notes = readText(formData, "notes");

  await service.createTenancy(
    {
      ...(dealId ? { dealId } : {}),
      ...(propertyId ? { propertyId } : {}),
      ...(landlordCompanyId ? { landlordCompanyId } : {}),
      ...(tenantCompanyId ? { tenantCompanyId } : {}),
      rentFrequency,
      rentAmountCents,
      ...(rentDueDayOfMonth !== undefined ? { rentDueDayOfMonth } : {}),
      tenancyStartDate,
      ...(tenancyEndDate ? { tenancyEndDate } : {}),
      ...(landlordPaymentLeadDays !== undefined ? { landlordPaymentLeadDays } : {}),
      ...(paymentReference ? { paymentReference } : {}),
      ...(notes ? { notes } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/tenancies");
  revalidatePath("/internal/rent-control");
}

export async function updateTenancyStatusAction(formData: FormData) {
  const user = await requireCurrentUser();
  const service = createTenancyPaymentService();

  const tenancyId = readText(formData, "tenancyId");
  const status = readText(formData, "status") as
    | "draft"
    | "active"
    | "ended"
    | "cancelled"
    | undefined;

  if (!tenancyId || !status) {
    return;
  }

  await service.setTenancyStatus(
    tenancyId,
    status,
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/tenancies");
  revalidatePath("/internal/rent-control");
}

export async function createTenantDueAction(formData: FormData) {
  const user = await requireCurrentUser();
  const service = createTenancyPaymentService();

  const tenancyId = readText(formData, "tenancyId");
  const dueDate = readDate(formData, "dueDate");
  const amountDueCents = readInt(formData, "amountDueCents");

  if (!tenancyId || !dueDate || !amountDueCents) {
    return;
  }

  const paymentReference = readText(formData, "paymentReference");
  const notes = readText(formData, "notes");

  await service.createTenantDueEntry(
    {
      tenancyId,
      dueDate,
      amountDueCents,
      ...(paymentReference ? { paymentReference } : {}),
      ...(notes ? { notes } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/tenancies");
  revalidatePath("/internal/rent-control");
}

export async function recordTenantPaymentAction(formData: FormData) {
  const user = await requireCurrentUser();
  const service = createTenancyPaymentService();

  const dueEntryId = readText(formData, "dueEntryId");
  const amountReceivedCents = readInt(formData, "amountReceivedCents");
  const paymentDate = readDate(formData, "paymentDate");

  if (!dueEntryId || !amountReceivedCents || !paymentDate) {
    return;
  }

  const paymentReference = readText(formData, "paymentReference");
  const notes = readText(formData, "notes");

  await service.recordTenantPayment(
    {
      dueEntryId,
      amountReceivedCents,
      paymentDate,
      ...(paymentReference ? { paymentReference } : {}),
      ...(notes ? { notes } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/tenancies");
  revalidatePath("/internal/rent-control");
}

export async function recordLandlordPaymentAction(formData: FormData) {
  const user = await requireCurrentUser();
  const service = createTenancyPaymentService();

  const payableEntryId = readText(formData, "payableEntryId");
  const amountPaidCents = readInt(formData, "amountPaidCents");
  const paymentDate = readDate(formData, "paymentDate");

  if (!payableEntryId || !amountPaidCents || !paymentDate) {
    return;
  }

  const paymentReference = readText(formData, "paymentReference");
  const notes = readText(formData, "notes");

  await service.recordLandlordPayment(
    {
      payableEntryId,
      amountPaidCents,
      paymentDate,
      ...(paymentReference ? { paymentReference } : {}),
      ...(notes ? { notes } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/tenancies");
  revalidatePath("/internal/rent-control");
}
