CREATE TYPE "public"."contact_suppression_status" AS ENUM('clear', 'suppressed', 'review');--> statement-breakpoint
CREATE TYPE "public"."lead_outreach_status" AS ENUM('not_started', 'drafted', 'sent', 'responded', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('supply', 'demand', 'ai_discovered');--> statement-breakpoint
CREATE TYPE "public"."source_health" AS ENUM('healthy', 'degraded', 'offline', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."source_permission_status" AS ENUM('APPROVED', 'REVIEW_REQUIRED', 'BLOCKED', 'DISABLED');--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE 'researching' BEFORE 'qualified';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "legal_name" varchar(200);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "trading_name" varchar(200);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "company_number" varchar(64);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "company_type" varchar(120);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "locations" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "role_title" varchar(160);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "source" varchar(120);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "confidence" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "suppression_status" "contact_suppression_status" DEFAULT 'clear' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "decision_maker_evidence" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "property_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lead_type" "lead_type" DEFAULT 'supply' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "confidence" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "next_action" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "outreach_status" "lead_outreach_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "connector_key" varchar(160);--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "permission_status" "source_permission_status" DEFAULT 'REVIEW_REQUIRED' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "allowed_data" text;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "rate_limit_per_minute" integer;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "last_scanned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "health" "source_health" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_company_number_uq" ON "companies" USING btree ("company_number");--> statement-breakpoint
CREATE INDEX "leads_type_status_idx" ON "leads" USING btree ("lead_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_connector_key_uq" ON "sources" USING btree ("connector_key");--> statement-breakpoint
CREATE INDEX "sources_permission_idx" ON "sources" USING btree ("permission_status","enabled");