const nodeEnvValues = ["development", "test", "production"] as const;
const appEnvValues = ["development", "test", "staging", "production"] as const;
const aiProviderValues = ["openai", "gemini"] as const;

type NodeEnv = (typeof nodeEnvValues)[number];
type AppEnvironment = (typeof appEnvValues)[number];
type AiProvider = (typeof aiProviderValues)[number];

export interface AppEnv {
  NODE_ENV: NodeEnv;
  APP_NAME: string;
  APP_ENV: AppEnvironment;
  AUTH_SECRET: string | undefined;
  AUTH_MICROSOFT_ENTRA_ID_ID: string | undefined;
  AUTH_MICROSOFT_ENTRA_ID_SECRET: string | undefined;
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: string | undefined;
  AUTH_ADMIN_EMAILS: readonly string[];
  AUTH_MANAGER_EMAILS: readonly string[];
  AUTH_LOCAL_ADMIN_USERNAME: string | undefined;
  AUTH_LOCAL_ADMIN_PASSWORD: string | undefined;
  DATABASE_URL: string | undefined;
  STORAGE_ROOT: string | undefined;
  AI_PRIMARY_PROVIDER: AiProvider | undefined;
  AI_PROVIDER: AiProvider | undefined;
  AI_FALLBACK_PROVIDER: AiProvider | undefined;
  AI_MODEL: string | undefined;
  OPENAI_CHEAP_MODEL: string | undefined;
  OPENAI_STANDARD_MODEL: string | undefined;
  OPENAI_REASONING_MODEL: string | undefined;
  OPENAI_API_KEY: string | undefined;
  GEMINI_API_KEY: string | undefined;
  NIGHT_SHIFT_RESIDENTIAL_STOCK_TARGET: number | undefined;
  NIGHT_SHIFT_RESIDENTIAL_DEMAND_TARGET: number | undefined;
  NIGHT_SHIFT_HOTEL_SELLER_TARGET: number | undefined;
  NIGHT_SHIFT_HOTEL_BUYER_TARGET: number | undefined;
  NIGHT_SHIFT_DAILY_AI_BUDGET_GBP: number | undefined;
  NIGHT_SHIFT_MONTHLY_AI_BUDGET_GBP: number | undefined;
  PUBLIC_BUSINESS_DATA_API_URL: string | undefined;
  PUBLIC_BUSINESS_DATA_API_KEY: string | undefined;
  PUBLIC_BUSINESS_DATA_RATE_LIMIT_PER_MINUTE: number | undefined;
  SLACK_WEBHOOK_URL: string | undefined;
}

type EnvSource = NodeJS.ProcessEnv;

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readEnum<T extends string>(
  source: EnvSource,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = source[key];

  if (!hasValue(value)) {
    return fallback;
  }

  if (allowed.includes(value as T)) {
    return value as T;
  }

  throw new Error(
    `${key} must be one of: ${allowed.join(", ")}. Received: ${value}.`,
  );
}

function readOptional(source: EnvSource, key: string): string | undefined {
  const value = source[key];

  return hasValue(value) ? value.trim() : undefined;
}

function readOptionalUrl(source: EnvSource, key: string): string | undefined {
  const value = readOptional(source, key);

  if (!value) {
    return undefined;
  }

  try {
    new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL when provided.`);
  }

  return value;
}

function readOptionalList(source: EnvSource, key: string): readonly string[] {
  const value = readOptional(source, key);

  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function readOptionalInt(source: EnvSource, key: string): number | undefined {
  const value = readOptional(source, key);

  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer when provided.`);
  }

  return parsed;
}

function readOptionalNumber(source: EnvSource, key: string): number | undefined {
  const value = readOptional(source, key);

  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative number when provided.`);
  }

  return parsed;
}

function resolveDefaultAppEnv(nodeEnv: NodeEnv): AppEnvironment {
  return nodeEnv === "production" ? "production" : nodeEnv;
}

export function loadAppEnv(source: EnvSource = process.env): AppEnv {
  const NODE_ENV = readEnum(source, "NODE_ENV", nodeEnvValues, "development");
  const APP_NAME = readOptional(source, "APP_NAME") ?? "PQ COMMAND";
  const APP_ENV = readEnum(
    source,
    "APP_ENV",
    appEnvValues,
    resolveDefaultAppEnv(NODE_ENV),
  );
  const AUTH_SECRET = readOptional(source, "AUTH_SECRET");
  const AUTH_MICROSOFT_ENTRA_ID_ID = readOptional(
    source,
    "AUTH_MICROSOFT_ENTRA_ID_ID",
  );
  const AUTH_MICROSOFT_ENTRA_ID_SECRET = readOptional(
    source,
    "AUTH_MICROSOFT_ENTRA_ID_SECRET",
  );
  const AUTH_MICROSOFT_ENTRA_ID_ISSUER = readOptionalUrl(
    source,
    "AUTH_MICROSOFT_ENTRA_ID_ISSUER",
  );
  const AUTH_ADMIN_EMAILS = readOptionalList(source, "AUTH_ADMIN_EMAILS");
  const AUTH_MANAGER_EMAILS = readOptionalList(source, "AUTH_MANAGER_EMAILS");
  const configuredLocalAdminUsername = readOptional(
    source,
    "AUTH_LOCAL_ADMIN_USERNAME",
  );
  const configuredLocalAdminPassword = readOptional(
    source,
    "AUTH_LOCAL_ADMIN_PASSWORD",
  );
  const AUTH_LOCAL_ADMIN_USERNAME =
    configuredLocalAdminUsername ??
    (NODE_ENV === "development" ? "PQADMIN" : undefined);
  const AUTH_LOCAL_ADMIN_PASSWORD =
    configuredLocalAdminPassword ??
    (NODE_ENV === "development" ? "Loveteam@10" : undefined);
  const DATABASE_URL = readOptionalUrl(source, "DATABASE_URL");
  const STORAGE_ROOT = readOptional(source, "STORAGE_ROOT");
  const AI_PRIMARY_PROVIDER = readOptional(source, "AI_PRIMARY_PROVIDER");
  const AI_PROVIDER = readOptional(source, "AI_PROVIDER");
  const AI_FALLBACK_PROVIDER = readOptional(source, "AI_FALLBACK_PROVIDER");
  const AI_MODEL = readOptional(source, "AI_MODEL");
  const OPENAI_CHEAP_MODEL = readOptional(source, "OPENAI_CHEAP_MODEL");
  const OPENAI_STANDARD_MODEL = readOptional(source, "OPENAI_STANDARD_MODEL");
  const OPENAI_REASONING_MODEL = readOptional(source, "OPENAI_REASONING_MODEL");
  const OPENAI_API_KEY = readOptional(source, "OPENAI_API_KEY");
  const GEMINI_API_KEY = readOptional(source, "GEMINI_API_KEY");
  const NIGHT_SHIFT_RESIDENTIAL_STOCK_TARGET = readOptionalInt(
    source,
    "NIGHT_SHIFT_RESIDENTIAL_STOCK_TARGET",
  );
  const NIGHT_SHIFT_RESIDENTIAL_DEMAND_TARGET = readOptionalInt(
    source,
    "NIGHT_SHIFT_RESIDENTIAL_DEMAND_TARGET",
  );
  const NIGHT_SHIFT_HOTEL_SELLER_TARGET = readOptionalInt(
    source,
    "NIGHT_SHIFT_HOTEL_SELLER_TARGET",
  );
  const NIGHT_SHIFT_HOTEL_BUYER_TARGET = readOptionalInt(
    source,
    "NIGHT_SHIFT_HOTEL_BUYER_TARGET",
  );
  const NIGHT_SHIFT_DAILY_AI_BUDGET_GBP = readOptionalNumber(
    source,
    "NIGHT_SHIFT_DAILY_AI_BUDGET_GBP",
  );
  const NIGHT_SHIFT_MONTHLY_AI_BUDGET_GBP = readOptionalNumber(
    source,
    "NIGHT_SHIFT_MONTHLY_AI_BUDGET_GBP",
  );
  const PUBLIC_BUSINESS_DATA_API_URL = readOptionalUrl(
    source,
    "PUBLIC_BUSINESS_DATA_API_URL",
  );
  const PUBLIC_BUSINESS_DATA_API_KEY = readOptional(
    source,
    "PUBLIC_BUSINESS_DATA_API_KEY",
  );
  const PUBLIC_BUSINESS_DATA_RATE_LIMIT_PER_MINUTE = readOptionalInt(
    source,
    "PUBLIC_BUSINESS_DATA_RATE_LIMIT_PER_MINUTE",
  );
  const SLACK_WEBHOOK_URL = readOptionalUrl(source, "SLACK_WEBHOOK_URL");

  if (
    AI_PRIMARY_PROVIDER &&
    !aiProviderValues.includes(AI_PRIMARY_PROVIDER as AiProvider)
  ) {
    throw new Error(
      `AI_PRIMARY_PROVIDER must be one of: ${aiProviderValues.join(", ")}.`,
    );
  }

  if (AI_PROVIDER && !aiProviderValues.includes(AI_PROVIDER as AiProvider)) {
    throw new Error(
      `AI_PROVIDER must be one of: ${aiProviderValues.join(", ")}.`,
    );
  }

  const resolvedPrimaryProvider =
    (AI_PRIMARY_PROVIDER as AiProvider | undefined) ??
    (AI_PROVIDER as AiProvider | undefined);

  if (
    AI_FALLBACK_PROVIDER &&
    !aiProviderValues.includes(AI_FALLBACK_PROVIDER as AiProvider)
  ) {
    throw new Error(
      `AI_FALLBACK_PROVIDER must be one of: ${aiProviderValues.join(", ")}.`,
    );
  }

  if (
    resolvedPrimaryProvider &&
    AI_FALLBACK_PROVIDER &&
    resolvedPrimaryProvider === AI_FALLBACK_PROVIDER
  ) {
    throw new Error("AI_FALLBACK_PROVIDER must be different from AI_PROVIDER.");
  }

  if (resolvedPrimaryProvider === "openai" && !OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required when AI_PROVIDER=openai.",
    );
  }

  if (resolvedPrimaryProvider === "gemini" && !GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is required when AI_PROVIDER=gemini.",
    );
  }

  const openAiEnabled =
    resolvedPrimaryProvider === "openai" || AI_FALLBACK_PROVIDER === "openai";
  const geminiEnabled =
    resolvedPrimaryProvider === "gemini" || AI_FALLBACK_PROVIDER === "gemini";

  if (OPENAI_API_KEY && !openAiEnabled) {
    throw new Error(
      "AI_PROVIDER or AI_FALLBACK_PROVIDER must be openai when OPENAI_API_KEY is provided.",
    );
  }

  if (GEMINI_API_KEY && !geminiEnabled) {
    throw new Error(
      "AI_PROVIDER or AI_FALLBACK_PROVIDER must be gemini when GEMINI_API_KEY is provided.",
    );
  }

  if (
    Boolean(PUBLIC_BUSINESS_DATA_API_URL) !==
    Boolean(PUBLIC_BUSINESS_DATA_API_KEY)
  ) {
    throw new Error(
      "PUBLIC_BUSINESS_DATA_API_URL and PUBLIC_BUSINESS_DATA_API_KEY must be configured together.",
    );
  }

  if (Boolean(AUTH_LOCAL_ADMIN_USERNAME) !== Boolean(AUTH_LOCAL_ADMIN_PASSWORD)) {
    throw new Error(
      "AUTH_LOCAL_ADMIN_USERNAME and AUTH_LOCAL_ADMIN_PASSWORD must be configured together.",
    );
  }

  return {
    NODE_ENV,
    APP_NAME,
    APP_ENV,
    AUTH_SECRET,
    AUTH_MICROSOFT_ENTRA_ID_ID,
    AUTH_MICROSOFT_ENTRA_ID_SECRET,
    AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    AUTH_ADMIN_EMAILS,
    AUTH_MANAGER_EMAILS,
    AUTH_LOCAL_ADMIN_USERNAME,
    AUTH_LOCAL_ADMIN_PASSWORD,
    DATABASE_URL,
    STORAGE_ROOT,
    AI_PRIMARY_PROVIDER: resolvedPrimaryProvider,
    AI_PROVIDER: AI_PROVIDER as AiProvider | undefined,
    AI_FALLBACK_PROVIDER: AI_FALLBACK_PROVIDER as AiProvider | undefined,
    AI_MODEL,
    OPENAI_CHEAP_MODEL,
    OPENAI_STANDARD_MODEL,
    OPENAI_REASONING_MODEL,
    OPENAI_API_KEY,
    GEMINI_API_KEY,
    NIGHT_SHIFT_RESIDENTIAL_STOCK_TARGET,
    NIGHT_SHIFT_RESIDENTIAL_DEMAND_TARGET,
    NIGHT_SHIFT_HOTEL_SELLER_TARGET,
    NIGHT_SHIFT_HOTEL_BUYER_TARGET,
    NIGHT_SHIFT_DAILY_AI_BUDGET_GBP,
    NIGHT_SHIFT_MONTHLY_AI_BUDGET_GBP,
    PUBLIC_BUSINESS_DATA_API_URL,
    PUBLIC_BUSINESS_DATA_API_KEY,
    PUBLIC_BUSINESS_DATA_RATE_LIMIT_PER_MINUTE,
    SLACK_WEBHOOK_URL,
  };
}

export const appEnv = loadAppEnv();
