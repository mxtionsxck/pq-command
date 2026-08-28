import type {
  propertyAvailabilityEnum,
  propertyFitEnum,
  propertyStatusEnum,
  propertyTypeEnum,
} from "@/db/schema";

export type PropertyStatus = (typeof propertyStatusEnum.enumValues)[number];
export type PropertyType = (typeof propertyTypeEnum.enumValues)[number];
export type PropertyAvailability =
  (typeof propertyAvailabilityEnum.enumValues)[number];
export type PropertyFit = (typeof propertyFitEnum.enumValues)[number];

export interface PropertyFilters {
  search?: string;
  area?: string;
  minBedrooms?: number;
  minRentCents?: number;
  maxRentCents?: number;
  availability?: PropertyAvailability;
  status?: PropertyStatus;
  companyLetFit?: PropertyFit;
}

export interface PropertyMutationInput {
  companyId?: string;
  sourceId?: string;
  title: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  borough?: string;
  postcode: string;
  propertyType: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  furnished: boolean;
  parking: boolean;
  garden: boolean;
  monthlyRentCents?: number;
  depositCents?: number;
  termMonths?: number;
  availability: PropertyAvailability;
  availableFrom?: Date;
  billsSummary?: string;
  companyLetFit: PropertyFit;
  status: PropertyStatus;
  summary?: string;
}

export interface StockRoomPropertyCard {
  id: string;
  companyId: string | null;
  sourceId: string | null;
  title: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  borough: string | null;
  postcode: string;
  propertyType: PropertyType;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: boolean;
  parking: boolean;
  garden: boolean;
  monthlyRentCents: number | null;
  depositCents: number | null;
  termMonths: number | null;
  availability: PropertyAvailability;
  availableFrom: Date | null;
  billsSummary: string | null;
  companyLetFit: PropertyFit;
  status: PropertyStatus;
  summary: string | null;
  heroMediaKey: string | null;
  heroAltText: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}
