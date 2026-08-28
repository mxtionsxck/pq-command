import { and, desc, eq, ilike, isNull, ne, or } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import type { NewSource } from "@/db/models";
import { sources } from "@/db/schema";

import { createRepository } from "./base-repository";

function compactConditions<T>(values: Array<T | undefined>): T[] {
  return values.filter((value): value is T => value !== undefined);
}

export function createSourceRegistryRepository(db: PQCommandDb) {
  const sourceRepository = createRepository(db, sources, "src");

  return {
    createSource(
      input: Omit<NewSource, "id" | "createdAt" | "updatedAt"> & {
        id?: string;
      },
    ) {
      return sourceRepository.create(
        input as Parameters<typeof sourceRepository.create>[0],
      );
    },

    updateSource(id: string, input: Partial<NewSource>) {
      return sourceRepository.updateById(id, input);
    },

    findSourceById(id: string) {
      return sourceRepository.findById(id);
    },

    async archiveSource(id: string) {
      const [source] = await db
        .update(sources)
        .set({
          status: "archived",
          permissionStatus: "DISABLED",
          enabled: false,
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sources.id, id))
        .returning();

      return source;
    },

    async listSources(options: {
      search?: string;
      includeArchived?: boolean;
      limit?: number;
    }) {
      const conditions = compactConditions([
        options.includeArchived ? undefined : isNull(sources.archivedAt),
        options.search
          ? or(
              ilike(sources.name, `%${options.search}%`),
              ilike(sources.connectorKey, `%${options.search}%`),
              ilike(sources.allowedData, `%${options.search}%`),
            )
          : undefined,
      ]);

      return db
        .select()
        .from(sources)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sources.updatedAt), desc(sources.createdAt))
        .limit(options.limit ?? 100);
    },

    async findDuplicates(input: {
      name: string;
      connectorKey?: string;
      excludeId?: string;
    }) {
      const duplicateConditions = compactConditions([
        eq(sources.name, input.name),
        input.connectorKey
          ? eq(sources.connectorKey, input.connectorKey)
          : undefined,
      ]);

      return db
        .select()
        .from(sources)
        .where(
          and(
            or(...duplicateConditions),
            input.excludeId ? ne(sources.id, input.excludeId) : undefined,
            isNull(sources.archivedAt),
          ),
        )
        .limit(10);
    },
  };
}

export type SourceRegistryRepository = ReturnType<
  typeof createSourceRegistryRepository
>;
