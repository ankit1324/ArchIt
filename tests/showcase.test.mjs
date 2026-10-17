import assert from "node:assert/strict";
import test from "node:test";
import {
  SHOWCASE_COLUMNS,
  hasLocation,
  parsePublishBody,
  parseShowcaseQuery,
  toPublishedDesign,
} from "../lib/showcase.ts";

const row = {
  id: "d1",
  user_id: "u1",
  name: "Garden House",
  plot_lng: 0,
  plot_lat: 0,
  plot_w: 12,
  plot_d: 20,
  design: { v: 3, state: { blocks: [] } },
  snapshot: "https://tdbnwismmyllpufurqus.supabase.co/storage/v1/object/public/x.png",
  meta: { budget: 5e6, notes: "x", facing: "N" },
  published_at: "2026-10-17T10:00:00.000Z",
  author_name: "Ankit",
  place: "Sector 8, Chandigarh",
};

test("hasLocation is false only when both coordinates are zero", () => {
  assert.equal(hasLocation(0, 0), false);
  assert.equal(hasLocation(76.7, 30.7), true);
  assert.equal(hasLocation(0, 30), true);
});

test("toPublishedDesign drops user_id and private meta", () => {
  const p = toPublishedDesign(row, "u1");
  const json = JSON.stringify(p);
  for (const key of ["user_id", "meta", "budget", "notes"]) {
    assert.ok(!json.includes(`"${key}"`), `leaked ${key}`);
  }
  assert.equal(p.facing, "N");
  assert.equal(p.plotCenter, null);
  assert.equal(p.authorName, "Ankit");
  assert.equal(p.publishedAt, "2026-10-17T10:00:00.000Z");
  assert.equal(p.place, "Sector 8, Chandigarh");
  assert.equal(p.plotW, 12);
  assert.equal(p.plotD, 20);
});

test("toPublishedDesign sets mine only for the owner", () => {
  assert.equal(toPublishedDesign(row, "u1").mine, true);
  assert.equal(toPublishedDesign(row, "u2").mine, false);
  assert.equal(toPublishedDesign(row, null).mine, false);
});

test("toPublishedDesign includes design only when asked", () => {
  assert.ok(!("design" in toPublishedDesign(row, null)));
  assert.deepEqual(toPublishedDesign(row, null, { includeDesign: true }).design, row.design);
});

test("toPublishedDesign keeps a real location and falls back on author name", () => {
  const p = toPublishedDesign({ ...row, plot_lng: 76.7, plot_lat: 30.7, author_name: null, meta: null }, null);
  assert.deepEqual(p.plotCenter, [76.7, 30.7]);
  assert.equal(p.authorName, "ArchIt user");
  assert.equal(p.facing, undefined);
});

test("SHOWCASE_COLUMNS lists the projection columns but never design", () => {
  const cols = SHOWCASE_COLUMNS.split(",").map((c) => c.trim());
  assert.ok(!cols.includes("design"));
  for (const c of ["id", "user_id", "name", "plot_lng", "plot_lat", "plot_w", "plot_d", "snapshot", "meta", "published_at", "author_name", "place"]) {
    assert.ok(cols.includes(c), `missing ${c}`);
  }
});

test("parseShowcaseQuery defaults, clamps and validates", () => {
  const q = (s) => parseShowcaseQuery(new URLSearchParams(s));
  assert.deepEqual(q(""), { limit: 60, before: null, located: false });
  assert.equal(q("limit=999").limit, 200);
  assert.equal(q("limit=0").limit, 1);
  assert.equal(q("limit=abc").limit, 60);
  assert.equal(q("before=nope").before, null);
  assert.equal(q("before=2026-10-17T10:00:00.000Z").before, "2026-10-17T10:00:00.000Z");
  assert.equal(q("located=1").located, true);
});

test("parsePublishBody accepts publish without a location", () => {
  assert.deepEqual(parsePublishBody({ published: true }), { ok: true, published: true, location: null });
  assert.deepEqual(parsePublishBody({ published: true, location: null }), { ok: true, published: true, location: null });
});

test("parsePublishBody rejects bad input", () => {
  assert.equal(parsePublishBody({ published: false, location: { lng: 0, lat: 0 } }).ok, false);
  assert.equal(parsePublishBody({ published: true, location: { lng: 181, lat: 30 } }).ok, false);
  assert.equal(parsePublishBody({ published: true, location: { lng: 76, lat: 91 } }).ok, false);
  assert.equal(parsePublishBody({ published: true, location: { lng: "76", lat: 30 } }).ok, false);
  assert.equal(parsePublishBody({ published: "yes" }).ok, false);
  assert.equal(parsePublishBody(null).ok, false);
  assert.equal(typeof parsePublishBody({ published: "yes" }).error, "string");
});

test("parsePublishBody trims place to 120 chars", () => {
  const r = parsePublishBody({ published: true, location: { lng: 76.7, lat: 30.7, place: `  ${"a".repeat(200)}  ` } });
  assert.equal(r.ok, true);
  assert.equal(r.location.place.length, 120);
  assert.deepEqual(
    parsePublishBody({ published: true, location: { lng: 76.7, lat: 30.7, place: "   " } }).location,
    { lng: 76.7, lat: 30.7, place: null },
  );
});
