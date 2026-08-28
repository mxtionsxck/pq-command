import type { AppEnv } from "../lib/env";

export interface IntegrationDescriptor {
  name: string;
  status: "configured";
}

export function listIntegrations(env: AppEnv): IntegrationDescriptor[] {
  const integrations: IntegrationDescriptor[] = [];

  integrations.push({
    name: "mock-email-adapter",
    status: "configured",
  });

  if (env.PUBLIC_BUSINESS_DATA_API_URL && env.PUBLIC_BUSINESS_DATA_API_KEY) {
    integrations.push({
      name: "public-business-data-api",
      status: "configured",
    });
  }

  if (env.SLACK_WEBHOOK_URL) {
    integrations.push({ name: "slack-webhook", status: "configured" });
  }

  return integrations;
}

export * from "./email";
