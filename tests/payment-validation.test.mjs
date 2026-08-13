import assert from "node:assert/strict";
import test from "node:test";

// These are the real shipped decisions, imported directly: lib/payment-validation.ts
// deliberately has no Razorpay/Supabase/"server-only" imports so the money logic
// is testable without standing up any of it.
import {
  checkPayment,
  isFeePurpose,
  isSamePaymentConflict,
} from "../lib/payment-validation.ts";
// the real fee table, so these assert against shipped prices rather than copies
import { FEES } from "../lib/fees.ts";

// checkPayment logs every rejection by design; keep the test output readable.
console.error = () => {};

const ORDER = "order_NfP9k2LmQ1xYzA";
const PAYMENT = "pay_NfP9k9ZzT4bWqR";

/** A payment that should pass every gate, minus whatever the test breaks. */
function payment(overrides = {}) {
  return {
    order_id: ORDER,
    status: "captured",
    amount: 5000,
    currency: "INR",
    ...overrides,
  };
}

function check(p, purpose = "contact_owner") {
  return checkPayment(p, {
    orderId: ORDER,
    purpose,
    paymentId: PAYMENT,
    expectedAmount: FEES[purpose],
  });
}

test("accepts a captured payment of the exact fee for every purpose", () => {
  assert.equal(check(payment({ amount: 5000 }), "contact_owner"), null);
  assert.equal(check(payment({ amount: 25000 }), "featured_property"), null);
  assert.equal(check(payment({ amount: 200000 }), "builder_unlock"), null);
});

test("rejects a payment captured against a different order", () => {
  // A payment id stolen from someone else's order must not buy anything here.
  assert.deepEqual(check(payment({ order_id: "order_SomeoneElse" })), {
    error: "payment does not match order",
    status: 400,
  });
});

test("defers an authorized-but-uncaptured payment instead of granting it", () => {
  // Authorized holds auto-void after a few days, so this must not grant. But it
  // is a live payment mid-capture, so it is 202 (webhook will finish it), not a
  // hard failure that tells the user their payment broke.
  assert.deepEqual(check(payment({ status: "authorized" })), {
    error: "payment processing",
    status: 202,
  });
});

test("rejects failed and created payments outright", () => {
  for (const status of ["failed", "created"]) {
    assert.deepEqual(
      check(payment({ status })),
      { error: "payment not captured", status: 402 },
      `status "${status}" must not be treated as paid`,
    );
  }
});

test("never grants on any non-captured status", () => {
  // Whatever the status, a non-captured payment must not return null (= granted).
  for (const status of ["authorized", "failed", "created", "refunded", ""]) {
    assert.notEqual(
      check(payment({ status })),
      null,
      `status "${status}" must never be treated as a completed purchase`,
    );
  }
});

test("rejects an underpayment for the requested purpose", () => {
  // ₹50 paid, ₹2000 product.
  assert.deepEqual(check(payment({ amount: 5000 }), "builder_unlock"), {
    error: "payment amount mismatch",
    status: 400,
  });
});

test("accepts a correct amount delivered as a string", () => {
  // Razorpay sometimes serialises amount as a string; Number() coercion must
  // not false-reject a genuinely good payment.
  assert.equal(check(payment({ amount: "200000" }), "builder_unlock"), null);
  assert.equal(check(payment({ amount: "5000" }), "contact_owner"), null);
});

test("rejects a payment in the wrong currency", () => {
  // 200000 USD-cents is not 200000 paise.
  assert.deepEqual(check(payment({ currency: "USD" })), {
    error: "payment currency mismatch",
    status: 400,
  });
});

test("reports the order mismatch before the amount mismatch", () => {
  // Pins guard ordering so a refactor cannot silently reorder the checks and
  // start leaking "which order was this?" through the error body.
  assert.deepEqual(
    check(payment({ order_id: "order_SomeoneElse", amount: 1 })),
    { error: "payment does not match order", status: 400 },
  );
});

test("treats a payment_id unique violation as the same payment arriving twice", () => {
  assert.equal(
    isSamePaymentConflict({
      message:
        'duplicate key value violates unique constraint "purchases_payment_id_key"',
      details: "Key (payment_id)=(pay_NfP9k9ZzT4bWqR) already exists.",
    }),
    true,
  );
});

test("treats entitlement index violations as a second, distinct charge", () => {
  for (const constraint of [
    "purchases_one_time",
    "purchases_contact_ref",
    "purchases_featured_ref",
  ]) {
    assert.equal(
      isSamePaymentConflict({
        message: `duplicate key value violates unique constraint "${constraint}"`,
        details: "Key (user_id, purpose)=(user_123, builder_unlock) already exists.",
      }),
      false,
      `${constraint} means money owed back, not an idempotent replay`,
    );
  }
});

test("finds the constraint name in details when the message omits it", () => {
  assert.equal(
    isSamePaymentConflict({
      message: "duplicate key value violates unique constraint",
      details: 'Conflicting constraint: purchases_payment_id_key',
    }),
    true,
  );
});

test("tolerates a conflict error with no details", () => {
  for (const details of [undefined, null]) {
    assert.equal(
      isSamePaymentConflict({ message: "duplicate key value", details }),
      false,
    );
    assert.equal(
      isSamePaymentConflict({
        message:
          'duplicate key value violates unique constraint "purchases_payment_id_key"',
        details,
      }),
      true,
    );
  }
  assert.equal(isSamePaymentConflict({ message: "duplicate key value" }), false);
});

test("accepts the three real fee purposes", () => {
  assert.equal(isFeePurpose("contact_owner"), true);
  assert.equal(isFeePurpose("featured_property"), true);
  assert.equal(isFeePurpose("builder_unlock"), true);
});

test("rejects anything that is not a fee purpose", () => {
  assert.equal(isFeePurpose("banana"), false);
  assert.equal(isFeePurpose(""), false);
});

test("rejects inherited Object.prototype keys as fee purposes", () => {
  // `value in FEES` walks the prototype chain, so these currently pass the
  // guard and reach FEES[purpose], which yields a function instead of a price.
  assert.equal(isFeePurpose("toString"), false);
  assert.equal(isFeePurpose("constructor"), false);
});
