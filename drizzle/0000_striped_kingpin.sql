CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'scheduled', 'running', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('prospect', 'active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('open', 'pending', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('pipeline', 'negotiation', 'agreed', 'completed', 'lost', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."job_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'qualified', 'nurturing', 'disqualified', 'archived');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('suggested', 'contacted', 'viewing_booked', 'won', 'lost', 'archived');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('unread', 'read', 'archived');--> statement-breakpoint
CREATE TYPE "public"."objective_status" AS ENUM('draft', 'active', 'completed', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."outreach_channel" AS ENUM('email', 'sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."outreach_message_status" AS ENUM('queued', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."property_media_kind" AS ENUM('image', 'video', 'floorplan', 'document');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('draft', 'active', 'off_market', 'archived');--> statement-breakpoint
CREATE TYPE "public"."requirement_status" AS ENUM('open', 'matched', 'on_hold', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."signal_status" AS ENUM('new', 'reviewed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."signal_type" AS ENUM('inquiry', 'engagement', 'availability', 'pricing', 'conversation');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('portal', 'manual', 'referral', 'partner', 'website', 'other');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."suppression_channel" AS ENUM('email', 'sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."suppression_reason" AS ENUM('bounced', 'opt_out', 'manual', 'legal');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'MANAGER', 'AGENT');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."viewing_status" AS ENUM('proposed', 'confirmed', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" text,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" text NOT NULL,
	"action" varchar(120) NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"request_id" varchar(120)
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"owner_user_id" text,
	"name" varchar(160) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"status" "company_status" DEFAULT 'prospect' NOT NULL,
	"website" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"company_id" text,
	"owner_user_id" text,
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"email" varchar(320),
	"phone" varchar(32),
	"status" "contact_status" DEFAULT 'active' NOT NULL,
	"preferred_channel" "outreach_channel",
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"lead_id" text,
	"contact_id" text,
	"owner_user_id" text,
	"channel" "outreach_channel" DEFAULT 'email' NOT NULL,
	"status" "conversation_status" DEFAULT 'open' NOT NULL,
	"subject" varchar(200),
	"last_message_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"company_id" text,
	"contact_id" text,
	"property_id" text,
	"lead_id" text,
	"owner_user_id" text,
	"status" "deal_status" DEFAULT 'pipeline' NOT NULL,
	"value_cents" integer,
	"expected_close_at" date,
	"closed_at" timestamp with time zone,
	"summary" text
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"company_id" text,
	"contact_id" text,
	"property_id" text,
	"deal_id" text,
	"uploaded_by_user_id" text,
	"title" varchar(200) NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"storage_key" text NOT NULL,
	"checksum" varchar(128),
	"mime_type" varchar(120)
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"triggered_by_user_id" text,
	"job_name" varchar(160) NOT NULL,
	"status" "job_run_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"error_message" text,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"source_id" text NOT NULL,
	"company_id" text,
	"contact_id" text,
	"owner_user_id" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"received_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"requirement_id" text NOT NULL,
	"property_id" text NOT NULL,
	"lead_id" text,
	"status" "match_status" DEFAULT 'suggested' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"rationale" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conversation_id" text NOT NULL,
	"outreach_message_id" text,
	"author_user_id" text,
	"direction" "message_direction" NOT NULL,
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"body_text" text NOT NULL,
	"external_message_id" varchar(191),
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"task_id" text,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"link_href" text,
	"status" "notification_status" DEFAULT 'unread' NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"owner_user_id" text,
	"title" varchar(200) NOT NULL,
	"description" text,
	"status" "objective_status" DEFAULT 'draft' NOT NULL,
	"target_value" integer,
	"current_value" integer,
	"due_at" date,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "outreach_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"owner_user_id" text,
	"source_id" text,
	"name" varchar(200) NOT NULL,
	"channel" "outreach_channel" DEFAULT 'email' NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"objective" text,
	"scheduled_at" timestamp with time zone,
	"launched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "outreach_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"campaign_id" text NOT NULL,
	"lead_id" text,
	"contact_id" text,
	"created_by_user_id" text,
	"channel" "outreach_channel" DEFAULT 'email' NOT NULL,
	"status" "outreach_message_status" DEFAULT 'queued' NOT NULL,
	"external_message_id" varchar(191),
	"subject" varchar(200),
	"body_text" text NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"company_id" text,
	"created_by_user_id" text,
	"source_id" text,
	"title" varchar(200) NOT NULL,
	"status" "property_status" DEFAULT 'draft' NOT NULL,
	"address_line_1" varchar(200) NOT NULL,
	"city" varchar(120) NOT NULL,
	"postcode" varchar(32) NOT NULL,
	"bedrooms" integer,
	"monthly_rent_cents" integer,
	"available_from" date,
	"summary" text
);
--> statement-breakpoint
CREATE TABLE "property_media" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"property_id" text NOT NULL,
	"uploaded_by_user_id" text,
	"kind" "property_media_kind" DEFAULT 'image' NOT NULL,
	"storage_key" text NOT NULL,
	"alt_text" varchar(200),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"company_id" text,
	"contact_id" text,
	"owner_user_id" text,
	"status" "requirement_status" DEFAULT 'open' NOT NULL,
	"budget_min_cents" integer,
	"budget_max_cents" integer,
	"bedrooms_min" integer,
	"preferred_area" varchar(200),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_id" text NOT NULL,
	"lead_id" text,
	"contact_id" text,
	"property_id" text,
	"created_by_user_id" text,
	"type" "signal_type" NOT NULL,
	"status" "signal_status" DEFAULT 'new' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by_user_id" text,
	"name" varchar(160) NOT NULL,
	"kind" "source_kind" NOT NULL,
	"status" "source_status" DEFAULT 'active' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_ingested_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "suppression_list" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"contact_id" text,
	"created_by_user_id" text,
	"channel" "suppression_channel" NOT NULL,
	"value" varchar(320) NOT NULL,
	"reason" "suppression_reason" DEFAULT 'manual' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"assigned_to_user_id" text,
	"created_by_user_id" text,
	"lead_id" text,
	"deal_id" text,
	"viewing_id" text,
	"objective_id" text,
	"title" varchar(200) NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"email" varchar(320) NOT NULL,
	"name" varchar(160),
	"role" "user_role" DEFAULT 'AGENT' NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"auth_provider" varchar(64) DEFAULT 'microsoft-entra-id' NOT NULL,
	"external_subject" varchar(191),
	"last_signed_in_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "viewings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" text NOT NULL,
	"property_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"scheduled_by_user_id" text,
	"status" "viewing_status" DEFAULT 'proposed' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_outreach_message_id_outreach_messages_id_fk" FOREIGN KEY ("outreach_message_id") REFERENCES "public"."outreach_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppression_list" ADD CONSTRAINT "suppression_list_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppression_list" ADD CONSTRAINT "suppression_list_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_viewing_id_viewings_id_fk" FOREIGN KEY ("viewing_id") REFERENCES "public"."viewings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_scheduled_by_user_id_users_id_fk" FOREIGN KEY ("scheduled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_created_idx" ON "audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_action_created_idx" ON "audit_events" USING btree ("action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_slug_uq" ON "companies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "companies_owner_status_idx" ON "companies" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "companies_archived_idx" ON "companies" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "contacts_company_status_idx" ON "contacts" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "contacts_owner_status_idx" ON "contacts" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "contacts_phone_idx" ON "contacts" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "conversations_owner_status_idx" ON "conversations" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "conversations_contact_status_idx" ON "conversations" USING btree ("contact_id","status");--> statement-breakpoint
CREATE INDEX "conversations_lead_status_idx" ON "conversations" USING btree ("lead_id","status");--> statement-breakpoint
CREATE INDEX "deals_owner_status_idx" ON "deals" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "deals_company_status_idx" ON "deals" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "deals_property_status_idx" ON "deals" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "deals_lead_status_idx" ON "deals" USING btree ("lead_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_storage_key_uq" ON "documents" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "documents_company_status_idx" ON "documents" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "documents_property_status_idx" ON "documents" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "documents_contact_status_idx" ON "documents" USING btree ("contact_id","status");--> statement-breakpoint
CREATE INDEX "job_runs_name_status_idx" ON "job_runs" USING btree ("job_name","status");--> statement-breakpoint
CREATE INDEX "job_runs_triggered_by_idx" ON "job_runs" USING btree ("triggered_by_user_id");--> statement-breakpoint
CREATE INDEX "job_runs_started_at_idx" ON "job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "leads_source_status_idx" ON "leads" USING btree ("source_id","status");--> statement-breakpoint
CREATE INDEX "leads_owner_status_idx" ON "leads" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "leads_contact_status_idx" ON "leads" USING btree ("contact_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_requirement_property_uq" ON "matches" USING btree ("requirement_id","property_id");--> statement-breakpoint
CREATE INDEX "matches_requirement_status_idx" ON "matches" USING btree ("requirement_id","status");--> statement-breakpoint
CREATE INDEX "matches_property_status_idx" ON "matches" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "matches_lead_status_idx" ON "matches" USING btree ("lead_id","status");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_direction_status_idx" ON "messages" USING btree ("direction","status");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_external_id_uq" ON "messages" USING btree ("external_message_id");--> statement-breakpoint
CREATE INDEX "notifications_user_status_idx" ON "notifications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "notifications_task_status_idx" ON "notifications" USING btree ("task_id","status");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "objectives_owner_status_idx" ON "objectives" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "objectives_due_idx" ON "objectives" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "outreach_campaigns_owner_status_idx" ON "outreach_campaigns" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "outreach_campaigns_source_status_idx" ON "outreach_campaigns" USING btree ("source_id","status");--> statement-breakpoint
CREATE INDEX "outreach_messages_campaign_status_idx" ON "outreach_messages" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "outreach_messages_lead_status_idx" ON "outreach_messages" USING btree ("lead_id","status");--> statement-breakpoint
CREATE INDEX "outreach_messages_contact_status_idx" ON "outreach_messages" USING btree ("contact_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_messages_external_id_uq" ON "outreach_messages" USING btree ("external_message_id");--> statement-breakpoint
CREATE INDEX "properties_company_status_idx" ON "properties" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "properties_source_status_idx" ON "properties" USING btree ("source_id","status");--> statement-breakpoint
CREATE INDEX "properties_postcode_idx" ON "properties" USING btree ("postcode");--> statement-breakpoint
CREATE INDEX "properties_archived_idx" ON "properties" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "property_media_property_kind_idx" ON "property_media" USING btree ("property_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "property_media_storage_key_uq" ON "property_media" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "requirements_company_status_idx" ON "requirements" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "requirements_contact_status_idx" ON "requirements" USING btree ("contact_id","status");--> statement-breakpoint
CREATE INDEX "requirements_owner_status_idx" ON "requirements" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "signals_source_status_idx" ON "signals" USING btree ("source_id","status");--> statement-breakpoint
CREATE INDEX "signals_lead_type_idx" ON "signals" USING btree ("lead_id","type");--> statement-breakpoint
CREATE INDEX "signals_contact_type_idx" ON "signals" USING btree ("contact_id","type");--> statement-breakpoint
CREATE INDEX "signals_property_type_idx" ON "signals" USING btree ("property_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_name_uq" ON "sources" USING btree ("name");--> statement-breakpoint
CREATE INDEX "sources_kind_status_idx" ON "sources" USING btree ("kind","status");--> statement-breakpoint
CREATE UNIQUE INDEX "suppression_list_channel_value_uq" ON "suppression_list" USING btree ("channel","value");--> statement-breakpoint
CREATE INDEX "suppression_list_contact_idx" ON "suppression_list" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "suppression_list_reason_idx" ON "suppression_list" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "tasks_assignee_status_idx" ON "tasks" USING btree ("assigned_to_user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_creator_status_idx" ON "tasks" USING btree ("created_by_user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_deal_status_idx" ON "tasks" USING btree ("deal_id","status");--> statement-breakpoint
CREATE INDEX "tasks_lead_status_idx" ON "tasks" USING btree ("lead_id","status");--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_external_subject_uq" ON "users" USING btree ("external_subject");--> statement-breakpoint
CREATE INDEX "users_role_status_idx" ON "users" USING btree ("role","status");--> statement-breakpoint
CREATE INDEX "viewings_property_schedule_idx" ON "viewings" USING btree ("property_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "viewings_contact_schedule_idx" ON "viewings" USING btree ("contact_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "viewings_match_status_idx" ON "viewings" USING btree ("match_id","status");