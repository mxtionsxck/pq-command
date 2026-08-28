import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { appEnv, type AppEnv } from "@/lib/env";

import { getDatabaseConfig } from "./config";
import * as schema from "./schema";

export function createDb(env: AppEnv = appEnv) {
  const config = getDatabaseConfig(env);

  if (!config.connectionString) {
    throw new Error(
      "DATABASE_URL is required before creating a database client.",
    );
  }

  const client = postgres(config.connectionString, {
    max: 5,
  });

  return drizzle(client, {
    schema,
  });
}

export type PQCommandDb = ReturnType<typeof createDb>;

let dbSingleton: PQCommandDb | undefined;

export function getDb(env: AppEnv = appEnv): PQCommandDb {
  if (!dbSingleton) {
    dbSingleton = createDb(env);
  }

  return dbSingleton;
}
