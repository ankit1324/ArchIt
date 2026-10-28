import assert from "node:assert/strict";
import test from "node:test";

import {
  createOrderHandler,
  gatewayFailureStatus,
  paymentsDisabled,
  validateOrderBody,
} from "../lib/create-order.ts";
import { FEES } from "../lib/fees.ts";

const USER = "user_a";
const OTHER = "user_b";

class FakeGatewayError extends Error {
  constructor(status) {
    super(`gateway ${status}`);
    this.status = status;
  }
}

/** A handler wired to in-memory fakes; `calls` records every side effect. */
function harness({
  paywallEnabled = true,
  property = { user_id: OTHER, owner: "+91 98765 43210", status: "live" },
  propertyError = null,
  owned = { ok: true, granted: false },
  payment = { paymentId: "pay_1", orderId: "ord_1", checkoutUrl: "https://pay.test/checkout/pay_1" },
  paymentError = null,
  logResult = { error: null },
  paidTemplates = new Set(["office_1"]),
} = {}) {
  const calls = { lookups: [], owned: [], payments: [], logs: [] };
  const createOrder = createOrderHandler({
    paywallEnabled,
    async lookupProperty(id) {
      calls.lookups.push(id);
      return { data: property, error: propertyError };
    },
    isPaidTemplateKey: (key) => paidTemplates.has(key),
    async hasPurchase(userId, purpose, ref) {
      calls.owned.push({ userId, purpose, ref });
      return owned;
    },
    async createPayment(input) {
      calls.payments.push(input);
      if (paymentError) throw paymentError;
      return payment;
    },
    async logOrder(row) {
      calls.logs.push(row);
      if (logResult instanceof Error) throw logResult;
      return logResult;
    },
    newOrderId: (purpose) => `${purpose}_test_0001`,
    portalUrl: () => "https://pay.test",
    gatewayErrorStatus: (e) => (e instanceof FakeGatewayError ? e.status : undefined),
  });
  return { createOrder, calls };
}

test("paywall off: 410 and nothing is touched", async () => {
  assert.deepEqual(paymentsDisabled(false), { status: 410, body: { error: "payments are disabled" } });
  assert.equal(paymentsDisabled(true), null);

  const { createOrder, calls } = harness({ paywallEnabled: false });
  const res = await createOrder(USER, { purpose: "builder_unlock", ref: "" });
  assert.equal(res.status, 410);
  assert.deepEqual(calls, { lookups: [], owned: [], payments: [], logs: [] });
});

test("body validation: unknown purpose and bad refs are refused", () => {
  assert.equal(validateOrderBody({ purpose: "toString" }), "unknown purpose");
  assert.equal(validateOrderBody({ purpose: "add_property" }), "unknown purpose");
  assert.equal(validateOrderBody({ purpose: 5 }), "unknown purpose");
  assert.equal(validateOrderBody({}), "unknown purpose");
  assert.equal(validateOrderBody({ purpose: "contact_owner", ref: 7 }), "invalid ref");
  assert.equal(validateOrderBody({ purpose: "contact_owner", ref: "x".repeat(65) }), "invalid ref");
  assert.deepEqual(validateOrderBody({ purpose: "builder_unlock" }), { purpose: "builder_unlock", ref: "" });
  assert.deepEqual(validateOrderBody({ purpose: "builder_unlock", ref: null }), { purpose: "builder_unlock", ref: "" });
  assert.deepEqual(validateOrderBody({ purpose: "contact_owner", ref: "p1" }), { purpose: "contact_owner", ref: "p1" });
});

test("happy path: fixed amount, metadata, logged order, response shape", async () => {
  const { createOrder, calls } = harness();
  const res = await createOrder(USER, { purpose: "contact_owner", ref: "prop_1" });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    paymentId: "pay_1",
    orderId: "ord_1",
    amount: FEES.contact_owner,
    currency: "INR",
    checkoutUrl: "https://pay.test/checkout/pay_1",
    portalUrl: "https://pay.test",
  });
  assert.deepEqual(calls.lookups, ["prop_1"]);
  assert.equal(calls.payments.length, 1);
  assert.equal(calls.payments[0].orderId, "contact_owner_test_0001");
  assert.equal(calls.payments[0].amountPaise, FEES.contact_owner);
  assert.deepEqual(calls.payments[0].metadata, { purpose: "contact_owner", userId: USER, ref: "prop_1" });
  assert.match(calls.payments[0].description, /₹50/);
  assert.deepEqual(calls.logs, [
    {
      order_id: "contact_owner_test_0001",
      payment_id: "pay_1",
      user_id: USER,
      purpose: "contact_owner",
      ref: "prop_1",
      amount: FEES.contact_owner,
    },
  ]);
});

test("builder_unlock: no ref, no property lookup, ledger checked without a ref", async () => {
  const { createOrder, calls } = harness();
  const res = await createOrder(USER, { purpose: "builder_unlock", ref: "" });
  assert.equal(res.status, 200);
  assert.deepEqual(calls.lookups, []);
  assert.deepEqual(calls.owned, [{ userId: USER, purpose: "builder_unlock", ref: undefined }]);
  assert.equal(calls.logs[0].ref, null);

  const withRef = await harness().createOrder(USER, { purpose: "builder_unlock", ref: "x" });
  assert.deepEqual(withRef, { status: 400, body: { error: "builder_unlock takes no ref" } });
});

test("template_unlock: only paid template keys", async () => {
  assert.equal((await harness().createOrder(USER, { purpose: "template_unlock", ref: "office_1" })).status, 200);
  const free = harness();
  const res = await free.createOrder(USER, { purpose: "template_unlock", ref: "studio_free" });
  assert.deepEqual(res, { status: 400, body: { error: "unknown or free template" } });
  assert.equal(free.calls.payments.length, 0);
  assert.equal(
    (await harness().createOrder(USER, { purpose: "template_unlock", ref: "" })).body.error,
    "template ref required",
  );
});

test("featured_property: only the lister's own listing", async () => {
  const mine = harness({ property: { user_id: USER, owner: null, status: "live" } });
  assert.equal((await mine.createOrder(USER, { purpose: "featured_property", ref: "p1" })).status, 200);

  for (const property of [{ user_id: OTHER, owner: null }, null, { user_id: null, owner: null }]) {
    const h = harness({ property });
    const res = await h.createOrder(USER, { purpose: "featured_property", ref: "p1" });
    assert.deepEqual(res, { status: 400, body: { error: "property not found or not yours" } });
    assert.equal(h.calls.payments.length, 0);
  }
  assert.equal(
    (await harness().createOrder(USER, { purpose: "featured_property", ref: "" })).body.error,
    "property ref required",
  );
});

test("contact_owner: someone else's listing with an owner contact", async () => {
  const cases = [
    [null, "property not found"],
    [{ user_id: USER, owner: "x", status: "live" }, "you already own this listing"],
    [{ user_id: OTHER, owner: "   ", status: "live" }, "listing has no owner contact to unlock"],
    [{ user_id: OTHER, owner: null, status: "live" }, "listing has no owner contact to unlock"],
    [{ user_id: OTHER, owner: "+91 98765 43210", status: "pending" }, "listing is not live"],
    [{ user_id: OTHER, owner: "+91 98765 43210", status: "rejected" }, "listing is not live"],
  ];
  for (const [property, error] of cases) {
    const h = harness({ property });
    assert.deepEqual(await h.createOrder(USER, { purpose: "contact_owner", ref: "p1" }), {
      status: 400,
      body: { error },
    });
    assert.equal(h.calls.payments.length, 0);
  }
});

test("a failed property lookup is a 500, never a session", async () => {
  const h = harness({ propertyError: { message: "boom" } });
  assert.deepEqual(await h.createOrder(USER, { purpose: "contact_owner", ref: "p1" }), {
    status: 500,
    body: { error: "internal error" },
  });
  assert.equal(h.calls.payments.length, 0);
});

test("already owned: 409 and the gateway is never called", async () => {
  const h = harness({ owned: { ok: true, granted: true } });
  assert.deepEqual(await h.createOrder(USER, { purpose: "contact_owner", ref: "p1" }), {
    status: 409,
    body: { error: "already purchased" },
  });
  assert.deepEqual(h.calls.owned, [{ userId: USER, purpose: "contact_owner", ref: "p1" }]);
  assert.equal(h.calls.payments.length, 0);
});

test("a failed ledger check is a 500, never a session", async () => {
  const h = harness({ owned: { ok: false, error: "internal error" } });
  assert.equal((await h.createOrder(USER, { purpose: "builder_unlock", ref: "" })).status, 500);
  assert.equal(h.calls.payments.length, 0);
});

test("featured_property on a listing in review is still sold", async () => {
  for (const status of ["pending", "rejected"]) {
    const h = harness({ property: { user_id: USER, owner: null, status } });
    assert.equal((await h.createOrder(USER, { purpose: "featured_property", ref: "p1" })).status, 200, status);
  }
});

test("a failed order log aborts the checkout", async () => {
  // recordPurchase refuses a payment without its payment_orders row, so a
  // checkout handed out without one would take money we then cannot record
  for (const logResult of [{ error: { message: "insert failed" } }, new Error("network")]) {
    const h = harness({ logResult });
    const res = await h.createOrder(USER, { purpose: "builder_unlock", ref: "" });
    assert.deepEqual(res, { status: 503, body: { error: "order creation failed" } });
    assert.equal(res.body.checkoutUrl, undefined);
    assert.equal(h.calls.logs.length, 1);
  }
});

test("gateway error mapping: 401→500, 504→504, other→502, non-gateway→502", async () => {
  assert.equal(gatewayFailureStatus(401), 500);
  assert.equal(gatewayFailureStatus(504), 504);
  assert.equal(gatewayFailureStatus(500), 502);
  assert.equal(gatewayFailureStatus(422), 502);
  assert.equal(gatewayFailureStatus(undefined), 502);

  for (const [err, status] of [
    [new FakeGatewayError(401), 500],
    [new FakeGatewayError(504), 504],
    [new FakeGatewayError(503), 502],
    [new FakeGatewayError(400), 502],
    [new Error("YOUPI_API_URL unset"), 502],
  ]) {
    const h = harness({ paymentError: err });
    const res = await h.createOrder(USER, { purpose: "builder_unlock", ref: "" });
    assert.deepEqual(res, { status, body: { error: "order creation failed" } }, err.message);
    assert.equal(h.calls.logs.length, 0, "no order logged when no session opened");
  }
});

test("missing checkoutUrl or paymentId: 502 and nothing logged", async () => {
  for (const payment of [
    { paymentId: "pay_1", orderId: "o" },
    { checkoutUrl: "https://pay.test/checkout/x", orderId: "o" },
    null,
  ]) {
    const h = harness({ payment });
    const res = await h.createOrder(USER, { purpose: "builder_unlock", ref: "" });
    assert.deepEqual(res, { status: 502, body: { error: "order creation failed" } });
    assert.equal(h.calls.logs.length, 0);
  }
});
