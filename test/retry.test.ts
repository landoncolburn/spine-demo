import assert from "node:assert/strict";
import { test } from "node:test";
import { backoffDelay, isRetryable, type RetryPolicy } from "../src/delivery/retry.ts";
import type { DeliveryResult } from "../src/delivery/types.ts";

const policy: RetryPolicy = { maxAttempts: 5, baseDelayMs: 500, maxDelayMs: 30_000 };

function failed(status: number | null): DeliveryResult {
  return { id: "dlv_1", ok: false, status, attempts: 1, durationMs: 1 };
}

test("network errors, timeouts, 429 and 5xx are retried", () => {
  for (const status of [null, 408, 429, 500, 502, 503]) {
    assert.equal(isRetryable(failed(status)), true, `status ${status}`);
  }
});

test("other 4xx answers and successes are not", () => {
  for (const status of [400, 401, 404, 410, 422]) {
    assert.equal(isRetryable(failed(status)), false, `status ${status}`);
  }
  assert.equal(isRetryable({ ...failed(200), ok: true }), false);
});

test("the ceiling doubles with each attempt", () => {
  const top = () => 0.999999;
  assert.equal(backoffDelay(policy, 1, undefined, top), 499);
  assert.equal(backoffDelay(policy, 2, undefined, top), 999);
  assert.equal(backoffDelay(policy, 3, undefined, top), 1999);
});

test("the delay never passes the cap", () => {
  assert.equal(backoffDelay(policy, 20, undefined, () => 0.999999), 29_999);
});

test("a longer Retry-After wins, up to the cap", () => {
  const none = () => 0;
  assert.equal(backoffDelay(policy, 1, 3, none), 3_000);
  assert.equal(backoffDelay(policy, 1, 120, none), 30_000);
});
