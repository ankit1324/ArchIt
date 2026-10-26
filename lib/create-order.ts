import { FEES, feeLabel, type FeePurpose } from "./fees.ts";
import { isFeePurpose } from "./payment-validation.ts";
import {
  refIsProperty,
  validatePurchaseRef,
  type PurchaseRefProperty,
} from "./purchase-rules.ts";

/**
 * The create-order decision logic, with every side effect injected (same
 * pattern as lib/record-purchase.ts). Runtime imports are limited to
 * import-free modules with explicit .ts extensions so `node --test` can load
 * this file directly. app/api/create-order/route.ts does auth + rate limiting
 * and wires the real dependencies (Supabase, the ledger, YouPI).
 */

export const ORDER_DESCRIPTIONS: Record<FeePurpose, string> = {
  contact_owner: "Owner contact unlock",
  featured_property: "Featured listing boost",
  builder_unlock: "3D Builder — full access",
  template_unlock: "Floor-plan template",
};

export const MAX_ORDER_REF = 64;

export interface OrderBody {
  purpose: FeePurpose;
  /** "" when absent */
  ref: string;
}

/** Body validator for parseJsonBody: the typed body or a 400-able message. */
export function validateOrderBody(v: unknown): OrderBody | string {
  const { purpose, ref } = (v ?? {}) as { purpose?: unknown; ref?: unknown };
  // isFeePurpose, not `purpose in FEES`: `in` walks the prototype chain, so
  // "toString" would reach FEES[purpose] and ORDER_DESCRIPTIONS[purpose].
  if (typeof purpose !== "string" || !isFeePurpose(purpose)) return "unknown purpose";
  if (
    ref !== undefined &&
    ref !== null &&
    (typeof ref !== "string" || ref.length > MAX_ORDER_REF)
  ) {
    return "invalid ref";
  }
  return { purpose, ref: typeof ref === "string" ? ref : "" };
}

/** What the route turns into `Response.json(body, { status })`. */
export interface OrderResult {
  status: number;
  body: Record<string, unknown>;
}

type DbError = { message: string };

/** The subset of the gateway's create-payment response create-order relies on. */
export interface CreatedPayment {
  paymentId?: string;
  orderId?: string;
  checkoutUrl?: string;
}

export interface PaymentOrderRow {
  order_id: string;
  payment_id: string;
  user_id: string;
  purpose: FeePurpose;
  ref: string | null;
  amount: number;
}

export interface CreateOrderDeps {
  /** lib/paywall.ts PAYWALL_ENABLED, injected so both states are testable. */
  paywallEnabled: boolean;
  /** The `properties` row for a property ref (featured_property / contact_owner). */
  lookupProperty(id: string): PromiseLike<{
    data: { user_id: string | null; owner: string | null } | null;
    error: DbError | null;
  }>;
  /** TEMPLATE_KEYS.has(key) && isPaidTemplate(key). */
  isPaidTemplateKey(key: string): boolean;
  /** lib/entitlements.ts hasPurchase. */
  hasPurchase(
    userId: string,
    purpose: FeePurpose,
    ref?: string,
  ): Promise<{ ok: true; granted: boolean } | { ok: false; error: string }>;
  /** lib/youpi.ts createPayment. */
  createPayment(input: {
    orderId: string;
    amountPaise: number;
    description: string;
    metadata: Record<string, string>;
  }): Promise<CreatedPayment>;
  /** Insert into payment_orders (the reconciler's work list). */
  logOrder(row: PaymentOrderRow): PromiseLike<{ error: DbError | null }>;
  /** A fresh, unique order id for this purpose. */
  newOrderId(purpose: FeePurpose): string;
  /** lib/youpi.ts youpiPortalUrl. */
  portalUrl(): string;
  /** The HTTP status carried by a gateway error (YoupiError.status), else undefined. */
  gatewayErrorStatus(e: unknown): number | undefined;
}

/** Paywall off: nothing is for sale, so no gateway session may be opened. */
export function paymentsDisabled(paywallEnabled: boolean): OrderResult | null {
  return paywallEnabled
    ? null
    : { status: 410, body: { error: "payments are disabled" } };
}

/**
 * Map a create-payment failure to our response status: 401 means our merchant
 * key is wrong (our misconfiguration → 500), 504 means the gateway hung, and
 * everything else is the gateway's problem (502).
 */
export function gatewayFailureStatus(status: number | undefined): number {
  if (status === 401) return 500;
  if (status === 504) return 504;
  return 502;
}

export function createOrderHandler(deps: CreateOrderDeps) {
  /**
   * Open a YouPI checkout session for a fixed platform fee. The browser sends
   * only a purpose (and an optional ref); the amount is resolved server-side
   * and purpose/userId/ref are stashed in gateway metadata so verify-payment
   * and the webhook can record the purchase without trusting the client.
   *
   * Before any session is opened the ref is checked against what the purpose
   * means (lib/purchase-rules.ts) and the ledger is consulted: a payment for
   * something the user already owns would succeed at the gateway and then be
   * refused by the ledger — money we'd owe back.
   */
  return async function createOrder(userId: string, body: OrderBody): Promise<OrderResult> {
    const disabled = paymentsDisabled(deps.paywallEnabled);
    if (disabled) return disabled;
    const { purpose, ref } = body;

    let property: PurchaseRefProperty | null = null;
    if (refIsProperty(purpose) && ref) {
      const { data, error } = await deps.lookupProperty(ref);
      if (error) {
        console.error(`create-order ref lookup failed for ${purpose}:${ref}:`, error.message);
        return { status: 500, body: { error: "internal error" } };
      }
      if (data) {
        property = { userId: data.user_id, hasOwner: Boolean(data.owner?.trim()) };
      }
    }

    const rule = validatePurchaseRef(purpose, ref, {
      userId,
      isPaidTemplateKey: deps.isPaidTemplateKey,
      property,
    });
    if (!rule.ok) return { status: 400, body: { error: rule.error } };

    // Never open a gateway session for something already owned.
    const owned = await deps.hasPurchase(userId, purpose, ref || undefined);
    if (!owned.ok) return { status: 500, body: { error: owned.error } };
    if (owned.granted) return { status: 409, body: { error: "already purchased" } };

    const amount = FEES[purpose]; // paise, fixed server-side

    // Our own order id, also sent as the gateway's Idempotency-Key so a retry
    // of this same call can't open a second session. (Each request mints a
    // new id; the rate limit, not this key, bounds repeated clicks.)
    const orderId = deps.newOrderId(purpose);
    let payment: CreatedPayment;
    try {
      payment = await deps.createPayment({
        orderId,
        amountPaise: amount,
        description: `${ORDER_DESCRIPTIONS[purpose]} (${feeLabel(purpose)})`,
        metadata: { purpose, userId, ref },
      });
    } catch (e) {
      const gatewayStatus = deps.gatewayErrorStatus(e);
      console.error(
        `YouPI create-payment failed${gatewayStatus ? ` (${gatewayStatus})` : ""}:`,
        e instanceof Error ? e.message : e,
      );
      return { status: gatewayFailureStatus(gatewayStatus), body: { error: "order creation failed" } };
    }
    if (!payment?.checkoutUrl || !payment.paymentId) {
      console.error("YouPI create-payment returned no checkoutUrl:", payment);
      return { status: 502, body: { error: "order creation failed" } };
    }

    // The reconciler's work list (app/api/cron/reconcile). Not fatal: the
    // checkout still works without it, the payment just can't be swept up if
    // both verify-payment and the webhook later miss it.
    try {
      const { error: logError } = await deps.logOrder({
        order_id: orderId,
        payment_id: payment.paymentId,
        user_id: userId,
        purpose,
        ref: ref || null,
        amount,
      });
      if (logError) {
        console.error(`create-order: order ${orderId} not logged for reconciliation:`, logError.message);
      }
    } catch (e) {
      console.error(
        `create-order: order ${orderId} not logged for reconciliation:`,
        e instanceof Error ? e.message : e,
      );
    }

    return {
      status: 200,
      body: {
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        amount,
        currency: "INR",
        checkoutUrl: payment.checkoutUrl,
        portalUrl: deps.portalUrl(),
      },
    };
  };
}
