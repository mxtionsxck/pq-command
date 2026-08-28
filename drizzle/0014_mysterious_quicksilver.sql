CREATE TYPE "public"."pilot_feedback_label" AS ENUM('GOOD_AI', 'WRONG', 'MISSING', 'NEEDS_HUMAN');--> statement-breakpoint
CREATE TABLE "pilot_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workflow_key" varchar(80) NOT NULL,
	"feedback_label" "pilot_feedback_label" NOT NULL,
	"notes" text,
	"entity_type" varchar(80),
	"entity_id" text,
	"submitted_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "pilot_feedback" ADD CONSTRAINT "pilot_feedback_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pilot_feedback_workflow_created_idx" ON "pilot_feedback" USING btree ("workflow_key","created_at");--> statement-breakpoint
CREATE INDEX "pilot_feedback_label_created_idx" ON "pilot_feedback" USING btree ("feedback_label","created_at");--> statement-breakpoint
CREATE INDEX "pilot_feedback_user_created_idx" ON "pilot_feedback" USING btree ("submitted_by_user_id","created_at");--> statement-breakpoint
CREATE INDEX "conversations_inbox_last_message_idx" ON "conversations" USING btree ("inbox_category","status","last_message_at");--> statement-breakpoint
CREATE INDEX "leads_type_status_updated_idx" ON "leads" USING btree ("lead_type","status","updated_at");--> statement-breakpoint
CREATE INDEX "properties_fit_status_updated_idx" ON "properties" USING btree ("company_let_fit","status","updated_at");