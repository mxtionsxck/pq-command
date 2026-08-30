import type { AiProvider } from "@/domain/ai/types";
import type { AppEnv } from "@/lib/env";

import { createGeminiProvider, createOpenAiProvider } from "./live-ai-provider";
import { createMockAiProvider } from "./mock-ai-provider";

function providerConfigured(env: AppEnv, provider: "openai" | "gemini") {
  return provider === "openai"
    ? Boolean(env.OPENAI_API_KEY)
    : Boolean(env.GEMINI_API_KEY);
}

function createConfiguredProvider(env: AppEnv, provider: "openai" | "gemini") {
  if (provider === "openai" && env.OPENAI_API_KEY) {
    return createOpenAiProvider({
      apiKey: env.OPENAI_API_KEY,
      model: env.AI_MODEL ?? "gpt-4.1-mini",
    });
  }

  if (provider === "gemini" && env.GEMINI_API_KEY) {
    return createGeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.AI_MODEL ?? "gemini-1.5-pro",
    });
  }

  return undefined;
}

function withFallback(primary: AiProvider, fallback: AiProvider): AiProvider {
  return {
    providerName: `${primary.providerName}->${fallback.providerName}`,
    modelName: `${primary.modelName}|${fallback.modelName}`,
    async structuredExtraction(request) {
      const first = await primary.structuredExtraction(request);
      if (first.ok || !first.failure.retryable) {
        return first;
      }

      return fallback.structuredExtraction(request);
    },
    async classification(request) {
      const first = await primary.classification(request);
      if (first.ok || !first.failure.retryable) {
        return first;
      }

      return fallback.classification(request);
    },
    async summarisation(request) {
      const first = await primary.summarisation(request);
      if (first.ok || !first.failure.retryable) {
        return first;
      }

      return fallback.summarisation(request);
    },
    async drafting(request) {
      const first = await primary.drafting(request);
      if (first.ok || !first.failure.retryable) {
        return first;
      }

      return fallback.drafting(request);
    },
    async scoringRecommendation(request) {
      const first = await primary.scoringRecommendation(request);
      if (first.ok || !first.failure.retryable) {
        return first;
      }

      return fallback.scoringRecommendation(request);
    },
  };
}

export function createAiProvider(env: AppEnv): AiProvider {
  if (!env.AI_PROVIDER) {
    return createMockAiProvider();
  }

  const primaryProvider = createConfiguredProvider(env, env.AI_PROVIDER);
  if (!primaryProvider) {
    return createMockAiProvider();
  }

  if (
    env.AI_FALLBACK_PROVIDER &&
    env.AI_FALLBACK_PROVIDER !== env.AI_PROVIDER &&
    providerConfigured(env, env.AI_FALLBACK_PROVIDER)
  ) {
    const fallbackProvider = createConfiguredProvider(env, env.AI_FALLBACK_PROVIDER);
    if (fallbackProvider) {
      return withFallback(primaryProvider, fallbackProvider);
    }
  }

  return primaryProvider;
}
