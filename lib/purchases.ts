import "server-only";
import Razorpay from "razorpay";
import { db } from "./db";
import { FEES, type FeePurpose } from "./fees";
import {
  checkPayment,
  isFeePurpose,
  isSamePaymentConflict,
} from "./payment-validation";
import { retryTransientDb } from "./retry";

// re-exported so callers have one import site for the purchase contract
export {
  checkPayment,
  isFeePurpose,
  isSamePaymentConflict,
} from "./payment-validation";
export type {
  FetchedPayment,
  PurchaseFailure,
} from "./payment-validation";

// one SDK client for every server-side Razorpay call
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

/**
 * Fetch the payment, giving auto-capture a moment to land.
 *
 * verify-payment runs the instant the browser's checkout handler fires, which
 * can be a beat before Razorpay flips authorized → captured. Re-reading a
 * couple of times turns what would be a "payment processing" bounce into a
 * clean confirmation for the overwhelming majority of real payments.
 */
async function fetchSettledPayment(paymentId: string) {
  let payment = await razorpay.payments.fetch(paymentId);
  for (let attempt = 1; attempt < 3 && payment.status === "authorized"; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    payment = await razorpay.payments.fetch(paymentId);
  }
  return payment;
}

/**
 * Apply the side effect a purchase buys, beyond the ledger row itself.
 *
 * Only featured_property has one: the boost lives in a column on the listing.
 * Doing it here means the webhook grants it too, so a user who closes the tab
 * mid-checkout still gets what they paid for — previously this depended on the
 * browser making a follow-up PUT, and the money was simply lost if it didn't.
 *
 * Idempotent, and safe to re-run on a duplicate-payment retry.
 */
async function applyEntitlement(
  purpose: FeePurpose,
  userId: string,
  ref: string | null,
): Promise<void> {
  if (purpose !== "featured_property" || !ref) return;
  // scoped to the payer so a purchase can only boost the payer's own listing
  const { error } = await db
    .from("properties")
    .update({ featured: true })
    .eq("id", ref)
    .eq("user_id", userId);
  if (error) {
    // The ledger row is already written, so the entitlement is provable and
    // the PUT/read path will still resolve it from the ledger. Log for repair.
    console.error(
      `Featured flip failed for property ${ref} (user ${userId}):`,
      error.message,
    );
  }
}

/**
 * Record a captured payment in the purchases ledger, resolving purpose/user/ref
 * from the order notes written by create-order. Shared by verify-payment and
 * the Razorpay webhook so the ledger contract lives in one place.
 *
 * The payment itself is re-fetched from Razorpay and checked (captured, right
 * amount, right currency, right order) before anything is granted — the order
 * alone only proves what we asked for, not what was actually paid.
 *
 * Returns null on success; a duplicate of the *same* payment counts as success.
 * A duplicate that trips an entitlement index instead means a second, distinct
 * payment was captured for something already owned: that is money we owe back,
 * so it is logged loudly rather than swallowed. Throws if a Razorpay lookup fails.
 */
export async function recordPurchaseFromOrder(
  orderId: string,
  paymentId: string,
  fallbackUserId?: string | null,
): Promise<{ error: string; status: number } | null> {
  const order = await razorpay.orders.fetch(orderId);
  const notes = (order.notes ?? {}) as {
    purpose?: string;
    userId?: string;
    ref?: string;
  };
  const userId = notes.userId || fallbackUserId;
  if (!notes.purpose || !userId) {
    return { error: "no user for purchase", status: 400 };
  }
  // notes are echoed back from Razorpay; never trust them as a fee purpose
  if (!isFeePurpose(notes.purpose)) {
    console.error(
      `Unknown purpose "${notes.purpose}" on order ${orderId} — refusing to record`,
    );
    return { error: "unknown purchase purpose", status: 400 };
  }
  const purpose = notes.purpose;
  // verify-payment: the paying session must match the order's owner so one
  // user can't confirm another's order (ledger grief/confirm oracle)
  if (fallbackUserId && notes.userId && notes.userId !== fallbackUserId) {
    return { error: "order belongs to another user", status: 403 };
  }

  // Confirm the money actually landed, for the right amount, on this order.
  // Without this an authorized-but-uncaptured payment (which auto-voids after
  // a few days) would buy a permanent entitlement.
  const payment = await fetchSettledPayment(paymentId);
  const mismatch = checkPayment(payment, {
    orderId,
    purpose,
    paymentId,
    expectedAmount: FEES[purpose],
  });
  if (mismatch) return mismatch;

  const { error } = await retryTransientDb(() =>
    db.from("purchases").insert({
      user_id: userId,
      purpose,
      ref: notes.ref || null,
      order_id: orderId,
      payment_id: paymentId,
      amount: Number(payment.amount),
    }),
  );

  if (error?.code === "23505") {
    // Same payment recorded twice: the idempotency case, already settled.
    // Re-apply the entitlement anyway — the first attempt may have died
    // between the insert and the grant.
    if (isSamePaymentConflict(error)) {
      await applyEntitlement(purpose, userId, notes.ref || null);
      return null;
    }
    // Different payment, same entitlement: the user was charged again for
    // something they already own. The ledger correctly refuses the row, but
    // this payment is unreconciled and owed back.
    console.error(
      `DUPLICATE CHARGE: payment ${paymentId} (order ${orderId}, user ${userId}, ` +
        `${purpose}, ${FEES[purpose]} paise) was captured for an entitlement already ` +
        `held. Not recorded — refund required. Constraint: ${error.message}`,
    );
    return { error: "already purchased", status: 409 };
  }

  if (error) {
    const unavailable = error.message.includes("fetch failed");
    console.error("Purchase ledger insert failed:", error.message);
    return {
      error: unavailable ? "purchase service unavailable" : "internal error",
      status: unavailable ? 503 : 500,
    };
  }

  await applyEntitlement(purpose, userId, notes.ref || null);
  return null;
}
