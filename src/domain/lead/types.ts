import type {
  directnessClassificationEnum,
  leadOutreachStatusEnum,
  leadStatusEnum,
  leadTypeEnum,
} from "@/db/schema";
import type { EvidenceTimelineItem } from "@/domain/evidence/types";

export type LeadType = (typeof leadTypeEnum.enumValues)[number];
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
export type LeadOutreachStatus =
  (typeof leadOutreachStatusEnum.enumValues)[number];
export type DirectnessClassification =
  (typeof directnessClassificationEnum.enumValues)[number];

export type LeadRoomView =
  "supply" | "demand" | "ai_discovered" | "researching" | "qualified";

export interface LeadListItem {
  id: string;
  leadLabel: string;
  leadType: LeadType;
  score: number;
  confidence: number;
  sourceName: string;
  lastSignalAt: Date | null;
  evidenceCount: number;
  status: LeadStatus;
  directnessClassification: DirectnessClassification;
  nextAction: string | null;
}

export interface LeadDrawerRecord {
  id: string;
  leadType: LeadType;
  status: LeadStatus;
  directnessClassification: DirectnessClassification;
  score: number;
  confidence: number;
  scoreVersion: string | null;
  lastScoredAt: Date | null;
  summary: string | null;
  nextAction: string | null;
  outreachStatus: LeadOutreachStatus;
  sourceName: string;
  sourceProvenance: string;
  companyName: string | null;
  contactName: string | null;
  propertyTitle: string | null;
  signals: Array<{
    id: string;
    type: string;
    status: string;
    detectedAt: Date;
    payloadSummary: string;
  }>;
  evidence: EvidenceTimelineItem[];
  qualificationGuard: {
    canUseForHighConfidenceQualification: boolean;
    supportedConclusionCount: number;
  };
}
