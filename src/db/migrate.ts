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

  try {
    const db = drizzle(sql);

    await migrate(db, {
      migrationsFolder,
    });

    console.log(`Applied migrations from ${migrationsFolder}.`);
  } finally {
    await sql.end();
  }
}

void main();
