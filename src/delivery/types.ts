/** One event to send to one subscriber's endpoint. */
export interface Delivery {
  id: string;
  url: string;
  event: string;
  payload: unknown;
  /** The subscriber's shared secret, used to sign the body. */
  secret: string;
}

/** What happened when a delivery was sent. */
export interface DeliveryResult {
  id: string;
  ok: boolean;
  status: number | null;
  error?: string;
  /** How many requests it took, retries included. */
  attempts: number;
  /** The subscriber's Retry-After, in seconds, when it sent one. */
  retryAfterSeconds?: number;
  durationMs: number;
}

/** Sends one HTTP request; swapped out in tests. */
export type Transport = (
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ status: number; retryAfterSeconds?: number }>;
