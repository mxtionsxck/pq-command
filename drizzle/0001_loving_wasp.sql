CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'system', 'job');--> statement-breakpoint
CREATE TYPE "public"."property_availability" AS ENUM('available_now', 'available_soon', 'occupied', 'let_agreed', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."property_fit" AS ENUM('ideal', 'strong', 'review', 'unsuitable');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('apartment', 'house', 'studio', 'maisonette', 'townhouse', 'other');--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "actor_type" "audit_actor_type" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "actor_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "occurred_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "borough" varchar(120);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "property_type" "property_type" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "address_line_2" varchar(200);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "bathrooms" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "furnished" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "parking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "garden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "deposit_cents" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "term_months" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "availability" "property_availability" DEFAULT 'available_now' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "bills_summary" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "company_let_fit" "property_fit" DEFAULT 'review' NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_events_occurred_idx" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_type_id_idx" ON "audit_events" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "properties_borough_status_idx" ON "properties" USING btree ("borough","status");--> statement-breakpoint
CREATE INDEX "properties_bedrooms_idx" ON "properties" USING btree ("bedrooms");--> statement-breakpoint
CREATE INDEX "properties_rent_idx" ON "properties" USING btree ("monthly_rent_cents");--> statement-breakpoint
CREATE INDEX "properties_availability_idx" ON "properties" USING btree ("availability");--> statement-breakpoint
CREATE INDEX "properties_fit_status_idx" ON "properties" USING btree ("company_let_fit","status");