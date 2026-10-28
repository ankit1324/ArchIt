import type { FeePurpose } from "./fees.ts";
import type { PurchaseFailure } from "./payment-validation.ts";

/**
 * The reconcile-cron decision logic, with every side effect injected (same
 * pattern as lib/record-purchase.ts). No runtime imports, so `node --test`
 * loads it directly; app/api/cron/reconcile/route.ts wires Supabase, YouPI
 * and the recorder.
 */

/** Leave fresh orders to verify-payment and the webhook. */
export const RECONCILE_GRACE_MS = 15 * 60_000;
/** Checkout sessions expire long before this; older open orders are abandoned. */
export const RECONCILE_WINDOW_MS = 30 * 24 * 60 * 60_000;
/** Orders per scan; the sweep keeps scanning until a batch comes back short. */
export const RECONCILE_BATCH = 40;
/**
 * Wall-clock point after which the sweep starts no new order, inside the
 * route's 60s maxDuration. One order can take ~20s at worst (two 8s gateway
 * timeouts, the 3s alert webhook, DB calls), so the last one must start by
 * 30s to leave room for itself and the featured repair. Vercel Hobby crons run
 * once a day, so throughput has to come from looping within one run, not a
 * tighter schedule.
 */
export const RECONCILE_BUDGET_MS = 30_000;
/**
 * An order still open this long after creation means the sweep is not keeping
 * up (or keeps failing on it): page before it ages out of the 30-day window.
 */
export const RECONCILE_BACKLOG_AGE_MS = 24 * 60 * 60_000;
/** Property ids per `.in()` lookup, so the PostgREST URL stays short. */
export const FEATURED_CHUNK = 100;

/** Gateway statuses that close an order without anything to grant. */
export const TERMINAL_ORDER_STATUS: Record<string, "failed" | "expired" | "cancelled"> = {
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

export type OrderStatus = "open" | "recorded" | "refund_due" | "failed" | "expired" | "cancelled";

export interface OpenOrder {
  order_id: string;
  payment_id: string;
  attempts: number;
}

type DbError = { message: string };

export interface ReconcileDeps {
  now(): number;
  /**
   * Open orders created in (newerThan, olderThan), never checked or last
   * checked before `checkedBefore` (the run's start, so orders this run has
   * already marked drop out), least recently checked first, at most `limit`.
   */
  listOpenOrders(q: {
    olderThan: string;
    newerThan: string;
    limit: number;
    checkedBefore: string;
  }): PromiseLike<{ data: OpenOrder[] | null; error: DbError | null }>;
  /** The oldest open order created after `newerThan`, or null when there is none. */
  oldestOpenOrder(q: {
    newerThan: string;
  }): PromiseLike<{ data: { created_at: string } | null; error: DbError | null }>;
  /** How many ledger rows hold this payment id. */
  countRecorded(paymentId: string): PromiseLike<{ count: number | null; error: DbError | null }>;
  /** The gateway's view of the payment (merchant key). Throws when unreachable. */
  fetchPaymentStatus(paymentId: string): Promise<{ status: string }>;
  /** lib/purchases.ts recordPurchase(paymentId, null, { poll: false }). */
  recordPurchase(paymentId: string): Promise<PurchaseFailure | null>;
  markOrder(
    orderId: string,
    patch: { status: OrderStatus; attempts: number; checked_at: string },
  ): PromiseLike<{ error: DbError | null }>;
  report(kind: string, message: string, context?: Record<string, unknown>): void | Promise<void>;
  /** Every featured_property purchase (user + listing). */
  listFeaturedPurchases(): PromiseLike<{
    data: { user_id: string; ref: string | null }[] | null;
    error: DbError | null;
  }>;
  /** Of these listing ids, the ones whose featured flag is not set. */
  listUnfeatured(ids: string[]): PromiseLike<{
    data: { id: string; user_id: string | null }[] | null;
    error: DbError | null;
  }>;
  /** lib/purchases.ts applyEntitlement; false when the grant failed (already paged). */
  applyEntitlement(purpose: FeePurpose, userId: string, ref: string | null): Promise<boolean>;
}

export interface ReconcileSummary {
  checked: number;
  alreadyRecorded: number;
  repaired: number;
  refundDue: number;
  closed: number;
  stillPending: number;
  errors: number;
  featuredRepaired: number;
  /** True when the sweep ran out of time or an open order is past the backlog age. */
  backlog: boolean;
}

export type ReconcileResult =
  | { ok: true; summary: ReconcileSummary }
  | { ok: false; error: string; summary: ReconcileSummary };

export function createReconciler(deps: ReconcileDeps) {
  /** One order: ledger, then gateway, then record or close. Never throws. */
  async function checkOrder(order: OpenOrder, summary: ReconcileSummary): Promise<void> {
    summary.checked++;
    const ctx = { orderId: order.order_id, paymentId: order.payment_id };
    const mark = async (status: OrderStatus) => {
      const { error: markError } = await deps.markOrder(order.order_id, {
        status,
        attempts: order.attempts + 1,
        checked_at: new Date(deps.now()).toISOString(),
      });
      if (markError) {
        console.error(`reconcile: could not mark order ${order.order_id} ${status}:`, markError.message);
      }
    };

    try {
      const recorded = await deps.countRecorded(order.payment_id);
      // A failed ledger read is not "unrecorded": leave the order open
      // rather than re-recording (and falsely paging) a settled payment.
      if (recorded.error) throw new Error(`ledger lookup failed: ${recorded.error.message}`);
      if (recorded.count) {
        summary.alreadyRecorded++;
        await mark("recorded");
        return;
      }

      const payment = await deps.fetchPaymentStatus(order.payment_id);
      const terminal = TERMINAL_ORDER_STATUS[payment.status];
      if (terminal) {
        summary.closed++;
        await mark(terminal);
        return;
      }
      if (payment.status !== "SUCCESS") {
        summary.stillPending++;
        await mark("open");
        return;
      }

      // Paid at the gateway, missing from our ledger.
      const failure = await deps.recordPurchase(order.payment_id);
      if (!failure) {
        summary.repaired++;
        await mark("recorded");
        await deps.report(
          "reconcile_repaired",
          `Payment ${order.payment_id} (order ${order.order_id}) was paid but unrecorded — recorded by reconciler`,
          ctx,
        );
      } else if (failure.status === 409) {
        // recordPurchase already paged the DUPLICATE CHARGE
        summary.refundDue++;
        await mark("refund_due");
      } else if (failure.status === 400) {
        // Paid, but the payment can never be recorded as-is (wrong amount or
        // order, unusable metadata). Retrying won't change that — close it as
        // owed back and page once, instead of paging every run for 30 days.
        summary.refundDue++;
        await mark("refund_due");
        await deps.report(
          "reconcile_failed",
          `Paid order ${order.order_id} cannot be recorded (${failure.error}) — needs a refund or manual grant`,
          { ...ctx, ...failure },
        );
      } else {
        // 5xx (our DB, metadata/merchant key) — transient or config: retry next run
        summary.errors++;
        await mark("open");
        await deps.report(
          "reconcile_failed",
          `Paid order ${order.order_id} could not be recorded: ${failure.status} ${failure.error}`,
          { ...ctx, ...failure },
        );
      }
    } catch (e) {
      // gateway down or timing out: leave it open for the next run
      summary.errors++;
      console.error(
        `reconcile: order ${order.order_id} lookup failed:`,
        e instanceof Error ? e.message : e,
      );
      await mark("open");
    }
}

  /**
   * Step 1: every checkout create-order opened that is still open past the
   * grace period. Scans batch after batch until one comes back short or the
   * time budget is spent, so a backlog drains in one daily run instead of 40
   * orders a day. Returns false when a scan failed (already paged).
   */
  async function sweepOrders(summary: ReconcileSummary): Promise<boolean> {
    const start = deps.now();
    // fixed for the whole run so every batch reads the same slice
    const query = {
      olderThan: new Date(start - RECONCILE_GRACE_MS).toISOString(),
      newerThan: new Date(start - RECONCILE_WINDOW_MS).toISOString(),
      limit: RECONCILE_BATCH,
      checkedBefore: new Date(start).toISOString(),
    };
    const outOfTime = () => deps.now() - start >= RECONCILE_BUDGET_MS;
    // belt and braces for checkedBefore: a failed markOrder leaves checked_at
    // unchanged, and the order must still not be re-read in this run
    const seen = new Set<string>();

    let budgetSpent = false;
    for (;;) {
      if (outOfTime()) {
        budgetSpent = true;
        break;
      }
      const { data, error } = await deps.listOpenOrders(query);
      if (error) {
        await deps.report("reconcile_failed", `payment_orders scan failed: ${error.message}`);
        return false;
      }
      const batch = data ?? [];
      const fresh = batch.filter((o) => !seen.has(o.order_id));
      for (const order of fresh) {
        if (outOfTime()) {
          budgetSpent = true;
          break;
        }
        seen.add(order.order_id);
        await checkOrder(order, summary);
      }
      if (budgetSpent || batch.length < RECONCILE_BATCH || fresh.length === 0) break;
    }

    await checkBacklog(summary, budgetSpent, query.newerThan);
    return true;
  }

  /**
   * Page when the sweep is falling behind: it ran out of time with orders left,
   * or an order has stayed open past RECONCILE_BACKLOG_AGE_MS. Either way the
   * 30-day window would otherwise let paid orders age out unnoticed.
   */
  async function checkBacklog(
    summary: ReconcileSummary,
    budgetSpent: boolean,
    newerThan: string,
  ): Promise<void> {
    if (budgetSpent) {
      summary.backlog = true;
      await deps.report(
        "reconcile_backlog",
        `Reconcile hit its ${RECONCILE_BUDGET_MS / 1000}s time budget after ${summary.checked} order(s) with more still open`,
        { checked: summary.checked },
      );
      return;
    }
    const { data, error } = await deps.oldestOpenOrder({ newerThan });
    if (error) {
      await deps.report("reconcile_failed", `oldest open order lookup failed: ${error.message}`);
      return;
    }
    if (!data) return;
    const age = deps.now() - Date.parse(data.created_at);
    if (age > RECONCILE_BACKLOG_AGE_MS) {
      summary.backlog = true;
      await deps.report(
        "reconcile_backlog",
        `An order has been open since ${data.created_at} (over ${RECONCILE_BACKLOG_AGE_MS / 3_600_000}h) — reconcile is not closing it`,
        { oldestOpenAt: data.created_at, checked: summary.checked },
      );
    }
  }

  /** Step 2: featured_property purchases whose listing never got its flag. */
  async function repairFeatured(summary: ReconcileSummary): Promise<void> {
    const { data: featured, error } = await deps.listFeaturedPurchases();
    if (error) {
      await deps.report("reconcile_failed", `featured scan failed: ${error.message}`);
      return;
    }
    // listing id → the users who paid to boost it
    const buyers = new Map<string, Set<string>>();
    for (const p of featured ?? []) {
      if (!p.ref || !p.user_id) continue;
      let set = buyers.get(p.ref);
      if (!set) buyers.set(p.ref, (set = new Set()));
      set.add(p.user_id);
    }
    const ids = [...buyers.keys()];
    for (let i = 0; i < ids.length; i += FEATURED_CHUNK) {
      const chunk = ids.slice(i, i + FEATURED_CHUNK);
      const { data: unflipped, error: propsError } = await deps.listUnfeatured(chunk);
      if (propsError) {
        await deps.report("reconcile_failed", `featured lookup failed: ${propsError.message}`);
        continue;
      }
      for (const prop of unflipped ?? []) {
        // Only the payer's own listing — same scope as the original grant. A
        // listing with no lister, or whose lister never bought the boost, is
        // left alone.
        if (!prop.user_id || !buyers.get(prop.id)?.has(prop.user_id)) continue;
        if (await deps.applyEntitlement("featured_property", prop.user_id, prop.id)) {
          summary.featuredRepaired++;
        }
      }
    }
    if (summary.featuredRepaired) {
      await deps.report(
        "reconcile_repaired",
        `Re-applied ${summary.featuredRepaired} featured flag(s) that a paid boost never set`,
      );
    }
  }

  /**
   * Sweep for money that landed but was never granted.
   *
   * 1. Orders: an order still open after the grace period is re-read from the
   *    gateway; a SUCCESS that never reached the ledger is recorded through
   *    the normal recordPurchase path (same checks, same idempotency), and
   *    paged.
   * 2. Featured flips: a featured_property purchase whose listing is not
   *    featured had its flip fail — re-apply it.
   *
   * A failed order scan stops the run (ok:false) before the featured repair,
   * as the route always has.
   */
  async function reconcile(): Promise<ReconcileResult> {
    const summary: ReconcileSummary = {
      checked: 0,
      alreadyRecorded: 0,
      repaired: 0,
      refundDue: 0,
      closed: 0,
      stillPending: 0,
      errors: 0,
      featuredRepaired: 0,
      backlog: false,
    };
    if (!(await sweepOrders(summary))) return { ok: false, error: "scan failed", summary };
    await repairFeatured(summary);
    return { ok: true, summary };
  }

  return { reconcile };
}
