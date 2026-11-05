import { createHmac, timingSafeEqual } from "node:crypto";

/** The signature header's value for a body: `sha256=` and the HMAC in hex. */
export function sign(secret: string, timestamp: number, body: string): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `sha256=${mac}`;
}

/** Checks a signature the way a subscriber should, in constant time. */
export function verify(secret: string, timestamp: number, body: string, signature: string): boolean {
  const expected = Buffer.from(sign(secret, timestamp, body));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
