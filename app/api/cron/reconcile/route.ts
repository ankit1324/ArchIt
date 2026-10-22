import { reportIncident } from "@/lib/alert";
import { isCronRequest } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { applyEntitlement, recordPurchase } from "@/lib/purchases";
import { fetchPayment } from "@/lib/youpi";

/** Leave fresh orders to verify-payment and the webhook. */
const GRACE_MS = 15 * 60_000;
/** Checkout sessions expire long before this; older open orders are abandoned. */
const WINDOW_MS = 30 * 24 * 60 * 60_000;
/** Gateway round-trips per run, so one run stays well inside the function timeout. */
const BATCH = 40;

const TERMINAL: Record<string, "failed" | "expired" | "cancelled"> = {
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

type OrderRow = { order_id: string; payment_id: string; attempts: number };

/**
 * Sweep for money that landed but was never granted.
 *
 * 1. Orders: every checkout create-order opened (payment_orders). An order
 *    still open after the grace period is re-read from the gateway; a SUCCESS
 *    that never reached the ledger is recorded through the normal
 *    recordPurchase path (same checks, same idempotency), and paged.
 * 2. Featured flips: a featured_property purchase whose listing is not
 *    featured had its flip fail — re-apply it.
 *
 * Triggered by Vercel Cron (vercel.json) with the CRON_SECRET bearer.
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = {
    checked: 0,
    alreadyRecorded: 0,
    repaired: 0,
    refundDue: 0,
    closed: 0,
    stillPending: 0,
    errors: 0,
    featuredRepaired: 0,
  };

  // ---- 1. open orders -----------------------------------------------------
  const now = Date.now();
  const { data: orders, error } = await db
    .from("payment_orders")
    .select("order_id, payment_id, attempts")
    .eq("status", "open")
    .lt("created_at", new Date(now - GRACE_MS).toISOString())
    .gt("created_at", new Date(now - WINDOW_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH)
    .overrideTypes<OrderRow[], { merge: false }>();
  if (error) {
    await reportIncident("reconcile_failed", `payment_orders scan failed: ${error.message}`);
    return Response.json({ error: "scan failed" }, { status: 500 });
  }

  for (const order of orders ?? []) {
    summary.checked++;
    const mark = (status: string) =>
      db
        .from("payment_orders")
        .update({ status, attempts: order.attempts + 1, checked_at: new Date().toISOString() })
        .eq("order_id", order.order_id);

    try {
      const { count } = await db
        .from("purchases")
        .select("*", { count: "exact", head: true })
        .eq("payment_id", order.payment_id);
      if (count) {
        summary.alreadyRecorded++;
        await mark("recorded");
        continue;
      }

      const payment = await fetchPayment(order.payment_id);
      const terminal = TERMINAL[payment.status];
      if (terminal) {
        summary.closed++;
        await mark(terminal);
        continue;
      }
      if (payment.status !== "SUCCESS") {
        summary.stillPending++;
        await mark("open");
        continue;
      }

      // Paid at the gateway, missing from our ledger.
      const failure = await recordPurchase(order.payment_id, null, { poll: false });
      if (!failure) {
        summary.repaired++;
        await mark("recorded");
        await reportIncident(
          "reconcile_repaired",
          `Payment ${order.payment_id} (order ${order.order_id}) was paid but unrecorded — recorded by reconciler`,
          { orderId: order.order_id, paymentId: order.payment_id },
        );
      } else if (failure.status === 409) {
        // recordPurchase already paged the DUPLICATE CHARGE
        summary.refundDue++;
        await mark("refund_due");
      } else {
        summary.errors++;
        await mark("open");
        await reportIncident(
          "reconcile_failed",
          `Paid order ${order.order_id} could not be recorded: ${failure.status} ${failure.error}`,
          { orderId: order.order_id, paymentId: order.payment_id, ...failure },
        );
      }
    } catch (e) {
      // gateway down or timing out: leave it open for the next run
      summary.errors++;
      console.error(`reconcile: order ${order.order_id} lookup failed:`, e);
      await mark("open");
    }
  }

  // ---- 2. featured flips that never landed ---------------------------------
  const { data: featured, error: featuredError } = await db
    .from("purchases")
    .select("user_id, ref")
    .eq("purpose", "featured_property")
    .overrideTypes<{ user_id: string; ref: string | null }[], { merge: false }>();
  if (featuredError) {
    await reportIncident("reconcile_failed", `featured scan failed: ${featuredError.message}`);
  } else {
    const refs = [...new Set((featured ?? []).map((p) => p.ref).filter((r): r is string => !!r))];
    if (refs.length) {
      const { data: unflipped, error: propsError } = await db
        .from("properties")
        .select("id, user_id")
        .in("id", refs)
        .eq("featured", false)
        .overrideTypes<{ id: string; user_id: string | null }[], { merge: false }>();
      if (propsError) {
        await reportIncident("reconcile_failed", `featured lookup failed: ${propsError.message}`);
      }
      for (const prop of unflipped ?? []) {
        // only the payer's own listing — same scope as the original grant
        const buyer = featured!.find((p) => p.ref === prop.id && p.user_id === prop.user_id);
        if (!buyer) continue;
        if (await applyEntitlement("featured_property", buyer.user_id, prop.id)) {
          summary.featuredRepaired++;
        }
      }
    }
  }

  if (summary.featuredRepaired) {
    await reportIncident(
      "reconcile_repaired",
      `Re-applied ${summary.featuredRepaired} featured flag(s) that a paid boost never set`,
    );
  }
  return Response.json(summary);
}
