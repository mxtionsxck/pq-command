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

      await ensureCriticalAutomationTables();
    }

    console.log(`Applied migrations from ${migrationsFolder}.`);
  } finally {
    await sql.end();
  }
}

void main();
