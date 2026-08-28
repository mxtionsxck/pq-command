import type {
  DiscoveryPipelineConnector,
  DiscoverySourceItem,
  NormalisedDiscoveryItem,
  SupplySignalType,
} from "@/domain/discovery/types";

const fixtures: DiscoverySourceItem[] = [
  {
    externalId: "landlord-e1-001",
    sourceUrl: "https://public.example.org/listings/landlord-e1-001",
    capturedAt: new Date("2026-08-27T10:00:00.000Z"),
    title: "Private landlord considering 5-bed company let in London E1",
    description:
      "Owner has a 5-bedroom townhouse and is open to a 24-month company let from October.",
    contactName: "Alex Carter",
    contactEmail: "alex.carter@example.org",
    companyName: "Carter Property Holdings",
    companyNumber: "11223344",
    city: "London",
    postcode: "E1 6AN",
    bedrooms: 5,
    unitCount: 1,
    companyLetFit: "strong",
    confidence: 84,
    sourceProvenance: "mock_public_feed",
    fields: {
      timing: "October",
      ownershipSignal: "explicit_owner_statement",
    },
  },
  {
    externalId: "dev-nw3-portfolio-004",
    sourceUrl: "https://public.example.org/listings/dev-nw3-portfolio-004",
    capturedAt: new Date("2026-08-27T11:00:00.000Z"),
    title: "Developer portfolio update: 6-bedroom and 7-bedroom units",
    description:
      "Portfolio has multi-unit availability suitable for relocation and temporary corporate occupation.",
    contactName: "Priya Shah",
    contactEmail: "priya.shah@example.org",
    companyName: "Northgate Developments Ltd",
    companyNumber: "55667788",
    city: "London",
    postcode: "NW3 5RT",
    bedrooms: 6,
    unitCount: 4,
    companyLetFit: "ideal",
    confidence: 88,
    sourceProvenance: "mock_public_feed",
    fields: {
      timing: "Immediate",
      ownershipSignal: "registered_developer_notice",
    },
  },
  {
    externalId: "landlord-e1-001",
    sourceUrl:
      "https://public.example.org/listings/landlord-e1-001?duplicate=true",
    capturedAt: new Date("2026-08-27T12:00:00.000Z"),
    title: "Duplicate copy: private landlord in E1",
    description:
      "Repeated syndication entry for the same owner and property details.",
    contactName: "Alex Carter",
    contactEmail: "alex.carter@example.org",
    companyName: "Carter Property Holdings",
    companyNumber: "11223344",
    city: "London",
    postcode: "E1 6AN",
    bedrooms: 5,
    unitCount: 1,
    companyLetFit: "strong",
    confidence: 81,
    sourceProvenance: "mock_public_feed",
    fields: {
      timing: "October",
      ownershipSignal: "explicit_owner_statement",
    },
  },
];

function normaliseSignalType(input: DiscoverySourceItem): SupplySignalType {
  const title = input.title.toLowerCase();
  const description = input.description.toLowerCase();

  if (title.includes("developer") || description.includes("developer")) {
    return "DEVELOPER";
  }

  if ((input.unitCount ?? 0) >= 2) {
    return "MULTI_UNIT";
  }

  if (title.includes("portfolio") || description.includes("portfolio")) {
    return "PORTFOLIO";
  }

  if (description.includes("owner") || title.includes("landlord")) {
    return "PROPERTY_OWNER";
  }

  return "AVAILABILITY";
}

function toIdentityKey(input: DiscoverySourceItem) {
  const company = input.companyNumber?.trim().toLowerCase();
  const email = input.contactEmail?.trim().toLowerCase();
  const location = `${input.postcode ?? ""}|${input.bedrooms ?? ""}`
    .trim()
    .toLowerCase();

  return [company, email, location].filter(Boolean).join("::");
}

function hasSupportedRelationship(input: DiscoverySourceItem) {
  return input.fields["ownershipSignal"] === "explicit_owner_statement";
}

export function createMockDiscoverySourceConnector(): DiscoveryPipelineConnector {
  return {
    name: "mock.discovery.source",
    maxRetries: 2,

    async fetch() {
      return fixtures;
    },

    normalise(item: DiscoverySourceItem): NormalisedDiscoveryItem {
      const supplySignalType = normaliseSignalType(item);
      const londonRelevance = item.city?.toLowerCase() === "london";
      const bedrooms = item.bedrooms ?? 0;
      const bedroomsInRange = bedrooms >= 3 && bedrooms <= 7;
      const largerHome = bedrooms >= 5;
      const multiUnitOpportunity = (item.unitCount ?? 0) >= 2;
      const companyLetSuitability =
        item.companyLetFit === "ideal" || item.companyLetFit === "strong";
      const timingSignal =
        item.description.toLowerCase().includes("oct") ||
        item.description.toLowerCase().includes("immediate") ||
        item.description.toLowerCase().includes("month");
      const contactability = Boolean(item.contactEmail || item.contactName);
      const supportedRelationship = hasSupportedRelationship(item);

      return {
        identityKey: toIdentityKey(item),
        leadLabel: item.companyName ?? item.contactName ?? item.title,
        signalType: supplySignalType,
        supplySignalType,
        confidence: item.confidence,
        sourceReference: `${item.sourceProvenance}:${item.externalId}`,
        ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
        summary: item.description,
        facts: [
          ...(item.city ? [{ field: "location", value: item.city }] : []),
          ...(item.postcode
            ? [{ field: "postcode", value: item.postcode }]
            : []),
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
