CREATE TYPE "public"."analytics_metric" AS ENUM('discovered', 'qualified', 'positive_reply', 'requirement', 'match', 'viewing', 'offer', 'completed_deal');--> statement-breakpoint
CREATE TYPE "public"."quest_chapter" AS ENUM('The Scout', 'The Qualifier', 'The Outreach Run', 'The Match', 'The Viewing', 'The Deal', 'The Shortage', 'The Flywheel');--> statement-breakpoint
CREATE TYPE "public"."queue_item_status" AS ENUM('queued', 'running', 'retrying', 'succeeded', 'failed', 'dead_letter', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."job_run_status" ADD VALUE 'retrying' BEFORE 'succeeded';--> statement-breakpoint
ALTER TYPE "public"."job_run_status" ADD VALUE 'dead_letter' BEFORE 'cancelled';--> statement-breakpoint
CREATE TABLE "analytics_funnel_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_id" text,
	"campaign_id" text,
	"lead_type" "lead_type",
	"area" varchar(200),
	"bedrooms_band" varchar(32),
	"agent_user_id" text,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"metric" "analytics_metric" NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"trace" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pq_quest_objectives" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"chapter" "quest_chapter" NOT NULL,
	"title" varchar(200) NOT NULL,
	"objective_type" varchar(40) NOT NULL,
	"target_count" integer DEFAULT 1 NOT NULL,
	"current_count" integer DEFAULT 0 NOT NULL,
	"boss_objective" boolean DEFAULT false NOT NULL,
	"owner_user_id" text,
	"linked_objective_id" text,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pq_quest_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"last_xp_at" timestamp with time zone,
	"unlocked_chapters" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pq_quest_xp_events" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"source_event_id" text NOT NULL,
	"source_action" varchar(120) NOT NULL,
	"chapter" "quest_chapter" NOT NULL,
	"xp_awarded" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_items" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"worker_name" varchar(120) NOT NULL,
	"queue_name" varchar(80) DEFAULT 'default' NOT NULL,
	"idempotency_key" varchar(220),
	"status" "queue_item_status" DEFAULT 'queued' NOT NULL,
	"scheduled_for" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"locked_by" varchar(120),
	"locked_at" timestamp with time zone,
	"last_error" text,
	"dead_letter_reason" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_controls" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"worker_name" varchar(120) NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"concurrency_limit" integer DEFAULT 1 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "worker_health_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"worker_name" varchar(120) NOT NULL,
	"status" varchar(32) NOT NULL,
	"queue_depth" integer DEFAULT 0 NOT NULL,
	"running_count" integer DEFAULT 0 NOT NULL,
	"recent_failures" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "worker_name" varchar(120);--> statement-breakpoint
UPDATE "job_runs"
SET "worker_name" = CASE
	WHEN "job_name" ILIKE 'discovery%' THEN 'discovery'
	WHEN "job_name" ILIKE 'research%' THEN 'research'
	WHEN "job_name" ILIKE 'scoring%' THEN 'scoring'
	WHEN "job_name" ILIKE 'outreach%' THEN 'outreach_planning'
	WHEN "job_name" ILIKE 'inbox%' THEN 'inbox_sync'
	WHEN "job_name" ILIKE 'reply%' THEN 'reply_analysis'
	WHEN "job_name" ILIKE 'match%' THEN 'matching'
	WHEN "job_name" ILIKE 'shortage%' THEN 'shortage'
	WHEN "job_name" ILIKE 'deal%' THEN 'deal_watcher'
	WHEN "job_name" ILIKE 'cleanup%' THEN 'cleanup'
	ELSE 'discovery'
END
WHERE "worker_name" IS NULL;--> statement-breakpoint
ALTER TABLE "job_runs" ALTER COLUMN "worker_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "queue_name" varchar(80) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "idempotency_key" varchar(220);--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "max_attempts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "started_by" varchar(120);--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "last_heartbeat_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "items_processed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "error_code" varchar(120);--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "dead_lettered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_funnel_snapshots" ADD CONSTRAINT "analytics_funnel_snapshots_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_funnel_snapshots" ADD CONSTRAINT "analytics_funnel_snapshots_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_funnel_snapshots" ADD CONSTRAINT "analytics_funnel_snapshots_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pq_quest_objectives" ADD CONSTRAINT "pq_quest_objectives_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pq_quest_objectives" ADD CONSTRAINT "pq_quest_objectives_linked_objective_id_objectives_id_fk" FOREIGN KEY ("linked_objective_id") REFERENCES "public"."objectives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pq_quest_profiles" ADD CONSTRAINT "pq_quest_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pq_quest_xp_events" ADD CONSTRAINT "pq_quest_xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_funnel_metric_period_idx" ON "analytics_funnel_snapshots" USING btree ("metric","period_start");--> statement-breakpoint
CREATE INDEX "analytics_funnel_source_campaign_idx" ON "analytics_funnel_snapshots" USING btree ("source_id","campaign_id");--> statement-breakpoint
CREATE INDEX "pq_quest_objectives_chapter_idx" ON "pq_quest_objectives" USING btree ("chapter","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pq_quest_profiles_user_uq" ON "pq_quest_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pq_quest_xp_source_event_uq" ON "pq_quest_xp_events" USING btree ("source_event_id");--> statement-breakpoint
CREATE INDEX "pq_quest_xp_user_created_idx" ON "pq_quest_xp_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "queue_items_worker_status_idx" ON "queue_items" USING btree ("worker_name","status");--> statement-breakpoint
CREATE INDEX "queue_items_schedule_idx" ON "queue_items" USING btree ("scheduled_for","status");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_items_idempotency_uq" ON "queue_items" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "worker_controls_worker_uq" ON "worker_controls" USING btree ("worker_name");--> statement-breakpoint
CREATE INDEX "worker_health_worker_created_idx" ON "worker_health_snapshots" USING btree ("worker_name","created_at");--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_runs_worker_status_idx" ON "job_runs" USING btree ("worker_name","status");--> statement-breakpoint
CREATE INDEX "job_runs_source_idx" ON "job_runs" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_runs_idempotency_uq" ON "job_runs" USING btree ("idempotency_key");