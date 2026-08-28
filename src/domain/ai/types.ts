export type AiTaskName =
  | "structuredExtraction"
  | "classification"
  | "summarisation"
  | "drafting"
  | "scoringRecommendation";

export interface AiRuntimeMetadata {
  provider: string;
  model: string;
  task: AiTaskName;
  latencyMs: number;
  tokenUsage?: {
    input?: number;
    output?: number;
    total?: number;
  };
  costUsdMicros?: number;
}

export interface AiFailure {
  type: "provider_unavailable" | "validation_failed" | "runtime_error";
  message: string;
  retryable: boolean;
}

export type AiResult<T> =
  | {
      ok: true;
      output: T;
      metadata: AiRuntimeMetadata;
      advisory: true;
    }
  | {
      ok: false;
      metadata: AiRuntimeMetadata;
      failure: AiFailure;
      advisory: true;
    };

export type AiSchemaValidator<T> = (value: unknown) => value is T;

export interface StructuredExtractionRequest<T> {
  input: string;
  schemaName: string;
  validator: AiSchemaValidator<T>;
}

export interface ClassificationRequest<T> {
  input: string;
  classes: readonly T[];
  validator: AiSchemaValidator<T>;
}

export interface SummarisationRequest {
  input: string;
  maxLength?: number;
}

export interface DraftingRequest {
  objective: string;
  context: string;
  tone?: "neutral" | "formal" | "direct";
}

export interface ScoringRecommendationRequest<T> {
  input: string;
  schemaName: string;
  validator: AiSchemaValidator<T>;
}

export interface AiProvider {
  readonly providerName: string;
  readonly modelName: string;

  structuredExtraction<T>(
    request: StructuredExtractionRequest<T>,
  ): Promise<AiResult<T>>;
  classification<T extends string>(
    request: ClassificationRequest<T>,
  ): Promise<AiResult<T>>;
  summarisation(
    request: SummarisationRequest,
  ): Promise<AiResult<{ summary: string }>>;
  drafting(request: DraftingRequest): Promise<AiResult<{ draft: string }>>;
  scoringRecommendation<T>(
    request: ScoringRecommendationRequest<T>,
  ): Promise<AiResult<T>>;
}
