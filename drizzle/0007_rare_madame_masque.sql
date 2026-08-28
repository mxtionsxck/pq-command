CREATE TYPE "public"."follow_up_status" AS ENUM('scheduled', 'cancelled', 'sent');--> statement-breakpoint
CREATE TYPE "public"."reply_fact_type" AS ENUM('availability', 'unit_count', 'bedrooms', 'location', 'budget', 'timing', 'next_step');--> statement-breakpoint
CREATE TYPE "public"."send_attempt_status" AS ENUM('blocked', 'queued', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "follow_up_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"campaign_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"conversation_id" text,
	"step_key" varchar(64) NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"dedupe_key" varchar(220) NOT NULL,
	"status" "follow_up_status" DEFAULT 'scheduled' NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "outreach_send_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"campaign_id" text NOT NULL,
	"lead_id" text,
	"contact_id" text,
	"conversation_id" text,
	"outreach_message_id" text,
	"recipient" varchar(320) NOT NULL,
	"dedupe_key" varchar(220) NOT NULL,
	"status" "send_attempt_status" NOT NULL,
	"reason" text,
	"policy_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reply_intelligence_events" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conversation_id" text NOT NULL,
	"message_id" text NOT NULL,
	"lead_id" text,
	"intent" "inbox_category" NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"extracted_facts" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "confidence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "match_version" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "next_action" text;--> statement-breakpoint
ALTER TABLE "follow_up_queue" ADD CONSTRAINT "follow_up_queue_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_queue" ADD CONSTRAINT "follow_up_queue_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_queue" ADD CONSTRAINT "follow_up_queue_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_send_attempts" ADD CONSTRAINT "outreach_send_attempts_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_send_attempts" ADD CONSTRAINT "outreach_send_attempts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_send_attempts" ADD CONSTRAINT "outreach_send_attempts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_send_attempts" ADD CONSTRAINT "outreach_send_attempts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_send_attempts" ADD CONSTRAINT "outreach_send_attempts_outreach_message_id_outreach_messages_id_fk" FOREIGN KEY ("outreach_message_id") REFERENCES "public"."outreach_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_intelligence_events" ADD CONSTRAINT "reply_intelligence_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_intelligence_events" ADD CONSTRAINT "reply_intelligence_events_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_intelligence_events" ADD CONSTRAINT "reply_intelligence_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "follow_up_queue_dedupe_uq" ON "follow_up_queue" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "follow_up_queue_campaign_status_idx" ON "follow_up_queue" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "follow_up_queue_schedule_idx" ON "follow_up_queue" USING btree ("scheduled_for","status");--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_send_attempts_dedupe_uq" ON "outreach_send_attempts" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "outreach_send_attempts_campaign_idx" ON "outreach_send_attempts" USING btree ("campaign_id","attempted_at");--> statement-breakpoint
CREATE INDEX "outreach_send_attempts_recipient_idx" ON "outreach_send_attempts" USING btree ("recipient");--> statement-breakpoint
CREATE UNIQUE INDEX "reply_intelligence_message_uq" ON "reply_intelligence_events" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "reply_intelligence_conversation_idx" ON "reply_intelligence_events" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "reply_intelligence_intent_idx" ON "reply_intelligence_events" USING btree ("intent","confidence");