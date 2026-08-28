import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { createEntityId } from "@/db/ids";
import { appEnv } from "@/lib/env";

import type {
  ObjectStorageAdapter,
  PutObjectInput,
  StoredObject,
} from "./adapter";

function getStorageRoot() {
  return appEnv.STORAGE_ROOT ?? path.join(process.cwd(), ".storage", "private");
}

function getObjectPath(objectKey: string) {
  return path.join(
    /*turbopackIgnore: true*/ getStorageRoot(),
    objectKey.replace(/\//g, path.sep),
  );
}

function getContentTypeExtension(contentType: string) {
  if (contentType === "image/jpeg") {
    return ".jpg";
  }

  if (contentType === "image/png") {
    return ".png";
  }

  if (contentType === "image/webp") {
    return ".webp";
  }

  if (contentType === "application/pdf") {
    return ".pdf";
  }

  return "";
}

export function createLocalPrivateStorageAdapter(): ObjectStorageAdapter {
  return {
    async putObject(input: PutObjectInput) {
      const objectKey = `${input.keyPrefix}/${createEntityId("obj")}${input.extension || getContentTypeExtension(input.contentType)}`;
      const objectPath = getObjectPath(objectKey);

      await mkdir(path.dirname(objectPath), { recursive: true });
      await writeFile(objectPath, input.body);

      return { objectKey };
    },

    async getObject(objectKey: string): Promise<StoredObject> {
      const objectPath = getObjectPath(objectKey);
      const body = await readFile(/*turbopackIgnore: true*/ objectPath);
      const extension = path.extname(objectKey).toLowerCase();
      const contentType =
        extension === ".jpg" || extension === ".jpeg"
          ? "image/jpeg"
          : extension === ".png"
            ? "image/png"
            : extension === ".webp"
              ? "image/webp"
              : extension === ".pdf"
                ? "application/pdf"
                : "application/octet-stream";

      return {
        body,
        contentType,
        contentLength: body.byteLength,
      };
    },

    async deleteObject(objectKey: string) {
      const objectPath = getObjectPath(objectKey);

      await rm(objectPath, { force: true });
    },
  };
}
