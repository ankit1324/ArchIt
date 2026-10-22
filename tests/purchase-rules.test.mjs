import assert from "node:assert/strict";
import test from "node:test";

// lib/purchase-rules.ts is import-free (FeePurpose import is type-only), so
// create-order's ref rules are tested against the shipped code.
import { refIsProperty, validatePurchaseRef } from "../lib/purchase-rules.ts";

const ME = "user_me";
const OTHER = "user_other";
const PAID = new Set(["off_startup", "oth_cafe"]);

function ctx(overrides = {}) {
  return {
    userId: ME,
    isPaidTemplateKey: (key) => PAID.has(key),
    property: null,
    ...overrides,
  };
}

const ok = { ok: true };
const fails = (r) => assert.equal(r.ok, false, JSON.stringify(r));

// --- builder_unlock --------------------------------------------------------

test("builder_unlock accepts an absent or empty ref", () => {
  assert.deepEqual(validatePurchaseRef("builder_unlock", undefined, ctx()), ok);
  assert.deepEqual(validatePurchaseRef("builder_unlock", null, ctx()), ok);
  assert.deepEqual(validatePurchaseRef("builder_unlock", "", ctx()), ok);
});

test("builder_unlock rejects any ref", () => {
  // a stray ref would scope the ledger row and let the user buy it twice
  fails(validatePurchaseRef("builder_unlock", "anything", ctx()));
});

// --- template_unlock -------------------------------------------------------

test("template_unlock accepts a paid catalog key", () => {
  assert.deepEqual(validatePurchaseRef("template_unlock", "off_startup", ctx()), ok);
  assert.deepEqual(validatePurchaseRef("template_unlock", "oth_cafe", ctx()), ok);
});

test("template_unlock rejects a missing ref", () => {
  fails(validatePurchaseRef("template_unlock", undefined, ctx()));
  fails(validatePurchaseRef("template_unlock", "", ctx()));
  fails(validatePurchaseRef("template_unlock", null, ctx()));
});

test("template_unlock rejects unknown and free templates", () => {
  // `isPaidTemplateKey` is TEMPLATE_KEYS.has(k) && isPaidTemplate(k): a free
  // key (in_1bhk) and a made-up key both fail it — charging ₹99 for either
  // buys nothing.
  fails(validatePurchaseRef("template_unlock", "in_1bhk", ctx()));
  fails(validatePurchaseRef("template_unlock", "nope", ctx()));
});

test("template_unlock consults the injected catalog check with the ref", () => {
  const seen = [];
  const c = ctx({ isPaidTemplateKey: (k) => (seen.push(k), true) });
  assert.deepEqual(validatePurchaseRef("template_unlock", "x", c), ok);
  assert.deepEqual(seen, ["x"]);
});

// --- featured_property -----------------------------------------------------

test("featured_property accepts the caller's own listing", () => {
  const c = ctx({ property: { userId: ME, hasOwner: false } });
  assert.deepEqual(validatePurchaseRef("featured_property", "prop_1", c), ok);
});

test("featured_property rejects a missing ref", () => {
  const c = ctx({ property: { userId: ME, hasOwner: true } });
  fails(validatePurchaseRef("featured_property", "", c));
  fails(validatePurchaseRef("featured_property", undefined, c));
});

test("featured_property rejects a listing that does not exist", () => {
  fails(validatePurchaseRef("featured_property", "prop_404", ctx({ property: null })));
});

test("featured_property rejects someone else's listing", () => {
  // applyEntitlement scopes the boost to the payer; paying for another
  // user's row would succeed at the gateway and then flip nothing.
  const c = ctx({ property: { userId: OTHER, hasOwner: true } });
  fails(validatePurchaseRef("featured_property", "prop_2", c));
});

test("featured_property rejects a legacy listing with no lister", () => {
  const c = ctx({ property: { userId: null, hasOwner: true } });
  fails(validatePurchaseRef("featured_property", "prop_3", c));
});

// --- contact_owner ---------------------------------------------------------

test("contact_owner accepts another user's listing with an owner contact", () => {
  const c = ctx({ property: { userId: OTHER, hasOwner: true } });
  assert.deepEqual(validatePurchaseRef("contact_owner", "prop_2", c), ok);
});

test("contact_owner accepts a legacy listing with no lister but an owner", () => {
  const c = ctx({ property: { userId: null, hasOwner: true } });
  assert.deepEqual(validatePurchaseRef("contact_owner", "prop_3", c), ok);
});

test("contact_owner rejects a missing ref", () => {
  const c = ctx({ property: { userId: OTHER, hasOwner: true } });
  fails(validatePurchaseRef("contact_owner", "", c));
  fails(validatePurchaseRef("contact_owner", undefined, c));
});

test("contact_owner rejects a listing that does not exist", () => {
  fails(validatePurchaseRef("contact_owner", "prop_404", ctx({ property: null })));
});

test("contact_owner rejects the caller's own listing", () => {
  // the lister already sees their own contact for free
  const c = ctx({ property: { userId: ME, hasOwner: true } });
  fails(validatePurchaseRef("contact_owner", "prop_1", c));
});

test("contact_owner rejects a listing with nothing to unlock", () => {
  // ₹50 for an empty field is a refund waiting to happen
  const c = ctx({ property: { userId: OTHER, hasOwner: false } });
  fails(validatePurchaseRef("contact_owner", "prop_2", c));
});

// --- helpers ---------------------------------------------------------------

test("every failure carries a human-readable error", () => {
  const cases = [
    ["builder_unlock", "x", ctx()],
    ["template_unlock", "", ctx()],
    ["featured_property", "p", ctx({ property: null })],
    ["contact_owner", "p", ctx({ property: { userId: ME, hasOwner: true } })],
  ];
  for (const [purpose, ref, c] of cases) {
    const r = validatePurchaseRef(purpose, ref, c);
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, "string");
    assert.ok(r.error.length > 0, purpose);
  }
});

test("refIsProperty is true only for the two property-scoped purposes", () => {
  assert.equal(refIsProperty("featured_property"), true);
  assert.equal(refIsProperty("contact_owner"), true);
  assert.equal(refIsProperty("builder_unlock"), false);
  assert.equal(refIsProperty("template_unlock"), false);
});
