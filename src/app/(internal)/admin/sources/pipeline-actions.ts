"use server";

import { revalidatePath } from "next/cache";

import { createMockDiscoverySourceConnector } from "@/integrations/connectors/mock-discovery-source";
import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createDiscoveryConnectorResolverService } from "@/server/services/discovery-connector-resolver-service";
import { createDiscoveryPipelineService } from "@/server/services/discovery-pipeline-service";
import { createSourceRegistryService } from "@/server/services/source-registry-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

export async function runMockDiscoveryPipelineAction(formData: FormData) {
  const sourceId = readText(formData, "sourceId");

  if (!sourceId) {
    return;
  }

  const user = await requireCurrentUserPermission("manageSources");
  const service = createDiscoveryPipelineService();

  await service.run(
    {
      sourceId,
      idempotencyKey:
        readText(formData, "idempotencyKey") ?? `manual-${Date.now()}`,
      connector: createMockDiscoverySourceConnector(),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/admin/sources");
}

export async function runConfiguredDiscoveryPipelineAction(formData: FormData) {
  const sourceId = readText(formData, "sourceId");

  if (!sourceId) {
    return;
  }

  const user = await requireCurrentUserPermission("manageSources");
  const sourceService = createSourceRegistryService();
  const resolver = createDiscoveryConnectorResolverService();
  const sources = await sourceService.listSources();
  const source = sources.find((item) => item.id === sourceId);

  if (!source) {
    throw new Error("Source not found.");
  }

  const service = createDiscoveryPipelineService();

  await service.run(
    {
      sourceId,
      idempotencyKey:
        readText(formData, "idempotencyKey") ?? `configured-${Date.now()}`,
      connector: resolver.resolve(source),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidatePath("/admin/sources");
}
