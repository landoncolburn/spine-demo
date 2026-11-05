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

test("a 2xx answer is a success", async () => {
  const transport: Transport = async () => ({ status: 204 });
  const result = await new Sender(defaults, transport).send(delivery);
  assert.equal(result.ok, true);
  assert.equal(result.status, 204);
});

test("the body is signed with the subscriber's secret", async () => {
  let seen: { headers: Record<string, string>; body: string } | undefined;
  const transport: Transport = async (_url, init) => {
    seen = init;
    return { status: 200 };
  };
  await new Sender(defaults, transport).send(delivery);
  assert.ok(seen);
  const timestamp = Number(seen.headers["x-hookline-timestamp"]);
  assert.ok(verify("s3cret", timestamp, seen.body, seen.headers["x-hookline-signature"]));
});

test("a network error is reported, not thrown", async () => {
  const transport: Transport = async () => {
    throw new Error("connection refused");
  };
  const result = await new Sender(defaults, transport).send(delivery);
  assert.equal(result.ok, false);
  assert.equal(result.status, null);
  assert.equal(result.error, "connection refused");
});
