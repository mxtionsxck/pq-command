"use server";

import { revalidatePath } from "next/cache";

import type { SourceRegistryMutationInput } from "@/domain/source/types";
import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createSourceRegistryService } from "@/server/services/source-registry-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function readInteger(formData: FormData, key: string) {
  const value = readText(formData, key);

  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function readJsonObject(formData: FormData, key: string) {
  const value = readText(formData, key);

  if (!value) {
    return undefined;
  }

  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${key} must be a JSON object.`);
  }

  return parsed as Record<string, unknown>;
}

function revalidateSources() {
  revalidatePath("/admin/sources");
}

function setIfDefined<
  TRecord extends Record<string, unknown>,
  TKey extends keyof TRecord,
>(target: Partial<TRecord>, key: TKey, value: TRecord[TKey] | undefined) {
  if (value !== undefined) {
    target[key] = value;
  }
}

function parseCreateInput(formData: FormData): SourceRegistryMutationInput {
  const connectorKey = readText(formData, "connectorKey");
  const allowedData = readText(formData, "allowedData");
  const rateLimitPerMinute = readInteger(formData, "rateLimitPerMinute");
  const notes = readText(formData, "notes");
  const config = readJsonObject(formData, "configJson");

  return {
    name: readText(formData, "name") ?? "",
    kind:
      (readText(formData, "kind") as SourceRegistryMutationInput["kind"]) ??
      "manual",
    ...(connectorKey ? { connectorKey } : {}),
    permissionStatus:
      (readText(
        formData,
        "permissionStatus",
      ) as SourceRegistryMutationInput["permissionStatus"]) ??
      "REVIEW_REQUIRED",
    ...(allowedData ? { allowedData } : {}),
    ...(rateLimitPerMinute !== undefined ? { rateLimitPerMinute } : {}),
    enabled: readBoolean(formData, "enabled"),
    health:
      (readText(formData, "health") as SourceRegistryMutationInput["health"]) ??
      "unknown",
    ...(notes ? { notes } : {}),
    ...(config ? { config } : {}),
  };
}

function parseUpdatePatch(
  formData: FormData,
): Partial<SourceRegistryMutationInput> {
  const patch: Partial<SourceRegistryMutationInput> = {};

  setIfDefined(patch, "name", readText(formData, "name"));
  setIfDefined(
    patch,
    "kind",
    readText(formData, "kind") as
      SourceRegistryMutationInput["kind"] | undefined,
  );
  setIfDefined(patch, "connectorKey", readText(formData, "connectorKey"));
  setIfDefined(
    patch,
    "permissionStatus",
    readText(formData, "permissionStatus") as
      SourceRegistryMutationInput["permissionStatus"] | undefined,
  );
  setIfDefined(patch, "allowedData", readText(formData, "allowedData"));
  setIfDefined(
    patch,
    "rateLimitPerMinute",
    readInteger(formData, "rateLimitPerMinute"),
  );
  setIfDefined(
    patch,
    "health",
    readText(formData, "health") as
      SourceRegistryMutationInput["health"] | undefined,
  );
  setIfDefined(patch, "notes", readText(formData, "notes"));
  setIfDefined(patch, "config", readJsonObject(formData, "configJson"));
  patch.enabled = readBoolean(formData, "enabled");

  return patch;
}

export async function createSourceAction(formData: FormData) {
  const input = parseCreateInput(formData);

  if (!input.name) {
    return;
  }

  const user = await requireCurrentUserPermission("manageSources");
  const service = createSourceRegistryService();

  await service.createSource(input, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateSources();
}

export async function updateSourceAction(formData: FormData) {
  const sourceId = readText(formData, "sourceId");

  if (!sourceId) {
    return;
  }

  const user = await requireCurrentUserPermission("manageSources");
  const service = createSourceRegistryService();

  await service.updateSource(sourceId, parseUpdatePatch(formData), {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateSources();
}

export async function archiveSourceAction(formData: FormData) {
  const sourceId = readText(formData, "sourceId");

  if (!sourceId) {
    return;
  }

  const user = await requireCurrentUserPermission("manageSources");
  const service = createSourceRegistryService();

  await service.archiveSource(sourceId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateSources();
}

export async function disableSourceAction(formData: FormData) {
  const sourceId = readText(formData, "sourceId");

  if (!sourceId) {
    return;
  }

  const user = await requireCurrentUserPermission("manageSources");
  const service = createSourceRegistryService();

  await service.disableSourceImmediately(sourceId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateSources();
}

export async function assertSourceJobAllowedAction(formData: FormData) {
  const sourceId = readText(formData, "sourceId");

  if (!sourceId) {
    return;
  }

  const service = createSourceRegistryService();

  await service.assertSourceJobAllowed(sourceId);
}
