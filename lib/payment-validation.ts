import type { FeePurpose } from "./fees";

/**
 * Pure payment-validation decisions. This module deliberately has NO runtime
 * imports — the FeePurpose import above is type-only and erased — so the money
 * logic can be unit-tested directly under `node --test` without standing up
 * Razorpay, Supabase or "server-only". lib/purchases.ts owns the I/O.
 */

/** The ledger's idempotency key — a conflict here is the same money twice. */
export const PAYMENT_ID_CONSTRAINT = "purchases_payment_id_key";

/**
 * Valid fee purposes, mirroring FeePurpose in ./fees. Duplicated as a runtime
 * value (rather than importing FEES) to keep this module import-free; the
 * `satisfies` check below fails the build if the two ever drift apart.
 */
export const FEE_PURPOSES = [
  "contact_owner",
  "featured_property",
  "builder_unlock",
] as const satisfies readonly FeePurpose[];

export function isFeePurpose(value: string): value is FeePurpose {
  // A plain array lookup, not `key in FEES`: purpose arrives from Razorpay
  // order notes, and `"toString" in FEES` would otherwise be true.
  return (FEE_PURPOSES as readonly string[]).includes(value);
}

/** Minimal shape of a fetched Razorpay payment that we actually gate on. */
export interface FetchedPayment {
  order_id?: string | null;
  status?: string;
  amount?: string | number;
  currency?: string;
}

export type PurchaseFailure = { error: string; status: number };

/**
 * Does this payment actually match what was ordered? Returns null when good.
 *
 * The order alone only proves what we asked for, never what was paid — without
 * this, an authorized-but-uncaptured payment (which auto-voids after a few days)
 * would buy a permanent entitlement.
 */
export function checkPayment(
  payment: FetchedPayment,
  expected: {
    orderId: string;
    purpose: FeePurpose;
    paymentId: string;
    /** FEES[purpose], passed in so this module stays import-free */
    expectedAmount: number;
  },
): PurchaseFailure | null {
  const { orderId, purpose, paymentId, expectedAmount } = expected;

  if (payment.order_id !== orderId) {
    console.error(
      `Payment ${paymentId} belongs to order ${payment.order_id}, not ${orderId}`,
    );
    return { error: "payment does not match order", status: 400 };
  }
  if (payment.status !== "captured") {
    // "authorized" is a live payment mid-auto-capture, not a failure: the
    // webhook will finish it. 202 keeps the client from showing a scary
    // "could not be confirmed" alert (and from paying a second time) for
    // money that is about to settle. Anything else really is not paid.
    if (payment.status === "authorized") {
      console.warn(
        `Payment ${paymentId} still authorized, awaiting capture — deferring ${purpose} to the webhook`,
      );
      return { error: "payment processing", status: 202 };
    }
    console.error(
      `Payment ${paymentId} is "${payment.status}", not captured — not granting ${purpose}`,
    );
    return { error: "payment not captured", status: 402 };
  }
  if (Number(payment.amount) !== expectedAmount) {
    console.error(
      `Payment ${paymentId} amount ${payment.amount} != expected ${expectedAmount} for ${purpose}`,
    );
    return { error: "payment amount mismatch", status: 400 };
  }
  if (payment.currency !== "INR") {
    console.error(`Payment ${paymentId} currency ${payment.currency} != INR`);
    return { error: "payment currency mismatch", status: 400 };
  }
  return null;
}

/**
 * Given a 23505 unique violation, was it our idempotency key (the same payment
 * arriving twice, which is fine) or an entitlement index (a second, distinct
 * payment for something already owned, which is money owed back)?
 *
 * Wrong in either direction costs money: too loose and duplicate charges vanish
 * silently, too strict and a normal verify/webhook race 500s.
 */
export function isSamePaymentConflict(error: {
  message: string;
  details?: string | null;
}): boolean {
  return `${error.message} ${error.details ?? ""}`.includes(
    PAYMENT_ID_CONSTRAINT,
  );
}
