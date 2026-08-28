export interface RateLimiter {
  consume(): Promise<void>;
}

export function createRateLimiter(input: {
  maxRequestsPerMinute: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): RateLimiter {
  const now = input.now ?? (() => Date.now());
  const sleep =
    input.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const intervalMs = Math.max(
    1,
    Math.floor(60_000 / Math.max(1, input.maxRequestsPerMinute)),
  );
  let nextAllowedAt = 0;

  return {
    async consume() {
      const current = now();
      const waitMs = Math.max(0, nextAllowedAt - current);

      if (waitMs > 0) {
        await sleep(waitMs);
      }

      nextAllowedAt = Math.max(nextAllowedAt, now()) + intervalMs;
    },
  };
}
