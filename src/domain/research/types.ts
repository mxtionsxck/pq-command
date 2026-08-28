import type { EvidenceTimelineItem } from "@/domain/evidence/types";

export interface ResearchFact {
  id: string;
  kind: "source_fact" | "ai_inference";
  field: string;
  value: string;
  evidenceIds: string[];
}

export interface ResearchOutput {
  signalId: string;
  leadId: string | null;
  canonicalIdentity: {
    leadLabel: string;
    sourceId: string;
  };
  relevantFacts: ResearchFact[];
  evidence: EvidenceTimelineItem[];
  confidence: number;
  missingFields: string[];
  recommendedNextAction: string;
  partial: boolean;
  recoverableErrors: string[];
}

export interface ResearchConnectorRecord {
  sourceReference: string;
  sourceUrl?: string;
  detectedAt: Date;
  summary: string;
  confidence: number;
  facts: Array<{ field: string; value: string }>;
}

export interface ResearchConnector {
  discoverFromSignal(input: {
    signalId: string;
    sourceId: string;
    payload: Record<string, unknown>;
  }): Promise<ResearchConnectorRecord[]>;
}
