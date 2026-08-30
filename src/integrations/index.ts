import type { AppEnv } from "../lib/env";

export interface IntegrationDescriptor {
  name: string;
  status: "connected" | "configuration_required" | "failed" | "not_enabled";
  detail: string;
}

export function listIntegrations(env: AppEnv): IntegrationDescriptor[] {
  const integrations: IntegrationDescriptor[] = [];
  const primaryProvider = env.AI_PRIMARY_PROVIDER ?? env.AI_PROVIDER;

  integrations.push({
    name: "database",
    status: env.DATABASE_URL ? "connected" : "configuration_required",
    detail: env.DATABASE_URL
      ? "DATABASE_URL configured"
      : "Set DATABASE_URL to enable persistent operations.",
  });

  integrations.push({
    name: "ai.openai",
    status:
      primaryProvider === "openai" || env.AI_FALLBACK_PROVIDER === "openai"
        ? env.OPENAI_API_KEY
          ? "connected"
          : "configuration_required"
        : "not_enabled",
    detail:
      primaryProvider === "openai" || env.AI_FALLBACK_PROVIDER === "openai"
        ? env.OPENAI_API_KEY
          ? "OpenAI configured for active routing."
          : "Set OPENAI_API_KEY for OpenAI routing."
        : "OpenAI is not enabled for this environment.",
  });

  integrations.push({
    name: "ai.gemini",
    status:
      primaryProvider === "gemini" || env.AI_FALLBACK_PROVIDER === "gemini"
        ? env.GEMINI_API_KEY
          ? "connected"
          : "configuration_required"
        : "not_enabled",
    detail:
      primaryProvider === "gemini" || env.AI_FALLBACK_PROVIDER === "gemini"
        ? env.GEMINI_API_KEY
          ? "Gemini configured for active routing."
          : "Set GEMINI_API_KEY for Gemini routing."
        : "Gemini is not enabled for this environment.",
  });

  if (env.PUBLIC_BUSINESS_DATA_API_URL && env.PUBLIC_BUSINESS_DATA_API_KEY) {
    integrations.push({
      name: "public-business-data-api",
      status: "connected",
      detail: "Public business data connector configured.",
    });
  } else {
    integrations.push({
      name: "public-business-data-api",
      status: "configuration_required",
      detail:
        "Set PUBLIC_BUSINESS_DATA_API_URL and PUBLIC_BUSINESS_DATA_API_KEY together.",
    });
  }

  integrations.push({
    name: "slack-webhook",
    status: env.SLACK_WEBHOOK_URL ? "connected" : "not_enabled",
    detail: env.SLACK_WEBHOOK_URL
      ? "Slack webhook configured for operational alerts."
      : "Set SLACK_WEBHOOK_URL to enable Slack alerting.",
  });

  integrations.push({
    name: "email.delivery",
    status: "configuration_required",
    detail:
      "Production email provider is not configured. System currently uses mock adapter.",
  });

  return integrations;
}

export * from "./email";
