import type {
  AiFailure,
  AiResult,
  AiRuntimeMetadata,
  AiSchemaValidator,
  AiTaskName,
} from "@/domain/ai/types";

export function createMetadata(input: {
  provider: string;
  model: string;
  task: AiTaskName;
  latencyMs: number;
  tokenUsage?: { input?: number; output?: number; total?: number };
  costUsdMicros?: number;
}): AiRuntimeMetadata {
  return {
    provider: input.provider,
    model: input.model,
    task: input.task,
    latencyMs: input.latencyMs,
    ...(input.tokenUsage ? { tokenUsage: input.tokenUsage } : {}),
    ...(input.costUsdMicros !== undefined
      ? { costUsdMicros: input.costUsdMicros }
      : {}),
  };
}

export function success<T>(
  output: T,
  metadata: AiRuntimeMetadata,
): AiResult<T> {
  return {
    ok: true,
    output,
    metadata,
    advisory: true,
  };
}

export function failure<T>(
  failureReason: AiFailure,
  metadata: AiRuntimeMetadata,
): AiResult<T> {
  return {
    ok: false,
    failure: failureReason,
    metadata,
    advisory: true,
  };
}

export function validateOutput<T>(
  value: unknown,
  validator: AiSchemaValidator<T>,
): { ok: true; value: T } | { ok: false } {
  if (validator(value)) {
    return {
      ok: true,
      value,
    };
  }

  return {
    ok: false,
  };
}
