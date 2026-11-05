import assert from "node:assert/strict";
import { test } from "node:test";
import { defaults } from "../src/config.ts";
import { Sender } from "../src/delivery/sender.ts";
import { verify } from "../src/delivery/signing.ts";
import type { Delivery, Transport } from "../src/delivery/types.ts";

const delivery: Delivery = {
  id: "dlv_1",
  url: "https://example.test/hooks",
  event: "order.paid",
  payload: { orderId: 42 },
  secret: "s3cret",
};

/** A sender that doesn't wait between attempts, and records what it would have waited. */
function sender(transport: Transport) {
  const waits: number[] = [];
  const instance = new Sender(defaults, {
    transport,
    sleep: async (ms) => {
      waits.push(ms);
    },
  });
  return { instance, waits };
}

/** Answers with each status in turn, then keeps answering with the last. */
function answers(...statuses: number[]): Transport & { calls: number } {
  const transport = Object.assign(
    async () => ({ status: statuses[Math.min(transport.calls++, statuses.length - 1)] }),
    { calls: 0 },
  );
  return transport;
}

test("a 2xx answer is a success", async () => {
  const { instance } = sender(answers(204));
  const result = await instance.send(delivery);
  assert.equal(result.ok, true);
  assert.equal(result.status, 204);
  assert.equal(result.attempts, 1);
});

test("the body is signed with the subscriber's secret", async () => {
  let seen: { headers: Record<string, string>; body: string } | undefined;
  const { instance } = sender(async (_url, init) => {
    seen = init;
    return { status: 200 };
  });
  await instance.send(delivery);
  assert.ok(seen);
  const timestamp = Number(seen.headers["x-hookline-timestamp"]);
  assert.ok(verify("s3cret", timestamp, seen.body, seen.headers["x-hookline-signature"]));
});

test("a network error is reported, not thrown", async () => {
  const { instance } = sender(async () => {
    throw new Error("connection refused");
  });
  const result = await instance.send(delivery);
  assert.equal(result.ok, false);
  assert.equal(result.status, null);
  assert.equal(result.error, "connection refused");
  assert.equal(result.attempts, defaults.retry.maxAttempts);
});

test("a 503 is retried until the subscriber recovers", async () => {
  const transport = answers(503, 503, 200);
  const { instance, waits } = sender(transport);
  const result = await instance.send(delivery);
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3);
  assert.equal(transport.calls, 3);
  assert.equal(waits.length, 2);
});

test("a 400 is not retried", async () => {
  const transport = answers(400);
  const { instance, waits } = sender(transport);
  const result = await instance.send(delivery);
  assert.equal(result.ok, false);
  assert.equal(result.attempts, 1);
  assert.deepEqual(waits, []);
});

test("it gives up after the last attempt", async () => {
  const transport = answers(500);
  const { instance } = sender(transport);
  const result = await instance.send(delivery);
  assert.equal(result.status, 500);
  assert.equal(transport.calls, defaults.retry.maxAttempts);
});
