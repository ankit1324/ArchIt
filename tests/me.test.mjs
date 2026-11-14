import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { toAiPhotoItem } from "../lib/ai-photos.ts";
import {
  aiPhotoAlt,
  aiPhotosView,
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

/* ============================== My AI photos ============================== */
// lib/me.ts is "server-only" and talks to the database, so it can't be loaded
// here: its query is checked as source, and the mapping it uses is pure.
const meSrc = readFileSync(new URL("../lib/me.ts", import.meta.url), "utf8");
const aiQuery = meSrc.slice(meSrc.indexOf('.from("ai_photo_requests")'), meSrc.indexOf(".returns<AiPhotoListRow[]>()"));
const aiColumns = meSrc.match(/const AI_PHOTO_COLUMNS =\s*"([^"]+)"/)?.[1] ?? "";

test("my AI photos are scoped to the signed-in user, newest first, capped", () => {
  assert.ok(aiQuery.length > 0, "the ai_photo_requests query exists");
  assert.match(aiQuery, /\.eq\("user_id", userId\)/);
  assert.match(aiQuery, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(aiQuery, /\.limit\(MY_AI_PHOTOS_LIMIT\)/);
  assert.match(meSrc, /aiPhotos: \(aiPhotosRes\.data \?\? \[\]\)\.map\(toAiPhotoItem\)/);
});

test("my AI photos never select the prompt, the input path or the user id", () => {
  const cols = aiColumns.split(",").map((c) => c.trim());
  assert.ok(cols.length > 0 && cols[0] === "id", aiColumns);
  for (const secret of ["prompt", "input_path", "user_id", "brief", "place", "completed_by", "*"]) {
    assert.ok(!cols.includes(secret), secret);
  }
});

test("a failing AI photo query sets only its own error flag", () => {
  assert.match(meSrc, /aiPhotosError: !!aiPhotosRes\.error/);
  assert.match(meSrc, /error: !!\(listingsRes\.error \|\| designsRes\.error \|\| aiPhotosRes\.error\)/);
  // the other cards keep their own flags, untouched by this query
  assert.match(meSrc, /listingsError: !!listingsRes\.error,/);
  assert.match(meSrc, /designsError: !!designsRes\.error,/);
  // a thrown failure (missing env) marks every card
  assert.match(meSrc, /aiPhotosError: true \}/);
});

const ID = (n) => `0b9f6e0a-3c1d-4f7e-9a55-2d0c8e4b7a1${n}`;
const dbRow = (n, over = {}) => ({
  id: ID(n), status: "pending", design_name: `Home ${n}`, created_at: "2026-11-14T10:00:00Z",
  completed_at: null, admin_note: null, result_path: null, ...over,
});

test("rows map to dashboard items without storage paths", () => {
  const items = [dbRow(1, { status: "done", result_path: "out/secret.png" })].map(toAiPhotoItem);
  assert.equal(items[0].image, `/api/ai-photos/${ID(1)}/image`);
  assert.equal(items[0].designName, "Home 1");
  assert.ok(!JSON.stringify(items).includes("secret"));
});

test("aiPhotosView splits finished, waiting and turned-down requests", () => {
  const items = [
    dbRow(1, { status: "done", result_path: "out/a.png" }),
    dbRow(2),
    dbRow(3),
    dbRow(4, { status: "rejected", admin_note: "No walls to paint" }),
    dbRow(5, { status: "done", result_path: null }),
  ].map(toAiPhotoItem);
  const v = aiPhotosView(items);
  assert.deepEqual(v.done.map((p) => p.id), [ID(1)], "a done row with no picture is not shown");
  assert.equal(v.pending, 2);
  assert.equal(v.pendingLabel, "2 being made");
  assert.deepEqual(v.rejected.map((p) => p.note), ["No walls to paint"]);
});

test("aiPhotosView with nothing waiting has no pending line", () => {
  const v = aiPhotosView([]);
  assert.deepEqual(v, { done: [], pending: 0, pendingLabel: null, rejected: [] });
  assert.equal(aiPhotosView([toAiPhotoItem(dbRow(1))]).pendingLabel, "1 being made");
});

test("AI photo alt text names the design", () => {
  assert.equal(aiPhotoAlt("Pune villa"), "AI photo of Pune villa");
  assert.equal(aiPhotoAlt("  "), "AI photo of your design");
  assert.equal(aiPhotoAlt(null), "AI photo of your design");
});
