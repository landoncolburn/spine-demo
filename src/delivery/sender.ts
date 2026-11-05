import { setTimeout as sleepFor } from "node:timers/promises";
import type { Config } from "../config.ts";
import { backoffDelay, isRetryable } from "./retry.ts";
import { sign } from "./signing.ts";
import type { Delivery, DeliveryResult, Transport } from "./types.ts";

const fetchTransport: Transport = async (url, init) => {
  const response = await fetch(url, init);
  return { status: response.status, retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")) };
};

/** Retry-After in seconds; the HTTP-date form is rare for webhooks and ignored. */
function parseRetryAfter(value: string | null): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : undefined;
}

export interface SenderOptions {
  transport?: Transport;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class Sender {
  private readonly config: Config;
  private readonly transport: Transport;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(config: Config, options: SenderOptions = {}) {
    this.config = config;
    this.transport = options.transport ?? fetchTransport;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => sleepFor(ms));
  }

  /**
   * Sends a delivery, trying again with backoff while the failure is worth
   * retrying, and reports the last attempt. Every attempt is signed afresh, so
   * its timestamp is current when the subscriber checks it.
   */
  async send(delivery: Delivery): Promise<DeliveryResult> {
    const started = this.now();
    const { retry } = this.config;
    let result = await this.attempt(delivery);
    let attempts = 1;
    while (attempts < retry.maxAttempts && isRetryable(result)) {
      await this.sleep(backoffDelay(retry, attempts, result.retryAfterSeconds));
      result = await this.attempt(delivery);
      attempts += 1;
    }
    return { ...result, attempts, durationMs: this.now() - started };
  }

  private async attempt(delivery: Delivery): Promise<DeliveryResult> {
    const started = this.now();
    const body = JSON.stringify({ event: delivery.event, payload: delivery.payload });
    const timestamp = Math.floor(started / 1000);
    try {
      const { status, retryAfterSeconds } = await this.transport(delivery.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": this.config.userAgent,
          "x-hookline-id": delivery.id,
          "x-hookline-timestamp": String(timestamp),
          "x-hookline-signature": sign(delivery.secret, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      return {
        id: delivery.id,
        ok: status >= 200 && status < 300,
        status,
        attempts: 1,
        retryAfterSeconds,
        durationMs: this.now() - started,
      };
    } catch (error) {
      return {
        id: delivery.id,
        ok: false,
        status: null,
        error: error instanceof Error ? error.message : String(error),
        attempts: 1,
        durationMs: this.now() - started,
      };
    }
  }
}
