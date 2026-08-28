import { createRateLimiter } from "./utils/rate-limit";
import { retryWithBackoff } from "./utils/retry";

export interface DomainPolicyRecord {
  domain: string;
  permissionStatus: "APPROVED" | "REVIEW_REQUIRED" | "BLOCKED" | "DISABLED";
  robotsAllowed: boolean;
  termsAllowed: boolean;
  crawlDelayMs: number;
  maxRequestsPerMinute: number;
}

export interface WebFetchResult {
  originalUrl: string;
  canonicalUrl: string;
  domain: string;
  title: string;
  text: string;
  capturedAt: Date;
  provenance: string;
}

export interface PermittedWebFramework {
  fetchPublicPages(input: {
    sourceEnabled: boolean;
    urls: string[];
    domainRegistry: DomainPolicyRecord[];
    timeoutMs?: number;
    maxRetries?: number;
    fetcher?: (url: string, timeoutMs: number) => Promise<string>;
  }): Promise<{ records: WebFetchResult[]; errors: string[] }>;
}

function canonicaliseUrl(inputUrl: string): string {
  const url = new URL(inputUrl);
  url.hash = "";
  url.searchParams.sort();
  url.pathname =
    url.pathname.endsWith("/") && url.pathname !== "/"
      ? url.pathname.slice(0, -1)
      : url.pathname;

  return url.toString();
}

function extractSafeText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] ?? "Untitled")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  const sanitized = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title,
    text: sanitized.slice(0, 4_000),
  };
}

function defaultFetcher(url: string, timeoutMs: number) {
  return fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "PQ-Command-PublicConnector/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(timeoutMs),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Fetch failed ${response.status} for ${url}`);
    }

    return response.text();
  });
}

export function createPermittedWebFramework(): PermittedWebFramework {
  return {
    async fetchPublicPages(input) {
      if (!input.sourceEnabled) {
        return {
          records: [],
          errors: ["Source disabled."],
        };
      }

      const domainMap = new Map(
        input.domainRegistry.map((record) => [
          record.domain.toLowerCase(),
          record,
        ]),
      );
      const seen = new Set<string>();
      const records: WebFetchResult[] = [];
      const errors: string[] = [];
      const limiterByDomain = new Map<
        string,
        ReturnType<typeof createRateLimiter>
      >();
      const timeoutMs = input.timeoutMs ?? 8_000;
      const maxRetries = input.maxRetries ?? 2;
      const fetcher = input.fetcher ?? defaultFetcher;

      for (const rawUrl of input.urls) {
        let canonicalUrl = "";

        try {
          canonicalUrl = canonicaliseUrl(rawUrl);
          if (seen.has(canonicalUrl)) {
            continue;
          }
          seen.add(canonicalUrl);

          const parsed = new URL(canonicalUrl);
          const domain = parsed.hostname.toLowerCase();
          const policy = domainMap.get(domain);

          if (!policy) {
            errors.push(`Domain ${domain} is not registered.`);
            continue;
          }

          if (
            policy.permissionStatus === "BLOCKED" ||
            policy.permissionStatus === "REVIEW_REQUIRED"
          ) {
            errors.push(
              `Domain ${domain} is not permitted: ${policy.permissionStatus}.`,
            );
            continue;
          }

          if (policy.permissionStatus === "DISABLED") {
            errors.push(`Domain ${domain} is disabled.`);
            continue;
          }

          if (!policy.robotsAllowed || !policy.termsAllowed) {
            errors.push(`Domain ${domain} policy disallows crawling.`);
            continue;
          }

          const limiter =
            limiterByDomain.get(domain) ??
            createRateLimiter({
              maxRequestsPerMinute: policy.maxRequestsPerMinute,
            });
          limiterByDomain.set(domain, limiter);
          await limiter.consume();

          if (policy.crawlDelayMs > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, policy.crawlDelayMs),
            );
          }

          const html = await retryWithBackoff({
            maxRetries,
            baseDelayMs: 250,
            operation: () => fetcher(canonicalUrl, timeoutMs),
          });
          const extracted = extractSafeText(html);

          records.push({
            originalUrl: rawUrl,
            canonicalUrl,
            domain,
            title: extracted.title,
            text: extracted.text,
            capturedAt: new Date(),
            provenance: `public_web:${domain}`,
          });
        } catch (error) {
          errors.push(
            error instanceof Error
              ? `Failed ${canonicalUrl || rawUrl}: ${error.message}`
              : `Failed ${canonicalUrl || rawUrl}: unknown error`,
          );
        }
      }

      return {
        records,
        errors,
      };
    },
  };
}
