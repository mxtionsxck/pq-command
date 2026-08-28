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

function now() {
  return Date.now();
}

function summarise(input: string, maxLength = 180) {
  const trimmed = input.replace(/\s+/g, " ").trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function buildLatency(start: number) {
  return Math.max(1, now() - start);
}

export function createMockAiProvider(
  options: {
    providerName?: string;
    modelName?: string;
  } = {},
): AiProvider {
  const providerName = options.providerName ?? "mock";
  const modelName = options.modelName ?? "mock-v1";

  return {
    providerName,
    modelName,

    async structuredExtraction<T>(request: StructuredExtractionRequest<T>) {
      const startedAt = now();
      const raw = JSON.parse(request.input);
      const validated = validateOutput(raw, request.validator);
      const metadata = createMetadata({
        provider: providerName,
        model: modelName,
        task: "structuredExtraction",
        latencyMs: buildLatency(startedAt),
      });

      if (!validated.ok) {
        return failure<T>(
          {
            type: "validation_failed",
            message: `Structured extraction failed schema ${request.schemaName}.`,
            retryable: false,
          },
          metadata,
        );
      }

      return success(validated.value, metadata);
    },

    async classification<T extends string>(request: ClassificationRequest<T>) {
      const startedAt = now();
      const lower = request.input.toLowerCase();
      const selected = request.classes.find((item) =>
        lower.includes(String(item).toLowerCase()),
      );
      const guess = selected ?? request.classes[0];
      const metadata = createMetadata({
        provider: providerName,
        model: modelName,
        task: "classification",
        latencyMs: buildLatency(startedAt),
      });

      if (!guess || !request.validator(guess)) {
        return failure<T>(
          {
            type: "validation_failed",
            message: "Classification output did not match schema.",
            retryable: false,
          },
          metadata,
        );
      }

      return success(guess, metadata);
    },

    async summarisation(request: SummarisationRequest) {
      const startedAt = now();
      const summary = summarise(request.input, request.maxLength ?? 180);

      return success(
        { summary },
        createMetadata({
          provider: providerName,
          model: modelName,
          task: "summarisation",
          latencyMs: buildLatency(startedAt),
        }),
      );
    },

    async drafting(request: DraftingRequest) {
      const startedAt = now();
      const draft = `[${request.tone ?? "neutral"}] ${request.objective}: ${summarise(request.context, 220)}`;

      return success(
        { draft },
        createMetadata({
          provider: providerName,
          model: modelName,
          task: "drafting",
          latencyMs: buildLatency(startedAt),
        }),
      );
    },

    async scoringRecommendation<T>(request: ScoringRecommendationRequest<T>) {
      const startedAt = now();
      const raw = JSON.parse(request.input);
      const validated = validateOutput(raw, request.validator);
      const metadata = createMetadata({
        provider: providerName,
        model: modelName,
        task: "scoringRecommendation",
        latencyMs: buildLatency(startedAt),
      });

      if (!validated.ok) {
        return failure<T>(
          {
            type: "validation_failed",
            message: `Scoring recommendation failed schema ${request.schemaName}.`,
            retryable: false,
          },
          metadata,
        );
      }

      return success(validated.value, metadata);
    },
  };
}
