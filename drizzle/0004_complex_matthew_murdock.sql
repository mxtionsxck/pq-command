CREATE TYPE "public"."ai_conclusion_status" AS ENUM('advisory', 'unsupported', 'promoted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."evidence_collection_method" AS ENUM('manual', 'connector', 'ai_extraction', 'ai_inference');--> statement-breakpoint
CREATE TABLE "ai_conclusions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"lead_id" text NOT NULL,
	"signal_id" text,
	"provider" varchar(80) NOT NULL,
	"model" varchar(120) NOT NULL,
	"summary" text NOT NULL,
	"recommendation" varchar(80) NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"supported" boolean DEFAULT false NOT NULL,
	"status" "ai_conclusion_status" DEFAULT 'advisory' NOT NULL,
	"failure_reason" text,
	"latency_ms" integer,
	"token_usage" jsonb,
	"cost_usd_micros" integer
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"source_id" text NOT NULL,
	"lead_id" text,
	"signal_id" text NOT NULL,
	"source_reference" varchar(240) NOT NULL,
	"source_url" text,
	"detected_at" timestamp with time zone NOT NULL,
	"summary" text NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"collection_method" "evidence_collection_method" DEFAULT 'connector' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_scoring_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by_user_id" text,
	"version" varchar(64) NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"thresholds" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "score_version" varchar(64);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_scored_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_conclusions" ADD CONSTRAINT "ai_conclusions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conclusions" ADD CONSTRAINT "ai_conclusions_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scoring_configs" ADD CONSTRAINT "lead_scoring_configs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_conclusions_lead_status_idx" ON "ai_conclusions" USING btree ("lead_id","status");--> statement-breakpoint
CREATE INDEX "ai_conclusions_signal_idx" ON "ai_conclusions" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "ai_conclusions_supported_idx" ON "ai_conclusions" USING btree ("supported","confidence");--> statement-breakpoint
CREATE INDEX "evidence_signal_detected_idx" ON "evidence" USING btree ("signal_id","detected_at");--> statement-breakpoint
CREATE INDEX "evidence_source_detected_idx" ON "evidence" USING btree ("source_id","detected_at");--> statement-breakpoint
CREATE INDEX "evidence_lead_detected_idx" ON "evidence" USING btree ("lead_id","detected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_signal_reference_uq" ON "evidence" USING btree ("signal_id","source_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_scoring_configs_version_uq" ON "lead_scoring_configs" USING btree ("version");--> statement-breakpoint
CREATE INDEX "lead_scoring_configs_active_idx" ON "lead_scoring_configs" USING btree ("active","created_at");