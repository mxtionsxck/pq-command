import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { Company, Contact } from "@/db/models";
import type {
  CompanyListItem,
  CompanyMutationInput,
  ContactListItem,
  ContactMutationInput,
} from "@/domain/company/types";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canManageSources } from "@/server/auth/rbac";
import { createCompanyContactRepository } from "@/server/repositories/company-contact-repository";

import { createAuditService } from "./audit-event-service";

type CompanyContactRepositoryLike = ReturnType<
  typeof createCompanyContactRepository
>;

type CompanyContactServiceDependencies = {
  repository?: CompanyContactRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function ensureMutationAccess(
  actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
) {
  if (actor.role && !canManageSources(actor.role)) {
    throw new Error(
      "Only managers and admins can mutate companies and contacts.",
    );
  }
}

function getRepository(repository?: CompanyContactRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createCompanyContactRepository(getDb());
}

function normaliseOptional(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function buildCompanyName(input: {
  legalName: string;
  tradingName?: string | null;
}) {
  return input.tradingName?.trim() || input.legalName.trim();
}

export function createCompanyContactService(
  dependencies: CompanyContactServiceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const getAuditService = () =>
    dependencies.auditService ?? createAuditService();

  return {
    async listCompanies(search?: string): Promise<CompanyListItem[]> {
      if (!repository) {
        return [];
      }

      const rows = await repository.listCompanies(search ? { search } : {});
      const duplicateKeys = new Map<string, number>();

      for (const row of rows) {
        const legalKey = row.legalName?.trim().toLowerCase();
        const numberKey = row.companyNumber?.trim().toLowerCase();

        if (legalKey) {
          duplicateKeys.set(
            `legal:${legalKey}`,
            (duplicateKeys.get(`legal:${legalKey}`) ?? 0) + 1,
          );
        }

        if (numberKey) {
          duplicateKeys.set(
            `number:${numberKey}`,
            (duplicateKeys.get(`number:${numberKey}`) ?? 0) + 1,
          );
        }
      }

      return rows.map((row) => {
        const legalKey = row.legalName?.trim().toLowerCase();
        const numberKey = row.companyNumber?.trim().toLowerCase();
        const duplicateWarning =
          (legalKey
            ? (duplicateKeys.get(`legal:${legalKey}`) ?? 0) > 1
            : false) ||
          (numberKey
            ? (duplicateKeys.get(`number:${numberKey}`) ?? 0) > 1
            : false);

        return {
          id: row.id,
          legalName: row.legalName ?? row.name,
          tradingName: row.tradingName,
          companyNumber: row.companyNumber,
          website: row.website,
          companyType: row.companyType,
          locations: row.locations,
          status: row.status,
          contactCount: row.contactCount,
          duplicateWarning,
        };
      });
    },

    async listContacts(
      options: { search?: string; companyId?: string } = {},
    ): Promise<ContactListItem[]> {
      if (!repository) {
        return [];
      }

      const rows = await repository.listContacts(options);
      const suppressionMatches = await repository.listSuppressionMatches(
        rows.map((row) => ({
          id: row.contact.id,
          email: row.contact.email,
          phone: row.contact.phone,
        })),
      );

      const duplicateKeys = new Map<string, number>();

      for (const row of rows) {
        const emailKey = row.contact.email?.trim().toLowerCase();
        const phoneKey = row.contact.phone?.trim().toLowerCase();

        if (emailKey) {
          duplicateKeys.set(
            `email:${emailKey}`,
            (duplicateKeys.get(`email:${emailKey}`) ?? 0) + 1,
          );
        }

        if (phoneKey) {
          duplicateKeys.set(
            `phone:${phoneKey}`,
            (duplicateKeys.get(`phone:${phoneKey}`) ?? 0) + 1,
          );
        }
      }

      return rows.map((row) => {
        const suppressed =
          row.contact.suppressionStatus === "suppressed" ||
          suppressionMatches.has(row.contact.id);
        const hasDirectChannel = Boolean(
          row.contact.email || row.contact.phone,
        );
        const contactability = suppressed
          ? "suppressed"
          : hasDirectChannel
            ? "contactable"
            : "limited";
        const emailKey = row.contact.email?.trim().toLowerCase();
        const phoneKey = row.contact.phone?.trim().toLowerCase();
        const duplicateWarning =
          (emailKey
            ? (duplicateKeys.get(`email:${emailKey}`) ?? 0) > 1
            : false) ||
          (phoneKey
            ? (duplicateKeys.get(`phone:${phoneKey}`) ?? 0) > 1
            : false);

        return {
          id: row.contact.id,
          companyId: row.contact.companyId,
          companyName: row.companyName,
          firstName: row.contact.firstName,
          lastName: row.contact.lastName,
          roleTitle: row.contact.roleTitle,
          email: row.contact.email,
          phone: row.contact.phone,
          source: row.contact.source,
          confidence: row.contact.confidence,
          decisionMakerEvidence: row.contact.decisionMakerEvidence,
          suppressionStatus: suppressed
            ? "suppressed"
            : row.contact.suppressionStatus,
          status: row.contact.status,
          contactability,
          duplicateWarning,
        };
      });
    },

    async listActivityTimeline(limit = 40) {
      if (!repository) {
        return [];
      }

      const auditService = getAuditService();
      const [companyEvents, contactEvents] = await Promise.all([
        auditService.listRecent({ entityType: "company", limit }),
        auditService.listRecent({ entityType: "contact", limit }),
      ]);

      return [...companyEvents, ...contactEvents]
        .sort(
          (left, right) =>
            right.occurredAt.getTime() - left.occurredAt.getTime(),
        )
        .slice(0, limit);
    },

    async createCompany(
      input: CompanyMutationInput,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<{ company: Company; duplicates: Company[] }> {
      ensureMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before companies can be managed.",
        );
      }

      const legalName = input.legalName.trim();
      const tradingName = normaliseOptional(input.tradingName);
      const companyNumber = normaliseOptional(input.companyNumber);
      const duplicates = await repository.findCompanyDuplicates({
        legalName,
        ...(tradingName ? { tradingName } : {}),
        ...(companyNumber ? { companyNumber } : {}),
      });

      const company = await repository.createCompany({
        ownerUserId: actor.userId,
        name: buildCompanyName({
          legalName,
          ...(tradingName ? { tradingName } : {}),
        }),
        legalName,
        tradingName,
        companyNumber,
        slug: slugify(legalName),
        status: input.status,
        website: normaliseOptional(input.website),
        companyType: normaliseOptional(input.companyType),
        locations: normaliseOptional(input.locations),
      });

      await getAuditService().recordEvent({
        actor,
        action: "company.created",
        entityType: "company",
        entityId: company.id,
        metadata: {
          legalName: company.legalName,
          companyNumber: company.companyNumber,
          duplicateCount: duplicates.length,
        },
        afterState: {
          status: company.status,
          companyType: company.companyType,
        },
      });

      return {
        company,
        duplicates,
      };
    },

    async updateCompany(
      companyId: string,
      input: Partial<CompanyMutationInput>,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before companies can be managed.",
        );
      }

      const before = await repository.findCompanyById(companyId);

      if (!before) {
        return undefined;
      }

      const legalName = input.legalName?.trim();
      const tradingName = normaliseOptional(input.tradingName);
      const companyNumber = normaliseOptional(input.companyNumber);
      const duplicates = await repository.findCompanyDuplicates({
        ...(legalName ? { legalName } : {}),
        ...(tradingName ? { tradingName } : {}),
        ...(companyNumber ? { companyNumber } : {}),
        excludeId: companyId,
      });

      const updated = await repository.updateCompany(companyId, {
        ...(legalName ? { legalName } : {}),
        ...(tradingName !== undefined ? { tradingName } : {}),
        ...(companyNumber !== undefined ? { companyNumber } : {}),
        ...(input.website !== undefined
          ? { website: normaliseOptional(input.website) ?? null }
          : {}),
        ...(input.companyType !== undefined
          ? { companyType: normaliseOptional(input.companyType) ?? null }
          : {}),
        ...(input.locations !== undefined
          ? { locations: normaliseOptional(input.locations) ?? null }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(legalName || tradingName
          ? {
              name: buildCompanyName({
                legalName: legalName ?? before.legalName ?? before.name,
                tradingName: tradingName ?? before.tradingName,
              }),
            }
          : {}),
      });

      if (!updated) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "company.updated",
        entityType: "company",
        entityId: updated.id,
        metadata: {
          changedFields: Object.keys(input),
          duplicateCount: duplicates.length,
        },
        beforeState: {
          status: before.status,
          legalName: before.legalName,
        },
        afterState: {
          status: updated.status,
          legalName: updated.legalName,
        },
      });

      return {
        company: updated,
        duplicates,
      };
    },

    async archiveCompany(
      companyId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before companies can be managed.",
        );
      }

      const before = await repository.findCompanyById(companyId);

      if (!before) {
        return undefined;
      }

      const archived = await repository.archiveCompany(companyId);

      if (!archived) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "company.archived",
        entityType: "company",
        entityId: archived.id,
        metadata: {
          legalName: archived.legalName,
        },
        beforeState: {
          status: before.status,
          archivedAt: before.archivedAt,
        },
        afterState: {
          status: archived.status,
          archivedAt: archived.archivedAt,
        },
      });

      return archived;
    },

    async createContact(
      input: ContactMutationInput,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<{ contact: Contact; duplicates: Contact[] }> {
      ensureMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before contacts can be managed.",
        );
      }

      const email = normaliseOptional(input.email);
      const phone = normaliseOptional(input.phone);
      const duplicates = await repository.findContactDuplicates({
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      });

      const contact = await repository.createContact({
        companyId: input.companyId,
        ownerUserId: actor.userId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        roleTitle: normaliseOptional(input.roleTitle),
        email: normaliseOptional(input.email),
        phone: normaliseOptional(input.phone),
        source: normaliseOptional(input.source),
        confidence: input.confidence,
        suppressionStatus: input.suppressionStatus,
        decisionMakerEvidence: normaliseOptional(input.decisionMakerEvidence),
        status: input.status,
        notes: normaliseOptional(input.notes),
      });

      await getAuditService().recordEvent({
        actor,
        action: "contact.created",
        entityType: "contact",
        entityId: contact.id,
        metadata: {
          companyId: contact.companyId,
          duplicateCount: duplicates.length,
          decisionMakerEvidenceRecorded: Boolean(contact.decisionMakerEvidence),
        },
        afterState: {
          status: contact.status,
          suppressionStatus: contact.suppressionStatus,
          confidence: contact.confidence,
        },
      });

      return {
        contact,
        duplicates,
      };
    },

    async updateContact(
      contactId: string,
      input: Partial<ContactMutationInput>,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before contacts can be managed.",
        );
      }

      const before = await repository.findContactById(contactId);

      if (!before) {
        return undefined;
      }

      const email = input.email ? normaliseOptional(input.email) : undefined;
      const phone = input.phone ? normaliseOptional(input.phone) : undefined;
      const duplicates = await repository.findContactDuplicates({
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        excludeId: contactId,
      });

      const updated = await repository.updateContact(contactId, {
        ...(input.companyId !== undefined
          ? { companyId: input.companyId }
          : {}),
        ...(input.firstName ? { firstName: input.firstName.trim() } : {}),
        ...(input.lastName ? { lastName: input.lastName.trim() } : {}),
        ...(input.roleTitle !== undefined
          ? { roleTitle: normaliseOptional(input.roleTitle) ?? null }
          : {}),
        ...(input.email !== undefined
          ? { email: normaliseOptional(input.email) ?? null }
          : {}),
        ...(input.phone !== undefined
          ? { phone: normaliseOptional(input.phone) ?? null }
          : {}),
        ...(input.source !== undefined
          ? { source: normaliseOptional(input.source) ?? null }
          : {}),
        ...(input.confidence !== undefined
          ? { confidence: input.confidence }
          : {}),
        ...(input.suppressionStatus
          ? { suppressionStatus: input.suppressionStatus }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.notes !== undefined
          ? { notes: normaliseOptional(input.notes) ?? null }
          : {}),
        ...(input.decisionMakerEvidence !== undefined
          ? {
              decisionMakerEvidence:
                normaliseOptional(input.decisionMakerEvidence) ?? null,
            }
          : {}),
      });

      if (!updated) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "contact.updated",
        entityType: "contact",
        entityId: updated.id,
        metadata: {
          changedFields: Object.keys(input),
          duplicateCount: duplicates.length,
          decisionMakerEvidenceRecorded: Boolean(updated.decisionMakerEvidence),
        },
        beforeState: {
          status: before.status,
          suppressionStatus: before.suppressionStatus,
          companyId: before.companyId,
        },
        afterState: {
          status: updated.status,
          suppressionStatus: updated.suppressionStatus,
          companyId: updated.companyId,
        },
      });

      return {
        contact: updated,
        duplicates,
      };
    },

    async archiveContact(
      contactId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before contacts can be managed.",
        );
      }

      const before = await repository.findContactById(contactId);

      if (!before) {
        return undefined;
      }

      const archived = await repository.archiveContact(contactId);

      if (!archived) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "contact.archived",
        entityType: "contact",
        entityId: archived.id,
        metadata: {
          companyId: archived.companyId,
        },
        beforeState: {
          status: before.status,
          archivedAt: before.archivedAt,
        },
        afterState: {
          status: archived.status,
          archivedAt: archived.archivedAt,
        },
      });

      return archived;
    },
  };
}
