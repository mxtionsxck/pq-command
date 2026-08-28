CREATE TYPE "public"."economics_signal_status" AS ENUM('new', 'informational', 'reviewed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."shortage_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."shortage_status" AS ENUM('active', 'converted', 'archived');--> statement-breakpoint
ALTER TYPE "public"."viewing_status" ADD VALUE 'scheduled' BEFORE 'confirmed';--> statement-breakpoint
ALTER TYPE "public"."viewing_status" ADD VALUE 'reminded' BEFORE 'confirmed';--> statement-breakpoint
CREATE TABLE "economics_signals" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"property_id" text NOT NULL,
	"lha_rate_id" text NOT NULL,
	"bedroom_band" varchar(32) NOT NULL,
	"known_rent_cents" integer NOT NULL,
	"lha_rate_cents" integer NOT NULL,
	"difference_cents" integer NOT NULL,
	"signal_status" "economics_signal_status" DEFAULT 'new' NOT NULL,
	"notify_enabled" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "lha_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"borough" varchar(120),
	"area" varchar(200),
	"bedroom_band" varchar(32) NOT NULL,
	"monthly_rate_cents" integer NOT NULL,
	"rate_source" varchar(200) NOT NULL,
	"rate_reference" text NOT NULL,
	"rate_date" date NOT NULL,
	"rate_version" varchar(64) NOT NULL,
	"source_approved" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "shortage_intelligence_rows" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"borough" varchar(120),
	"area" varchar(200),
	"bedrooms_band" varchar(32) NOT NULL,
	"unit_count_band" varchar(32) NOT NULL,
	"budget_band" varchar(32) NOT NULL,
	"availability_window" varchar(64) NOT NULL,
	"active_demand" integer DEFAULT 0 NOT NULL,
	"suitable_stock" integer DEFAULT 0 NOT NULL,
	"estimated_gap" integer DEFAULT 0 NOT NULL,
	"priority" "shortage_priority" DEFAULT 'MEDIUM' NOT NULL,
	"status" "shortage_status" DEFAULT 'active' NOT NULL,
	"trace" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"converted_objective_id" text,
	"converted_campaign_id" text
);
--> statement-breakpoint
ALTER TABLE "viewings" DROP CONSTRAINT "viewings_match_id_matches_id_fk";
--> statement-breakpoint
ALTER TABLE "viewings" DROP CONSTRAINT "viewings_contact_id_contacts_id_fk";
--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "status" SET DEFAULT 'MATCHED'::text;--> statement-breakpoint
DROP TYPE "public"."deal_status";--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('MATCHED', 'VIEWING', 'OFFER', 'NEGOTIATION', 'AGREED', 'CONTRACT', 'LIVE', 'COMPLETED', 'LOST');--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "status" SET DEFAULT 'MATCHED'::"public"."deal_status";--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "status" SET DATA TYPE "public"."deal_status" USING "status"::"public"."deal_status";--> statement-breakpoint
ALTER TABLE "viewings" ALTER COLUMN "match_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "viewings" ALTER COLUMN "contact_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "requirement_id" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "match_id" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "next_action" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "commercial_summary" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "blockers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "viewings" ADD COLUMN "requirement_id" text;--> statement-breakpoint
ALTER TABLE "viewings" ADD COLUMN "company_id" text;--> statement-breakpoint
ALTER TABLE "viewings" ADD COLUMN "attendees" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "viewings" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "viewings" ADD COLUMN "next_action" text;--> statement-breakpoint
ALTER TABLE "viewings" ADD COLUMN "commercial_notes" text;--> statement-breakpoint
ALTER TABLE "viewings" ADD COLUMN "reminder_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "economics_signals" ADD CONSTRAINT "economics_signals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economics_signals" ADD CONSTRAINT "economics_signals_lha_rate_id_lha_rates_id_fk" FOREIGN KEY ("lha_rate_id") REFERENCES "public"."lha_rates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortage_intelligence_rows" ADD CONSTRAINT "shortage_intelligence_rows_converted_objective_id_objectives_id_fk" FOREIGN KEY ("converted_objective_id") REFERENCES "public"."objectives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortage_intelligence_rows" ADD CONSTRAINT "shortage_intelligence_rows_converted_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("converted_campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "economics_signals_property_rate_uq" ON "economics_signals" USING btree ("property_id","lha_rate_id");--> statement-breakpoint
CREATE INDEX "economics_signals_status_idx" ON "economics_signals" USING btree ("signal_status","created_at");--> statement-breakpoint
CREATE INDEX "lha_rates_lookup_idx" ON "lha_rates" USING btree ("borough","area","bedroom_band");--> statement-breakpoint
CREATE UNIQUE INDEX "lha_rates_version_uq" ON "lha_rates" USING btree ("area","bedroom_band","rate_date","rate_version");--> statement-breakpoint
CREATE UNIQUE INDEX "shortage_intel_bucket_uq" ON "shortage_intelligence_rows" USING btree ("borough","area","bedrooms_band","unit_count_band","budget_band","availability_window");--> statement-breakpoint
CREATE INDEX "shortage_intel_priority_idx" ON "shortage_intelligence_rows" USING btree ("priority","status");--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deals_requirement_status_idx" ON "deals" USING btree ("requirement_id","status");--> statement-breakpoint
CREATE INDEX "viewings_requirement_schedule_idx" ON "viewings" USING btree ("requirement_id","scheduled_for");