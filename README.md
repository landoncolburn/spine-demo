# hookline

Signed webhook delivery for small services. Hookline sends each event as a JSON `POST`, signed with the subscriber's shared secret, retries the failures worth retrying, and tells you what happened.

This repository is a sample project for [Spine](https://spinepr.app), an iPhone app for reviewing pull requests. Its open pull request is the one Spine opens for new users.

## Use

```ts
import { loadConfig, Sender } from "hookline";

const sender = new Sender(loadConfig());
const result = await sender.send({
  id: "dlv_1",
  url: "https://example.com/hooks",
  event: "order.paid",
  payload: { orderId: 42 },
  secret: process.env.SUBSCRIBER_SECRET!,
});
```

## Verifying a delivery

Each request carries `x-hookline-timestamp` and `x-hookline-signature`. The signature is `sha256=` followed by the HMAC-SHA256 of `<timestamp>.<body>` in hex. `verify()` checks it in constant time.

## Retries

A delivery is tried again after a network error, a timeout, a 408, a 429 or any 5xx answer. Any other 4xx means the request itself is wrong, so it isn't. Waits grow exponentially with full jitter, and a subscriber's `Retry-After` is honoured when it asks for longer, up to the cap. Each attempt is signed afresh, so its timestamp is current. The result says how many attempts it took.

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `HOOKLINE_TIMEOUT_MS` | 10000 | How long one request may take |
| `HOOKLINE_USER_AGENT` | `hookline/0.4` | The User-Agent sent with each delivery |
| `HOOKLINE_MAX_ATTEMPTS` | 5 | Attempts in all, the first included |
| `HOOKLINE_RETRY_BASE_MS` | 500 | The longest wait before the second attempt; it doubles each time |
| `HOOKLINE_RETRY_MAX_MS` | 30000 | No wait is longer than this |

## Develop

```sh
npm install
npm test
npm run typecheck
```
