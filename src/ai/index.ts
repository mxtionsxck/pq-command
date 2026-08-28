import type { AppEnv } from "../lib/env";
import type { AiProvider } from "@/domain/ai/types";

import { createAiProvider } from "./provider-factory";

export interface AiProviderDescriptor {
  name: string;
  status: "configured";
}

export function listAiProviders(env: AppEnv): AiProviderDescriptor[] {
  if (env.AI_PROVIDER === "openai") {
    return [{ name: "openai", status: "configured" }];
  }

  if (!env.AI_PROVIDER) {
    return [{ name: "mock", status: "configured" }];
  }

  return [];
}

export function resolveAiProvider(env: AppEnv): AiProvider {
  return createAiProvider(env);
}

export * from "./mock-ai-provider";
export * from "./provider-validation";
