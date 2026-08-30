DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
    CREATE TYPE "public"."lead_status" AS ENUM('new', 'researching', 'qualified', 'nurturing', 'disqualified', 'archived');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_type') THEN
    CREATE TYPE "public"."lead_type" AS ENUM('supply', 'demand', 'ai_discovered');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_outreach_status') THEN
    CREATE TYPE "public"."lead_outreach_status" AS ENUM('not_started', 'drafted', 'sent', 'responded', 'suppressed');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'directness_classification') THEN
    CREATE TYPE "public"."directness_classification" AS ENUM('DIRECT', 'INTERMEDIARY', 'UNKNOWN', 'SUPPRESSED');
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "lead_type" "public"."lead_type" DEFAULT 'supply' NOT NULL,
  ADD COLUMN IF NOT EXISTS "status" "public"."lead_status" DEFAULT 'new' NOT NULL,
  ADD COLUMN IF NOT EXISTS "score" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "confidence" integer DEFAULT 50 NOT NULL,
  ADD COLUMN IF NOT EXISTS "next_action" text,
  ADD COLUMN IF NOT EXISTS "outreach_status" "public"."lead_outreach_status" DEFAULT 'not_started' NOT NULL,
  ADD COLUMN IF NOT EXISTS "directness_classification" "public"."directness_classification" DEFAULT 'UNKNOWN' NOT NULL,
  ADD COLUMN IF NOT EXISTS "directness_confidence" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "directness_verified" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "score_version" varchar(64),
  ADD COLUMN IF NOT EXISTS "last_scored_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "summary" text,
  ADD COLUMN IF NOT EXISTS "received_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_type_status_idx" ON "leads" USING btree ("lead_type", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_type_status_updated_idx" ON "leads" USING btree ("lead_type", "status", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_directness_idx" ON "leads" USING btree ("directness_classification", "directness_verified");
