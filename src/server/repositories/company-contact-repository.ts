import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import type { NewCompany, NewContact } from "@/db/models";
import { companies, contacts, suppressionList } from "@/db/schema";

import { createRepository } from "./base-repository";

type CompanyCreateInput = Omit<NewCompany, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

type ContactCreateInput = Omit<NewContact, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

function compactConditions<T>(values: Array<T | undefined>): T[] {
  return values.filter((value): value is T => value !== undefined);
}

export function createCompanyContactRepository(db: PQCommandDb) {
  const companyRepository = createRepository(db, companies, "co");
  const contactRepository = createRepository(db, contacts, "ctc");

  return {
    createCompany(input: CompanyCreateInput) {
      return companyRepository.create(
        input as Parameters<typeof companyRepository.create>[0],
      );
    },

    updateCompany(id: string, input: Partial<NewCompany>) {
      return companyRepository.updateById(id, input);
    },

    findCompanyById(id: string) {
      return companyRepository.findById(id);
    },

    async archiveCompany(id: string) {
      const [company] = await db
        .update(companies)
        .set({
          status: "archived",
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(companies.id, id))
        .returning();

      return company;
    },

    async listCompanies(options: {
      search?: string;
      includeArchived?: boolean;
      limit?: number;
    }) {
      const conditions = compactConditions([
        options.includeArchived ? undefined : isNull(companies.archivedAt),
        options.search
          ? or(
              ilike(companies.name, `%${options.search}%`),
              ilike(companies.legalName, `%${options.search}%`),
              ilike(companies.tradingName, `%${options.search}%`),
              ilike(companies.companyNumber, `%${options.search}%`),
              ilike(companies.slug, `%${options.search}%`),
            )
          : undefined,
      ]);

      const rows = await db
        .select()
        .from(companies)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(companies.updatedAt), desc(companies.createdAt))
        .limit(options.limit ?? 100);

      if (rows.length === 0) {
        return [];
      }

      const counts = await db
        .select({
          companyId: contacts.companyId,
          count: sql<number>`count(*)::int`,
        })
        .from(contacts)
        .where(
          and(
            inArray(
              contacts.companyId,
              rows.map((row) => row.id),
            ),
            isNull(contacts.archivedAt),
          ),
        )
        .groupBy(contacts.companyId);

      const countByCompanyId = new Map(
        counts
          .filter((item) => item.companyId)
          .map((item) => [item.companyId as string, item.count]),
      );

      return rows.map((row) => ({
        ...row,
        contactCount: countByCompanyId.get(row.id) ?? 0,
      }));
    },

    async findCompanyDuplicates(input: {
      legalName?: string;
      tradingName?: string;
      companyNumber?: string;
      excludeId?: string;
    }) {
      const conditions = compactConditions([
        input.companyNumber
          ? eq(companies.companyNumber, input.companyNumber)
          : undefined,
        input.legalName
          ? ilike(companies.legalName, input.legalName)
          : undefined,
        input.tradingName
          ? ilike(companies.tradingName, input.tradingName)
          : undefined,
      ]);

      if (conditions.length === 0) {
        return [];
      }

      return db
        .select()
        .from(companies)
        .where(
          and(
            or(...conditions),
            input.excludeId ? ne(companies.id, input.excludeId) : undefined,
            isNull(companies.archivedAt),
          ),
        )
        .limit(10);
    },

    createContact(input: ContactCreateInput) {
      return contactRepository.create(
        input as Parameters<typeof contactRepository.create>[0],
      );
    },

    updateContact(id: string, input: Partial<NewContact>) {
      return contactRepository.updateById(id, input);
    },

    findContactById(id: string) {
      return contactRepository.findById(id);
    },

    async archiveContact(id: string) {
      const [contact] = await db
        .update(contacts)
        .set({
          status: "archived",
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, id))
        .returning();

      return contact;
    },

    async listContacts(options: {
      search?: string;
      companyId?: string;
      includeArchived?: boolean;
      limit?: number;
    }) {
      const conditions = compactConditions([
        options.includeArchived ? undefined : isNull(contacts.archivedAt),
        options.companyId
          ? eq(contacts.companyId, options.companyId)
          : undefined,
        options.search
          ? or(
              ilike(contacts.firstName, `%${options.search}%`),
              ilike(contacts.lastName, `%${options.search}%`),
              ilike(contacts.email, `%${options.search}%`),
              ilike(contacts.phone, `%${options.search}%`),
              ilike(contacts.roleTitle, `%${options.search}%`),
            )
          : undefined,
      ]);

      return db
        .select({
          contact: contacts,
          companyName: companies.name,
        })
        .from(contacts)
        .leftJoin(companies, eq(companies.id, contacts.companyId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(contacts.updatedAt), desc(contacts.createdAt))
        .limit(options.limit ?? 150);
    },

    async findContactDuplicates(input: {
      email?: string;
      phone?: string;
      excludeId?: string;
    }) {
      const conditions = compactConditions([
        input.email ? eq(contacts.email, input.email) : undefined,
        input.phone ? eq(contacts.phone, input.phone) : undefined,
      ]);

      if (conditions.length === 0) {
        return [];
      }

      return db
        .select()
        .from(contacts)
        .where(
          and(
            or(...conditions),
            input.excludeId ? ne(contacts.id, input.excludeId) : undefined,
            isNull(contacts.archivedAt),
          ),
        )
        .limit(10);
    },

    async listSuppressionMatches(
      records: Array<{
        id: string;
        email: string | null;
        phone: string | null;
      }>,
    ) {
      if (records.length === 0) {
        return new Set<string>();
      }

      const contactIds = records.map((record) => record.id);
      const emailValues = records
        .map((record) => record.email)
        .filter((value): value is string => Boolean(value));
      const phoneValues = records
        .map((record) => record.phone)
        .filter((value): value is string => Boolean(value));

      const valueConditions = compactConditions([
        emailValues.length > 0
          ? inArray(suppressionList.value, emailValues)
          : undefined,
        phoneValues.length > 0
          ? inArray(suppressionList.value, phoneValues)
          : undefined,
      ]);

      const rows = await db
        .select({
          contactId: suppressionList.contactId,
          value: suppressionList.value,
        })
        .from(suppressionList)
        .where(
          and(
            isNull(suppressionList.archivedAt),
            or(
              inArray(suppressionList.contactId, contactIds),
              ...(valueConditions.length > 0 ? [or(...valueConditions)] : []),
            ),
          ),
        );

      const contactIdsByValue = new Map<string, string[]>();

      for (const record of records) {
        if (record.email) {
          contactIdsByValue.set(record.email, [
            ...(contactIdsByValue.get(record.email) ?? []),
            record.id,
          ]);
        }

        if (record.phone) {
          contactIdsByValue.set(record.phone, [
            ...(contactIdsByValue.get(record.phone) ?? []),
            record.id,
          ]);
        }
      }

      const matched = new Set<string>();

      for (const row of rows) {
        if (row.contactId) {
          matched.add(row.contactId);
        }

        for (const id of contactIdsByValue.get(row.value) ?? []) {
          matched.add(id);
        }
      }

      return matched;
    },
  };
}

export type CompanyContactRepository = ReturnType<
  typeof createCompanyContactRepository
>;
