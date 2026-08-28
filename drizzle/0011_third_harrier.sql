CREATE TABLE "acquisition_mission_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mission_id" text NOT NULL,
	"status" varchar(24) DEFAULT 'running' NOT NULL,
	"cycle_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_ended_at" timestamp with time zone,
	"discovered" integer DEFAULT 0 NOT NULL,
	"qualified" integer DEFAULT 0 NOT NULL,
	"outreach_ready" integer DEFAULT 0 NOT NULL,
	"awaiting_verification" integer DEFAULT 0 NOT NULL,
	"target_reached" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"trace" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acquisition_mission_runs" ADD CONSTRAINT "acquisition_mission_runs_mission_id_acquisition_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."acquisition_missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acquisition_mission_runs_mission_idx" ON "acquisition_mission_runs" USING btree ("mission_id","created_at");--> statement-breakpoint
CREATE INDEX "acquisition_mission_runs_status_idx" ON "acquisition_mission_runs" USING btree ("status","created_at");