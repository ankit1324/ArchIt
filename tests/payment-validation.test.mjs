import assert from "node:assert/strict";
import test from "node:test";

// These are the real shipped decisions, imported directly: lib/payment-validation.ts
// deliberately has no gateway/Supabase/"server-only" imports so the money logic
// is testable without standing up any of it.
import {
  checkPayment,
  FEE_PURPOSES,
  isFeePurpose,
  isSamePaymentConflict,
} from "../lib/payment-validation.ts";
// the real fee table, so these assert against shipped prices rather than copies
import { FEES } from "../lib/fees.ts";

// checkPayment logs every rejection by design; keep the test output readable.
console.error = () => {};

const ORDER = "contact_owner_m1abc_9f3a2c1d";
const PAYMENT = "c7942127-14e3-469a-9e4a-9359a16f903a";

/** A payment that should pass every gate, minus whatever the test breaks. */
function payment(overrides = {}) {
  return {
    orderId: ORDER,
    status: "SUCCESS",
    amountPaise: "5000",
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

test("accepts a successful payment of the exact fee for every purpose", () => {
  assert.equal(check(payment({ amountPaise: "5000" }), "contact_owner"), null);
  assert.equal(check(payment({ amountPaise: "25000" }), "featured_property"), null);
  assert.equal(check(payment({ amountPaise: "200000" }), "builder_unlock"), null);
  assert.equal(check(payment({ amountPaise: "9900" }), "template_unlock"), null);
});

test("rejects a payment completed against a different order", () => {
  // A payment id stolen from someone else's order must not buy anything here.
  assert.deepEqual(check(payment({ orderId: "builder_unlock_someone_else" })), {
    error: "payment does not match order",
    status: 400,
  });
});

test("defers a live, not-yet-verified session instead of granting it", () => {
  // The gateway is still inside its verification window. It must not grant, but
  // it is a real payment in flight, so it is 202 (webhook will finish it), not a
  // hard failure that tells the user their payment broke.
  for (const status of ["INITIATED", "ACTIVE", "QUEUED", "PROCESSING"]) {
    assert.deepEqual(
      check(payment({ status })),
      { error: "payment processing", status: 202 },
      `status "${status}" is pending, not failed`,
    );
  }
});

test("rejects failed, expired and cancelled sessions outright", () => {
  for (const status of ["FAILED", "EXPIRED", "CANCELLED"]) {
    assert.deepEqual(
      check(payment({ status })),
      { error: "payment not completed", status: 402 },
      `status "${status}" must not be treated as paid`,
    );
  }
});

test("never grants on any non-SUCCESS status", () => {
  // Whatever the status, a non-SUCCESS payment must not return null (= granted).
  for (const status of ["PROCESSING", "FAILED", "EXPIRED", "CANCELLED", "success", "", undefined]) {
    assert.notEqual(
      check(payment({ status })),
      null,
      `status "${status}" must never be treated as a completed purchase`,
    );
  }
});

test("rejects an underpayment for the requested purpose", () => {
  // ₹50 paid, ₹2000 product.
  assert.deepEqual(check(payment({ amountPaise: "5000" }), "builder_unlock"), {
    error: "payment amount mismatch",
    status: 400,
  });
});

test("accepts a correct amount delivered as a number", () => {
  // The gateway serialises amountPaise as a string; the webhook body as a
  // number. Number() coercion must not false-reject a genuinely good payment.
  assert.equal(check(payment({ amountPaise: 200000 }), "builder_unlock"), null);
  assert.equal(check(payment({ amountPaise: 5000 }), "contact_owner"), null);
});

test("does not accept the rupee amount in place of paise", () => {
  // "50.00" is the rupee field; a refactor that reads it instead of amountPaise
  // must fail here, not in production.
  assert.notEqual(check(payment({ amountPaise: "50.00" }), "contact_owner"), null);
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
    check(payment({ orderId: "builder_unlock_someone_else", amountPaise: "1" })),
    { error: "payment does not match order", status: 400 },
  );
});

test("treats a payment_id unique violation as the same payment arriving twice", () => {
  assert.equal(
    isSamePaymentConflict({
      message:
        'duplicate key value violates unique constraint "purchases_payment_id_key"',
      details: "Key (payment_id)=(c7942127-14e3-469a-9e4a-9359a16f903a) already exists.",
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

test("accepts the four real fee purposes", () => {
  assert.equal(isFeePurpose("contact_owner"), true);
  assert.equal(isFeePurpose("featured_property"), true);
  assert.equal(isFeePurpose("builder_unlock"), true);
  assert.equal(isFeePurpose("template_unlock"), true);
});

test("every priced fee is an accepted purpose, and nothing else is", () => {
  // A purpose missing from FEE_PURPOSES charges the user and then fails to
  // record the purchase ("unknown purchase purpose"), so the lists must match.
  assert.deepEqual([...FEE_PURPOSES].sort(), Object.keys(FEES).sort());
  for (const purpose of Object.keys(FEES)) assert.equal(isFeePurpose(purpose), true, purpose);
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
