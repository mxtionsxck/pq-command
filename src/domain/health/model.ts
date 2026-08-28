export type HealthCheckStatus = "ok" | "error";

export interface HealthCheck {
  name: string;
  status: HealthCheckStatus;
  detail: string;
}

export interface HealthSnapshot {
  service: string;
  environment: string;
  status: HealthCheckStatus;
  timestamp: string;
  checks: HealthCheck[];
}

export function aggregateHealthStatus(
  checks: readonly HealthCheck[],
): HealthCheckStatus {
  return checks.some((check) => check.status === "error") ? "error" : "ok";
}
