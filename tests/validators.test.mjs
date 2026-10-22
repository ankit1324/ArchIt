import assert from "node:assert/strict";
import test from "node:test";

// lib/validators.ts only imports types and lib/url.ts (import-free), so the
// shipped body validators run directly under node --test.
import {
  MAX_DESIGN_BYTES,
  MAX_DESIGN_NAME,
  MAX_PHOTOS,
  MAX_TEXT,
  validateDesign as validateDesignWith,
  validateListing as validateListingWith,
} from "../lib/validators.ts";
import { safeImageUrl, storageObjectName } from "../lib/url.ts";
import { MAX_JSON_BODY_BYTES, parseJsonBody } from "../lib/request.ts";

const PHOTO = "https://tdbnwismmyllpufurqus.supabase.co/storage/v1/object/public/photos/a.jpg";
const BAD_PHOTO = "http://evil.example/x.jpg";

const isError = (r) => typeof r === "string";
// the routes inject the real allowlist check; so do we
const validateListing = (v) => validateListingWith(v, safeImageUrl);
const validateDesign = (v) => validateDesignWith(v, safeImageUrl);

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

function listing(overrides = {}) {
  return {
    address: "12 MG Road",
    city: "Bengaluru",
    price: 4500000,
    coords: [77.59, 12.97],
    type: "sale",
    kind: "apartments",
    beds: 2,
    baths: 1,
    sqft: 1000,
    floors: 5,
    areaM: 50,
    ...overrides,
  };
}

test("listing: accepts a complete valid body", () => {
  const r = validateListing(listing());
  assert.equal(isError(r), false);
  assert.equal(r.address, "12 MG Road");
  assert.deepEqual(r.coords, [77.59, 12.97]);
  assert.equal(r.rooms, 1, "rooms defaults like listingToRow");
});

test("listing: rejects non-objects", () => {
  for (const v of [null, undefined, 3, "x", [], true]) assert.ok(isError(validateListing(v)));
});

test("listing: address is required, a string, and bounded", () => {
  assert.ok(isError(validateListing(listing({ address: undefined }))));
  assert.ok(isError(validateListing(listing({ address: "   " }))));
  assert.ok(isError(validateListing(listing({ address: 42 }))));
  assert.ok(isError(validateListing(listing({ address: "a".repeat(MAX_TEXT + 1) }))));
  assert.equal(isError(validateListing(listing({ address: "a".repeat(MAX_TEXT) }))), false);
});

test("listing: city is optional but must be a bounded string; defaults to empty", () => {
  const r = validateListing(listing({ city: undefined }));
  assert.equal(r.city, "");
  assert.ok(isError(validateListing(listing({ city: 1 }))));
  assert.ok(isError(validateListing(listing({ city: "c".repeat(MAX_TEXT + 1) }))));
});

test("listing: price accepts 0 and rejects negative, NaN, strings", () => {
  // `!l.price` used to 400 a genuine free listing
  assert.equal(isError(validateListing(listing({ price: 0 }))), false);
  assert.ok(isError(validateListing(listing({ price: -1 }))));
  assert.ok(isError(validateListing(listing({ price: NaN }))));
  assert.ok(isError(validateListing(listing({ price: Infinity }))));
  assert.ok(isError(validateListing(listing({ price: "100" }))));
  assert.ok(isError(validateListing(listing({ price: undefined }))));
});

test("listing: coords must be a finite in-range [lng, lat] tuple", () => {
  for (const coords of [
    undefined,
    [77.59],
    [77.59, 12.97, 0],
    ["77", "12"],
    [181, 0],
    [-181, 0],
    [0, 91],
    [0, -91],
    [NaN, 0],
    { 0: 77, 1: 12 },
  ]) {
    assert.ok(isError(validateListing(listing({ coords }))), JSON.stringify(coords));
  }
  for (const coords of [[-180, -90], [180, 90], [0, 0]]) {
    assert.equal(isError(validateListing(listing({ coords }))), false, JSON.stringify(coords));
  }
});

test("listing: type and kind are enums", () => {
  assert.ok(isError(validateListing(listing({ type: "lease" }))));
  assert.ok(isError(validateListing(listing({ type: undefined }))));
  assert.ok(isError(validateListing(listing({ kind: "castle" }))));
  assert.ok(isError(validateListing(listing({ kind: "toString" }))));
  for (const kind of ["apartments", "house", "land", "room", "business", "hotels"]) {
    assert.equal(isError(validateListing(listing({ kind }))), false, kind);
  }
  assert.equal(isError(validateListing(listing({ type: "rent" }))), false);
});

test("listing: counts are optional non-negative integers", () => {
  for (const key of ["beds", "baths", "sqft", "rooms", "floors", "areaM"]) {
    assert.ok(isError(validateListing(listing({ [key]: -1 }))), `${key} negative`);
    assert.ok(isError(validateListing(listing({ [key]: 1.5 }))), `${key} fraction`);
    assert.ok(isError(validateListing(listing({ [key]: "2" }))), `${key} string`);
    assert.ok(isError(validateListing(listing({ [key]: NaN }))), `${key} NaN`);
    assert.equal(isError(validateListing(listing({ [key]: 0 }))), false, `${key} zero`);
    assert.equal(isError(validateListing(listing({ [key]: undefined }))), false, `${key} absent`);
  }
});

test("listing: photos must be ≤5 allowlisted https URLs", () => {
  assert.equal(isError(validateListing(listing({ photos: [PHOTO, PHOTO] }))), false);
  assert.equal(isError(validateListing(listing({ photos: [] }))), false);
  assert.ok(isError(validateListing(listing({ photos: "x" }))));
  assert.ok(isError(validateListing(listing({ photos: [BAD_PHOTO] }))));
  assert.ok(isError(validateListing(listing({ photos: [PHOTO, 1] }))));
  assert.ok(isError(validateListing(listing({ photos: Array(MAX_PHOTOS + 1).fill(PHOTO) }))));
  assert.equal(isError(validateListing(listing({ photos: Array(MAX_PHOTOS).fill(PHOTO) }))), false);
});

test("listing: photo is optional and must be allowlisted", () => {
  assert.equal(isError(validateListing(listing({ photo: PHOTO }))), false);
  assert.equal(isError(validateListing(listing({ photo: "" }))), false);
  assert.ok(isError(validateListing(listing({ photo: BAD_PHOTO }))));
  assert.ok(isError(validateListing(listing({ photo: "javascript:alert(1)" }))));
  assert.ok(isError(validateListing(listing({ photo: 5 }))));
});

test("listing: owner and buildingName are optional bounded strings", () => {
  const r = validateListing(listing({ owner: "+91 98765", buildingName: "Prestige" }));
  assert.equal(r.owner, "+91 98765");
  assert.equal(r.buildingName, "Prestige");
  assert.ok(isError(validateListing(listing({ owner: {} }))));
  assert.ok(isError(validateListing(listing({ owner: "o".repeat(MAX_TEXT + 1) }))));
  assert.ok(isError(validateListing(listing({ buildingName: "b".repeat(MAX_TEXT + 1) }))));
});

test("listing: server-stamped fields are dropped from the body", () => {
  const r = validateListing(listing({ id: "x", mine: true, featured: true, hasOwner: true, user_id: "u" }));
  assert.equal("id" in r, false);
  assert.equal("mine" in r, false);
  assert.equal("featured" in r, false);
  assert.equal("hasOwner" in r, false);
  assert.equal("user_id" in r, false);
});

// ---------------------------------------------------------------------------
// Designs
// ---------------------------------------------------------------------------

const block = { id: 1, type: "living", cx: 0, cz: 0, rot: 0, w: 4, len: 5 };

function design(overrides = {}) {
  return {
    name: "My home",
    plotCenter: [77.59, 12.97],
    plotW: 12,
    plotD: 9,
    design: { v: 3, state: { blocks: [block] } },
    ...overrides,
  };
}

test("design: accepts a valid v3 body with blocks", () => {
  const r = validateDesign(design());
  assert.equal(isError(r), false);
  assert.equal(r.name, "My home");
  assert.equal(r.plotW, 12);
});

test("design: accepts a floors[] layout with at least one block", () => {
  const d = design({ design: { v: 3, state: { floors: [{ blocks: [] }, { blocks: [block] }], blocks: [] } } });
  assert.equal(isError(validateDesign(d)), false);
});

test("design: rejects an empty design", () => {
  assert.ok(isError(validateDesign(design({ design: { v: 3, state: { blocks: [] } } }))));
  assert.ok(isError(validateDesign(design({ design: { v: 3, state: { floors: [{ blocks: [] }], blocks: [] } } }))));
  assert.ok(isError(validateDesign(design({ design: { v: 3, state: { floors: [] } } }))));
});

test("design: missing design.state is a 400, not a TypeError", () => {
  // used to throw reading `.floors` of undefined → 500
  assert.ok(isError(validateDesign(design({ design: { v: 3 } }))));
  assert.ok(isError(validateDesign(design({ design: { v: 3, state: null } }))));
  assert.ok(isError(validateDesign(design({ design: { v: 3, state: "x" } }))));
  assert.ok(isError(validateDesign(design({ design: null }))));
  assert.ok(isError(validateDesign(design({ design: undefined }))));
});

test("design: design.v must be 3", () => {
  assert.ok(isError(validateDesign(design({ design: { v: 2, state: { blocks: [block] } } }))));
  assert.ok(isError(validateDesign(design({ design: { v: "3", state: { blocks: [block] } } }))));
});

test("design: plotCenter must be an in-range tuple", () => {
  assert.ok(isError(validateDesign(design({ plotCenter: undefined }))));
  assert.ok(isError(validateDesign(design({ plotCenter: [200, 0] }))));
  assert.ok(isError(validateDesign(design({ plotCenter: [0] }))));
});

test("design: plotW and plotD must be finite and > 0", () => {
  for (const key of ["plotW", "plotD"]) {
    assert.ok(isError(validateDesign(design({ [key]: 0 }))), `${key} zero`);
    assert.ok(isError(validateDesign(design({ [key]: -5 }))), `${key} negative`);
    assert.ok(isError(validateDesign(design({ [key]: "12" }))), `${key} string`);
    assert.ok(isError(validateDesign(design({ [key]: Infinity }))), `${key} inf`);
    assert.ok(isError(validateDesign(design({ [key]: undefined }))), `${key} absent`);
  }
});

test("design: name defaults when empty and is bounded", () => {
  assert.equal(validateDesign(design({ name: "" })).name, "My home");
  assert.equal(validateDesign(design({ name: undefined })).name, "My home");
  assert.ok(isError(validateDesign(design({ name: 7 }))));
  assert.ok(isError(validateDesign(design({ name: "n".repeat(MAX_DESIGN_NAME + 1) }))));
  assert.equal(isError(validateDesign(design({ name: "n".repeat(MAX_DESIGN_NAME) }))), false);
});

test("design: snapshot is optional and must be an allowlisted image URL", () => {
  assert.equal(validateDesign(design({ snapshot: PHOTO })).snapshot, PHOTO);
  assert.equal(validateDesign(design({ snapshot: "" })).snapshot, undefined);
  assert.ok(isError(validateDesign(design({ snapshot: BAD_PHOTO }))));
  assert.ok(isError(validateDesign(design({ snapshot: "data:image/png;base64,AAAA" }))));
});

test("design: meta must be an object when present", () => {
  assert.deepEqual(validateDesign(design({ meta: { unit: "ft" } })).meta, { unit: "ft" });
  assert.ok(isError(validateDesign(design({ meta: "x" }))));
});

test("design: serialized design is capped at 1 MB", () => {
  const fat = { ...block, pad: "x".repeat(MAX_DESIGN_BYTES) };
  assert.ok(isError(validateDesign(design({ design: { v: 3, state: { blocks: [fat] } } }))));
});

// ---------------------------------------------------------------------------
// Storage object names (DELETE photo cleanup)
// ---------------------------------------------------------------------------

test("storageObjectName extracts the object from a public bucket URL", () => {
  assert.equal(storageObjectName(PHOTO, "photos"), "a.jpg");
  assert.equal(
    storageObjectName(
      "https://tdbnwismmyllpufurqus.supabase.co/storage/v1/object/public/photos/0b1c-2d.webp",
      "photos",
    ),
    "0b1c-2d.webp",
  );
});

test("storageObjectName refuses foreign hosts, other buckets and traversal", () => {
  assert.equal(storageObjectName("https://images.unsplash.com/x.jpg", "photos"), null);
  assert.equal(storageObjectName(PHOTO, "other"), null);
  assert.equal(storageObjectName("not a url", "photos"), null);
  assert.equal(
    storageObjectName("https://x.supabase.co/storage/v1/object/public/photos/../secret", "photos"),
    null,
  );
  assert.equal(
    storageObjectName("https://x.supabase.co/storage/v1/object/public/photos/a/b.jpg", "photos"),
    null,
  );
  assert.equal(storageObjectName("https://x.supabase.co/storage/v1/object/public/photos/", "photos"), null);
});

// ---------------------------------------------------------------------------
// parseJsonBody
// ---------------------------------------------------------------------------

const req = (body, headers = {}) =>
  new Request("https://app.test/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });

const status = (r) => (r instanceof Response ? r.status : null);

test("parseJsonBody: returns the validated value on a good body", async () => {
  const r = await parseJsonBody(req(JSON.stringify({ a: 1 })), (v) => ({ a: v.a }));
  assert.deepEqual(r, { a: 1 });
});

test("parseJsonBody: malformed JSON is a 400", async () => {
  const r = await parseJsonBody(req("{nope"), () => ({}));
  assert.equal(status(r), 400);
  assert.deepEqual(await r.json(), { error: "invalid json" });
});

test("parseJsonBody: non-object bodies are a 400", async () => {
  for (const body of ["null", "[]", "3", '"s"', "true"]) {
    const r = await parseJsonBody(req(body), () => ({}));
    assert.equal(status(r), 400, body);
  }
});

test("parseJsonBody: validator string becomes a 400 with that message", async () => {
  const r = await parseJsonBody(req("{}"), () => "address required");
  assert.equal(status(r), 400);
  assert.deepEqual(await r.json(), { error: "address required" });
});

test("parseJsonBody: oversized content-length is a 413 before parsing", async () => {
  let called = false;
  const r = await parseJsonBody(
    req("{}", { "content-length": String(MAX_JSON_BODY_BYTES + 1) }),
    () => ((called = true), {}),
  );
  assert.equal(status(r), 413);
  assert.equal(called, false);
});

test("parseJsonBody: maxBytes option raises the cap", async () => {
  const r = await parseJsonBody(
    req("{}", { "content-length": String(MAX_JSON_BODY_BYTES + 1) }),
    () => ({ ok: true }),
    { maxBytes: MAX_JSON_BODY_BYTES * 2 },
  );
  assert.deepEqual(r, { ok: true });
});
