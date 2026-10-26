import assert from "node:assert/strict";
import test from "node:test";

import {
  canViewListing,
  changesReviewedContent,
  designEditNeedsReview,
  hasVerifiedAdminEmail,
  isAdminIdentity,
  onlyLive,
  onlyVisible,
  parseAdminEmails,
  parseAdminIds,
  statusAfterEdit,
  validateListingDecision,
  validateReport,
  validateReportDecision,
  MAX_REPORT_DETAILS,
} from "../lib/moderation.ts";

/** Records the filter calls a Supabase query builder would receive. */
function fakeQuery() {
  const calls = [];
  const q = {
    eq(column, value) {
      calls.push(["eq", column, value]);
      return q;
    },
    or(filters) {
      calls.push(["or", filters]);
      return q;
    },
  };
  return { q, calls };
}

// --- public visibility -----------------------------------------------------

test("anonymous viewers only get live listings", () => {
  for (const userId of [undefined, null, ""]) {
    const { q, calls } = fakeQuery();
    onlyVisible(q, userId);
    assert.deepEqual(calls, [["eq", "status", "live"]]);
  }
});

test("signed-in viewers get live listings plus their own", () => {
  const { q, calls } = fakeQuery();
  onlyVisible(q, "user_2abcDEF123");
  assert.deepEqual(calls, [["or", "status.eq.live,user_id.eq.user_2abcDEF123"]]);
});

test("a malformed user id can't inject into the or() filter — falls back to live only", () => {
  for (const userId of ["x,status.eq.pending", "a)b", "user id", "u".repeat(65)]) {
    const { q, calls } = fakeQuery();
    onlyVisible(q, userId);
    assert.deepEqual(calls, [["eq", "status", "live"]], userId);
  }
});

test("onlyLive ignores the viewer entirely", () => {
  const { q, calls } = fakeQuery();
  onlyLive(q);
  assert.deepEqual(calls, [["eq", "status", "live"]]);
});

test("canViewListing: live is public, the rest is lister/admin only", () => {
  const pending = { status: "pending", user_id: "user_owner" };
  const rejected = { status: "rejected", user_id: "user_owner" };
  const live = { status: "live", user_id: "user_owner" };

  assert.equal(canViewListing(live, null), true);
  assert.equal(canViewListing(live, "user_other"), true);

  for (const row of [pending, rejected]) {
    assert.equal(canViewListing(row, null), false);
    assert.equal(canViewListing(row, "user_other"), false);
    assert.equal(canViewListing(row, "user_owner"), true);
    assert.equal(canViewListing(row, "user_other", true), true);
  }
  // an unowned non-live row never matches a missing viewer
  assert.equal(canViewListing({ status: "pending", user_id: null }, null), false);
  // unknown/missing status is not live
  assert.equal(canViewListing({ user_id: "user_owner" }, "user_other"), false);
});

test("statusAfterEdit: rejected and pending go to review; live only on reviewed changes", () => {
  assert.equal(statusAfterEdit("rejected"), "pending");
  assert.equal(statusAfterEdit("rejected", false), "pending");
  assert.equal(statusAfterEdit("pending", false), "pending");
  assert.equal(statusAfterEdit("live", false), "live");
  assert.equal(statusAfterEdit("live", true), "pending");
  assert.equal(statusAfterEdit(null), "pending");
  assert.equal(statusAfterEdit("bogus", false), "pending");
});

test("changesReviewedContent: text, photos and contact count; numbers don't", () => {
  const row = { building_name: "Tower", owner: "9800000000", address: "Sec 17", city: "Chd", photos: ["a.jpg"], price: 100 };
  assert.equal(changesReviewedContent(row, { ...row, price: 999, beds: 4 }), false);
  assert.equal(changesReviewedContent(row, { ...row, building_name: null, owner: null }), true);
  assert.equal(changesReviewedContent(row, { ...row, photos: ["a.jpg", "b.jpg"] }), true);
  assert.equal(changesReviewedContent(row, { ...row, address: "Sec 18" }), true);
  // the cover image is reviewed too, even when photos[] is unchanged
  assert.equal(changesReviewedContent({ ...row, photo: "a.jpg" }, { ...row, photo: "evil.jpg" }), true);
  // null and undefined are the same "empty"
  assert.equal(changesReviewedContent({ ...row, owner: null }, { ...row, owner: undefined }), false);
});

// --- report validation ------------------------------------------------------

const ID = "3f1c2a9e-7b8d-4e2f-9a1b-0c3d4e5f6a7b";

test("accepts a minimal report and normalises details", () => {
  assert.deepEqual(validateReport({ propertyId: ID, reason: "fraud" }), {
    propertyId: ID,
    reason: "fraud",
    details: null,
  });
  assert.deepEqual(validateReport({ propertyId: ID, reason: "wrong_info", details: "  price is 10x  " }), {
    propertyId: ID,
    reason: "wrong_info",
    details: "price is 10x",
  });
  assert.equal(validateReport({ propertyId: ID, reason: "duplicate", details: "   " }).details, null);
});

test("rejects bad property ids", () => {
  for (const propertyId of [undefined, "", 42, "a/b", "x".repeat(65), "id;drop"]) {
    assert.equal(typeof validateReport({ propertyId, reason: "fraud" }), "string", String(propertyId));
  }
});

test("rejects unknown reasons, including prototype keys", () => {
  for (const reason of [undefined, "", "spam", "toString", "__proto__", 1]) {
    const r = validateReport({ propertyId: ID, reason });
    assert.equal(typeof r, "string", String(reason));
    assert.match(r, /reason must be one of/);
  }
});

test("rejects non-string and oversized details", () => {
  assert.equal(validateReport({ propertyId: ID, reason: "fraud", details: 5 }), "details must be a string");
  const long = "x".repeat(MAX_REPORT_DETAILS + 1);
  assert.match(validateReport({ propertyId: ID, reason: "fraud", details: long }), /at most/);
  assert.equal(
    validateReport({ propertyId: ID, reason: "fraud", details: "x".repeat(MAX_REPORT_DETAILS) }).details.length,
    MAX_REPORT_DETAILS,
  );
});

test("reason 'other' needs details", () => {
  assert.match(validateReport({ propertyId: ID, reason: "other" }), /required/);
  assert.match(validateReport({ propertyId: ID, reason: "other", details: "  " }), /required/);
  assert.equal(validateReport({ propertyId: ID, reason: "other", details: "agent posing as owner" }).reason, "other");
});

test("rejects non-object bodies", () => {
  for (const body of [null, [], "x", 3]) assert.equal(typeof validateReport(body), "string");
});

// --- admin decisions & identity ----------------------------------------------

test("listing and report decisions only accept their own actions", () => {
  assert.deepEqual(validateListingDecision({ action: "approve" }), { action: "approve", note: null });
  assert.deepEqual(validateListingDecision({ action: "reject", note: " blurry photos " }), {
    action: "reject",
    note: "blurry photos",
  });
  assert.equal(typeof validateListingDecision({ action: "takedown" }), "string");
  assert.equal(typeof validateReportDecision({ action: "approve" }), "string");
  assert.equal(validateReportDecision({ action: "takedown", note: "x".repeat(900) }).note.length, 500);
  assert.equal(typeof validateReportDecision({ action: "dismiss", note: 3 }), "string");
});

test("admin identity: env list or Clerk role, never anonymous", () => {
  const ids = parseAdminIds(" user_a, user_b\nuser_c ,, ");
  assert.deepEqual([...ids], ["user_a", "user_b", "user_c"]);
  assert.equal(parseAdminIds(undefined).size, 0);

  assert.equal(isAdminIdentity("user_b", ids), true);
  assert.equal(isAdminIdentity("user_z", ids), false);
  assert.equal(isAdminIdentity("user_z", ids, { role: "admin" }), true);
  assert.equal(isAdminIdentity("user_z", ids, { role: "Admin" }), false);
  assert.equal(isAdminIdentity(null, ids, { role: "admin" }), false);
  assert.equal(isAdminIdentity("", new Set([""])), false);
});

test("ADMIN_EMAILS: verified address grants admin, case-insensitively", () => {
  const admins = parseAdminEmails(" Owner@Example.com, second@example.com ");
  assert.equal(
    hasVerifiedAdminEmail([{ emailAddress: "owner@example.COM", verification: { status: "verified" } }], admins),
    true,
  );
});

test("ADMIN_EMAILS: an unverified address never grants admin", () => {
  const admins = parseAdminEmails("owner@example.com");
  assert.equal(
    hasVerifiedAdminEmail([{ emailAddress: "owner@example.com", verification: { status: "unverified" } }], admins),
    false,
  );
  assert.equal(hasVerifiedAdminEmail([{ emailAddress: "owner@example.com", verification: null }], admins), false);
  assert.equal(hasVerifiedAdminEmail([{ emailAddress: "owner@example.com" }], admins), false);
});

test("ADMIN_EMAILS: unlisted or empty list grants nothing", () => {
  const verified = [{ emailAddress: "someone@example.com", verification: { status: "verified" } }];
  assert.equal(hasVerifiedAdminEmail(verified, parseAdminEmails("owner@example.com")), false);
  assert.equal(hasVerifiedAdminEmail(verified, parseAdminEmails(undefined)), false);
  assert.equal(hasVerifiedAdminEmail(verified, parseAdminEmails("")), false);
});

test("designEditNeedsReview: snapshot, geometry or name changes re-queue attached listings", () => {
  const row = { name: "Home", snapshot: "https://x/a.webp", design: { v: 3, state: { blocks: [{ id: 1 }] } } };
  assert.equal(designEditNeedsReview(row, { ...row }), false);
  assert.equal(designEditNeedsReview(row, { ...row, design: { v: 3, state: { blocks: [{ id: 1 }] } } }), false);
  assert.equal(designEditNeedsReview(row, { ...row, snapshot: "https://x/b.webp" }), true);
  assert.equal(designEditNeedsReview(row, { ...row, design: { v: 3, state: { blocks: [{ id: 2 }] } } }), true);
  assert.equal(designEditNeedsReview(row, { ...row, name: "Other" }), true);
  assert.equal(designEditNeedsReview({ ...row, snapshot: null }, { ...row, snapshot: undefined }), false);
  // unknown previous state: fail towards review
  assert.equal(designEditNeedsReview(null, row), true);
});
