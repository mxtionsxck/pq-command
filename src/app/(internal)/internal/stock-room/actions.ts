"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createPropertyService } from "@/server/services/property-service";

function readText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function readInteger(formData: FormData, key: string): number | undefined {
  const value = readText(formData, key);

  if (!value) {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function readCurrencyCents(
  formData: FormData,
  key: string,
): number | undefined {
  const value = readText(formData, key);

  if (!value) {
    return undefined;
  }

  const parsedValue = Number.parseFloat(value);

  return Number.isFinite(parsedValue)
    ? Math.round(parsedValue * 100)
    : undefined;
}

function readBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function readDate(formData: FormData, key: string): Date | undefined {
  const value = readText(formData, key);

  if (!value) {
    return undefined;
  }

  const parsedValue = new Date(value);

  return Number.isNaN(parsedValue.getTime()) ? undefined : parsedValue;
}

function parsePropertyInput(formData: FormData) {
  const companyId = readText(formData, "companyId");
  const sourceId = readText(formData, "sourceId");
  const addressLine2 = readText(formData, "addressLine2");
  const borough = readText(formData, "borough");
  const bedrooms = readInteger(formData, "bedrooms");
  const bathrooms = readInteger(formData, "bathrooms");
  const monthlyRentCents = readCurrencyCents(formData, "monthlyRent");
  const depositCents = readCurrencyCents(formData, "deposit");
  const termMonths = readInteger(formData, "termMonths");
  const availableFrom = readDate(formData, "availableFrom");
  const billsSummary = readText(formData, "billsSummary");
  const summary = readText(formData, "summary");

  return {
    title: readText(formData, "title") ?? "Untitled property",
    addressLine1: readText(formData, "addressLine1") ?? "Unknown address",
    city: readText(formData, "city") ?? "London",
    postcode: readText(formData, "postcode") ?? "UNKNOWN",
    propertyType: (readText(formData, "propertyType") ?? "other") as
      "apartment" | "house" | "studio" | "maisonette" | "townhouse" | "other",
    furnished: readBoolean(formData, "furnished"),
    parking: readBoolean(formData, "parking"),
    garden: readBoolean(formData, "garden"),
    availability: (readText(formData, "availability") ?? "available_now") as
      | "available_now"
      | "available_soon"
      | "occupied"
      | "let_agreed"
      | "unavailable",
    companyLetFit: (readText(formData, "companyLetFit") ?? "review") as
      "ideal" | "strong" | "review" | "unsuitable",
    status: (readText(formData, "status") ?? "draft") as
      "draft" | "active" | "off_market" | "archived",
    ...(companyId ? { companyId } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(addressLine2 ? { addressLine2 } : {}),
    ...(borough ? { borough } : {}),
    ...(bedrooms !== undefined ? { bedrooms } : {}),
    ...(bathrooms !== undefined ? { bathrooms } : {}),
    ...(monthlyRentCents !== undefined ? { monthlyRentCents } : {}),
    ...(depositCents !== undefined ? { depositCents } : {}),
    ...(termMonths !== undefined ? { termMonths } : {}),
    ...(availableFrom ? { availableFrom } : {}),
    ...(billsSummary ? { billsSummary } : {}),
    ...(summary ? { summary } : {}),
  };
}

export async function createPropertyAction(formData: FormData) {
  const user = await requireCurrentUser();
  const propertyService = createPropertyService();

  await propertyService.createProperty(parsePropertyInput(formData), {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePath("/internal/stock-room");
}

export async function updatePropertyAction(formData: FormData) {
  const user = await requireCurrentUser();
  const propertyService = createPropertyService();
  const propertyId = readText(formData, "propertyId");

  if (!propertyId) {
    return;
  }

  await propertyService.updateProperty(
    propertyId,
    parsePropertyInput(formData),
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/internal/stock-room");
}

export async function archivePropertyAction(formData: FormData) {
  const user = await requireCurrentUser();
  const propertyService = createPropertyService();
  const propertyId = readText(formData, "propertyId");

  if (!propertyId) {
    return;
  }

  await propertyService.archiveProperty(propertyId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePath("/internal/stock-room");
}
