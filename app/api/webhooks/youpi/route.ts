import { recordPurchase } from "@/lib/purchases";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { readBodyCapped } from "@/lib/request";
import { verifyWebhookSignature, type YoupiWebhookEvent } from "@/lib/youpi";

/**
 * Failures that retrying the same delivery cannot change: the payment is
 * not SUCCESS / wrong amount / already owned / still pending (the gateway
 * will send a fresh SUCCESS event when it settles). Acknowledge with 200 so
 * the gateway stops redelivering; only genuine 5xx (our DB, our config,
 * their API) stays non-2xx to trigger a retry.
 */
const NON_RETRYABLE = new Set([202, 400, 402, 409]);

/**
 * A gateway event is a few hundred bytes. Anything past this is not ours,
 * and is refused before it is buffered in full or hashed.
 */
const MAX_WEBHOOK_BYTES = 64 * 1024;

/**
 * Strict UTF-8, BOM kept: decoding is then lossless, so the string handed to
 * verifyWebhookSignature re-encodes to exactly the bytes the gateway signed.
 */
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/**
 * YouPI-PG merchant webhook. Configure the gateway's merchant webhook URL to
 * point here; it signs every delivery with HMAC-SHA256(webhookSecret, body)
 * in `X-Gateway-Signature`.
 *
 * Only SUCCESS grants anything, and even then the session is re-fetched from
 * the gateway before the ledger is touched — the body is a hint, not proof.
 */
export async function POST(request: Request) {
  // Unauthenticated endpoint: throttle per source before doing HMAC work.
  if (!(await checkRateLimit(ipKey(request, "webhook"), 120, 60_000))) {
    return rateLimitedResponse();
  }

  const signature = request.headers.get("x-gateway-signature");
  if (!signature) {
    return Response.json({ error: "missing signature" }, { status: 400 });
  }

  const secret = process.env.YOUPI_WEBHOOK_SECRET;
  if (!secret) {
    console.error("YOUPI_WEBHOOK_SECRET unset");
    return Response.json({ error: "webhook not configured" }, { status: 500 });
  }

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_WEBHOOK_BYTES) {
    return Response.json({ error: "body too large" }, { status: 413 });
  }
  let raw: Uint8Array | null;
  try {
    raw = await readBodyCapped(request, MAX_WEBHOOK_BYTES);
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  if (!raw) return Response.json({ error: "body too large" }, { status: 413 });
  let body: string;
  try {
    body = utf8.decode(raw);
  } catch {
    // not UTF-8, so not a gateway event; a lossy decode would also break the HMAC
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  if (!verifyWebhookSignature(body, signature, secret)) {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: YoupiWebhookEvent;
  try {
    event = JSON.parse(body) as YoupiWebhookEvent;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  if (!event || typeof event !== "object") {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  if (event.event !== "SUCCESS") {
    // FAILED / EXPIRED / CANCELLED: nothing to grant, nothing to roll back —
    // the ledger only ever holds completed payments.
    return Response.json({ received: true });
  }
  if (typeof event.paymentId !== "string" || !event.paymentId) {
    return Response.json({ error: "missing paymentId" }, { status: 400 });
  }

  try {
    // poll: false — the gateway only fires SUCCESS after it has settled, so
    // there is nothing to wait for here.
    const failure = await recordPurchase(event.paymentId, null, { poll: false });
    if (failure) {
      if (NON_RETRYABLE.has(failure.status)) {
        // recordPurchase already logged the specifics (incl. DUPLICATE CHARGE)
        console.warn(
          `YouPI webhook: payment ${event.paymentId} not recorded (${failure.status} ${failure.error}) — acknowledged, no retry`,
        );
        return Response.json({ received: true, outcome: failure.error });
      }
      console.error(
        `YouPI webhook: payment ${event.paymentId} failed (${failure.status} ${failure.error}) — asking gateway to retry`,
      );
      return Response.json({ error: failure.error }, { status: failure.status });
    }
  } catch (error) {
    console.error("YouPI webhook payment lookup failed:", error);
    return Response.json({ error: "payment lookup failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
