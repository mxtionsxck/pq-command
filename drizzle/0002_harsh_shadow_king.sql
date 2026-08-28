CREATE TYPE "public"."document_type" AS ENUM('brochure', 'compliance', 'contract', 'floorplan', 'photo_pack', 'other');--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "document_type" "document_type" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "version_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "original_filename" varchar(260) NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "byte_size" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "property_media" ADD COLUMN "original_filename" varchar(260) NOT NULL;--> statement-breakpoint
ALTER TABLE "property_media" ADD COLUMN "mime_type" varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE "property_media" ADD COLUMN "byte_size" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "property_media" ADD COLUMN "caption" text;--> statement-breakpoint
ALTER TABLE "property_media" ADD COLUMN "is_hero" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "documents_property_type_idx" ON "documents" USING btree ("property_id","document_type");--> statement-breakpoint
CREATE INDEX "property_media_property_hero_idx" ON "property_media" USING btree ("property_id","is_hero");