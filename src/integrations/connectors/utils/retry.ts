export async function retryWithBackoff<T>(input: {
  maxRetries: number;
  baseDelayMs: number;
  operation: () => Promise<T>;
  shouldRetry?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}): Promise<T> {
  const shouldRetry = input.shouldRetry ?? (() => true);
  const sleep =
    input.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= input.maxRetries) {
    try {
      return await input.operation();
    } catch (error) {
      lastError = error;

      if (attempt >= input.maxRetries || !shouldRetry(error)) {
        break;
      }

      const delay = input.baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
      attempt += 1;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Retry failed with unknown error.");
}
