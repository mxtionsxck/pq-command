import path from "node:path";

import { getDb } from "@/db/client";
import type { Document, PropertyMedium } from "@/db/models";
import type { AuditActor } from "@/domain/audit/types";
import type { CurrentUser } from "@/domain/auth/types";
import { canManageSources } from "@/server/auth/rbac";
import { getObjectStorageAdapter } from "@/integrations/storage";
import type { ObjectStorageAdapter } from "@/integrations/storage/adapter";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { createPropertyAssetsRepository } from "@/server/repositories/property-assets-repository";

import { createAuditService } from "./audit-event-service";

const mediaMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const documentMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const maxMediaBytes = 10 * 1024 * 1024;
const maxDocumentBytes = 20 * 1024 * 1024;

type PropertyAssetsRepositoryLike = ReturnType<
  typeof createPropertyAssetsRepository
>;

type PropertyAssetsServiceDependencies = {
  repository?: PropertyAssetsRepositoryLike;
  storage?: ObjectStorageAdapter;
  auditService?: ReturnType<typeof createAuditService>;
};

function ensureManageAssets(
  actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
) {
  if (actor.role && !canManageSources(actor.role)) {
    throw new Error("Only managers and admins can manage property assets.");
  }
}

function getRepository(
  repository?: PropertyAssetsRepositoryLike,
): PropertyAssetsRepositoryLike {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    throw new Error(
      "DATABASE_URL is required before property assets can be managed.",
    );
  }

  return createPropertyAssetsRepository(getDb());
}

function buildPublicMediaUrl(propertyId: string, mediaId: string) {
  return `/api/internal/properties/${propertyId}/media/${mediaId}`;
}

function buildDocumentViewUrl(propertyId: string, documentId: string) {
  return `/api/internal/properties/${propertyId}/documents/${documentId}`;
}

function buildDocumentDownloadUrl(propertyId: string, documentId: string) {
  return `/api/internal/properties/${propertyId}/documents/${documentId}?download=1`;
}

function getExtension(name: string) {
  return path.extname(name).toLowerCase();
}

export function canViewPropertyDocument(
  user: CurrentUser | null | undefined,
): boolean {
  return Boolean(user);
}

export function canViewPropertyMedia(
  user: CurrentUser | null | undefined,
): boolean {
  return Boolean(user);
}

export function createPropertyAssetsService(
  dependencies: PropertyAssetsServiceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const storage = dependencies.storage ?? getObjectStorageAdapter();
  const getAuditService = () =>
    dependencies.auditService ?? createAuditService();

  return {
    async listMedia(propertyId: string) {
      const media = await repository.listMedia(propertyId);

      return media.map((item) => ({
        ...item,
        publicUrl: buildPublicMediaUrl(propertyId, item.id),
      }));
    },

    async listDocuments(propertyId: string) {
      const docs = await repository.listDocuments(propertyId);

      return docs.map((item) => ({
        ...item,
        viewUrl: buildDocumentViewUrl(propertyId, item.id),
        downloadUrl: buildDocumentDownloadUrl(propertyId, item.id),
      }));
    },

    async uploadMedia(
      propertyId: string,
      file: File,
      input: {
        caption?: string;
        altText?: string;
        sortOrder?: number;
        kind?: PropertyMedium["kind"];
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureManageAssets(actor);

      if (!mediaMimeTypes.has(file.type)) {
        throw new Error("Unsupported media type. Use JPEG, PNG, or WebP.");
      }

      if (file.size > maxMediaBytes) {
        throw new Error("Media file exceeds the 10MB limit.");
      }

      const body = Buffer.from(await file.arrayBuffer());
      const storedObject = await storage.putObject({
        keyPrefix: `properties/${propertyId}/media`,
        body,
        contentType: file.type,
        extension: getExtension(file.name),
      });

      const media = await repository.createMedia({
        propertyId,
        uploadedByUserId: actor.userId,
        kind: input.kind ?? "image",
        storageKey: storedObject.objectKey,
        originalFilename: file.name,
        mimeType: file.type,
        byteSize: file.size,
        caption: input.caption,
        altText: input.altText,
        sortOrder: input.sortOrder ?? 0,
      });

      await getAuditService().recordEvent({
        actor,
        action: "property.media.uploaded",
        entityType: "property",
        entityId: propertyId,
        metadata: {
          mediaId: media.id,
          mimeType: media.mimeType,
          byteSize: media.byteSize,
          filename: media.originalFilename,
        },
      });

      return {
        ...media,
        publicUrl: buildPublicMediaUrl(propertyId, media.id),
      };
    },

    async updateMediaMetadata(
      propertyId: string,
      mediaId: string,
      input: {
        caption?: string;
        altText?: string;
        sortOrder?: number;
        isHero?: boolean;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureManageAssets(actor);

      if (input.isHero) {
        await repository.clearHeroSelection(propertyId);
      }

      const media = await repository.updateMedia(mediaId, input);

      if (!media) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: input.isHero
          ? "property.media.hero_selected"
          : "property.media.updated",
        entityType: "property",
        entityId: propertyId,
        metadata: {
          mediaId,
          changedFields: Object.keys(input),
        },
      });

      return {
        ...media,
        publicUrl: buildPublicMediaUrl(propertyId, media.id),
      };
    },

    async archiveMedia(
      propertyId: string,
      mediaId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureManageAssets(actor);

      const existingMedia = await repository.findMediaById(propertyId, mediaId);

      const media = await repository.archiveMedia(mediaId);

      if (!media) {
        return undefined;
      }

      if (existingMedia) {
        await storage.deleteObject(existingMedia.storageKey);
      }

      await getAuditService().recordEvent({
        actor,
        action: "property.media.archived",
        entityType: "property",
        entityId: propertyId,
        metadata: {
          mediaId,
        },
      });

      return media;
    },

    async uploadDocument(
      propertyId: string,
      file: File,
      input: {
        title: string;
        documentType: Document["documentType"];
        versionNumber: number;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureManageAssets(actor);

      if (!documentMimeTypes.has(file.type)) {
        throw new Error(
          "Unsupported document type. Use PDF, JPEG, PNG, or WebP.",
        );
      }

      if (file.size > maxDocumentBytes) {
        throw new Error("Document exceeds the 20MB limit.");
      }

      const body = Buffer.from(await file.arrayBuffer());
      const storedObject = await storage.putObject({
        keyPrefix: `properties/${propertyId}/documents`,
        body,
        contentType: file.type,
        extension: getExtension(file.name),
      });

      const document = await repository.createDocument({
        propertyId,
        uploadedByUserId: actor.userId,
        title: input.title,
        documentType: input.documentType,
        versionNumber: input.versionNumber,
        originalFilename: file.name,
        storageKey: storedObject.objectKey,
        byteSize: file.size,
        mimeType: file.type,
        status: "active",
      });

      await getAuditService().recordEvent({
        actor,
        action: "property.document.uploaded",
        entityType: "property",
        entityId: propertyId,
        metadata: {
          documentId: document.id,
          documentType: document.documentType,
          versionNumber: document.versionNumber,
          filename: document.originalFilename,
        },
      });

      return {
        ...document,
        viewUrl: buildDocumentViewUrl(propertyId, document.id),
        downloadUrl: buildDocumentDownloadUrl(propertyId, document.id),
      };
    },

    async archiveDocument(
      propertyId: string,
      documentId: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureManageAssets(actor);

      const existingDocument = await repository.findDocumentById(
        propertyId,
        documentId,
      );

      const document = await repository.archiveDocument(documentId);

      if (!document) {
        return undefined;
      }

      if (existingDocument) {
        await storage.deleteObject(existingDocument.storageKey);
      }

      await getAuditService().recordEvent({
        actor,
        action: "property.document.archived",
        entityType: "property",
        entityId: propertyId,
        metadata: {
          documentId,
        },
      });

      return document;
    },

    async getMediaFile(propertyId: string, mediaId: string) {
      const media = await repository.findMediaById(propertyId, mediaId);

      if (!media || media.archivedAt) {
        return null;
      }

      const object = await storage.getObject(media.storageKey);

      return {
        media,
        object,
      };
    },

    async getDocumentFile(propertyId: string, documentId: string) {
      const document = await repository.findDocumentById(
        propertyId,
        documentId,
      );

      if (!document || document.archivedAt || document.status === "archived") {
        return null;
      }

      const object = await storage.getObject(document.storageKey);

      return {
        document,
        object,
      };
    },
  };
}
