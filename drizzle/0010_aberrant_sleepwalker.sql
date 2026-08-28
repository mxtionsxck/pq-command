CREATE TYPE "public"."demand_heat_status" AS ENUM('BALANCED', 'HIGH_DEMAND', 'SHORTAGE', 'CRITICAL_SHORTAGE', 'EMERGING_SHORTAGE');--> statement-breakpoint
CREATE TYPE "public"."directness_classification" AS ENUM('DIRECT', 'INTERMEDIARY', 'UNKNOWN', 'SUPPRESSED');--> statement-breakpoint
CREATE TYPE "public"."exclusion_reason" AS ENUM('INTERMEDIARY', 'WRONG_PROPERTY', 'WRONG_AREA', 'WRONG_BEDROOM_COUNT', 'UNREALISTIC_RENT', 'DUPLICATE', 'SUPPRESSED', 'INSUFFICIENT_EVIDENCE', 'LOW_CONFIDENCE', 'REPEATEDLY_NON_RESPONSIVE', 'POOR_HISTORICAL_CONVERSION');--> statement-breakpoint
CREATE TYPE "public"."mission_status" AS ENUM('draft', 'running', 'paused', 'satisfied', 'exhausted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."mission_type" AS ENUM('SUPPLY', 'DEMAND', 'SHORTAGE', 'RELATIONSHIP');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'partially_verified', 'verified', 'conflicted');--> statement-breakpoint
CREATE TABLE "acquisition_exclusions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lead_id" text,
	"mission_id" text,
	"reason" "exclusion_reason" NOT NULL,
	"explanation" text NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acquisition_missions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"objective_id" text,
	"owner_user_id" text,
	"mission_type" "mission_type" NOT NULL,
	"status" "mission_status" DEFAULT 'draft' NOT NULL,
	"title" varchar(220) NOT NULL,
	"mission_objective" text NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target_qualified_prospects" integer DEFAULT 0 NOT NULL,
	"target_outreach_ready_prospects" integer DEFAULT 0 NOT NULL,
	"candidates_discovered" integer DEFAULT 0 NOT NULL,
	"candidates_rejected" integer DEFAULT 0 NOT NULL,
	"candidates_awaiting_verification" integer DEFAULT 0 NOT NULL,
	"qualified_prospects" integer DEFAULT 0 NOT NULL,
	"outreach_ready_prospects" integer DEFAULT 0 NOT NULL,
	"responses" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"stop_reason" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" varchar(80) NOT NULL,
	"title" varchar(220) NOT NULL,
	"body" text NOT NULL,
	"severity" varchar(24) DEFAULT 'info' NOT NULL,
	"lead_id" text,
	"mission_id" text,
	"acknowledged_by_user_id" text,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "demand_heatmap_cells" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"area" varchar(200),
	"borough" varchar(120),
	"town" varchar(120),
	"postcode" varchar(32),
	"bedrooms_band" varchar(32) NOT NULL,
	"property_type" "property_type" DEFAULT 'other' NOT NULL,
	"budget_band" varchar(32) NOT NULL,
	"corporate_requirement_label" varchar(220),
	"requirements_count" integer DEFAULT 0 NOT NULL,
	"suitable_properties_count" integer DEFAULT 0 NOT NULL,
	"shortage_ratio" integer DEFAULT 0 NOT NULL,
	"demand_trend_score" integer DEFAULT 0 NOT NULL,
	"status" "demand_heat_status" DEFAULT 'BALANCED' NOT NULL,
	"trace" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directness_assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lead_id" text NOT NULL,
	"entity_name" varchar(200) NOT NULL,
	"person_name" varchar(200),
	"role_title" varchar(160),
	"relationship_to_property_or_company" text NOT NULL,
	"evidence_source" varchar(160) NOT NULL,
	"evidence_reference" text NOT NULL,
	"evidence_type" varchar(80) NOT NULL,
	"evidence_date" date NOT NULL,
	"explanation" text NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"classification" "directness_classification" DEFAULT 'UNKNOWN' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"conflict_detected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship_graph_edges" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"from_entity_type" varchar(80) NOT NULL,
	"from_entity_id" text NOT NULL,
	"to_entity_type" varchar(80) NOT NULL,
	"to_entity_id" text NOT NULL,
	"relationship_label" varchar(120) NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"evidence_id" text,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "directness_classification" "directness_classification" DEFAULT 'UNKNOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "directness_confidence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "directness_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "acquisition_exclusions" ADD CONSTRAINT "acquisition_exclusions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisition_exclusions" ADD CONSTRAINT "acquisition_exclusions_mission_id_acquisition_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."acquisition_missions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisition_missions" ADD CONSTRAINT "acquisition_missions_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisition_missions" ADD CONSTRAINT "acquisition_missions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_mission_id_acquisition_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."acquisition_missions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_acknowledged_by_user_id_users_id_fk" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directness_assessments" ADD CONSTRAINT "directness_assessments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_graph_edges" ADD CONSTRAINT "relationship_graph_edges_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acquisition_exclusions_reason_idx" ON "acquisition_exclusions" USING btree ("reason","created_at");--> statement-breakpoint
CREATE INDEX "acquisition_missions_status_idx" ON "acquisition_missions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "acquisition_missions_type_idx" ON "acquisition_missions" USING btree ("mission_type","status");--> statement-breakpoint
CREATE INDEX "agent_messages_type_created_idx" ON "agent_messages" USING btree ("type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "demand_heatmap_cell_uq" ON "demand_heatmap_cells" USING btree ("area","borough","town","postcode","bedrooms_band","property_type","budget_band");--> statement-breakpoint
CREATE INDEX "demand_heatmap_status_idx" ON "demand_heatmap_cells" USING btree ("status","shortage_ratio");--> statement-breakpoint
CREATE INDEX "directness_assessments_lead_idx" ON "directness_assessments" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "directness_assessments_classification_idx" ON "directness_assessments" USING btree ("classification","verification_status");--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_graph_edge_uq" ON "relationship_graph_edges" USING btree ("from_entity_type","from_entity_id","to_entity_type","to_entity_id","relationship_label");--> statement-breakpoint
CREATE INDEX "relationship_graph_from_idx" ON "relationship_graph_edges" USING btree ("from_entity_type","from_entity_id");--> statement-breakpoint
CREATE INDEX "relationship_graph_to_idx" ON "relationship_graph_edges" USING btree ("to_entity_type","to_entity_id");--> statement-breakpoint
CREATE INDEX "leads_directness_idx" ON "leads" USING btree ("directness_classification","directness_verified");