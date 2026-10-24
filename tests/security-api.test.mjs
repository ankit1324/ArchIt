import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

// Regression tests for the listing/upload API hardening. Each block names the
// hole it closes; valid inputs are asserted unchanged alongside.
import { parseBBox } from "../lib/listing-query.ts";
import { parseJsonBody } from "../lib/request.ts";
import { declaredPixels, detectImageType, MAX_INPUT_PIXELS } from "../lib/upload.ts";
import { safeImageUrl } from "../lib/url.ts";
import {
  MAX_COUNT,
  MAX_PRICE,
  validateDesign as validateDesignWith,
  validateListing as validateListingWith,
} from "../lib/validators.ts";

const STORAGE = "https://tdbnwismmyllpufurqus.supabase.co/storage/v1/object/public/photos/";
const PHOTO = `${STORAGE}0b8c1c3e-1f0a-4a55-9c1e-6a0c2b9d7e11-t.jpg`;
const validateListing = (v) => validateListingWith(v, safeImageUrl);
const validateDesign = (v) => validateDesignWith(v, safeImageUrl);
const isError = (r) => typeof r === "string";

function listing(overrides = {}) {
  return {
    address: "12 MG Road",
    city: "Bengaluru",
    price: 4500000,
    coords: [77.59, 12.97],
    type: "sale",
    kind: "apartments",
    beds: 2,
    photos: [PHOTO],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Photo URL allowlist: host alone was not enough
// ---------------------------------------------------------------------------

test("image URLs on our Supabase host must be public Storage objects", () => {
  assert.equal(safeImageUrl(PHOTO), PHOTO);
  assert.equal(safeImageUrl("https://images.unsplash.com/photo-1?w=1600"), "https://images.unsplash.com/photo-1?w=1600");
  for (const bad of [
    "https://tdbnwismmyllpufurqus.supabase.co/rest/v1/properties?select=*",
    "https://tdbnwismmyllpufurqus.supabase.co/auth/v1/user",
    "https://tdbnwismmyllpufurqus.supabase.co/storage/v1/object/sign/photos/a.jpg",
    // dot segments are resolved by the parser before the prefix check
    `${STORAGE}../../../../rest/v1/x`,
    `${STORAGE}%2e%2e/%2e%2e/%2e%2e/%2e%2e/rest/v1/x`,
  ]) {
    assert.equal(safeImageUrl(bad), null, bad);
  }
});

test("image URLs with userinfo, a port or control characters are refused", () => {
  for (const bad of [
    "https://user:pw@images.unsplash.com/photo-1",
    "https://images.unsplash.com:8443/photo-1",
    `${STORAGE.replace(".co/", ".co:444/")}a.jpg`,
    `${STORAGE}a\u0000.jpg`,
    `${STORAGE}a\n.jpg`,
    `\t${PHOTO}`,
  ]) {
    assert.equal(safeImageUrl(bad), null, JSON.stringify(bad));
  }
  // an explicit default port is normalised away by the parser: still fine
  assert.equal(safeImageUrl(PHOTO.replace(".co/", ".co:443/")), PHOTO.replace(".co/", ".co:443/"));
});

test("listing bodies with off-Storage photo URLs are rejected", () => {
  assert.ok(!isError(validateListing(listing())));
  assert.equal(
    validateListing(listing({ photos: ["https://tdbnwismmyllpufurqus.supabase.co/rest/v1/x"] })),
    "invalid photo url",
  );
  assert.equal(
    validateListing(listing({ photos: undefined, photo: "https://images.unsplash.com:1/x" })),
    "invalid photo url",
  );
});

// ---------------------------------------------------------------------------
// Numbers and strings Postgres would reject (used to surface as a 500)
// ---------------------------------------------------------------------------

test("counts are capped at the INT column range", () => {
  assert.equal(MAX_COUNT, 2 ** 31 - 1);
  const ok = validateListing(listing({ sqft: MAX_COUNT }));
  assert.ok(!isError(ok));
  assert.equal(ok.sqft, MAX_COUNT);
  for (const key of ["beds", "baths", "sqft", "rooms", "floors", "areaM"]) {
    const r = validateListing(listing({ [key]: MAX_COUNT + 1 }));
    assert.ok(isError(r) && r.startsWith(`${key} too large`), `${key}: ${r}`);
    assert.ok(isError(validateListing(listing({ [key]: 1e300 }))), key);
  }
});

test("price is capped where Number() stops being exact", () => {
  assert.ok(!isError(validateListing(listing({ price: 0 }))));
  assert.ok(!isError(validateListing(listing({ price: 1e12 }))));
  assert.ok(!isError(validateListing(listing({ price: MAX_PRICE }))));
  assert.equal(validateListing(listing({ price: 1e300 })), "price too large");
  assert.equal(validateListing(listing({ price: MAX_PRICE + 2 })), "price too large");
});

test("text fields with a NUL character are rejected", () => {
  for (const key of ["address", "city", "owner", "buildingName"]) {
    const r = validateListing(listing({ [key]: "a\u0000b" }));
    assert.ok(isError(r) && r.includes("invalid characters"), `${key}: ${r}`);
  }
  // other unicode (and non-NUL control chars like newlines) is untouched
  const ok = validateListing(listing({ address: "Flat 2,\nMG Road — बेंगलुरु", owner: "Ravi 📞" }));
  assert.ok(!isError(ok));
  assert.equal(ok.owner, "Ravi 📞");

  const design = {
    plotCenter: [77.59, 12.97],
    plotW: 20,
    plotD: 30,
    design: { v: 3, state: { blocks: [{}] } },
  };
  assert.ok(!isError(validateDesign({ ...design, name: "Villa" })));
  assert.equal(validateDesign({ ...design, name: "Vi\u0000lla" }), "name contains invalid characters");
});

// ---------------------------------------------------------------------------
// JSON bodies: the Content-Length check alone was bypassable
// ---------------------------------------------------------------------------

function chunked(parts) {
  let i = 0;
  let pulled = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (i < parts.length) {
        pulled++;
        controller.enqueue(new TextEncoder().encode(parts[i++]));
      } else controller.close();
    },
  });
  // no content-length: the stream is sent chunked
  const request = new Request("http://x.test/api", { method: "POST", body, duplex: "half" });
  return { request, pulled: () => pulled };
}

test("an oversized chunked JSON body is cut off at the cap, never buffered", async () => {
  const filler = "x".repeat(1000);
  const parts = ['{"a":"', ...Array.from({ length: 50 }, () => filler), '"}'];
  const { request, pulled } = chunked(parts);
  const res = await parseJsonBody(request, (v) => v, { maxBytes: 4096 });
  assert.ok(res instanceof Response);
  assert.equal(res.status, 413);
  assert.ok(pulled() < parts.length, "the rest of the stream is never pulled");
});

test("a lying Content-Length does not lift the cap", async () => {
  const big = JSON.stringify({ a: "x".repeat(5000) });
  const request = new Request("http://x.test/api", {
    method: "POST",
    body: big,
    headers: { "content-length": "10" },
  });
  const res = await parseJsonBody(request, (v) => v, { maxBytes: 4096 });
  assert.ok(res instanceof Response);
  assert.equal(res.status, 413);
});

test("valid JSON bodies parse exactly as before", async () => {
  const { request } = chunked(['{"addr', 'ess":"बेंगलुरु","n":1}']);
  assert.deepEqual(await parseJsonBody(request, (v) => v), { address: "बेंगलुरु", n: 1 });

  // Body.json() drops a leading UTF-8 BOM; so must we
  const bom = new Request("http://x.test/api", { method: "POST", body: '﻿{"a":1}' });
  assert.deepEqual(await parseJsonBody(bom, (v) => v), { a: 1 });

  const empty = await parseJsonBody(new Request("http://x.test/api", { method: "POST" }), (v) => v);
  assert.equal(empty.status, 400);
  const arr = await parseJsonBody(new Request("http://x.test/api", { method: "POST", body: "[1]" }), (v) => v);
  assert.equal(arr.status, 400);
  const bad = await parseJsonBody(new Request("http://x.test/api", { method: "POST", body: "{" }), (v) => v);
  assert.equal(bad.status, 400);
});

// ---------------------------------------------------------------------------
// bbox: empty parts read as 0
// ---------------------------------------------------------------------------

test("bbox with empty parts is invalid, not a box at 0,0", () => {
  for (const bad of [",,,", "1,,2,3", " , , , ", "76.7,30.7,76.8,"]) {
    assert.equal(parseBBox(bad), "invalid", JSON.stringify(bad));
  }
  assert.deepEqual(parseBBox("0,0,0,0"), [0, 0, 0, 0]);
});

// ---------------------------------------------------------------------------
// Uploads: magic bytes + decodable header + pixel budget (app/api/upload)
// ---------------------------------------------------------------------------

test("declaredPixels sums every frame of an animation", () => {
  assert.equal(declaredPixels({ width: 4000, height: 3000 }), 12_000_000);
  assert.equal(declaredPixels({ width: 500, height: 500, pageHeight: 500, pages: 200 }), 50_000_000);
  assert.equal(declaredPixels({ width: 500 }), 0);
  assert.equal(declaredPixels({}), 0);
  assert.ok(declaredPixels({ width: 500, height: 500, pages: 200 }) > MAX_INPUT_PIXELS);
});

test("sharp's header parse rejects polyglots and pixel bombs the way the route expects", async () => {
  // starts like a JPEG, is HTML: passes the magic-byte sniff, fails the header parse
  const poly = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from("<html><script>alert(1)</script></html>"),
  ]);
  assert.equal(detectImageType(poly), "image/jpeg");
  await assert.rejects(sharp(poly, { limitInputPixels: MAX_INPUT_PIXELS }).metadata());

  // a small file declaring a 7000×7000 canvas: the route matches /pixel limit/
  const bomb = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: "#000" } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  assert.ok(bomb.length < 1024 * 1024, "compresses far below the 8 MB upload cap");
  await assert.rejects(sharp(bomb, { limitInputPixels: MAX_INPUT_PIXELS }).metadata(), /pixel limit/i);

  // an ordinary photo is untouched
  const jpg = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#888" } })
    .jpeg()
    .toBuffer();
  const meta = await sharp(jpg, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  assert.equal(declaredPixels(meta), 1200 * 900);
});
