import { reportIncident } from "@/lib/alert";
import { isCronRequest } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { applyEntitlement, recordPurchase } from "@/lib/purchases";
import { createReconciler, type OpenOrder } from "@/lib/reconcile";
import { fetchPayment } from "@/lib/youpi";

/**
 * The sweep loops for up to RECONCILE_BUDGET_MS (45s); give the function room
 * to finish the featured repair and answer. Vercel Hobby crons run once a
 * day, so throughput comes from looping, not from a tighter schedule.
 */
export const maxDuration = 60;

/** PostgREST caps a response at 1000 rows by default; page past it. */
const PAGE = 1000;

type FeaturedRow = { user_id: string; ref: string | null };

/** Every featured_property purchase, paged so the scan isn't silently capped. */
async function listFeaturedPurchases() {
  const rows: FeaturedRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("purchases")
      .select("user_id, ref")
      .eq("purpose", "featured_property")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
      .overrideTypes<FeaturedRow[], { merge: false }>();
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: rows, error: null };
  }
}

/**
 * The live wiring of lib/reconcile.ts (logic and tests live there): Supabase
 * for payment_orders / purchases / properties, YouPI for the payment status,
 * lib/purchases.ts for recording and the featured grant.
 */
const { reconcile } = createReconciler({
  now: () => Date.now(),
  listOpenOrders: ({ olderThan, newerThan, limit, checkedBefore }) =>
    db
      .from("payment_orders")
      .select("order_id, payment_id, attempts")
      .eq("status", "open")
      .lt("created_at", olderThan)
      .gt("created_at", newerThan)
      // orders this run already marked carry a newer checked_at; skip them.
      // The timestamp is quoted: its "." and ":" are reserved in or() filters.
      .or(`checked_at.is.null,checked_at.lt."${checkedBefore}"`)
      // least recently checked first: orders the gateway keeps pending can't
      // starve newer ones out of the batch
      .order("checked_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true })
      .limit(limit)
      .overrideTypes<OpenOrder[], { merge: false }>(),
  oldestOpenOrder: ({ newerThan }) =>
    db
      .from("payment_orders")
      .select("created_at")
      .eq("status", "open")
      .gt("created_at", newerThan)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ created_at: string }>(),
  countRecorded: (paymentId) =>
    db
      .from("purchases")
      .select("*", { count: "exact", head: true })
      .eq("payment_id", paymentId),
  fetchPaymentStatus: fetchPayment,
  recordPurchase: (paymentId) => recordPurchase(paymentId, null, { poll: false }),
  markOrder: (orderId, patch) => db.from("payment_orders").update(patch).eq("order_id", orderId),
  report: reportIncident,
  listFeaturedPurchases,
  listUnfeatured: (ids) =>
    db
      .from("properties")
      .select("id, user_id")
      .in("id", ids)
      .eq("featured", false)
      .overrideTypes<{ id: string; user_id: string | null }[], { merge: false }>(),
  applyEntitlement,
});

/**
 * Sweep for money that landed but was never granted (see lib/reconcile.ts).
 * Triggered by Vercel Cron (vercel.json) with the CRON_SECRET bearer.
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await reconcile();
  if (!result.ok) return Response.json({ error: result.error }, { status: 500 });
  return Response.json(result.summary);
}
