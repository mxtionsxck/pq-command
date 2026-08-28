import type { companyStatusEnum, contactStatusEnum } from "@/db/schema";

export type CompanyStatus = (typeof companyStatusEnum.enumValues)[number];
export type ContactStatus = (typeof contactStatusEnum.enumValues)[number];

export type Contactability = "contactable" | "suppressed" | "limited";

export interface CompanyMutationInput {
  legalName: string;
  tradingName?: string;
  companyNumber?: string;
  website?: string;
  companyType?: string;
  locations?: string;
  status: CompanyStatus;
}

export interface ContactMutationInput {
  companyId?: string;
  firstName: string;
  lastName: string;
  roleTitle?: string;
  email?: string;
  phone?: string;
  source?: string;
  confidence: number;
  suppressionStatus: "clear" | "suppressed" | "review";
  status: ContactStatus;
  notes?: string;
  decisionMakerEvidence?: string;
}

export interface CompanyListItem {
  id: string;
  legalName: string;
  tradingName: string | null;
  companyNumber: string | null;
  website: string | null;
  companyType: string | null;
  locations: string | null;
  status: CompanyStatus;
  contactCount: number;
  duplicateWarning: boolean;
}

export interface ContactListItem {
  id: string;
  companyId: string | null;
  companyName: string | null;
  firstName: string;
  lastName: string;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  confidence: number;
  decisionMakerEvidence: string | null;
  suppressionStatus: "clear" | "suppressed" | "review";
  status: ContactStatus;
  contactability: Contactability;
  duplicateWarning: boolean;
}
