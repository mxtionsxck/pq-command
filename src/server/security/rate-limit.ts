type RateLimitEntry = {
  windowStartedAt: number;
  count: number;
};

const store = new Map<string, RateLimitEntry>();

function nowMs() {
  return Date.now();
}

export function consumeRateLimit(input: {
  key: string;
  max: number;
  windowMs: number;
}) {
  const current = nowMs();
  const existing = store.get(input.key);

  if (!existing || current - existing.windowStartedAt >= input.windowMs) {
    store.set(input.key, {
      windowStartedAt: current,
      count: 1,
    });
    return {
      allowed: true,
      remaining: Math.max(0, input.max - 1),
    } as const;
  }

  if (existing.count >= input.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(
        (input.windowMs - (current - existing.windowStartedAt)) / 1000,
      ),
    } as const;
  }

  existing.count += 1;
  store.set(input.key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, input.max - existing.count),
  } as const;
}
