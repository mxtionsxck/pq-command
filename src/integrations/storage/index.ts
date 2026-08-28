import type { ObjectStorageAdapter } from "./adapter";
import { createLocalPrivateStorageAdapter } from "./local-private-storage";

let storageAdapter: ObjectStorageAdapter | undefined;

export function getObjectStorageAdapter(): ObjectStorageAdapter {
  if (!storageAdapter) {
    storageAdapter = createLocalPrivateStorageAdapter();
  }

  return storageAdapter;
}
