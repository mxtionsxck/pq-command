import type {
  AiProvider,
  ClassificationRequest,
  DraftingRequest,
  ScoringRecommendationRequest,
  StructuredExtractionRequest,
  SummarisationRequest,
} from "@/domain/ai/types";

import {
  createMetadata,
  failure,
  success,
  validateOutput,
} from "./provider-validation";

type LiveProviderConfig = {
  providerName: "openai" | "gemini";
  modelName: string;
  timeoutMs?: number;
  invoke: (prompt: string, maxOutputTokens: number) => Promise<string>;
};

function now() {
  return Date.now();
}

function buildLatency(start: number) {
  return Math.max(1, now() - start);
}

function extractFirstJsonObject(text: string) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Fall through to bracket extraction.
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");

  if (first < 0 || last <= first) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed.slice(first, last + 1)) as unknown;
  } catch {
    return undefined;
  }
}

function clampOutputLength(input: string, maxLength = 180) {
  const compact = input.replace(/\s+/g, " ").trim();

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, Math.max(1, maxLength - 3))}...`;
}

function createLiveProvider(config: LiveProviderConfig): AiProvider {
  const providerName = config.providerName;
  const modelName = config.modelName;

  return {
    providerName,
    modelName,

    async structuredExtraction<T>(request: StructuredExtractionRequest<T>) {
      const startedAt = now();
      const metadata = createMetadata({
        provider: providerName,
        model: modelName,
        task: "structuredExtraction",
        latencyMs: 1,
      });

      try {
        const prompt = [
          "Return JSON only. No markdown.",
          `Schema: ${request.schemaName}`,
          "Input:",
          request.input,
        ].join("\n");
        const raw = await config.invoke(prompt, 700);
        const parsed = extractFirstJsonObject(raw);
        const validated = validateOutput(parsed, request.validator);

        if (!validated.ok) {
          return failure<T>(
            {
              type: "validation_failed",
              message: `Structured extraction failed schema ${request.schemaName}.`,
              retryable: false,
            },
            {
              ...metadata,
              latencyMs: buildLatency(startedAt),
            },
          );
        }

        return success(validated.value, {
          ...metadata,
          latencyMs: buildLatency(startedAt),
        });
      } catch (error) {
        return failure<T>(
          {
            type: "provider_unavailable",
            message:
              error instanceof Error
                ? error.message
                : "Live AI provider call failed.",
            retryable: true,
          },
          {
            ...metadata,
            latencyMs: buildLatency(startedAt),
          },
        );
      }
    },

    async classification<T extends string>(request: ClassificationRequest<T>) {
      const startedAt = now();
      const metadata = createMetadata({
        provider: providerName,
        model: modelName,
        task: "classification",
        latencyMs: 1,
      });

      try {
        const prompt = [
          "Choose exactly one class and respond with only that class label.",
          `Classes: ${request.classes.join(", ")}`,
          "Input:",
          request.input,
        ].join("\n");

        const raw = await config.invoke(prompt, 40);
        const selected = request.classes.find(
          (item) => raw.trim().toLowerCase() === item.toLowerCase(),
        );

        if (!selected || !request.validator(selected)) {
          return failure<T>(
            {
              type: "validation_failed",
              message: "Classification output did not match schema.",
              retryable: false,
            },
            {
              ...metadata,
              latencyMs: buildLatency(startedAt),
            },
          );
        }

        return success(selected, {
          ...metadata,
          latencyMs: buildLatency(startedAt),
        });
      } catch (error) {
        return failure<T>(
          {
            type: "provider_unavailable",
            message:
              error instanceof Error
                ? error.message
                : "Live AI provider call failed.",
            retryable: true,
          },
          {
            ...metadata,
            latencyMs: buildLatency(startedAt),
          },
        );
      }
    },

    async summarisation(request: SummarisationRequest) {
      const startedAt = now();
      const metadata = createMetadata({
        provider: providerName,
        model: modelName,
        task: "summarisation",
        latencyMs: 1,
      });

      try {
        const maxLength = Math.max(60, Math.min(700, request.maxLength ?? 180));
        const prompt = [
          "Summarise the following for an operations user.",
          `Keep it under ${maxLength} characters.`,
          "Input:",
          request.input,
        ].join("\n");
        const raw = await config.invoke(prompt, 220);

        return success(
          {
            summary: clampOutputLength(raw, maxLength),
          },
          {
            ...metadata,
            latencyMs: buildLatency(startedAt),
          },
        );
      } catch (error) {
        return failure<{ summary: string }>(
          {
            type: "provider_unavailable",
            message:
              error instanceof Error
                ? error.message
                : "Live AI provider call failed.",
            retryable: true,
          },
          {
            ...metadata,
            latencyMs: buildLatency(startedAt),
          },
        );
      }
    },

    async drafting(request: DraftingRequest) {
      const startedAt = now();
      const metadata = createMetadata({
        provider: providerName,
        model: modelName,
        task: "drafting",
        latencyMs: 1,
      });

      try {
        const prompt = [
          "Write a concise operational draft message.",
          `Tone: ${request.tone ?? "neutral"}`,
          `Objective: ${request.objective}`,
          "Context:",
          request.context,
        ].join("\n");

        const raw = await config.invoke(prompt, 350);

        return success(
          { draft: clampOutputLength(raw, 320) },
          {
            ...metadata,
            latencyMs: buildLatency(startedAt),
          },
        );
      } catch (error) {
        return failure<{ draft: string }>(
          {
            type: "provider_unavailable",
            message:
              error instanceof Error
                ? error.message
                : "Live AI provider call failed.",
            retryable: true,
          },
          {
            ...metadata,
            latencyMs: buildLatency(startedAt),
          },
        );
      }
    },

    async scoringRecommendation<T>(request: ScoringRecommendationRequest<T>) {
      const startedAt = now();
      const metadata = createMetadata({
        provider: providerName,
        model: modelName,
        task: "scoringRecommendation",
        latencyMs: 1,
      });

      try {
        const prompt = [
          "Return JSON only. No markdown.",
          `Schema: ${request.schemaName}`,
          "Input:",
          request.input,
        ].join("\n");
        const raw = await config.invoke(prompt, 700);
        const parsed = extractFirstJsonObject(raw);
        const validated = validateOutput(parsed, request.validator);

        if (!validated.ok) {
          return failure<T>(
            {
              type: "validation_failed",
              message: `Scoring recommendation failed schema ${request.schemaName}.`,
              retryable: false,
            },
            {
              ...metadata,
              latencyMs: buildLatency(startedAt),
            },
          );
        }

        return success(validated.value, {
          ...metadata,
          latencyMs: buildLatency(startedAt),
        });
      } catch (error) {
        return failure<T>(
          {
            type: "provider_unavailable",
            message:
              error instanceof Error
                ? error.message
                : "Live AI provider call failed.",
            retryable: true,
          },
          {
            ...metadata,
            latencyMs: buildLatency(startedAt),
          },
        );
      }
    },
  };
}

async function fetchOpenAiText(input: {
  apiKey: string;
  model: string;
  prompt: string;
  maxOutputTokens: number;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        input: [
          {
            role: "system",
            content:
              "You are an operations AI for company-let investor and stock sourcing. Keep responses factual and concise.",
          },
          {
            role: "user",
            content: input.prompt,
          },
        ],
        max_output_tokens: input.maxOutputTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };

    if (typeof payload.output_text === "string" && payload.output_text.trim()) {
      return payload.output_text.trim();
    }

    const fallbackText = payload.output
      ?.flatMap((entry) => entry.content ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();

    if (!fallbackText) {
      throw new Error("OpenAI returned an empty response.");
    }

    return fallbackText;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGeminiText(input: {
  apiKey: string;
  model: string;
  prompt: string;
  maxOutputTokens: number;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  "You are an operations AI for company-let investor and stock sourcing. Keep responses factual and concise.",
                  input.prompt,
                ].join("\n\n"),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: input.maxOutputTokens,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = payload.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export function createOpenAiProvider(config: {
  apiKey: string;
  model: string;
  timeoutMs?: number;
}): AiProvider {
  const liveConfig: LiveProviderConfig = {
    providerName: "openai",
    modelName: config.model,
    ...(config.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : {}),
    invoke: (prompt, maxOutputTokens) =>
      fetchOpenAiText({
        apiKey: config.apiKey,
        model: config.model,
        prompt,
        maxOutputTokens,
        timeoutMs: config.timeoutMs ?? 20_000,
      }),
  };

  return createLiveProvider(liveConfig);
}

export function createGeminiProvider(config: {
  apiKey: string;
  model: string;
  timeoutMs?: number;
}): AiProvider {
  const liveConfig: LiveProviderConfig = {
    providerName: "gemini",
    modelName: config.model,
    ...(config.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : {}),
    invoke: (prompt, maxOutputTokens) =>
      fetchGeminiText({
        apiKey: config.apiKey,
        model: config.model,
        prompt,
        maxOutputTokens,
        timeoutMs: config.timeoutMs ?? 20_000,
      }),
  };

  return createLiveProvider(liveConfig);
}
