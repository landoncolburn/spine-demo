# hookline

Signed webhook delivery for small services. Hookline sends each event as a JSON `POST`, signed with the subscriber's shared secret, and tells you what happened.

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

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `HOOKLINE_TIMEOUT_MS` | 10000 | How long one request may take |
| `HOOKLINE_USER_AGENT` | `hookline/0.3` | The User-Agent sent with each delivery |

## Develop

```sh
npm install
npm test
npm run typecheck
```
