import assert from "node:assert/strict";
import test from "node:test";

import {
  BUSINESS,
  filled,
  hasSupportEmail,
  isPlaceholder,
  legalEntityName,
  orFallback,
} from "../lib/business.ts";

test("isPlaceholder: bracketed, empty and missing values are unfilled", () => {
  assert.equal(isPlaceholder("[SUPPORT EMAIL]"), true);
  assert.equal(isPlaceholder("  [LEGAL ENTITY NAME]  "), true);
  assert.equal(isPlaceholder("[]"), true);
  assert.equal(isPlaceholder(""), true);
  assert.equal(isPlaceholder("   "), true);
  assert.equal(isPlaceholder(undefined), true);
  assert.equal(isPlaceholder(null), true);
});

test("isPlaceholder: real values (even with brackets inside) are filled", () => {
  assert.equal(isPlaceholder("support@archit.in"), false);
  assert.equal(isPlaceholder("Acme Pvt Ltd"), false);
  assert.equal(isPlaceholder("Flat 2 [rear], MG Road"), false);
  assert.equal(isPlaceholder("[a] and [b]"), false);
});

test("filled returns the trimmed value or null", () => {
  assert.equal(filled("[GST NUMBER]"), null);
  assert.equal(filled(""), null);
  assert.equal(filled("  Pune "), "Pune");
});

test("orFallback swaps in neutral wording only while unfilled", () => {
  assert.equal(orFallback("[LEGAL ENTITY NAME]", "the operator"), "the operator");
  assert.equal(orFallback("Acme Pvt Ltd", "the operator"), "Acme Pvt Ltd");
});

test("BUSINESS keeps its existing shape and the derived values agree", () => {
  for (const key of [
    "legalName",
    "address",
    "supportEmail",
    "supportPhone",
    "grievanceOfficer",
    "responseTime",
    "lastUpdated",
  ]) {
    assert.equal(typeof BUSINESS[key], "string", key);
  }
  assert.equal(isPlaceholder(BUSINESS.lastUpdated), false);
  assert.equal(hasSupportEmail, BUSINESS.supportEmail.includes("@"));
  assert.equal(
    legalEntityName,
    isPlaceholder(BUSINESS.legalName) ? "the operator of ArchIt" : BUSINESS.legalName.trim(),
  );
  assert.ok(!legalEntityName.includes("["));
});
