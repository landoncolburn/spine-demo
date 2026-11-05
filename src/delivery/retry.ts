import type { DeliveryResult } from "./types.ts";

export interface RetryPolicy {
  /** Attempts in all, the first one included. */
  maxAttempts: number;
  /** The delay before the second attempt; each later one doubles it. */
  baseDelayMs: number;
  /** No wait is longer than this, Retry-After included. */
  maxDelayMs: number;
}

/**
 * Whether a failed attempt is worth repeating. Network errors, timeouts, 408, 429
 * and 5xx answers are; any other 4xx means the request itself is wrong and will
 * fail the same way again.
 */
export function isRetryable(result: DeliveryResult): boolean {
  if (result.ok) return false;
  if (result.status === null) return true;
  return result.status === 408 || result.status === 429 || result.status >= 500;
}

/**
 * How long to wait before attempt `attempt + 1`, after `attempt` attempts have
 * failed. Exponential backoff with full jitter, so subscribers coming back from
 * an outage aren't hit by every sender at once. A Retry-After from the
 * subscriber wins when it's longer, up to the cap.
 */
export function backoffDelay(
  policy: RetryPolicy,
  attempt: number,
  retryAfterSeconds?: number,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
  const jittered = Math.floor(random() * ceiling);
  if (retryAfterSeconds === undefined) return jittered;
  return Math.min(policy.maxDelayMs, Math.max(jittered, retryAfterSeconds * 1000));
}
