import type {
  DiscoveryPipelineConnector,
  DiscoverySourceItem,
} from "@/domain/discovery/types";

import {
  createPermittedWebFramework,
  type DomainPolicyRecord,
} from "./permitted-web-framework";

const defaultPolicies: DomainPolicyRecord[] = [
  {
    domain: "public.example.org",
    permissionStatus: "APPROVED",
    robotsAllowed: true,
    termsAllowed: true,
    crawlDelayMs: 25,
    maxRequestsPerMinute: 30,
  },
];

function detectSignalType(text: string) {
  const lower = text.toLowerCase();

  if (lower.includes("private landlord")) {
    return "PRIVATE_LANDLORD" as const;
  }
  if (lower.includes("developer")) {
    return "DEVELOPER" as const;
  }
  if (lower.includes("multi-unit") || lower.includes("multiple units")) {
    return "MULTI_UNIT" as const;
  }
  if (lower.includes("portfolio")) {
    return "PORTFOLIO" as const;
  }
  if (lower.includes("owner")) {
    return "PROPERTY_OWNER" as const;
  }
  if (lower.includes("reactivation") || lower.includes("re-listed")) {
    return "REACTIVATION" as const;
  }

  return "AVAILABILITY" as const;
}

function extractBedrooms(text: string) {
  const match = text.match(/(\d+)\s*-?\s*bed/i);

  if (!match) {
    return undefined;
  }

  const parsed = Number.parseInt(match[1] ?? "", 10);

  return Number.isFinite(parsed) ? parsed : undefined;
}

export function createSupplyPublicWebConnector(options: {
  urls: string[];
  domainRegistry?: DomainPolicyRecord[];
  sourceProvenance?: string;
  fetcher?: (url: string, timeoutMs: number) => Promise<string>;
}): DiscoveryPipelineConnector {
  const framework = createPermittedWebFramework();
  const provenanceName = options.sourceProvenance ?? "permitted_public_web";

  return {
    name: "supply.public.web.connector",
    maxRetries: 2,

    async fetch(sourceContext) {
      const result = await framework.fetchPublicPages({
        sourceEnabled: true,
        urls: options.urls,
        domainRegistry: options.domainRegistry ?? defaultPolicies,
        ...(options.fetcher ? { fetcher: options.fetcher } : {}),
        maxRetries: 2,
      });

      if (result.records.length === 0 && result.errors.length > 0) {
        throw new Error(result.errors.join("; "));
      }

      return result.records.map((record, index) => {
        const bedrooms = extractBedrooms(record.text);
        const unitCount = record.text.toLowerCase().includes("multi-unit")
          ? 3
          : 1;
        const hasOwnerEvidence =
          record.text.toLowerCase().includes("owner confirmed") ||
          record.text.toLowerCase().includes("landlord confirmed");

        return {
          externalId: `${record.domain}-${index}`,
          sourceUrl: record.canonicalUrl,
          capturedAt: record.capturedAt,
          title: record.title,
          description: record.text,
          companyName: record.title,
          ...(record.text.toLowerCase().includes("london")
            ? { city: "London" }
            : {}),
          ...(bedrooms !== undefined ? { bedrooms } : {}),
          unitCount,
          companyLetFit: bedrooms && bedrooms >= 5 ? "strong" : "review",
          confidence: hasOwnerEvidence ? 82 : 58,
          sourceProvenance: `${provenanceName}:${record.domain}`,
          fields: {
            sourceId: sourceContext.sourceId,
            ownershipSignal: hasOwnerEvidence
              ? "explicit_owner_statement"
              : "weak_reference",
            fetchProvenance: record.provenance,
          },
        } satisfies DiscoverySourceItem;
      });
    },

    normalise(item) {
      const text = `${item.title} ${item.description}`;
      const supplySignalType = detectSignalType(text);
      const bedrooms = item.bedrooms ?? 0;
      const londonRelevance = item.city?.toLowerCase() === "london";
      const bedroomsInRange = bedrooms >= 3 && bedrooms <= 7;
      const largerHome = bedrooms >= 5;
      const multiUnitOpportunity = (item.unitCount ?? 0) >= 2;
      const companyLetSuitability =
        item.companyLetFit === "ideal" || item.companyLetFit === "strong";
      const timingSignal =
        text.toLowerCase().includes("available") ||
        text.toLowerCase().includes("immediate") ||
        text.toLowerCase().includes("from ");
      const contactability = Boolean(item.contactEmail || item.contactName);
      const supportedRelationship =
        item.fields["ownershipSignal"] === "explicit_owner_statement";

      return {
        identityKey: [
          item.companyName?.toLowerCase(),
          item.contactEmail?.toLowerCase(),
          item.sourceUrl?.toLowerCase(),
        ]
          .filter(Boolean)
          .join("::"),
        leadLabel: item.companyName ?? item.title,
        signalType: supplySignalType,
        supplySignalType,
        confidence: item.confidence,
        sourceReference: `${item.sourceProvenance}:${item.externalId}`,
        ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
        summary: item.description,
        facts: [
          ...(item.city ? [{ field: "location", value: item.city }] : []),
          ...(item.bedrooms !== undefined
            ? [{ field: "bedrooms", value: String(item.bedrooms) }]
            : []),
          ...(item.unitCount !== undefined
            ? [{ field: "unit_count", value: String(item.unitCount) }]
            : []),
        ],
        features: {
          londonRelevance,
          bedroomsInRange,
          largerHome,
          multiUnitOpportunity,
          companyLetSuitability,
          timingSignal,
          contactability,
          supportedRelationship,
        },
        sourceProvenance: item.sourceProvenance,
        rawFields: item.fields,
      };
    },
  };
}
