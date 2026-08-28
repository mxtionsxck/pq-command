import type {
  SourceConnector,
  SourceConnectorContext,
} from "@/domain/source/connector";
import { appEnv } from "@/lib/env";

import { createRateLimiter } from "./utils/rate-limit";
import { retryWithBackoff } from "./utils/retry";

type BusinessApiRecord = {
  id: string;
  name?: string;
  company_number?: string;
  registered_address?: string;
  postcode?: string;
  city?: string;
  sic_codes?: string[];
  officers?: Array<{ name?: string; role?: string }>;
  updated_at?: string;
};

type ConnectorRecord = {
  id: string;
  name: string;
  companyNumber: string;
  city: string;
  postcode: string;
  sicCodes: string[];
  officerName: string | null;
  updatedAt: Date;
};

const defaultAllowedFields = [
  "id",
  "name",
  "company_number",
  "postcode",
  "city",
  "sic_codes",
  "officers",
  "updated_at",
] as const;

function readAllowedFieldSet(context: SourceConnectorContext) {
  const requested = context.allowedData
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (requested.length === 0) {
    return new Set<string>(defaultAllowedFields);
  }

  return new Set<string>(
    requested.filter((field) => defaultAllowedFields.includes(field as never)),
  );
}

function buildFetchUrl(baseUrl: string, context: SourceConnectorContext) {
  const url = new URL(baseUrl);
  url.searchParams.set("limit", "25");
  url.searchParams.set("sourceId", context.sourceId);
  return url.toString();
}

function mapRecord(
  record: BusinessApiRecord,
  allowed: Set<string>,
): ConnectorRecord {
  return {
    id: allowed.has("id") ? record.id : "",
    name: allowed.has("name")
      ? (record.name ?? "Unknown business")
      : "Unknown business",
    companyNumber: allowed.has("company_number")
      ? (record.company_number ?? "")
      : "",
    city: allowed.has("city") ? (record.city ?? "") : "",
    postcode: allowed.has("postcode") ? (record.postcode ?? "") : "",
    sicCodes: allowed.has("sic_codes") ? (record.sic_codes ?? []) : [],
    officerName:
      allowed.has("officers") && Array.isArray(record.officers)
        ? (record.officers[0]?.name ?? null)
        : null,
    updatedAt:
      allowed.has("updated_at") && record.updated_at
        ? new Date(record.updated_at)
        : new Date(),
  };
}

function buildFetcher(apiKey: string) {
  return async (url: string) => {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Business API failure (${response.status}).`);
    }

    return (await response.json()) as { records?: BusinessApiRecord[] };
  };
}

export function createPublicBusinessDataConnector(
  options: {
    fetcher?: (url: string) => Promise<{ records?: BusinessApiRecord[] }>;
    baseUrl?: string;
    env?: {
      PUBLIC_BUSINESS_DATA_API_URL?: string;
      PUBLIC_BUSINESS_DATA_API_KEY?: string;
    };
  } = {},
): SourceConnector<BusinessApiRecord, ConnectorRecord> {
  const env = options.env ?? appEnv;
  const apiKey = env.PUBLIC_BUSINESS_DATA_API_KEY;
  const baseUrl = options.baseUrl ?? env.PUBLIC_BUSINESS_DATA_API_URL;

  return {
    async discover(context) {
      if (!apiKey || !baseUrl) {
        throw new Error(
          "PUBLIC_BUSINESS_DATA_API_KEY and PUBLIC_BUSINESS_DATA_API_URL are required.",
        );
      }

      const allowedFields = readAllowedFieldSet(context);
      const fetcher = options.fetcher ?? buildFetcher(apiKey);
      const limiter = createRateLimiter({
        maxRequestsPerMinute: Math.max(1, context.rateLimitPerMinute),
      });
      await limiter.consume();

      const payload = await retryWithBackoff({
        maxRetries: 2,
        baseDelayMs: 200,
        operation: () => fetcher(buildFetchUrl(baseUrl, context)),
      });

      return (payload.records ?? []).map((item) => {
        const limited = mapRecord(item, allowedFields);
        return {
          id: limited.id,
          name: limited.name,
          company_number: limited.companyNumber,
          city: limited.city,
          postcode: limited.postcode,
          sic_codes: limited.sicCodes,
          officers: limited.officerName ? [{ name: limited.officerName }] : [],
          updated_at: limited.updatedAt.toISOString(),
        } satisfies BusinessApiRecord;
      });
    },

    async healthCheck(context) {
      try {
        await this.discover({
          ...context,
          allowedData: ["id"],
        });

        return {
          healthy: true,
          message: "Public business data connector healthy.",
          checkedAt: new Date(),
        };
      } catch (error) {
        return {
          healthy: false,
          message:
            error instanceof Error ? error.message : "Connector unhealthy.",
          checkedAt: new Date(),
        };
      }
    },

    normalise(record) {
      return {
        id: record.id,
        name: record.name ?? "Unknown business",
        companyNumber: record.company_number ?? "",
        city: record.city ?? "",
        postcode: record.postcode ?? "",
        sicCodes: record.sic_codes ?? [],
        officerName: record.officers?.[0]?.name ?? null,
        updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(),
      };
    },

    rateLimitPolicy(context) {
      return {
        maxRequestsPerMinute: Math.max(1, context.rateLimitPerMinute),
        burst: 1,
      };
    },

    provenance(record) {
      return {
        sourceName: "approved-public-business-data-api",
        externalId: record.id,
        capturedAt: record.updated_at
          ? new Date(record.updated_at)
          : new Date(),
        note: "Public business dataset record",
      };
    },
  };
}
