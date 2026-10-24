import assert from "node:assert/strict";
import test from "node:test";

import {
  createReconciler,
  FEATURED_CHUNK,
  RECONCILE_BATCH,
  RECONCILE_GRACE_MS,
  RECONCILE_WINDOW_MS,
} from "../lib/reconcile.ts";

const NOW = Date.parse("2026-10-24T03:30:00Z");

function order(id, attempts = 0) {
  return { order_id: `ord_${id}`, payment_id: `pay_${id}`, attempts };
}

/**
 * A reconciler over in-memory fakes. `gateway` maps payment id → status (or an
 * Error to throw), `recorded` is the set of payment ids already in the ledger,
 * `record` maps payment id → recordPurchase's result.
 */
function harness({
  orders = [],
  scanError = null,
  gateway = {},
  recorded = new Set(),
  countError = null,
  record = {},
  featured = [],
  featuredError = null,
  properties = [],
  grantOk = true,
} = {}) {
  const calls = { scans: [], marks: [], reports: [], records: [], fetches: [], grants: [], lookups: [] };
  const { reconcile } = createReconciler({
    now: () => NOW,
    async listOpenOrders(q) {
      calls.scans.push(q);
      return { data: scanError ? null : orders, error: scanError };
    },
    async countRecorded(paymentId) {
      if (countError) return { count: null, error: countError };
      return { count: recorded.has(paymentId) ? 1 : 0, error: null };
    },
    async fetchPaymentStatus(paymentId) {
      calls.fetches.push(paymentId);
      const s = gateway[paymentId];
      if (s instanceof Error) throw s;
      return { status: s ?? "ACTIVE" };
    },
    async recordPurchase(paymentId) {
      calls.records.push(paymentId);
      return record[paymentId] ?? null;
    },
    async markOrder(orderId, patch) {
      calls.marks.push({ orderId, ...patch });
      return { error: null };
    },
    report(kind, message, context) {
      calls.reports.push({ kind, message, context });
    },
    async listFeaturedPurchases() {
      return { data: featuredError ? null : featured, error: featuredError };
    },
    async listUnfeatured(ids) {
      calls.lookups.push(ids);
      return { data: properties.filter((p) => ids.includes(p.id) && !p.featured), error: null };
    },
    async applyEntitlement(purpose, userId, ref) {
      calls.grants.push({ purpose, userId, ref });
      return grantOk;
    },
  });
  return { reconcile, calls };
}

const statusOf = (calls, orderId) => calls.marks.find((m) => m.orderId === orderId)?.status;

test("scans open orders past the grace period, inside the window, in one batch", async () => {
  const { reconcile, calls } = harness();
  const res = await reconcile();
  assert.equal(res.ok, true);
  assert.deepEqual(calls.scans, [
    {
      olderThan: new Date(NOW - RECONCILE_GRACE_MS).toISOString(),
      newerThan: new Date(NOW - RECONCILE_WINDOW_MS).toISOString(),
      limit: RECONCILE_BATCH,
    },
  ]);
});

test("a failed scan is paged and stops the run", async () => {
  const { reconcile, calls } = harness({ scanError: { message: "db down" } });
  const res = await reconcile();
  assert.equal(res.ok, false);
  assert.equal(calls.reports[0].kind, "reconcile_failed");
  assert.equal(calls.lookups.length, 0);
});

test("already in the ledger → recorded, gateway not called", async () => {
  const { reconcile, calls } = harness({ orders: [order(1, 2)], recorded: new Set(["pay_1"]) });
  const { summary } = await reconcile();
  assert.equal(summary.alreadyRecorded, 1);
  assert.deepEqual(calls.fetches, []);
  assert.equal(statusOf(calls, "ord_1"), "recorded");
  assert.equal(calls.marks[0].attempts, 3);
  assert.equal(calls.marks[0].checked_at, new Date(NOW).toISOString());
});

test("terminal gateway statuses close the order", async () => {
  const { reconcile, calls } = harness({
    orders: [order(1), order(2), order(3)],
    gateway: { pay_1: "FAILED", pay_2: "EXPIRED", pay_3: "CANCELLED" },
  });
  const { summary } = await reconcile();
  assert.equal(summary.closed, 3);
  assert.equal(statusOf(calls, "ord_1"), "failed");
  assert.equal(statusOf(calls, "ord_2"), "expired");
  assert.equal(statusOf(calls, "ord_3"), "cancelled");
  assert.deepEqual(calls.records, []);
});

test("still pending at the gateway stays open", async () => {
  const { reconcile, calls } = harness({ orders: [order(1)], gateway: { pay_1: "PROCESSING" } });
  const { summary } = await reconcile();
  assert.equal(summary.stillPending, 1);
  assert.equal(statusOf(calls, "ord_1"), "open");
  assert.equal(calls.marks[0].attempts, 1);
});

test("SUCCESS but unrecorded → recorded through recordPurchase and paged", async () => {
  const { reconcile, calls } = harness({ orders: [order(1)], gateway: { pay_1: "SUCCESS" } });
  const { summary } = await reconcile();
  assert.equal(summary.repaired, 1);
  assert.deepEqual(calls.records, ["pay_1"]);
  assert.equal(statusOf(calls, "ord_1"), "recorded");
  assert.deepEqual(
    calls.reports.map((r) => r.kind),
    ["reconcile_repaired"],
  );
  assert.deepEqual(calls.reports[0].context, { orderId: "ord_1", paymentId: "pay_1" });
});

test("SUCCESS but 409 (entitlement already held) → refund_due, no extra page", async () => {
  const { reconcile, calls } = harness({
    orders: [order(1)],
    gateway: { pay_1: "SUCCESS" },
    record: { pay_1: { error: "already purchased", status: 409 } },
  });
  const { summary } = await reconcile();
  assert.equal(summary.refundDue, 1);
  assert.equal(statusOf(calls, "ord_1"), "refund_due");
  assert.deepEqual(calls.reports, [], "recordPurchase already paged the duplicate charge");
});

test("SUCCESS but unrecordable (400) → refund_due and paged once", async () => {
  const { reconcile, calls } = harness({
    orders: [order(1)],
    gateway: { pay_1: "SUCCESS" },
    record: { pay_1: { error: "payment amount mismatch", status: 400 } },
  });
  const { summary } = await reconcile();
  assert.equal(summary.refundDue, 1);
  assert.equal(statusOf(calls, "ord_1"), "refund_due");
  assert.equal(calls.reports.length, 1);
  assert.equal(calls.reports[0].kind, "reconcile_failed");
});

test("SUCCESS but a 5xx recording → stays open for the next run, paged", async () => {
  const { reconcile, calls } = harness({
    orders: [order(1)],
    gateway: { pay_1: "SUCCESS" },
    record: { pay_1: { error: "purchase service unavailable", status: 503 } },
  });
  const { summary } = await reconcile();
  assert.equal(summary.errors, 1);
  assert.equal(statusOf(calls, "ord_1"), "open");
  assert.equal(calls.reports[0].kind, "reconcile_failed");
});

test("gateway down → order stays open, the rest of the batch still runs", async () => {
  const { reconcile, calls } = harness({
    orders: [order(1), order(2)],
    gateway: { pay_1: new Error("gateway timeout"), pay_2: "SUCCESS" },
  });
  const { summary } = await reconcile();
  assert.equal(summary.errors, 1);
  assert.equal(summary.repaired, 1);
  assert.equal(statusOf(calls, "ord_1"), "open");
  assert.equal(statusOf(calls, "ord_2"), "recorded");
});

test("a failed ledger count leaves the order open instead of re-recording it", async () => {
  const { reconcile, calls } = harness({
    orders: [order(1)],
    gateway: { pay_1: "SUCCESS" },
    countError: { message: "fetch failed" },
  });
  const { summary } = await reconcile();
  assert.equal(summary.errors, 1);
  assert.equal(summary.repaired, 0);
  assert.deepEqual(calls.records, []);
  assert.deepEqual(calls.reports, [], "no false 'repaired' page");
  assert.equal(statusOf(calls, "ord_1"), "open");
});

test("featured repair: only the payer's own, unflagged listing", async () => {
  const { reconcile, calls } = harness({
    featured: [
      { user_id: "lister", ref: "p_mine" }, // flag never landed → repair
      { user_id: "lister", ref: "p_done" }, // already featured → skip
      { user_id: "stranger", ref: "p_theirs" }, // payer isn't the lister → skip
      { user_id: "lister", ref: null }, // legacy row without a ref → skip
      { user_id: "lister", ref: "p_orphan" }, // listing has no lister → skip
    ],
    properties: [
      { id: "p_mine", user_id: "lister", featured: false },
      { id: "p_done", user_id: "lister", featured: true },
      { id: "p_theirs", user_id: "lister", featured: false },
      { id: "p_orphan", user_id: null, featured: false },
    ],
  });
  const { summary } = await reconcile();
  assert.equal(summary.featuredRepaired, 1);
  assert.deepEqual(calls.grants, [{ purpose: "featured_property", userId: "lister", ref: "p_mine" }]);
  assert.equal(calls.reports.at(-1).kind, "reconcile_repaired");
});

test("featured repair matches the lister even when another user also bought the same ref", async () => {
  // Two ledger rows for one listing: a stranger's (refused by today's rules,
  // but possible in history) listed first, then the lister's own.
  const { reconcile, calls } = harness({
    featured: [
      { user_id: "stranger", ref: "p1" },
      { user_id: "lister", ref: "p1" },
    ],
    properties: [{ id: "p1", user_id: "lister", featured: false }],
  });
  await reconcile();
  assert.deepEqual(calls.grants, [{ purpose: "featured_property", userId: "lister", ref: "p1" }]);
});

test("featured lookups are chunked so the id list never outgrows the URL", async () => {
  const n = FEATURED_CHUNK * 2 + 5;
  const featured = Array.from({ length: n }, (_, i) => ({ user_id: "u", ref: `p${i}` }));
  const { reconcile, calls } = harness({ featured });
  await reconcile();
  assert.deepEqual(
    calls.lookups.map((ids) => ids.length),
    [FEATURED_CHUNK, FEATURED_CHUNK, 5],
  );
});

test("a failed featured grant is not counted (applyEntitlement already paged)", async () => {
  const { reconcile } = harness({
    featured: [{ user_id: "lister", ref: "p1" }],
    properties: [{ id: "p1", user_id: "lister", featured: false }],
    grantOk: false,
  });
  const { summary } = await reconcile();
  assert.equal(summary.featuredRepaired, 0);
});

test("a failed featured scan is paged but the run still succeeds", async () => {
  const { reconcile, calls } = harness({ featuredError: { message: "boom" } });
  const res = await reconcile();
  assert.equal(res.ok, true);
  assert.equal(calls.reports[0].kind, "reconcile_failed");
});
