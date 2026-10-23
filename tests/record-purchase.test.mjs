import assert from "node:assert/strict";
import test from "node:test";

import { createPurchaseRecorder, SETTLE_ATTEMPTS } from "../lib/record-purchase.ts";

const PAYMENT_ID = "pay_1";
const ORDER_ID = "builder_unlock_abc_123";

function payment(overrides = {}) {
  return {
    orderId: ORDER_ID,
    status: "SUCCESS",
    amountPaise: "200000",
    currency: "INR",
    metadata: { purpose: "builder_unlock", userId: "user_a", ref: "" },
    ...overrides,
  };
}

/** A recorder wired to in-memory fakes; `calls` records every side effect. */
function harness({ payments = [payment()], insertError = null, grantError = null } = {}) {
  const calls = { fetch: 0, inserts: [], grants: [], reports: [], sleeps: 0 };
  const recorder = createPurchaseRecorder({
    async fetchPayment(id) {
      assert.equal(id, PAYMENT_ID);
      const p = payments[Math.min(calls.fetch, payments.length - 1)];
      calls.fetch += 1;
      return p;
    },
    async insertPurchase(row) {
      calls.inserts.push(row);
      return { error: insertError };
    },
    async grantFeatured(propertyId, userId) {
      calls.grants.push({ propertyId, userId });
      return { error: grantError };
    },
    report(kind, message, context) {
      calls.reports.push({ kind, message, context });
    },
    async sleep() {
      calls.sleeps += 1;
    },
  });
  return { ...recorder, calls };
}

test("records a verified payment in the ledger", async () => {
  const { recordPurchase, calls } = harness();
  assert.equal(await recordPurchase(PAYMENT_ID, "user_a"), null);
  assert.deepEqual(calls.inserts, [
    {
      user_id: "user_a",
      purpose: "builder_unlock",
      ref: null,
      order_id: ORDER_ID,
      payment_id: PAYMENT_ID,
      amount: 200000,
    },
  ]);
  assert.equal(calls.grants.length, 0, "builder unlock has no side effect");
  assert.equal(calls.reports.length, 0);
});

test("webhook path: no session user, metadata supplies the payer", async () => {
  const { recordPurchase, calls } = harness();
  assert.equal(await recordPurchase(PAYMENT_ID, null, { poll: false }), null);
  assert.equal(calls.inserts[0].user_id, "user_a");
});

test("refuses (and pages) when the gateway hides metadata", async () => {
  const { recordPurchase, calls } = harness({ payments: [payment({ metadata: undefined })] });
  assert.deepEqual(await recordPurchase(PAYMENT_ID, "user_a"), {
    error: "payment metadata unavailable",
    status: 502,
  });
  assert.equal(calls.inserts.length, 0);
  assert.equal(calls.reports[0].kind, "payment_metadata_missing");
});

test("refuses a purpose outside the fee table", async () => {
  const { recordPurchase, calls } = harness({
    payments: [payment({ metadata: { purpose: "toString", userId: "user_a" } })],
  });
  assert.equal((await recordPurchase(PAYMENT_ID, "user_a"))?.status, 400);
  assert.equal(calls.inserts.length, 0);
});

test("refuses when metadata names no user and there is no session", async () => {
  const { recordPurchase } = harness({
    payments: [payment({ metadata: { purpose: "builder_unlock" } })],
  });
  assert.deepEqual(await recordPurchase(PAYMENT_ID, null), {
    error: "no user for purchase",
    status: 400,
  });
});

test("one user cannot confirm another user's order", async () => {
  const { recordPurchase, calls } = harness();
  assert.equal((await recordPurchase(PAYMENT_ID, "user_b"))?.status, 403);
  assert.equal(calls.inserts.length, 0);
});

test("wrong amount is not granted", async () => {
  const { recordPurchase, calls } = harness({ payments: [payment({ amountPaise: "100" })] });
  assert.equal((await recordPurchase(PAYMENT_ID, "user_a"))?.error, "payment amount mismatch");
  assert.equal(calls.inserts.length, 0);
});

test("polls a PROCESSING payment until it settles", async () => {
  const { recordPurchase, calls } = harness({
    payments: [payment({ status: "PROCESSING" }), payment()],
  });
  assert.equal(await recordPurchase(PAYMENT_ID, "user_a"), null);
  assert.equal(calls.fetch, 2);
  assert.equal(calls.sleeps, 1);
});

test("gives up polling after the settle window and defers with 202", async () => {
  const { recordPurchase, calls } = harness({ payments: [payment({ status: "PROCESSING" })] });
  assert.equal((await recordPurchase(PAYMENT_ID, "user_a"))?.status, 202);
  assert.equal(calls.fetch, SETTLE_ATTEMPTS);
  assert.equal(calls.inserts.length, 0);
});

test("poll: false reads the gateway exactly once", async () => {
  const { recordPurchase, calls } = harness({ payments: [payment({ status: "PROCESSING" })] });
  assert.equal((await recordPurchase(PAYMENT_ID, null, { poll: false }))?.status, 202);
  assert.equal(calls.fetch, 1);
  assert.equal(calls.sleeps, 0);
});

test("same payment twice is idempotent success and re-applies the entitlement", async () => {
  const { recordPurchase, calls } = harness({
    payments: [
      payment({
        orderId: "featured_property_x",
        amountPaise: "25000",
        metadata: { purpose: "featured_property", userId: "user_a", ref: "prop_1" },
      }),
    ],
    insertError: {
      code: "23505",
      message: 'duplicate key value violates unique constraint "purchases_payment_id_key"',
    },
  });
  assert.equal(await recordPurchase(PAYMENT_ID, "user_a"), null);
  assert.deepEqual(calls.grants, [{ propertyId: "prop_1", userId: "user_a" }]);
  assert.equal(calls.reports.length, 0);
});

test("a second distinct charge for an owned entitlement is paged as a duplicate charge", async () => {
  const { recordPurchase, calls } = harness({
    insertError: {
      code: "23505",
      message: 'duplicate key value violates unique constraint "purchases_one_time"',
    },
  });
  assert.deepEqual(await recordPurchase(PAYMENT_ID, "user_a"), {
    error: "already purchased",
    status: 409,
  });
  assert.equal(calls.reports.length, 1);
  assert.equal(calls.reports[0].kind, "duplicate_charge");
  assert.equal(calls.reports[0].context.paymentId, PAYMENT_ID);
  assert.match(calls.reports[0].message, /refund required/);
});

test("ledger outage surfaces as 503 so the webhook retries", async () => {
  const { recordPurchase } = harness({
    insertError: { code: "", message: "TypeError: fetch failed" },
  });
  assert.equal((await recordPurchase(PAYMENT_ID, "user_a"))?.status, 503);
});

test("other ledger errors are a 500", async () => {
  const { recordPurchase } = harness({
    insertError: { code: "23514", message: "violates check constraint" },
  });
  assert.equal((await recordPurchase(PAYMENT_ID, "user_a"))?.status, 500);
});

test("featured purchase flips the listing for the payer only", async () => {
  const { recordPurchase, calls } = harness({
    payments: [
      payment({
        amountPaise: "25000",
        metadata: { purpose: "featured_property", userId: "user_a", ref: "prop_9" },
      }),
    ],
  });
  assert.equal(await recordPurchase(PAYMENT_ID, "user_a"), null);
  assert.deepEqual(calls.grants, [{ propertyId: "prop_9", userId: "user_a" }]);
});

test("a failed featured flip still records the purchase but pages", async () => {
  const { recordPurchase, calls } = harness({
    payments: [
      payment({
        amountPaise: "25000",
        metadata: { purpose: "featured_property", userId: "user_a", ref: "prop_9" },
      }),
    ],
    grantError: { message: "timeout" },
  });
  assert.equal(await recordPurchase(PAYMENT_ID, "user_a"), null);
  assert.equal(calls.inserts.length, 1);
  assert.equal(calls.reports[0].kind, "entitlement_failed");
});

test("applyEntitlement reports success/failure for the reconciler", async () => {
  const ok = harness();
  assert.equal(await ok.applyEntitlement("featured_property", "u", "p"), true);
  assert.equal(await ok.applyEntitlement("contact_owner", "u", "p"), true);
  assert.equal(ok.calls.grants.length, 1);

  const bad = harness({ grantError: { message: "nope" } });
  assert.equal(await bad.applyEntitlement("featured_property", "u", "p"), false);
});

test("onRecorded fires once per new payment, not on a same-payment retry", async () => {
  const seen = [];
  const make = (insertError) =>
    createPurchaseRecorder({
      fetchPayment: async () => payment(),
      insertPurchase: async () => ({ error: insertError }),
      grantFeatured: async () => ({ error: null }),
      report() {},
      onRecorded: (row) => {
        seen.push(row.payment_id);
      },
      sleep: async () => {},
    });
  assert.equal(await make(null).recordPurchase(PAYMENT_ID, "user_a"), null);
  assert.deepEqual(seen, [PAYMENT_ID]);

  const dup = { code: "23505", message: 'duplicate key value violates unique constraint "purchases_payment_id_key"' };
  assert.equal(await make(dup).recordPurchase(PAYMENT_ID, "user_a"), null);
  assert.deepEqual(seen, [PAYMENT_ID], "retry must not re-send the receipt");
});

test("a throwing onRecorded hook never fails the purchase", async () => {
  const recorder = createPurchaseRecorder({
    fetchPayment: async () => payment(),
    insertPurchase: async () => ({ error: null }),
    grantFeatured: async () => ({ error: null }),
    report() {},
    onRecorded() {
      throw new Error("resend down");
    },
    sleep: async () => {},
  });
  assert.equal(await recorder.recordPurchase(PAYMENT_ID, "user_a"), null);
});
