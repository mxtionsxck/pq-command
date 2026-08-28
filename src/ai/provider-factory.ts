import type { AiProvider } from "@/domain/ai/types";
import type { AppEnv } from "@/lib/env";

import { createMockAiProvider } from "./mock-ai-provider";

export function createAiProvider(env: AppEnv): AiProvider {
  if (!env.AI_PROVIDER) {
    return createMockAiProvider();
  }

  if (env.AI_PROVIDER === "openai" && env.OPENAI_API_KEY) {
    // Live provider wiring is intentionally deferred until explicit environment rollout.
    return createMockAiProvider({
      providerName: "openai_stub",
      modelName: "not-configured-for-live",
    });
  }

  return createMockAiProvider();
}
