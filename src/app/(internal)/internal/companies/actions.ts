"use server";

import { revalidatePath } from "next/cache";

import type {
  CompanyMutationInput,
  ContactMutationInput,
} from "@/domain/company/types";
import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createCompanyContactService } from "@/server/services/company-contact-service";

function readText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function readInteger(formData: FormData, key: string): number | undefined {
  const value = readText(formData, key);

  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function setIfDefined<
  TRecord extends Record<string, unknown>,
  TKey extends keyof TRecord,
>(target: Partial<TRecord>, key: TKey, value: TRecord[TKey] | undefined) {
  if (value !== undefined) {
    target[key] = value;
  }
}

function revalidateCompanies() {
  revalidatePath("/internal/companies");
}

export async function createCompanyAction(formData: FormData) {
  const legalName = readText(formData, "legalName");

  if (!legalName) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createCompanyContactService();
  const tradingName = readText(formData, "tradingName");
  const companyNumber = readText(formData, "companyNumber");
  const website = readText(formData, "website");
  const companyType = readText(formData, "companyType");
  const locations = readText(formData, "locations");

  await service.createCompany(
    {
      legalName,
      ...(tradingName ? { tradingName } : {}),
      ...(companyNumber ? { companyNumber } : {}),
      ...(website ? { website } : {}),
      ...(companyType ? { companyType } : {}),
      ...(locations ? { locations } : {}),
      status:
        (readText(formData, "status") as CompanyMutationInput["status"]) ??
        "prospect",
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidateCompanies();
}

export async function updateCompanyAction(formData: FormData) {
  const companyId = readText(formData, "companyId");

  if (!companyId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createCompanyContactService();

  const patch: Partial<CompanyMutationInput> = {};
  setIfDefined(patch, "legalName", readText(formData, "legalName"));
  setIfDefined(patch, "tradingName", readText(formData, "tradingName"));
  setIfDefined(patch, "companyNumber", readText(formData, "companyNumber"));
  setIfDefined(patch, "website", readText(formData, "website"));
  setIfDefined(patch, "companyType", readText(formData, "companyType"));
  setIfDefined(patch, "locations", readText(formData, "locations"));
  setIfDefined(
    patch,
    "status",
    readText(formData, "status") as CompanyMutationInput["status"] | undefined,
  );

  await service.updateCompany(companyId, patch, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateCompanies();
}

export async function archiveCompanyAction(formData: FormData) {
  const companyId = readText(formData, "companyId");

  if (!companyId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createCompanyContactService();

  await service.archiveCompany(companyId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateCompanies();
}

export async function createContactAction(formData: FormData) {
  const firstName = readText(formData, "firstName");
  const lastName = readText(formData, "lastName");

  if (!firstName || !lastName) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createCompanyContactService();
  const companyId = readText(formData, "companyId");
  const roleTitle = readText(formData, "roleTitle");
  const email = readText(formData, "email");
  const phone = readText(formData, "phone");
  const source = readText(formData, "source");
  const notes = readText(formData, "notes");
  const decisionMakerEvidence = readText(formData, "decisionMakerEvidence");

  await service.createContact(
    {
      ...(companyId ? { companyId } : {}),
      firstName,
      lastName,
      ...(roleTitle ? { roleTitle } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(source ? { source } : {}),
      confidence: Math.min(
        100,
        Math.max(0, readInteger(formData, "confidence") ?? 50),
      ),
      suppressionStatus:
        (readText(
          formData,
          "suppressionStatus",
        ) as ContactMutationInput["suppressionStatus"]) ?? "clear",
      status:
        (readText(formData, "status") as ContactMutationInput["status"]) ??
        "active",
      ...(notes ? { notes } : {}),
      ...(decisionMakerEvidence ? { decisionMakerEvidence } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidateCompanies();
}

export async function updateContactAction(formData: FormData) {
  const contactId = readText(formData, "contactId");

  if (!contactId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createCompanyContactService();

  const patch: Partial<ContactMutationInput> = {};
  setIfDefined(patch, "companyId", readText(formData, "companyId"));
  setIfDefined(patch, "firstName", readText(formData, "firstName"));
  setIfDefined(patch, "lastName", readText(formData, "lastName"));
  setIfDefined(patch, "roleTitle", readText(formData, "roleTitle"));
  setIfDefined(patch, "email", readText(formData, "email"));
  setIfDefined(patch, "phone", readText(formData, "phone"));
  setIfDefined(patch, "source", readText(formData, "source"));
  setIfDefined(patch, "confidence", readInteger(formData, "confidence"));
  setIfDefined(
    patch,
    "suppressionStatus",
    readText(formData, "suppressionStatus") as
      ContactMutationInput["suppressionStatus"] | undefined,
  );
  setIfDefined(
    patch,
    "status",
    readText(formData, "status") as ContactMutationInput["status"] | undefined,
  );
  setIfDefined(patch, "notes", readText(formData, "notes"));
  setIfDefined(
    patch,
    "decisionMakerEvidence",
    readText(formData, "decisionMakerEvidence"),
  );

  await service.updateContact(contactId, patch, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateCompanies();
}

export async function archiveContactAction(formData: FormData) {
  const contactId = readText(formData, "contactId");

  if (!contactId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createCompanyContactService();

  await service.archiveContact(contactId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateCompanies();
}
