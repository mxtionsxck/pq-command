export type LeadScoreBand =
  "IGNORE" | "MONITOR" | "RESEARCH" | "QUALIFIED" | "PRIORITY";

export interface LeadScoringWeights {
  companyLetFit: number;
  location: number;
  bedroomsUnits: number;
  timing: number;
  commercialFit: number;
  evidenceStrength: number;
  decisionMakerConfidence: number;
  recency: number;
  contactability: number;
  historicalConversionLikelihood: number;
}

export interface LeadScoringThresholds {
  IGNORE: number;
  MONITOR: number;
  RESEARCH: number;
  QUALIFIED: number;
  PRIORITY: number;
}

export interface LeadScoringConfigShape {
  version: string;
  weights: LeadScoringWeights;
  thresholds: LeadScoringThresholds;
}

export interface LeadScoreResult {
  leadId: string;
  score: number;
  confidence: number;
  reasonCodes: string[];
  missingData: string[];
  scoringVersion: string;
  band: LeadScoreBand;
}
