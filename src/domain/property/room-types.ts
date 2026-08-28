import type { Company, Document, Property, PropertyMedium } from "@/db/models";

export interface PropertyMediaView extends PropertyMedium {
  publicUrl: string;
}

export interface PropertyDocumentView extends Document {
  viewUrl: string;
  downloadUrl: string;
}

export interface PropertyRoomRecord {
  property: Property;
  company: Company | null;
  media: PropertyMediaView[];
  documents: PropertyDocumentView[];
}
