import assert from "node:assert/strict";
import test from "node:test";

import {
  designsSummary,
  listingMapHref,
  listingPriceLabel,
  listingPublicHref,
  listingStatusView,
  listingsSummary,
  listingTitle,
} from "../app/(app)/dashboard/listing-status.ts";

test("live listings are public and labelled Live", () => {
  const v = listingStatusView("live", "looks great");
  assert.equal(v.label, "Live");
  assert.equal(v.tone, "live");
  assert.equal(v.isPublic, true);
  assert.equal(v.note, null, "an approval note isn't surfaced");
});

test("pending listings are in review and private", () => {
  const v = listingStatusView("pending");
  assert.equal(v.label, "In review");
  assert.equal(v.tone, "review");
  assert.equal(v.isPublic, false);
  assert.match(v.help, /admin/);
});

test("a stale rejection note is hidden once the listing is back in review", () => {
  assert.equal(listingStatusView("pending", "blurry photos").note, null);
});

test("rejected listings show the reviewer's note, trimmed", () => {
  const v = listingStatusView("rejected", "  Photos are not of this property  ");
  assert.equal(v.label, "Not approved");
  assert.equal(v.tone, "rejected");
  assert.equal(v.isPublic, false);
  assert.equal(v.note, "Photos are not of this property");
  assert.match(v.help, /Edit/);
});

test("rejected with no or blank note has note null", () => {
  for (const n of [null, undefined, "", "   "]) {
    assert.equal(listingStatusView("rejected", n).note, null);
  }
});

test("unknown or missing status never claims the listing is public", () => {
  for (const s of [null, undefined, "", "archived", "LIVE"]) {
    const v = listingStatusView(s);
    assert.equal(v.tone, "review", String(s));
    assert.equal(v.isPublic, false, String(s));
  }
});

test("links encode the id", () => {
  assert.equal(listingMapHref("abc-123"), "/find?property=abc-123");
  assert.equal(listingPublicHref("abc-123"), "/property/abc-123");
  assert.equal(listingMapHref("a&b=c"), "/find?property=a%26b%3Dc");
  assert.equal(listingPublicHref("../x"), "/property/..%2Fx");
});

test("price label matches formatPrice: Indian grouping, /mo for rent", () => {
  assert.equal(listingPriceLabel(4500000, "sale"), "₹45,00,000");
  assert.equal(listingPriceLabel(25000, "rent"), "₹25,000/mo");
  assert.equal(listingPriceLabel(Number.NaN, "sale"), "₹0");
});

test("title falls back from building name to address", () => {
  assert.equal(listingTitle({ buildingName: "Sky Towers", address: "1 MG Road" }), "Sky Towers");
  assert.equal(listingTitle({ buildingName: "  ", address: "1 MG Road" }), "1 MG Road");
  assert.equal(listingTitle({ buildingName: null, address: "" }), "Untitled listing");
});

test("listingsSummary counts by tone and skips zeros", () => {
  assert.equal(listingsSummary([]), "No listings yet");
  assert.equal(listingsSummary(["live"]), "1 live");
  assert.equal(
    listingsSummary(["live", "live", "pending", "rejected", null]),
    "2 live · 2 in review · 1 not approved",
  );
});

test("designsSummary pluralises and handles empty", () => {
  assert.equal(designsSummary(0), "No designs yet");
  assert.equal(designsSummary(-1), "No designs yet");
  assert.equal(designsSummary(Number.NaN), "No designs yet");
  assert.equal(designsSummary(1), "1 saved design");
  assert.equal(designsSummary(3), "3 saved designs");
});
