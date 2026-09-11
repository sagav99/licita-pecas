export type SourceHealth = 'healthy' | 'degraded' | 'paused';

export function nextSourceHealth(consecutiveFailures: number): {
  status: SourceHealth;
  retryAfterMinutes: number;
} {
  if (consecutiveFailures <= 0)
    return { status: 'healthy', retryAfterMinutes: 0 };
  if (consecutiveFailures < 3)
    return { status: 'degraded', retryAfterMinutes: 15 * consecutiveFailures };
  return {
    status: 'paused',
    retryAfterMinutes: Math.min(24 * 60, 60 * 2 ** (consecutiveFailures - 3)),
  };
}
