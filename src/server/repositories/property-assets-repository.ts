import { and, asc, desc, eq, isNull } from "drizzle-orm";

import type { PQCommandDb } from "@/db/client";
import { createEntityId } from "@/db/ids";
import type {
  Document,
  NewDocument,
  NewPropertyMedium,
  PropertyMedium,
} from "@/db/models";
import { documents, propertyMedia } from "@/db/schema";

type NewMediaInput = Omit<
  NewPropertyMedium,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

type NewDocumentInput = Omit<NewDocument, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

export function createPropertyAssetsRepository(db: PQCommandDb) {
  return {
    async listMedia(propertyId: string): Promise<PropertyMedium[]> {
      return db
        .select()
        .from(propertyMedia)
        .where(
          and(
            eq(propertyMedia.propertyId, propertyId),
            isNull(propertyMedia.archivedAt),
          ),
        )
        .orderBy(
          desc(propertyMedia.isHero),
          asc(propertyMedia.sortOrder),
          asc(propertyMedia.createdAt),
        );
    },

    async findMediaById(
      propertyId: string,
      mediaId: string,
    ): Promise<PropertyMedium | undefined> {
      const [media] = await db
        .select()
        .from(propertyMedia)
        .where(
          and(
            eq(propertyMedia.propertyId, propertyId),
            eq(propertyMedia.id, mediaId),
          ),
        )
        .limit(1);

      return media;
    },

    async createMedia(input: NewMediaInput): Promise<PropertyMedium> {
      const [media] = await db
        .insert(propertyMedia)
        .values({
          ...input,
          id: input.id ?? createEntityId("med"),
        })
        .returning();

      if (!media) {
        throw new Error("Failed to create property media record.");
      }

      return media;
    },

    async updateMedia(
      mediaId: string,
      input: Partial<NewPropertyMedium>,
    ): Promise<PropertyMedium | undefined> {
      const [media] = await db
        .update(propertyMedia)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(propertyMedia.id, mediaId))
        .returning();

      return media;
    },

    async clearHeroSelection(propertyId: string) {
      await db
        .update(propertyMedia)
        .set({ isHero: false, updatedAt: new Date() })
        .where(eq(propertyMedia.propertyId, propertyId));
    },

    async archiveMedia(mediaId: string): Promise<PropertyMedium | undefined> {
      const [media] = await db
        .update(propertyMedia)
        .set({ archivedAt: new Date(), isHero: false, updatedAt: new Date() })
        .where(eq(propertyMedia.id, mediaId))
        .returning();

      return media;
    },

    async listDocuments(propertyId: string): Promise<Document[]> {
      return db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.propertyId, propertyId),
            isNull(documents.archivedAt),
          ),
        )
        .orderBy(desc(documents.createdAt));
    },

    async findDocumentById(
      propertyId: string,
      documentId: string,
    ): Promise<Document | undefined> {
      const [document] = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.propertyId, propertyId),
            eq(documents.id, documentId),
          ),
        )
        .limit(1);

      return document;
    },

    async createDocument(input: NewDocumentInput): Promise<Document> {
      const [document] = await db
        .insert(documents)
        .values({
          ...input,
          id: input.id ?? createEntityId("doc"),
        })
        .returning();

      if (!document) {
        throw new Error("Failed to create document record.");
      }

      return document;
    },

    async archiveDocument(documentId: string): Promise<Document | undefined> {
      const [document] = await db
        .update(documents)
        .set({
          archivedAt: new Date(),
          status: "archived",
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId))
        .returning();

      return document;
    },
  };
}

export type PropertyAssetsRepository = ReturnType<
  typeof createPropertyAssetsRepository
>;
