import "server-only";
import { paiseToRupees } from "./youpi-signature";

export { paiseToRupees, verifyWebhookSignature } from "./youpi-signature";

/**
 * Thin server-side client for a self-hosted YouPI-PG gateway
 * (https://github.com/youpi-pg/YouPI-PG). Two calls, no SDK dependency:
 *
 *   POST /api/v1/payments        — open a checkout session for a fixed amount
 *   GET  /api/v1/payments/:id    — read status + our metadata back
 *
 * The gateway authenticates merchants with one shared secret: it signs the
 * webhooks and, sent as `X-Merchant-Key`, unlocks the private view of
 * GET /payments/:id (the only view that returns `metadata`). It never reaches
 * the browser — the client only receives a `checkoutUrl` to embed.
 */

export const YOUPI_TERMINAL = ["SUCCESS", "FAILED", "EXPIRED", "CANCELLED"] as const;

export interface YoupiPayment {
  paymentId: string;
  orderId: string;
  /** Rupees, "50.00" */
  amount: string;
  /** Paise as a string, "5000" */
  amountPaise: string;
  currency: string;
  /** INITIATED | ACTIVE | QUEUED | PROCESSING | SUCCESS | FAILED | EXPIRED | CANCELLED */
  status: string;
  checkoutUrl?: string;
  completedAt?: string | null;
  /** Only present when the request carried a valid X-Merchant-Key. */
  metadata?: Record<string, unknown>;
}

export interface YoupiWebhookEvent {
  event: "SUCCESS" | "FAILED" | "EXPIRED" | "CANCELLED" | string;
  paymentId: string;
  orderId: string;
  amount?: string;
  amountPaise?: number | string;
  currency?: string;
  utr?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} unset`);
  return v.replace(/\/+$/, "");
}

/** Payment API base, e.g. https://pay.example.com (no trailing slash). */
export function youpiApiUrl(): string {
  return requireEnv("YOUPI_API_URL");
}

/** Checkout portal base (serves /youpi.js and /checkout/:id). Defaults to the API URL. */
export function youpiPortalUrl(): string {
  return (
    process.env.NEXT_PUBLIC_YOUPI_PORTAL_URL ||
    process.env.YOUPI_API_URL ||
    ""
  ).replace(/\/+$/, "");
}

function merchantHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Proves we own the merchant: gates the private GET view (metadata) and,
    // when the gateway is configured to require it, payment creation.
    "X-Merchant-Key": requireEnv("YOUPI_WEBHOOK_SECRET"),
  };
  const merchantId = process.env.YOUPI_MERCHANT_ID;
  if (merchantId) headers["X-Merchant-Id"] = merchantId;
  return headers;
}

export class YoupiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "YoupiError";
  }
}

/** Per-call ceiling on gateway round-trips; a hung gateway must not hang us. */
export const YOUPI_TIMEOUT_MS = 8_000;

function isTimeout(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e.name === "TimeoutError" || e.name === "AbortError")
  );
}

/** fetch with a timeout; TimeoutError/AbortError surface as YoupiError 504. */
async function gatewayFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(YOUPI_TIMEOUT_MS) });
  } catch (e) {
    if (isTimeout(e)) throw new YoupiError("gateway timeout", 504);
    throw e;
  }
}

async function parse<T>(res: Response, what: string): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const fromBody =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : null;
    throw new YoupiError(fromBody || `${what} failed (${res.status})`, res.status, body);
  }
  return body as T;
}

/**
 * Open a payment session. `metadata` round-trips untouched and is how
 * verify-payment / the webhook learn purpose, userId and ref — the gateway is
 * the source of truth for that, never the browser.
 */
export async function createPayment(input: {
  orderId: string;
  amountPaise: number;
  description: string;
  metadata: Record<string, string>;
  returnUrl?: string;
}): Promise<YoupiPayment> {
  const res = await gatewayFetch(`${youpiApiUrl()}/api/v1/payments`, {
    method: "POST",
    headers: { ...merchantHeaders(), "Idempotency-Key": input.orderId },
    body: JSON.stringify({
      orderId: input.orderId,
      amount: paiseToRupees(input.amountPaise),
      currency: "INR",
      description: input.description,
      metadata: input.metadata,
      ...(input.returnUrl ? { returnUrl: input.returnUrl } : {}),
    }),
    cache: "no-store",
  });
  return parse<YoupiPayment>(res, "create payment");
}

/** Read a payment back with the merchant key so `metadata` is included. */
export async function fetchPayment(paymentId: string): Promise<YoupiPayment> {
  const res = await gatewayFetch(
    `${youpiApiUrl()}/api/v1/payments/${encodeURIComponent(paymentId)}`,
    { headers: merchantHeaders(), cache: "no-store" },
  );
  return parse<YoupiPayment>(res, "fetch payment");
}
