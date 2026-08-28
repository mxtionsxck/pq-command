"use server";

import { revalidatePath } from "next/cache";

import type { Document as PropertyDocument, PropertyMedium } from "@/db/models";
import type { PropertyMutationInput } from "@/domain/property/types";
import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createPropertyAssetsService } from "@/server/services/property-assets-service";
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

function setIfDefined<
  TRecord extends Record<string, unknown>,
  TKey extends keyof TRecord,
>(target: Partial<TRecord>, key: TKey, value: TRecord[TKey] | undefined) {
  if (value !== undefined) {
    target[key] = value;
  }
}

function parsePropertyPatch(formData: FormData) {
  const title = readText(formData, "title");
  const summary = readText(formData, "summary");
  const billsSummary = readText(formData, "billsSummary");
  const borough = readText(formData, "borough");
  const addressLine1 = readText(formData, "addressLine1");
  const addressLine2 = readText(formData, "addressLine2");
  const city = readText(formData, "city");
  const postcode = readText(formData, "postcode");
  const propertyType = readText(formData, "propertyType");
  const bedrooms = readInteger(formData, "bedrooms");
  const bathrooms = readInteger(formData, "bathrooms");
  const monthlyRentCents = readCurrencyCents(formData, "monthlyRent");
  const depositCents = readCurrencyCents(formData, "deposit");
  const termMonths = readInteger(formData, "termMonths");
  const availability = readText(formData, "availability");
  const availableFrom = readDate(formData, "availableFrom");
  const companyLetFit = readText(formData, "companyLetFit");
  const status = readText(formData, "status");

  return {
    ...(title ? { title } : {}),
    ...(summary ? { summary } : {}),
    ...(billsSummary ? { billsSummary } : {}),
    ...(borough ? { borough } : {}),
    ...(addressLine1 ? { addressLine1 } : {}),
    ...(addressLine2 ? { addressLine2 } : {}),
    ...(city ? { city } : {}),
    ...(postcode ? { postcode } : {}),
    ...(propertyType
      ? { propertyType: propertyType as PropertyMutationInput["propertyType"] }
      : {}),
    ...(bedrooms !== undefined ? { bedrooms } : {}),
    ...(bathrooms !== undefined ? { bathrooms } : {}),
    ...(monthlyRentCents !== undefined ? { monthlyRentCents } : {}),
    ...(depositCents !== undefined ? { depositCents } : {}),
    ...(termMonths !== undefined ? { termMonths } : {}),
    ...(availability
      ? { availability: availability as PropertyMutationInput["availability"] }
      : {}),
    ...(availableFrom ? { availableFrom } : {}),
    ...(companyLetFit
      ? {
          companyLetFit:
            companyLetFit as PropertyMutationInput["companyLetFit"],
        }
      : {}),
    ...(status ? { status: status as PropertyMutationInput["status"] } : {}),
    furnished: readBoolean(formData, "furnished"),
    parking: readBoolean(formData, "parking"),
    garden: readBoolean(formData, "garden"),
  } satisfies Partial<PropertyMutationInput>;
}

function revalidatePropertyPages(propertyId: string) {
  revalidatePath(`/internal/stock-room/${propertyId}`);
  revalidatePath("/internal/stock-room");
}

export async function updatePropertyRoomAction(formData: FormData) {
  const propertyId = readText(formData, "propertyId");

  if (!propertyId) {
    return;
  }

  const user = await requireCurrentUser();
  const propertyService = createPropertyService();

  await propertyService.updateProperty(
    propertyId,
    parsePropertyPatch(formData),
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePropertyPages(propertyId);
}

export async function transitionPropertyStatusAction(formData: FormData) {
  const propertyId = readText(formData, "propertyId");
  const status = readText(formData, "status");

  if (!propertyId || !status) {
    return;
  }

  const user = await requireCurrentUser();
  const propertyService = createPropertyService();

  await propertyService.updateProperty(
    propertyId,
    {
      status: status as PropertyMutationInput["status"],
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePropertyPages(propertyId);
}

export async function uploadPropertyMediaAction(formData: FormData) {
  const propertyId = readText(formData, "propertyId");
  const file = formData.get("mediaFile");

  if (!propertyId || !(file instanceof File) || file.size === 0) {
    return;
  }

  const user = await requireCurrentUser();
  const assetsService = createPropertyAssetsService();

  const mediaInput: {
    caption?: string;
    altText?: string;
    sortOrder?: number;
    kind?: PropertyMedium["kind"];
  } = {
    kind:
      (readText(formData, "kind") as PropertyMedium["kind"] | undefined) ??
      "image",
  };

  setIfDefined(mediaInput, "caption", readText(formData, "caption"));
  setIfDefined(mediaInput, "altText", readText(formData, "altText"));
  setIfDefined(mediaInput, "sortOrder", readInteger(formData, "sortOrder"));

  await assetsService.uploadMedia(propertyId, file, mediaInput, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePropertyPages(propertyId);
}

export async function updatePropertyMediaAction(formData: FormData) {
  const propertyId = readText(formData, "propertyId");
  const mediaId = readText(formData, "mediaId");

  if (!propertyId || !mediaId) {
    return;
  }

  const user = await requireCurrentUser();
  const assetsService = createPropertyAssetsService();

  const mediaPatch: {
    caption?: string;
    altText?: string;
    sortOrder?: number;
    isHero?: boolean;
  } = {};

  setIfDefined(mediaPatch, "caption", readText(formData, "caption"));
  setIfDefined(mediaPatch, "altText", readText(formData, "altText"));
  setIfDefined(mediaPatch, "sortOrder", readInteger(formData, "sortOrder"));

  if (formData.get("isHero") === "on") {
    mediaPatch.isHero = true;
  }

  await assetsService.updateMediaMetadata(propertyId, mediaId, mediaPatch, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePropertyPages(propertyId);
}

export async function archivePropertyMediaAction(formData: FormData) {
  const propertyId = readText(formData, "propertyId");
  const mediaId = readText(formData, "mediaId");

  if (!propertyId || !mediaId) {
    return;
  }

  const user = await requireCurrentUser();
  const assetsService = createPropertyAssetsService();

  await assetsService.archiveMedia(propertyId, mediaId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePropertyPages(propertyId);
}

export async function uploadPropertyDocumentAction(formData: FormData) {
  const propertyId = readText(formData, "propertyId");
  const file = formData.get("documentFile");

  if (!propertyId || !(file instanceof File) || file.size === 0) {
    return;
  }

  const title = readText(formData, "title") ?? file.name;
  const documentType = (readText(formData, "documentType") ??
    "other") as PropertyDocument["documentType"];
  const versionNumber = readInteger(formData, "versionNumber") ?? 1;
  const user = await requireCurrentUser();
  const assetsService = createPropertyAssetsService();

  await assetsService.uploadDocument(
    propertyId,
    file,
    {
      title,
      documentType,
      versionNumber,
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePropertyPages(propertyId);
}

export async function archivePropertyDocumentAction(formData: FormData) {
  const propertyId = readText(formData, "propertyId");
  const documentId = readText(formData, "documentId");

  if (!propertyId || !documentId) {
    return;
  }

  const user = await requireCurrentUser();
  const assetsService = createPropertyAssetsService();

  await assetsService.archiveDocument(propertyId, documentId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidatePropertyPages(propertyId);
}
