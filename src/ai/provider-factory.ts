import type { AiProvider } from "@/domain/ai/types";
import type { AppEnv } from "@/lib/env";

import { createGeminiProvider, createOpenAiProvider } from "./live-ai-provider";
import { createMockAiProvider } from "./mock-ai-provider";

function providerConfigured(env: AppEnv, provider: "openai" | "gemini") {
  return provider === "openai"
    ? Boolean(env.OPENAI_API_KEY)
    : Boolean(env.GEMINI_API_KEY);
}

function openAiModelByTask(env: AppEnv) {
  return {
    cheap: env.OPENAI_CHEAP_MODEL ?? "gpt-4.1-mini",
    standard: env.OPENAI_STANDARD_MODEL ?? env.AI_MODEL ?? "gpt-4.1",
    reasoning: env.OPENAI_REASONING_MODEL ?? "o4-mini",
  };
}

function createConfiguredProvider(env: AppEnv, provider: "openai" | "gemini") {
  if (provider === "openai" && env.OPENAI_API_KEY) {
    const models = openAiModelByTask(env);
    const cheapProvider = createOpenAiProvider({
      apiKey: env.OPENAI_API_KEY,
      model: models.cheap,
    });
    const standardProvider = createOpenAiProvider({
      apiKey: env.OPENAI_API_KEY,
      model: models.standard,
    });
    const reasoningProvider = createOpenAiProvider({
      apiKey: env.OPENAI_API_KEY,
      model: models.reasoning,
    });

    return {
      providerName: "openai",
      modelName: `${models.cheap}|${models.standard}|${models.reasoning}`,
      structuredExtraction: (request) => standardProvider.structuredExtraction(request),
      classification: (request) => cheapProvider.classification(request),
      summarisation: (request) => cheapProvider.summarisation(request),
      drafting: (request) => standardProvider.drafting(request),
      scoringRecommendation: (request) => reasoningProvider.scoringRecommendation(request),
    } satisfies AiProvider;
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

export function validateAiRuntimeConfig(env: AppEnv): boolean {
  const primaryProviderName = env.AI_PRIMARY_PROVIDER ?? env.AI_PROVIDER;

  if (!primaryProviderName) {
    return true;
  }

  if (primaryProviderName === "openai" && !env.OPENAI_API_KEY) {
    return false;
  }

  if (primaryProviderName === "gemini" && !env.GEMINI_API_KEY) {
    return false;
  }

  return true;
}

export function createAiProvider(env: AppEnv): AiProvider {
  const primaryProviderName = env.AI_PRIMARY_PROVIDER ?? env.AI_PROVIDER;

  if (!primaryProviderName || !validateAiRuntimeConfig(env)) {
    return createMockAiProvider();
  }

  const primaryProvider = createConfiguredProvider(env, primaryProviderName);
  if (!primaryProvider) {
    return createMockAiProvider();
  }

  if (
    env.AI_FALLBACK_PROVIDER &&
    env.AI_FALLBACK_PROVIDER !== primaryProviderName &&
    providerConfigured(env, env.AI_FALLBACK_PROVIDER)
  ) {
    const fallbackProvider = createConfiguredProvider(env, env.AI_FALLBACK_PROVIDER);
    if (fallbackProvider) {
      return withFallback(primaryProvider, fallbackProvider);
    }
  }

  return primaryProvider;
}
