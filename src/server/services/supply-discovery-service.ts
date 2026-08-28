import type { AuditActor } from "@/domain/audit/types";
import { createSupplyPublicWebConnector } from "@/integrations/connectors/supply-public-web-connector";
import type { DomainPolicyRecord } from "@/integrations/connectors/permitted-web-framework";

import { createDiscoveryPipelineService } from "./discovery-pipeline-service";

export function createSupplyDiscoveryService(
  pipelineService = createDiscoveryPipelineService(),
) {
  return {
    async runSupplyDiscovery(
      input: {
        sourceId: string;
        idempotencyKey: string;
        urls: string[];
        domainRegistry?: DomainPolicyRecord[];
        fetcher?: (url: string, timeoutMs: number) => Promise<string>;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" } = {
        type: "system",
        id: "supply_discovery",
      },
    ) {
      return pipelineService.run(
        {
          sourceId: input.sourceId,
          idempotencyKey: input.idempotencyKey,
          connector: createSupplyPublicWebConnector({
            urls: input.urls,
            sourceProvenance: "supply_public_web",
            ...(input.domainRegistry
              ? { domainRegistry: input.domainRegistry }
              : {}),
            ...(input.fetcher ? { fetcher: input.fetcher } : {}),
          }),
        },
        actor,
      );
    },
  };
}
