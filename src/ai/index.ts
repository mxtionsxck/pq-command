import type { AppEnv } from "../lib/env";
import type { AiProvider } from "@/domain/ai/types";

import { createAiProvider } from "./provider-factory";

export interface AiProviderDescriptor {
  name: string;
  status: "configured";
}

export function listAiProviders(env: AppEnv): AiProviderDescriptor[] {
  const providers: AiProviderDescriptor[] = [];

  if (
    (env.AI_PROVIDER === "openai" || env.AI_FALLBACK_PROVIDER === "openai") &&
    env.OPENAI_API_KEY
  ) {
    providers.push({ name: "openai", status: "configured" });
  }

  if (
    (env.AI_PROVIDER === "gemini" || env.AI_FALLBACK_PROVIDER === "gemini") &&
    env.GEMINI_API_KEY
  ) {
    providers.push({ name: "gemini", status: "configured" });
  }

  if (providers.length > 0) {
    return providers;
  }

  if (!env.AI_PROVIDER && !env.AI_FALLBACK_PROVIDER) {
    return [{ name: "mock", status: "configured" }];
  }

  return [];
}

export function resolveAiProvider(env: AppEnv): AiProvider {
  return createAiProvider(env);
}

export * from "./mock-ai-provider";
export * from "./live-ai-provider";
export * from "./provider-validation";
