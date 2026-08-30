import type { jobRunStatusEnum, signalTypeEnum } from "@/db/schema";

export type DiscoveryJobStatus = (typeof jobRunStatusEnum.enumValues)[number];
export type PipelineSignalType = (typeof signalTypeEnum.enumValues)[number];

export type SupplySignalType =
  | "PRIVATE_LANDLORD"
  | "DEVELOPER"
  | "MULTI_UNIT"
  | "AVAILABILITY"
  | "PORTFOLIO"
  | "PROPERTY_OWNER"
  | "REACTIVATION";

export interface DiscoverySourceItem {
  externalId: string;
  sourceUrl?: string;
  capturedAt: Date;
  title: string;
  description: string;
  contactName?: string;
  contactEmail?: string;
  companyName?: string;
  companyNumber?: string;
  city?: string;
  postcode?: string;
  bedrooms?: number;
  unitCount?: number;
  companyLetFit?: "ideal" | "strong" | "review" | "unsuitable";
  confidence: number;
  sourceProvenance: string;
  fields: Record<string, unknown>;
}

export interface NormalisedDiscoveryItem {
  identityKey: string;
  leadLabel: string;
  leadType: "supply" | "demand" | "ai_discovered";
  signalType: PipelineSignalType;
  supplySignalType: SupplySignalType;
  confidence: number;
  sourceReference: string;
  sourceUrl?: string;
  summary: string;
  facts: Array<{ field: string; value: string }>;
  features: {
    londonRelevance: boolean;
    bedroomsInRange: boolean;
    largerHome: boolean;
    multiUnitOpportunity: boolean;
    companyLetSuitability: boolean;
    timingSignal: boolean;
    contactability: boolean;
    supportedRelationship: boolean;
  };
  sourceProvenance: string;
  rawFields: Record<string, unknown>;
}

export interface DiscoveryPipelineResult {
  jobRunId: string;
  idempotencyKey: string;
  status: DiscoveryJobStatus;
  processed: number;
  collapsedDuplicates: number;
  createdSignals: number;
  createdLeads: number;
  qualifiedLeads: number;
  errors: string[];
}

export interface DiscoveryPipelineConnector {
  readonly name: string;
  readonly maxRetries: number;

  fetch(sourceContext: {
    sourceId: string;
    allowedData: string[];
    rateLimitPerMinute: number;
  }): Promise<DiscoverySourceItem[]>;
  normalise(item: DiscoverySourceItem): NormalisedDiscoveryItem;
}
