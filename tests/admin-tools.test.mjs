import assert from "node:assert/strict";
import test from "node:test";

import {
  ageLabel,
  canBan,
  listingSearchFilter,
  parseListingFilters,
  parsePage,
  sanitizeSearch,
  sumPaise,
  validateDesignAction,
  validateOrderAction,
  validateUserAction,
} from "../lib/admin-tools.ts";

test("validateDesignAction accepts only unpublish, with an optional trimmed note", () => {
  assert.deepEqual(validateDesignAction({ action: "unpublish" }), { action: "unpublish", note: null });
  assert.deepEqual(validateDesignAction({ action: "unpublish", note: "  spam  " }), {
    action: "unpublish",
    note: "spam",
  });
  assert.equal(typeof validateDesignAction({ action: "delete" }), "string");
  assert.equal(typeof validateDesignAction({ action: "publish" }), "string");
  assert.equal(typeof validateDesignAction(null), "string");
});

test("parsePage clamps to a positive, bounded integer", () => {
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage("0"), 1);
  assert.equal(parsePage("-4"), 1);
  assert.equal(parsePage("abc"), 1);
  assert.equal(parsePage(["7", "9"]), 7);
  assert.equal(parsePage("999999"), 1000);
});

test("sanitizeSearch strips PostgREST filter syntax so it can't inject a filter", () => {
  assert.equal(sanitizeSearch("Sector 15"), "Sector 15");
  assert.equal(sanitizeSearch("a,status.eq.live)"), "a status.eq.live");
  assert.equal(sanitizeSearch("%_*\\:\"x"), "_ x");
  assert.equal(sanitizeSearch("   "), "");
  assert.equal(sanitizeSearch("x".repeat(200)).length, 80);
});

test("listingSearchFilter builds an ilike OR across text columns", () => {
  assert.equal(listingSearchFilter(""), null);
  assert.equal(
    listingSearchFilter("rose"),
    "building_name.ilike.%rose%,address.ilike.%rose%,city.ilike.%rose%,id.ilike.%rose%",
  );
});

test("parseListingFilters defaults unknown status to all", () => {
  assert.deepEqual(parseListingFilters({}), { q: "", status: "all", page: 1 });
  assert.deepEqual(parseListingFilters({ status: "pending", q: " Mohali ", page: "2" }), {
    q: "Mohali",
    status: "pending",
    page: 2,
  });
  assert.equal(parseListingFilters({ status: "deleted" }).status, "all");
});

test("user and order actions accept only their own verbs", () => {
  assert.deepEqual(validateUserAction({ action: "ban", note: " spam " }), { action: "ban", note: "spam" });
  assert.deepEqual(validateUserAction({ action: "unban" }), { action: "unban", note: null });
  assert.equal(typeof validateUserAction({ action: "delete" }), "string");
  assert.deepEqual(validateOrderAction({ action: "refunded" }), { action: "refunded", note: null });
  assert.equal(typeof validateOrderAction({ action: "ban" }), "string");
});

test("canBan refuses self-bans and banning admins", () => {
  assert.equal(canBan("user_a", "user_b", false), null);
  assert.match(canBan("user_a", "user_a", false), /yourself/);
  assert.match(canBan("user_a", "user_b", true), /admin/);
});

test("sumPaise ignores null amounts", () => {
  assert.equal(sumPaise([{ amount: 5000 }, { amount: null }, { amount: 25000 }]), 30000);
  assert.equal(sumPaise([]), 0);
});

test("ageLabel reads naturally", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  assert.equal(ageLabel(null, now), "—");
  assert.equal(ageLabel("2026-10-24T11:30:00Z", now), "under an hour");
  assert.equal(ageLabel("2026-10-24T07:00:00Z", now), "5 hours");
  assert.equal(ageLabel("2026-10-20T12:00:00Z", now), "4 days");
});
