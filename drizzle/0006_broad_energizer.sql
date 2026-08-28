CREATE TYPE "public"."inbox_category" AS ENUM('HOT', 'INTERESTED', 'FUTURE', 'QUESTION', 'UNCLEAR', 'NOT_INTERESTED', 'OPT_OUT');--> statement-breakpoint
CREATE TYPE "public"."outreach_approval_mode" AS ENUM('HUMAN_APPROVAL', 'AUTO_APPROVAL');--> statement-breakpoint
CREATE TYPE "public"."outreach_draft_status" AS ENUM('draft', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."outreach_draft_template" AS ENUM('PRIVATE_LANDLORD', 'DEVELOPER', 'PORTFOLIO_OWNER', 'DIRECT_COMPANY');--> statement-breakpoint
CREATE TYPE "public"."requirement_relationship" AS ENUM('DIRECT', 'INTRODUCER', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."requirement_urgency" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TABLE "outreach_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"lead_id" text NOT NULL,
	"campaign_id" text,
	"conversation_id" text,
	"created_by_user_id" text,
	"template_type" "outreach_draft_template" NOT NULL,
	"status" "outreach_draft_status" DEFAULT 'draft' NOT NULL,
	"provider" varchar(80) NOT NULL,
	"model" varchar(120) NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unsupported_claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" varchar(220) NOT NULL,
	"body_text" text NOT NULL,
	"why_this_lead" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "inbox_category" "inbox_category" DEFAULT 'UNCLEAR' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "snoozed_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "ai_summary" text;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "audience" varchar(120);--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "minimum_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "location" varchar(160);--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "bedrooms_min" integer;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "bedrooms_max" integer;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "unit_count_min" integer;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "start_hour" varchar(5);--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "end_hour" varchar(5);--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "weekday_rules" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "daily_limit" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "sequence_steps" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "approval_mode" "outreach_approval_mode" DEFAULT 'HUMAN_APPROVAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "suppression_policy" varchar(120) DEFAULT 'respect_global_suppression' NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "lead_id" text;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "bedrooms_max" integer;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "unit_count" integer;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "acceptable_radius_miles" integer;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "term_months" integer;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "purpose" varchar(200);--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "urgency" "requirement_urgency" DEFAULT 'MEDIUM' NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "relationship_type" "requirement_relationship" DEFAULT 'UNKNOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "direct_relationship_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outreach_drafts_lead_status_idx" ON "outreach_drafts" USING btree ("lead_id","status");--> statement-breakpoint
CREATE INDEX "outreach_drafts_campaign_idx" ON "outreach_drafts" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "outreach_drafts_conversation_idx" ON "outreach_drafts" USING btree ("conversation_id");--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "requirements_lead_status_idx" ON "requirements" USING btree ("lead_id","status");