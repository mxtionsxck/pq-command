import type { Source } from "@/db/models";
import type { DiscoveryPipelineConnector } from "@/domain/discovery/types";
import {
  createSupplyPublicWebConnector,
} from "@/integrations/connectors/supply-public-web-connector";
import type { DomainPolicyRecord } from "@/integrations/connectors/permitted-web-framework";

type PublicWebSourceConfig = {
  urls: string[];
  domainRegistry?: DomainPolicyRecord[];
  sourceProvenance?: string;
};

function parsePublicWebConfig(config: Record<string, unknown>): PublicWebSourceConfig {
  const urls = Array.isArray(config["urls"])
    ? config["urls"].filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const domainRegistry = Array.isArray(config["domainRegistry"])
    ? config["domainRegistry"].filter(
        (value): value is DomainPolicyRecord =>
          Boolean(value) &&
          typeof value === "object" &&
          typeof (value as DomainPolicyRecord).domain === "string" &&
          typeof (value as DomainPolicyRecord).permissionStatus === "string" &&
          typeof (value as DomainPolicyRecord).robotsAllowed === "boolean" &&
          typeof (value as DomainPolicyRecord).termsAllowed === "boolean" &&
          typeof (value as DomainPolicyRecord).crawlDelayMs === "number" &&
          typeof (value as DomainPolicyRecord).maxRequestsPerMinute === "number",
      )
    : [];
  const sourceProvenance =
    typeof config["sourceProvenance"] === "string" &&
    config["sourceProvenance"].trim().length > 0
      ? config["sourceProvenance"].trim()
      : undefined;

  if (urls.length === 0) {
    throw new Error("Public web source config must include at least one URL.");
  }

  if (domainRegistry.length === 0) {
    throw new Error(
      "Public web source config must include domainRegistry policy records.",
    );
  }

  return {
    urls,
    domainRegistry,
    ...(sourceProvenance ? { sourceProvenance } : {}),
  };
}

export function createDiscoveryConnectorResolverService() {
  return {
    resolve(source: Source): DiscoveryPipelineConnector {
      if (source.connectorKey === "supply.public.web") {
        const parsedConfig = parsePublicWebConfig(source.config ?? {});

        return createSupplyPublicWebConnector(parsedConfig);
      }

      throw new Error(
        `Unsupported source connector: ${source.connectorKey ?? "unset"}.`,
      );
    },
  };
}