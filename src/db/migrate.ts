import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

loadEnvConfig(process.cwd());

import { appEnv } from "../lib/env";
import { getDatabaseConfig } from "./config";

const database = getDatabaseConfig(appEnv);
const migrationsFolder = path.join(process.cwd(), database.migrationsDirectory);

async function main() {
  if (!database.configured || !database.connectionString) {
    console.log(
      "No DATABASE_URL configured. Existing SQL migrations remain on disk; skipping database apply.",
    );
    process.exit(0);
  }

  const sql = postgres(database.connectionString, {
    max: 1,
  });

  async function ensureCriticalAutomationTables() {
    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_item_status') THEN
          CREATE TYPE queue_item_status AS ENUM ('queued', 'running', 'retrying', 'succeeded', 'failed', 'dead_letter', 'cancelled');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS queue_items (
        id text PRIMARY KEY NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        worker_name varchar(120) NOT NULL,
        queue_name varchar(80) DEFAULT 'default' NOT NULL,
        idempotency_key varchar(220),
        status queue_item_status DEFAULT 'queued' NOT NULL,
        scheduled_for timestamp with time zone DEFAULT now() NOT NULL,
        attempt integer DEFAULT 0 NOT NULL,
        max_attempts integer DEFAULT 3 NOT NULL,
        locked_by varchar(120),
        locked_at timestamp with time zone,
        last_error text,
        dead_letter_reason text,
        payload jsonb DEFAULT '{}'::jsonb NOT NULL
      );
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
          CREATE TYPE lead_status AS ENUM ('new', 'researching', 'qualified', 'nurturing', 'disqualified', 'archived');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_status') THEN
          CREATE TYPE conversation_status AS ENUM ('open', 'pending', 'closed', 'archived');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inbox_category') THEN
          CREATE TYPE inbox_category AS ENUM ('HOT', 'INTERESTED', 'FUTURE', 'QUESTION', 'UNCLEAR', 'NOT_INTERESTED', 'OPT_OUT');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_direction') THEN
          CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
          CREATE TYPE message_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_draft_template') THEN
          CREATE TYPE outreach_draft_template AS ENUM ('PRIVATE_LANDLORD', 'DEVELOPER', 'PORTFOLIO_OWNER', 'DIRECT_COMPANY');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_draft_status') THEN
          CREATE TYPE outreach_draft_status AS ENUM ('draft', 'approved', 'rejected');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_message_status') THEN
          CREATE TYPE outreach_message_status AS ENUM ('queued', 'sent', 'failed', 'cancelled');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'send_attempt_status') THEN
          CREATE TYPE send_attempt_status AS ENUM ('blocked', 'queued', 'sent', 'failed');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'follow_up_status') THEN
          CREATE TYPE follow_up_status AS ENUM ('scheduled', 'cancelled', 'sent');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS conversations (
        id text PRIMARY KEY NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        archived_at timestamp with time zone,
        lead_id text REFERENCES leads(id) ON DELETE SET NULL,
        contact_id text REFERENCES contacts(id) ON DELETE SET NULL,
        owner_user_id text REFERENCES users(id) ON DELETE SET NULL,
        channel outreach_channel NOT NULL DEFAULT 'email',
        status conversation_status NOT NULL DEFAULT 'open',
        inbox_category inbox_category NOT NULL DEFAULT 'UNCLEAR',
        snoozed_until timestamp with time zone,
        ai_summary text,
        subject varchar(200),
        last_message_at timestamp with time zone
      );
    `);

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS messages (
        id text PRIMARY KEY NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        outreach_message_id text REFERENCES outreach_messages(id) ON DELETE SET NULL,
        author_user_id text REFERENCES users(id) ON DELETE SET NULL,
        direction message_direction NOT NULL,
        status message_status NOT NULL DEFAULT 'queued',
        body_text text NOT NULL,
        external_message_id varchar(191),
        sent_at timestamp with time zone,
        delivered_at timestamp with time zone,
        read_at timestamp with time zone,
        metadata jsonb DEFAULT '{}'::jsonb NOT NULL
      );
    `);

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS outreach_messages (
        id text PRIMARY KEY NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        archived_at timestamp with time zone,
        campaign_id text NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
        lead_id text REFERENCES leads(id) ON DELETE SET NULL,
        contact_id text REFERENCES contacts(id) ON DELETE SET NULL,
        created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
        channel outreach_channel NOT NULL DEFAULT 'email',
        status outreach_message_status NOT NULL DEFAULT 'queued',
        external_message_id varchar(191),
        subject varchar(200),
        body_text text NOT NULL,
        sent_at timestamp with time zone,
        failed_at timestamp with time zone
      );
    `);

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS outreach_drafts (
        id text PRIMARY KEY NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        archived_at timestamp with time zone,
        lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        campaign_id text REFERENCES outreach_campaigns(id) ON DELETE SET NULL,
        conversation_id text REFERENCES conversations(id) ON DELETE SET NULL,
        created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
        template_type outreach_draft_template NOT NULL,
        status outreach_draft_status NOT NULL DEFAULT 'draft',
        provider varchar(80) NOT NULL,
        model varchar(120) NOT NULL,
        evidence_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
        unsupported_claims jsonb DEFAULT '[]'::jsonb NOT NULL,
        subject varchar(220) NOT NULL,
        body_text text NOT NULL,
        why_this_lead text NOT NULL
      );
    `);

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS reply_intelligence_events (
        id text PRIMARY KEY NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        lead_id text REFERENCES leads(id) ON DELETE SET NULL,
        intent inbox_category NOT NULL,
        confidence integer NOT NULL DEFAULT 0,
        extracted_facts jsonb DEFAULT '[]'::jsonb NOT NULL
      );
    `);

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS outreach_send_attempts (
        id text PRIMARY KEY NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        campaign_id text NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
        lead_id text REFERENCES leads(id) ON DELETE SET NULL,
        contact_id text REFERENCES contacts(id) ON DELETE SET NULL,
        conversation_id text REFERENCES conversations(id) ON DELETE SET NULL,
        outreach_message_id text REFERENCES outreach_messages(id) ON DELETE SET NULL,
        recipient varchar(320) NOT NULL,
        dedupe_key varchar(220) NOT NULL,
        status send_attempt_status NOT NULL,
        reason text,
        policy_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
        attempted_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS follow_up_queue (
        id text PRIMARY KEY NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        campaign_id text NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
        lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        conversation_id text REFERENCES conversations(id) ON DELETE SET NULL,
        step_key varchar(64) NOT NULL,
        scheduled_for timestamp with time zone NOT NULL,
        dedupe_key varchar(220) NOT NULL,
        status follow_up_status NOT NULL DEFAULT 'scheduled',
        reason text
      );
    `);

    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS conversations_owner_status_idx ON conversations (owner_user_id, status);
      CREATE INDEX IF NOT EXISTS conversations_contact_status_idx ON conversations (contact_id, status);
      CREATE INDEX IF NOT EXISTS conversations_lead_status_idx ON conversations (lead_id, status);
      CREATE INDEX IF NOT EXISTS conversations_inbox_last_message_idx ON conversations (inbox_category, status, last_message_at);
      CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages (conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS messages_direction_status_idx ON messages (direction, status);
      CREATE INDEX IF NOT EXISTS outreach_messages_campaign_status_idx ON outreach_messages (campaign_id, status);
      CREATE INDEX IF NOT EXISTS outreach_messages_lead_status_idx ON outreach_messages (lead_id, status);
      CREATE INDEX IF NOT EXISTS outreach_messages_contact_status_idx ON outreach_messages (contact_id, status);
      CREATE INDEX IF NOT EXISTS outreach_drafts_lead_status_idx ON outreach_drafts (lead_id, status);
      CREATE INDEX IF NOT EXISTS outreach_drafts_campaign_idx ON outreach_drafts (campaign_id);
      CREATE INDEX IF NOT EXISTS outreach_drafts_conversation_idx ON outreach_drafts (conversation_id);
      CREATE INDEX IF NOT EXISTS reply_intelligence_conversation_idx ON reply_intelligence_events (conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS reply_intelligence_intent_idx ON reply_intelligence_events (intent, confidence);
      CREATE INDEX IF NOT EXISTS outreach_send_attempts_campaign_idx ON outreach_send_attempts (campaign_id, attempted_at);
      CREATE INDEX IF NOT EXISTS outreach_send_attempts_recipient_idx ON outreach_send_attempts (recipient);
      CREATE INDEX IF NOT EXISTS follow_up_queue_campaign_status_idx ON follow_up_queue (campaign_id, status);
    `);

    await sql.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_uq ON messages (external_message_id) WHERE external_message_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS outreach_messages_external_id_uq ON outreach_messages (external_message_id) WHERE external_message_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS reply_intelligence_message_uq ON reply_intelligence_events (message_id);
      CREATE UNIQUE INDEX IF NOT EXISTS outreach_send_attempts_dedupe_uq ON outreach_send_attempts (dedupe_key);
      CREATE UNIQUE INDEX IF NOT EXISTS follow_up_queue_dedupe_uq ON follow_up_queue (dedupe_key);
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_external_id_uq') THEN
          CREATE UNIQUE INDEX messages_external_id_uq ON messages (external_message_id) WHERE external_message_id IS NOT NULL;
        END IF;
      END $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outreach_messages_external_id_uq') THEN
          CREATE UNIQUE INDEX outreach_messages_external_id_uq ON outreach_messages (external_message_id) WHERE external_message_id IS NOT NULL;
        END IF;
      END $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reply_intelligence_message_uq') THEN
          CREATE UNIQUE INDEX reply_intelligence_message_uq ON reply_intelligence_events (message_id);
        END IF;
      END $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outreach_send_attempts_dedupe_uq') THEN
          CREATE UNIQUE INDEX outreach_send_attempts_dedupe_uq ON outreach_send_attempts (dedupe_key);
        END IF;
      END $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follow_up_queue_dedupe_uq') THEN
          CREATE UNIQUE INDEX follow_up_queue_dedupe_uq ON follow_up_queue (dedupe_key);
        END IF;
      END $$;
    `);

    await sql.unsafe(`
      ALTER TABLE IF EXISTS conversations
        DROP CONSTRAINT IF EXISTS conversations_lead_id_fkey,
        DROP CONSTRAINT IF EXISTS conversations_contact_id_fkey,
        DROP CONSTRAINT IF EXISTS conversations_owner_user_id_fkey;
    `);

    await sql.unsafe(`
      ALTER TABLE IF EXISTS conversations
        ADD CONSTRAINT conversations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
    `);

    await sql.unsafe(`
      ALTER TABLE IF EXISTS messages
        DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey,
        DROP CONSTRAINT IF EXISTS messages_outreach_message_id_fkey,
        DROP CONSTRAINT IF EXISTS messages_author_user_id_fkey;
    `);

    await sql.unsafe(`
      ALTER TABLE IF EXISTS messages
        ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        ADD CONSTRAINT messages_outreach_message_id_fkey FOREIGN KEY (outreach_message_id) REFERENCES outreach_messages(id) ON DELETE SET NULL,
        ADD CONSTRAINT messages_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL;
    `);

    // This repair creates the exact runtime tables that the app currently expects but which were missing from the live Render schema.

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_type') THEN
          CREATE TYPE lead_type AS ENUM ('supply', 'demand', 'ai_discovered');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_outreach_status') THEN
          CREATE TYPE lead_outreach_status AS ENUM ('not_started', 'drafted', 'sent', 'responded', 'suppressed');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'directness_classification') THEN
          CREATE TYPE directness_classification AS ENUM ('DIRECT', 'INTERMEDIARY', 'UNKNOWN', 'SUPPRESSED');
        END IF;
      END
      $$;
    `);

    await sql.unsafe(`
      ALTER TABLE IF EXISTS leads
        ADD COLUMN IF NOT EXISTS lead_type lead_type DEFAULT 'supply' NOT NULL,
        ADD COLUMN IF NOT EXISTS status lead_status DEFAULT 'new' NOT NULL,
        ADD COLUMN IF NOT EXISTS score integer DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS confidence integer DEFAULT 50 NOT NULL,
        ADD COLUMN IF NOT EXISTS next_action text,
        ADD COLUMN IF NOT EXISTS outreach_status lead_outreach_status DEFAULT 'not_started' NOT NULL,
        ADD COLUMN IF NOT EXISTS directness_classification directness_classification DEFAULT 'UNKNOWN' NOT NULL,
        ADD COLUMN IF NOT EXISTS directness_confidence integer DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS directness_verified boolean DEFAULT false NOT NULL,
        ADD COLUMN IF NOT EXISTS score_version varchar(64),
        ADD COLUMN IF NOT EXISTS last_scored_at timestamp with time zone,
        ADD COLUMN IF NOT EXISTS summary text,
        ADD COLUMN IF NOT EXISTS received_at timestamp with time zone;
    `);

    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS leads_type_status_idx ON leads USING btree (lead_type, status);
    `);
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS leads_type_status_updated_idx ON leads USING btree (lead_type, status, updated_at);
    `);
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS leads_directness_idx ON leads USING btree (directness_classification, directness_verified);
    `);

    await sql.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS queue_items_idempotency_uq ON queue_items (idempotency_key);
    `);
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS queue_items_worker_status_idx ON queue_items (worker_name, status);
    `);
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS queue_items_schedule_idx ON queue_items (scheduled_for, status);
    `);

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id text PRIMARY KEY NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        type varchar(80) NOT NULL,
        title varchar(220) NOT NULL,
        body text NOT NULL,
        severity varchar(24) DEFAULT 'info' NOT NULL,
        lead_id text,
        mission_id text,
        acknowledged_by_user_id text,
        acknowledged_at timestamp with time zone
      );
    `);

    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS agent_messages_type_created_idx ON agent_messages (type, created_at);
    `);
  }

  try {
    const db = drizzle(sql);

    try {
      await migrate(db, {
        migrationsFolder,
      });
    } catch (error) {
      const isDuplicatePilotFeedbackType =
        error instanceof Error &&
        error.message.includes('type "pilot_feedback_label" already exists');

      if (!isDuplicatePilotFeedbackType) {
        throw error;
      }

      console.warn(
        "Detected existing pilot_feedback_label type during migration. Applying critical table repair fallback.",
      );
    }

    console.log(`Applied migrations from ${migrationsFolder}.`);
    await ensureCriticalAutomationTables();
    console.log("Applied critical runtime repair checks for inbox and conversations tables.");
  } finally {
    await sql.end();
  }
}

void main();
