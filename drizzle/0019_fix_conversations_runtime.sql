DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_status') THEN
    CREATE TYPE "public"."conversation_status" AS ENUM('open', 'pending', 'closed', 'archived');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inbox_category') THEN
    CREATE TYPE "public"."inbox_category" AS ENUM('HOT', 'INTERESTED', 'FUTURE', 'QUESTION', 'UNCLEAR', 'NOT_INTERESTED', 'OPT_OUT');
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone,
  "lead_id" text,
  "contact_id" text,
  "owner_user_id" text,
  "channel" "public"."outreach_channel" DEFAULT 'email' NOT NULL,
  "status" "public"."conversation_status" DEFAULT 'open' NOT NULL,
  "inbox_category" "public"."inbox_category" DEFAULT 'UNCLEAR' NOT NULL,
  "snoozed_until" timestamp with time zone,
  "ai_summary" text,
  "subject" varchar(200),
  "last_message_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "lead_id" text,
  ADD COLUMN IF NOT EXISTS "contact_id" text,
  ADD COLUMN IF NOT EXISTS "owner_user_id" text,
  ADD COLUMN IF NOT EXISTS "channel" "public"."outreach_channel",
  ADD COLUMN IF NOT EXISTS "status" "public"."conversation_status",
  ADD COLUMN IF NOT EXISTS "inbox_category" "public"."inbox_category",
  ADD COLUMN IF NOT EXISTS "snoozed_until" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "ai_summary" text,
  ADD COLUMN IF NOT EXISTS "subject" varchar(200),
  ADD COLUMN IF NOT EXISTS "last_message_at" timestamp with time zone;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE "conversations"
      ALTER COLUMN "status" TYPE "public"."conversation_status"
      USING "status"::text::"public"."conversation_status";
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'status'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "conversations"
      ALTER COLUMN "status" SET NOT NULL,
      ALTER COLUMN "status" SET DEFAULT 'open';
  END IF;
END $$;
