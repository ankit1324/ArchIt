import "server-only";
import { db } from "./db";
import { FEES, type FeePurpose } from "./fees";
import {
  checkPayment,
  isFeePurpose,
  isSamePaymentConflict,
} from "./payment-validation";
import { retryTransientDb } from "./retry";
import { fetchPayment, type YoupiPayment } from "./youpi";

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

/**
 * Fetch the payment, giving the gateway's verification window a moment to land.
 *
 * verify-payment runs the instant the checkout iframe posts `payment_success`,
 * which can be a beat before the gateway flips PROCESSING → SUCCESS. Re-reading
 * a couple of times turns what would be a "payment processing" bounce into a
 * clean confirmation for the overwhelming majority of real payments.
 *
 * `poll: false` skips the re-reads: the webhook already arrives after the
 * gateway settled, so sleeping there only ties up the handler.
 */
async function fetchSettledPayment(
  paymentId: string,
  poll: boolean,
): Promise<YoupiPayment> {
  let payment = await fetchPayment(paymentId);
  for (
    let attempt = 1;
    poll &&
    attempt < 3 &&
    (payment.status === "PROCESSING" || payment.status === "ACTIVE");
    attempt++
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    payment = await fetchPayment(paymentId);
  }
  return payment;
}

/**
 * Apply the side effect a purchase buys, beyond the ledger row itself.
 *
 * Only featured_property has one: the boost lives in a column on the listing.
 * Doing it here means the webhook grants it too, so a user who closes the tab
 * mid-checkout still gets what they paid for — otherwise this would depend on
 * the browser making a follow-up PUT, and the money would be lost if it didn't.
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

function metaString(meta: Record<string, unknown> | undefined, key: string): string {
  const v = meta?.[key];
  return typeof v === "string" ? v : "";
}

/**
 * Record a successful payment in the purchases ledger, resolving
 * purpose/user/ref from the metadata written by create-order. Shared by
 * verify-payment and the YouPI webhook so the ledger contract lives in one place.
 *
 * The payment is re-fetched from the gateway with the merchant key and checked
 * (SUCCESS, right amount, right currency, right order) before anything is
 * granted — a webhook body or a browser claim alone is never trusted.
 *
 * Returns null on success; a duplicate of the *same* payment counts as success.
 * A duplicate that trips an entitlement index instead means a second, distinct
 * payment was completed for something already owned: that is money we owe back,
 * so it is logged loudly rather than swallowed. Throws if the gateway lookup fails.
 */
export async function recordPurchase(
  paymentId: string,
  fallbackUserId?: string | null,
  options: { poll?: boolean } = {},
): Promise<{ error: string; status: number } | null> {
  const payment = await fetchSettledPayment(paymentId, options.poll ?? true);
  const orderId = payment.orderId;
  const meta = payment.metadata;
  if (!meta) {
    // Public view only: the merchant key was rejected or unset. Without
    // metadata we cannot know who paid for what — refuse rather than guess.
    console.error(`Payment ${paymentId} returned no metadata — check YOUPI_WEBHOOK_SECRET`);
    return { error: "payment metadata unavailable", status: 502 };
  }
  const rawPurpose = metaString(meta, "purpose");
  const metaUserId = metaString(meta, "userId");
  const ref = metaString(meta, "ref") || null;
  const userId = metaUserId || fallbackUserId;
  if (!rawPurpose || !userId) {
    return { error: "no user for purchase", status: 400 };
  }
  // metadata is echoed back from the gateway; never trust it as a fee purpose
  if (!isFeePurpose(rawPurpose)) {
    console.error(
      `Unknown purpose "${rawPurpose}" on payment ${paymentId} — refusing to record`,
    );
    return { error: "unknown purchase purpose", status: 400 };
  }
  const purpose = rawPurpose;
  // verify-payment: the paying session must match the order's owner so one
  // user can't confirm another's order (ledger grief/confirm oracle)
  if (fallbackUserId && metaUserId && metaUserId !== fallbackUserId) {
    return { error: "order belongs to another user", status: 403 };
  }

  // Confirm the money actually landed, for the right amount, on this order.
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
      ref,
      order_id: orderId,
      payment_id: paymentId,
      amount: Number(payment.amountPaise),
    }),
  );

  if (error?.code === "23505") {
    // Same payment recorded twice: the idempotency case, already settled.
    // Re-apply the entitlement anyway — the first attempt may have died
    // between the insert and the grant.
    if (isSamePaymentConflict(error)) {
      await applyEntitlement(purpose, userId, ref);
      return null;
    }
    // Different payment, same entitlement: the user was charged again for
    // something they already own. The ledger correctly refuses the row, but
    // this payment is unreconciled and owed back.
    console.error(
      `DUPLICATE CHARGE: payment ${paymentId} (order ${orderId}, user ${userId}, ` +
        `${purpose}, ${FEES[purpose]} paise) succeeded for an entitlement already ` +
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

  await applyEntitlement(purpose, userId, ref);
  return null;
}
