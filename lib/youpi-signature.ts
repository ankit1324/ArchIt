import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * YouPI-PG webhook signature check, kept free of "server-only" and env reads
 * so it can be unit-tested under `node --test` (see tests/youpi.test.mjs).
 *
 * The gateway sends `X-Gateway-Signature: sha256=<hex>` where
 * hex = HMAC-SHA256(merchant.webhookSecret, rawBody).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!signatureHeader || !secret) return false;
  const presented = signatureHeader.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-f]{64}$/i.test(presented)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(presented, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Paise → "50.00", the rupee string the gateway's create endpoint expects. */
export function paiseToRupees(paise: number): string {
  return (paise / 100).toFixed(2);
}
