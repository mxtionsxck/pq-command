import type { AppEnv } from "../lib/env";

export interface DatabaseConfig {
  configured: boolean;
  connectionString: string | undefined;
  migrationsDirectory: string;
}

export function getDatabaseConfig(env: AppEnv): DatabaseConfig {
  return {
    configured: Boolean(env.DATABASE_URL),
    connectionString: env.DATABASE_URL,
    migrationsDirectory: "drizzle",
  };
}
