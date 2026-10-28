import { FEES, type FeePurpose } from "./fees.ts";
import {
  checkPayment,
  isFeePurpose,
  isSamePaymentConflict,
  type PurchaseFailure,
} from "./payment-validation.ts";

/**
 * The purchase-recording contract, with every side effect injected. Runtime
 * imports are limited to the two import-free modules above (with explicit .ts
 * extensions so `node --test` can load this file directly), so the most
 * money-critical path in the app is unit-testable without the gateway,
 * Supabase or "server-only". lib/purchases.ts wires the real dependencies.
 */

/** Minimal shape of a payment read back from the gateway with the merchant key. */
export interface GatewayPayment {
  orderId: string;
  status: string;
  /** Paise; the gateway returns it as a string. */
  amountPaise: string | number;
  currency: string;
  /** Only present on the private (merchant-key) view. */
  metadata?: Record<string, unknown>;
}

export interface LedgerRow {
  user_id: string;
  purpose: FeePurpose;
  ref: string | null;
  order_id: string;
  payment_id: string;
  amount: number;
}

type DbError = { code?: string; message: string; details?: string | null };

/** Things money ops must hear about — each one is paged, not just logged. */
export type IncidentKind =
  | "duplicate_charge"
  | "entitlement_failed"
  | "payment_metadata_missing"
  | "payment_order_missing"
  | "payment_order_mismatch";

/** The payment_orders row create-order wrote when it opened the checkout. */
export interface PaymentOrder {
  order_id: string;
  user_id: string;
  purpose: string;
  ref: string | null;
  /** Paise, as ordered. */
  amount: number;
}

export interface RecordPurchaseDeps {
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
  /**
   * The payment_orders row for this payment id (null when there is none).
   * This is our own record of what was sold, written before the checkout URL
   * reached the browser, so it is independent of anything the gateway echoes.
   */
  loadOrder(paymentId: string): PromiseLike<{
    data: PaymentOrder | null;
    error: { message: string } | null;
  }>;
  /**
   * Ledger rows already holding this payment_id. Consulted only when the order
   * row is missing, so a payment recorded before payment_orders existed stays
   * an idempotent no-op on a re-verify or a redelivered webhook.
   */
  countRecorded(paymentId: string): PromiseLike<{
    count: number | null;
    error: { message: string } | null;
  }>;
  insertPurchase(row: LedgerRow): PromiseLike<{ error: DbError | null }>;
  /** Flip properties.featured for (propertyId, owner). Must be idempotent. */
  grantFeatured(
    propertyId: string,
    userId: string,
  ): PromiseLike<{ error: { message: string } | null }>;
  report(
    kind: IncidentKind,
    message: string,
    context: Record<string, unknown>,
  ): void | Promise<void>;
  /**
   * Called once per newly recorded payment (not for a same-payment retry),
   * after the entitlement is applied — receipts and lister notifications hang
   * off this. Must not throw; a throw is logged and swallowed regardless.
   */
  onRecorded?(row: LedgerRow): void | Promise<void>;
  /** Injected so tests don't wait out the gateway's verification window. */
  sleep?(ms: number): Promise<void>;
}

export interface RecordOptions {
  /**
   * Re-read a PROCESSING/ACTIVE payment a couple of times before giving up.
   * verify-payment wants this (it races the gateway); the webhook and the
   * reconciler don't (the payment has already settled).
   */
  poll?: boolean;
}

/** Re-reads spaced this far apart, at most this many times in total. */
export const SETTLE_DELAY_MS = 1200;
export const SETTLE_ATTEMPTS = 3;

function metaString(meta: Record<string, unknown> | undefined, key: string): string {
  const v = meta?.[key];
  return typeof v === "string" ? v : "";
}

/** The first field on which the order row and the paid payment disagree, else null. */
function orderDisagreement(
  order: PaymentOrder,
  paid: Omit<PaymentOrder, "ref"> & { ref: string | null },
): keyof PaymentOrder | null {
  if (order.order_id !== paid.order_id) return "order_id";
  if (order.user_id !== paid.user_id) return "user_id";
  if (order.purpose !== paid.purpose) return "purpose";
  // create-order stores an absent ref as null; metadata carries it as ""
  if ((order.ref || null) !== paid.ref) return "ref";
  if (Number(order.amount) !== paid.amount) return "amount";
  return null;
}

export function createPurchaseRecorder(deps: RecordPurchaseDeps) {
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  /**
   * Fetch the payment, giving the gateway's verification window a moment to land.
   *
   * verify-payment runs the instant the checkout iframe posts `payment_success`,
   * which can be a beat before the gateway flips PROCESSING → SUCCESS. Re-reading
   * a couple of times turns what would be a "payment processing" bounce into a
   * clean confirmation for the overwhelming majority of real payments.
   */
  async function fetchSettledPayment(paymentId: string, poll: boolean): Promise<GatewayPayment> {
    let payment = await deps.fetchPayment(paymentId);
    for (
      let attempt = 1;
      poll &&
      attempt < SETTLE_ATTEMPTS &&
      (payment.status === "PROCESSING" || payment.status === "ACTIVE");
      attempt++
    ) {
      await sleep(SETTLE_DELAY_MS);
      payment = await deps.fetchPayment(paymentId);
    }
    return payment;
  }

  /**
   * Apply the side effect a purchase buys, beyond the ledger row itself.
   *
   * Only featured_property has one: the boost lives in a column on the listing.
   * Doing it here means the webhook grants it too, so a user who closes the tab
   * mid-checkout still gets what they paid for. Idempotent, and safe to re-run
   * on a duplicate-payment retry or from the reconciler.
   *
   * Returns false when the grant failed (already reported).
   */
  async function applyEntitlement(
    purpose: FeePurpose,
    userId: string,
    ref: string | null,
  ): Promise<boolean> {
    if (purpose !== "featured_property" || !ref) return true;
    // scoped to the payer so a purchase can only boost the payer's own listing
    const { error } = await deps.grantFeatured(ref, userId);
    if (!error) return true;
    // The ledger row is already written, so the entitlement is provable and the
    // reconciler will retry the flip. Page anyway: a paid boost is not showing.
    await deps.report(
      "entitlement_failed",
      `Featured flip failed for property ${ref} (user ${userId}): ${error.message}`,
      { purpose, userId, ref },
    );
    return false;
  }

  /**
   * Record a successful payment in the purchases ledger, resolving
   * purpose/user/ref from the metadata written by create-order. Shared by
   * verify-payment, the YouPI webhook and the reconciler so the ledger contract
   * lives in one place.
   *
   * The payment is re-fetched from the gateway with the merchant key and checked
   * (SUCCESS, right amount, right currency, right order) before anything is
   * granted — a webhook body or a browser claim alone is never trusted.
   *
   * Returns null on success; a duplicate of the *same* payment counts as success.
   * A duplicate that trips an entitlement index instead means a second, distinct
   * payment was completed for something already owned: that is money we owe back,
   * so it is reported rather than swallowed. Throws if the gateway lookup fails.
   */
  async function recordPurchase(
    paymentId: string,
    fallbackUserId?: string | null,
    options: RecordOptions = {},
  ): Promise<PurchaseFailure | null> {
    const payment = await fetchSettledPayment(paymentId, options.poll ?? true);
    const meta = payment.metadata;
    if (!meta) {
      // Public view only: the merchant key was rejected or unset. Without
      // metadata we cannot know who paid for what — refuse rather than guess.
      await deps.report(
        "payment_metadata_missing",
        `Payment ${paymentId} returned no metadata — check YOUPI_WEBHOOK_SECRET`,
        { paymentId, orderId: payment.orderId },
      );
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

    // Tie the payment to the order we opened. Metadata and orderId both come
    // back from the gateway; only payment_orders is ours, so every field the
    // ledger row will carry must agree with it.
    const { data: order, error: orderError } = await deps.loadOrder(paymentId);
    if (orderError) {
      console.error(`payment_orders lookup failed for ${paymentId}:`, orderError.message);
      return { error: "purchase service unavailable", status: 503 };
    }
    if (!order) {
      // Already in the ledger: recorded before payment_orders existed, so a
      // re-verify or a redelivered webhook is the same money arriving twice.
      const recorded = await deps.countRecorded(paymentId);
      if (recorded.error) {
        console.error(`purchases lookup failed for ${paymentId}:`, recorded.error.message);
        return { error: "purchase service unavailable", status: 503 };
      }
      if (recorded.count) return null;
      await deps.report(
        "payment_order_missing",
        `Payment ${paymentId} has no payment_orders row — not opened by create-order; not recorded`,
        { paymentId, gatewayOrderId: payment.orderId, userId, purpose, ref },
      );
      return { error: "no order for payment", status: 400 };
    }
    const disagreement = orderDisagreement(order, {
      order_id: payment.orderId,
      user_id: userId,
      purpose,
      ref,
      amount: Number(payment.amountPaise),
    });
    if (disagreement) {
      await deps.report(
        "payment_order_mismatch",
        `Payment ${paymentId} disagrees with its order ${order.order_id} on ${disagreement} — not recorded`,
        { paymentId, orderId: order.order_id, field: disagreement },
      );
      return { error: "payment does not match order", status: 400 };
    }
    const orderId = order.order_id;

    // Confirm the money actually landed, for the right amount, on this order.
    // orderId is ours (payment_orders), so this compares two independent values.
    const mismatch = checkPayment(payment, {
      orderId,
      purpose,
      paymentId,
      expectedAmount: FEES[purpose],
    });
    if (mismatch) return mismatch;

    const row: LedgerRow = {
      user_id: userId,
      purpose,
      ref,
      order_id: orderId,
      payment_id: paymentId,
      amount: Number(payment.amountPaise),
    };
    const { error } = await deps.insertPurchase(row);

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
      await deps.report(
        "duplicate_charge",
        `DUPLICATE CHARGE: payment ${paymentId} (order ${orderId}, user ${userId}, ` +
          `${purpose}, ${FEES[purpose]} paise) succeeded for an entitlement already ` +
          `held. Not recorded — refund required. Constraint: ${error.message}`,
        { paymentId, orderId, userId, purpose, ref, amountPaise: FEES[purpose] },
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
    if (deps.onRecorded) {
      try {
        await deps.onRecorded(row);
      } catch (e) {
        console.error("onRecorded hook failed:", e instanceof Error ? e.message : e);
      }
    }
    return null;
  }

  return { recordPurchase, applyEntitlement };
}
