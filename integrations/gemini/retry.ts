type RetryOptions = {
  attempts?: number;
  delaysMs?: number[];
  sleep?: (delayMs: number) => Promise<void>;
};

function statusOf(error: unknown) {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  return typeof error.status === 'number' ? error.status : null;
}

export function isRetryableGeminiError(error: unknown) {
  return [429, 502, 503, 504].includes(statusOf(error) ?? 0);
}

export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delays = options.delaysMs ?? [500, 1_500];
  const sleep =
    options.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error) || attempt === attempts - 1)
        throw error;
      await sleep(delays[Math.min(attempt, delays.length - 1)] ?? 0);
    }
  }
  throw lastError;
}
