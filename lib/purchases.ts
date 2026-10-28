import "server-only";
import { reportIncident } from "./alert";
import { db } from "./db";
import { afterResponse, notifyPurchaseRecorded } from "./notify";
import { createPurchaseRecorder, type PaymentOrder } from "./record-purchase";
import { retryTransientDb } from "./retry";
import { fetchPayment } from "./youpi";

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
 * The live wiring of lib/record-purchase.ts: YouPI for the payment, Supabase
 * for the ledger and the featured flag, Sentry/webhook for incidents, email
 * (after the response) for the receipt and the lister's heads-up. The
 * logic itself (and its tests) lives in record-purchase.ts.
 */
export const { recordPurchase, applyEntitlement } = createPurchaseRecorder({
  fetchPayment,
  loadOrder: (paymentId) =>
    retryTransientDb(() =>
      db
        .from("payment_orders")
        .select("order_id, user_id, purpose, ref, amount")
        .eq("payment_id", paymentId)
        .maybeSingle<PaymentOrder>(),
    ),
  countRecorded: (paymentId) =>
    retryTransientDb(() =>
      db
        .from("purchases")
        .select("*", { count: "exact", head: true })
        .eq("payment_id", paymentId),
    ),
  insertPurchase: (row) => retryTransientDb(() => db.from("purchases").insert(row)),
  grantFeatured: (propertyId, userId) =>
    db.from("properties").update({ featured: true }).eq("id", propertyId).eq("user_id", userId),
  report: reportIncident,
  onRecorded: (row) => afterResponse(() => notifyPurchaseRecorded(row)),
});
