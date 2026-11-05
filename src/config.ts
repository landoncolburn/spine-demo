import type { RetryPolicy } from "./delivery/retry.ts";

export interface Config {
  /** How long one request may take before it's abandoned. */
  timeoutMs: number;
  /** Sent as the User-Agent on every delivery. */
  userAgent: string;
  /** When and how often a failed delivery is tried again. */
  retry: RetryPolicy;
}

export const defaults: Config = {
  timeoutMs: 10_000,
  userAgent: "hookline/0.4",
  retry: { maxAttempts: 5, baseDelayMs: 500, maxDelayMs: 30_000 },
};

/** Reads overrides from the environment, falling back to the defaults. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    timeoutMs: readInt(env.HOOKLINE_TIMEOUT_MS, defaults.timeoutMs),
    userAgent: env.HOOKLINE_USER_AGENT ?? defaults.userAgent,
    retry: {
      maxAttempts: readInt(env.HOOKLINE_MAX_ATTEMPTS, defaults.retry.maxAttempts),
      baseDelayMs: readInt(env.HOOKLINE_RETRY_BASE_MS, defaults.retry.baseDelayMs),
      maxDelayMs: readInt(env.HOOKLINE_RETRY_MAX_MS, defaults.retry.maxDelayMs),
    },
  };
}

function readInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
