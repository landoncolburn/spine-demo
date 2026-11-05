import type { Config } from "../config.ts";
import { sign } from "./signing.ts";
import type { Delivery, DeliveryResult, Transport } from "./types.ts";

const fetchTransport: Transport = async (url, init) => {
  const response = await fetch(url, init);
  return { status: response.status };
};

export class Sender {
  private readonly config: Config;
  private readonly transport: Transport;
  private readonly now: () => number;

  constructor(config: Config, transport: Transport = fetchTransport, now: () => number = Date.now) {
    this.config = config;
    this.transport = transport;
    this.now = now;
  }

  /** Sends a delivery once and reports how it went. */
  async send(delivery: Delivery): Promise<DeliveryResult> {
    const started = this.now();
    const body = JSON.stringify({ event: delivery.event, payload: delivery.payload });
    const timestamp = Math.floor(started / 1000);
    try {
      const { status } = await this.transport(delivery.url, {
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
      return { id: delivery.id, ok: status >= 200 && status < 300, status, durationMs: this.now() - started };
    } catch (error) {
      return {
        id: delivery.id,
        ok: false,
        status: null,
        error: error instanceof Error ? error.message : String(error),
        durationMs: this.now() - started,
      };
    }
  }
}
