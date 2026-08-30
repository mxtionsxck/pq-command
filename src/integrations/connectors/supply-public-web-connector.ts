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

function isPolicyApproved(record: DomainPolicyRecord) {
  return (
    record.permissionStatus === "APPROVED" &&
    record.robotsAllowed &&
    record.termsAllowed
  );
}

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

function detectLeadType(text: string) {
  const lower = text.toLowerCase();

  if (
    lower.includes("investor") ||
    lower.includes("looking for") ||
    lower.includes("requirement") ||
    lower.includes("we need") ||
    lower.includes("units needed")
  ) {
    return "demand" as const;
  }

  return "supply" as const;
}

function hasCompanyLetIntent(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("company let") ||
    lower.includes("corporate let") ||
    lower.includes("corporate housing") ||
    lower.includes("relocation housing")
  );
}

function hasInvestorOrStockSignal(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("investor") ||
    lower.includes("private landlord") ||
    lower.includes("landlord") ||
    lower.includes("developer") ||
    lower.includes("portfolio") ||
    lower.includes("multi-unit") ||
    lower.includes("multiple units") ||
    lower.includes("block") ||
    lower.includes("units") ||
    lower.includes("house")
  );
}

function hasNearCompletionSignal(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("nearing completion") ||
    lower.includes("near completion") ||
    lower.includes("completing") ||
    lower.includes("completion due") ||
    lower.includes("handover") ||
    lower.includes("practical completion")
  );
}

function hasIntermediarySignals(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("estate agent") ||
    lower.includes("letting agent") ||
    lower.includes("broker") ||
    lower.includes("sourcing") ||
    lower.includes("on behalf") ||
    lower.includes("for my client")
  );
}

function isCompanyLetInvestorOrStockMatch(text: string) {
  return hasCompanyLetIntent(text) && hasInvestorOrStockSignal(text);
}

function pickExpansionUrls(input: {
  domainRegistry: DomainPolicyRecord[];
  discoveredLinks: string[];
  maxCount: number;
}) {
  const approvedDomains = new Set(
    input.domainRegistry
      .filter(isPolicyApproved)
      .map((record) => record.domain.toLowerCase()),
  );

  const keywords = [
    "company-let",
    "company%20let",
    "corporate-let",
    "investor",
    "landlord",
    "developer",
    "portfolio",
    "block",
    "multi-unit",
    "completion",
    "handover",
  ];

  const selected: string[] = [];

  for (const href of input.discoveredLinks) {
    if (selected.length >= input.maxCount) {
      break;
    }

    try {
      const parsed = new URL(href);
      const host = parsed.hostname.toLowerCase();
      if (!approvedDomains.has(host)) {
        continue;
      }

      const lower = href.toLowerCase();
      if (!keywords.some((keyword) => lower.includes(keyword))) {
        continue;
      }

      selected.push(href);
    } catch {
      // Ignore invalid URLs.
    }
  }

  return Array.from(new Set(selected));
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
      const domainRegistry = options.domainRegistry ?? defaultPolicies;
      const result = await framework.fetchPublicPages({
        sourceEnabled: true,
        urls: options.urls,
        domainRegistry,
        ...(options.fetcher ? { fetcher: options.fetcher } : {}),
        maxRetries: 2,
      });

      const expansionUrls = pickExpansionUrls({
        domainRegistry,
        discoveredLinks: result.records.flatMap((record) => record.discoveredLinks),
        maxCount: 18,
      });

      const expansionResult =
        expansionUrls.length > 0
          ? await framework.fetchPublicPages({
              sourceEnabled: true,
              urls: expansionUrls,
              domainRegistry,
              ...(options.fetcher ? { fetcher: options.fetcher } : {}),
              maxRetries: 2,
            })
          : { records: [], errors: [] };

      const records = [...result.records, ...expansionResult.records];
      const errors = [...result.errors, ...expansionResult.errors];

      if (records.length === 0 && errors.length > 0) {
        throw new Error(errors.join("; "));
      }

      return records.map((record, index) => {
        const bedrooms = extractBedrooms(record.text);
        const unitCount = record.text.toLowerCase().includes("multi-unit")
          ? 3
          : 1;
        const hasOwnerEvidence =
          record.text.toLowerCase().includes("owner confirmed") ||
          record.text.toLowerCase().includes("landlord confirmed");
        const nearCompletion = hasNearCompletionSignal(record.text);

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
          confidence: nearCompletion
            ? 86
            : hasOwnerEvidence
              ? 82
              : 58,
          sourceProvenance: `${provenanceName}:${record.domain}`,
          fields: {
            sourceId: sourceContext.sourceId,
            ownershipSignal: hasOwnerEvidence
              ? "explicit_owner_statement"
              : "weak_reference",
            nearCompletion,
            discoveredLinks: record.discoveredLinks,
            discoveryDepth: index < result.records.length ? 0 : 1,
            fetchProvenance: record.provenance,
          },
        } satisfies DiscoverySourceItem;
      }).filter((record) =>
        isCompanyLetInvestorOrStockMatch(`${record.title} ${record.description}`),
      );
    },

    normalise(item) {
      const text = `${item.title} ${item.description}`;
      const supplySignalType = detectSignalType(text);
      const leadType = detectLeadType(text);
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
        !hasIntermediarySignals(text) &&
        (item.fields["ownershipSignal"] === "explicit_owner_statement" ||
          text.toLowerCase().includes("developer") ||
          text.toLowerCase().includes("private landlord"));

      return {
        identityKey: [
          item.companyName?.toLowerCase(),
          item.contactEmail?.toLowerCase(),
          item.sourceUrl?.toLowerCase(),
        ]
          .filter(Boolean)
          .join("::"),
        leadLabel: item.companyName ?? item.title,
        leadType,
        signalType: leadType === "demand" ? "inquiry" : supplySignalType,
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
          ...(item.fields["nearCompletion"] === true
            ? [{ field: "development_status", value: "near_completion" }]
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
