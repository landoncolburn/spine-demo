export interface Config {
  /** How long one request may take before it's abandoned. */
  timeoutMs: number;
  /** Sent as the User-Agent on every delivery. */
  userAgent: string;
}

export const defaults: Config = {
  timeoutMs: 10_000,
  userAgent: "hookline/0.3",
};

/** Reads overrides from the environment, falling back to the defaults. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    timeoutMs: readInt(env.HOOKLINE_TIMEOUT_MS, defaults.timeoutMs),
    userAgent: env.HOOKLINE_USER_AGENT ?? defaults.userAgent,
  };
}

function readInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
