import type {
  aiConclusionStatusEnum,
  evidenceCollectionMethodEnum,
} from "@/db/schema";

export type EvidenceCollectionMethod =
  (typeof evidenceCollectionMethodEnum.enumValues)[number];

export interface EvidenceInput {
  sourceId: string;
  leadId?: string;
  signalId: string;
  sourceReference: string;
  sourceUrl?: string;
  detectedAt: Date;
  summary: string;
  confidence: number;
  collectionMethod: EvidenceCollectionMethod;
}

export interface EvidenceTimelineItem {
  id: string;
  sourceId: string;
  sourceReference: string;
  sourceUrl: string | null;
  detectedAt: Date;
  summary: string;
  confidence: number;
  collectionMethod: EvidenceCollectionMethod;
  signalId: string;
}

export type AiConclusionStatus =
  (typeof aiConclusionStatusEnum.enumValues)[number];

export interface AiConclusionInput {
  leadId: string;
  signalId?: string;
  provider: string;
  model: string;
  summary: string;
  recommendation: string;
  confidence: number;
  evidenceIds: string[];
  latencyMs?: number;
  tokenUsage?: Record<string, number>;
  costUsdMicros?: number;
  failureReason?: string;
}

export interface QualificationGuardResult {
  canUseForHighConfidenceQualification: boolean;
  unsupportedReason?: string;
  supportedConclusionIds: string[];
}
