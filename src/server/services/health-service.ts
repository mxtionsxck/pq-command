import { listAiProviders } from "../../ai";
import { getDatabaseConfig } from "../../db/config";
import {
  aggregateHealthStatus,
  type HealthCheck,
  type HealthSnapshot,
} from "../../domain/health/model";
import { listIntegrations } from "../../integrations";
import { appEnv, type AppEnv } from "../../lib/env";
import { listJobs } from "../../jobs";

function createCheck(name: string, detail: string): HealthCheck {
  return {
    name,
    status: "ok",
    detail,
  };
}

export function buildHealthSnapshot(
  now: Date = new Date(),
  env: AppEnv = appEnv,
): HealthSnapshot {
  const database = getDatabaseConfig(env);
  const integrations = listIntegrations(env);
  const connectedIntegrations = integrations.filter(
    (integration) => integration.status === "connected",
  ).length;
  const aiProviders = listAiProviders(env);
  const jobs = listJobs();

  const checks: HealthCheck[] = [
    createCheck("environment", `${env.APP_ENV} configuration validated`),
    createCheck(
      "database",
      database.configured
        ? "DATABASE_URL configured"
        : "Database boundary ready; DATABASE_URL not configured",
    ),
    createCheck(
      "integrations",
      `${connectedIntegrations}/${integrations.length} integration(s) connected`,
    ),
    createCheck(
      "ai",
      aiProviders.length > 0
        ? `${aiProviders.length} AI provider(s) configured`
        : "No AI provider configured",
    ),
    createCheck(
      "jobs",
      jobs.length > 0
        ? `${jobs.length} background job(s) registered`
        : "No scheduled jobs registered",
    ),
  ];

  return {
    service: env.APP_NAME,
    environment: env.APP_ENV,
    status: aggregateHealthStatus(checks),
    timestamp: now.toISOString(),
    checks,
  };
}
