import Razorpay from "razorpay";
import { db } from "./db";
import { retryTransientDb } from "./retry";

// one SDK client for every server-side Razorpay call
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

/**
 * Record a captured payment in the purchases ledger, resolving purpose/user/ref
 * from the order notes written by create-order. Shared by verify-payment and
 * the Razorpay webhook so the ledger contract lives in one place.
 * Returns null on success (a 23505 duplicate — verify/webhook race or retry —
 * counts as success); throws if the order lookup fails.
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
  const { error } = await retryTransientDb(() =>
    db.from("purchases").insert({
      user_id: userId,
      purpose: notes.purpose,
      ref: notes.ref || null,
      order_id: orderId,
      payment_id: paymentId,
      amount: Number(order.amount) || null,
    }),
  );
  if (error && error.code !== "23505") {
    const unavailable = error.message.includes("fetch failed");
    console.error("Purchase ledger insert failed:", error.message);
    return {
      error: unavailable ? "purchase service unavailable" : error.message,
      status: unavailable ? 503 : 500,
    };
  }
  return null;
}
