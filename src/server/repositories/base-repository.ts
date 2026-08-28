import { eq } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";

import { createEntityId } from "@/db/ids";
import type { PQCommandDb } from "@/db/client";

type RepositoryTable = AnyPgTable & {
  id: AnyPgColumn;
  updatedAt: AnyPgColumn;
};

type CreateInput<TTable extends RepositoryTable> = Omit<
  InferInsertModel<TTable>,
  "createdAt" | "updatedAt"
> & {
  id?: string;
};

type UpdateInput<TTable extends RepositoryTable> = Partial<
  Omit<InferInsertModel<TTable>, "id" | "createdAt" | "updatedAt">
>;

export function createRepository<TTable extends RepositoryTable>(
  db: PQCommandDb,
  table: TTable,
  idPrefix: string,
) {
  return {
    async create(
      input: CreateInput<TTable>,
    ): Promise<InferSelectModel<TTable>> {
      const values = {
        ...input,
        id: input.id ?? createEntityId(idPrefix),
      } as InferInsertModel<TTable>;

      const [entity] = await db.insert(table).values(values).returning();

      return entity as InferSelectModel<TTable>;
    },

    async findById(id: string): Promise<InferSelectModel<TTable> | undefined> {
      const [entity] = await db
        .select()
        .from(table as AnyPgTable)
        .where(eq(table.id, id))
        .limit(1);

      return entity as InferSelectModel<TTable> | undefined;
    },

    async list(limit = 100): Promise<InferSelectModel<TTable>[]> {
      const entities = await db
        .select()
        .from(table as AnyPgTable)
        .limit(limit);

      return entities as InferSelectModel<TTable>[];
    },

    async updateById(
      id: string,
      input: UpdateInput<TTable>,
    ): Promise<InferSelectModel<TTable> | undefined> {
      const [entity] = await db
        .update(table)
        .set({
          ...input,
          updatedAt: new Date(),
        } as Partial<InferInsertModel<TTable>>)
        .where(eq(table.id, id))
        .returning();

      return entity as InferSelectModel<TTable> | undefined;
    },
  };
}
