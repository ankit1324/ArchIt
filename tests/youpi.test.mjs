import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

// lib/youpi-signature.ts is the pure half of lib/youpi.ts — no "server-only",
// no env reads — so the webhook signature check is tested against the real code.
import { paiseToRupees, verifyWebhookSignature } from "../lib/youpi-signature.ts";

const SECRET = "whsec_test_9f82b71e";
const BODY = JSON.stringify({
  event: "SUCCESS",
  paymentId: "c7942127-14e3-469a-9e4a-9359a16f903a",
  orderId: "contact_owner_m1abc_9f3a2c1d",
  amount: "50.00",
  amountPaise: 5000,
  currency: "INR",
  metadata: { purpose: "contact_owner", userId: "user_1", ref: "prop_1" },
});
const sign = (body, secret = SECRET) =>
  createHmac("sha256", secret).update(body, "utf8").digest("hex");

test("accepts a correctly signed body, with or without the sha256= prefix", () => {
  assert.equal(verifyWebhookSignature(BODY, `sha256=${sign(BODY)}`, SECRET), true);
  assert.equal(verifyWebhookSignature(BODY, sign(BODY), SECRET), true);
  assert.equal(verifyWebhookSignature(BODY, `  sha256=${sign(BODY)}  `, SECRET), true);
  assert.equal(verifyWebhookSignature(BODY, `sha256=${sign(BODY).toUpperCase()}`, SECRET), true);
});

test("rejects a body signed with another secret", () => {
  assert.equal(
    verifyWebhookSignature(BODY, `sha256=${sign(BODY, "someone-elses-secret")}`, SECRET),
    false,
  );
});

test("rejects a tampered body", () => {
  const sig = `sha256=${sign(BODY)}`;
  const tampered = BODY.replace('"amountPaise":5000', '"amountPaise":200000');
  assert.notEqual(tampered, BODY);
  assert.equal(verifyWebhookSignature(tampered, sig, SECRET), false);
});

test("rejects missing, empty, malformed or truncated signatures", () => {
  const good = sign(BODY);
  for (const header of [null, undefined, "", "sha256=", "sha256=zz", good.slice(0, 63), `${good}0`, "sha256=not-hex"]) {
    assert.equal(verifyWebhookSignature(BODY, header, SECRET), false, String(header));
  }
});

test("never verifies when the secret is unset", () => {
  // Misconfiguration must fail closed: an empty secret would otherwise let a
  // forged webhook through if HMAC("") happened to be computed on both sides.
  assert.equal(verifyWebhookSignature(BODY, `sha256=${sign(BODY, "")}`, ""), false);
  assert.equal(verifyWebhookSignature(BODY, `sha256=${sign(BODY, "")}`, undefined), false);
});

test("formats paise as a two-decimal rupee string for the gateway", () => {
  assert.equal(paiseToRupees(5000), "50.00");
  assert.equal(paiseToRupees(9900), "99.00");
  assert.equal(paiseToRupees(25000), "250.00");
  assert.equal(paiseToRupees(200000), "2000.00");
  assert.equal(paiseToRupees(1), "0.01");
});
