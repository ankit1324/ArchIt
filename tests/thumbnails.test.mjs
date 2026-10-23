import assert from "node:assert/strict";
import test from "node:test";
import { isThumbObjectName, sizedImageUrl, thumbObjectNames, thumbnailUrl } from "../lib/url.ts";

const BASE = "https://tdbnwismmyllpufurqus.supabase.co/storage/v1/object/public/photos/";
const ID = "0b8c1c3e-1f0a-4a55-9c1e-6a0c2b9d7e11";

test("uploads with the -t marker map to their webp variants", () => {
  assert.equal(thumbnailUrl(`${BASE}${ID}-t.jpg`, 64), `${BASE}${ID}-t.w64.webp`);
  assert.equal(thumbnailUrl(`${BASE}${ID}-t.png`, 480), `${BASE}${ID}-t.w480.webp`);
  assert.deepEqual(thumbObjectNames(`${ID}-t.avif`), [`${ID}-t.w64.webp`, `${ID}-t.w480.webp`]);
});

test("older uploads and foreign URLs have no thumbnail (callers fall back)", () => {
  assert.equal(thumbnailUrl(`${BASE}${ID}.jpg`, 64), null);
  assert.deepEqual(thumbObjectNames(`${ID}.jpg`), []);
  assert.equal(thumbnailUrl(`https://evil.example/storage/v1/object/public/photos/${ID}-t.jpg`, 64), null);
  assert.equal(thumbnailUrl("javascript:alert(1)", 64), null);
  assert.equal(thumbnailUrl(undefined, 64), null);
  // malformed percent-encoding must not throw during render
  assert.equal(thumbnailUrl(`${BASE}%E0%A4%A.jpg`, 64), null);
  // a thumb itself is not a thumbed original
  assert.equal(thumbnailUrl(`${BASE}${ID}-t.w64.webp`, 480), null);
});

test("sizedImageUrl falls back to the original, and shrinks unsplash seed photos", () => {
  assert.equal(sizedImageUrl(`${BASE}${ID}.jpg`, 64), `${BASE}${ID}.jpg`);
  assert.equal(sizedImageUrl(`${BASE}${ID}-t.jpg`, 64), `${BASE}${ID}-t.w64.webp`);
  const u = new URL(sizedImageUrl("https://images.unsplash.com/photo-1?w=1600", 64));
  assert.equal(u.searchParams.get("w"), "128");
  assert.equal(sizedImageUrl("http://images.unsplash.com/photo-1", 64), null);
});

test("variant names are recognised so cleanup never deletes one on its own", () => {
  assert.equal(isThumbObjectName(`${ID}-t.w64.webp`), true);
  assert.equal(isThumbObjectName(`${ID}-t.w480.webp`), true);
  assert.equal(isThumbObjectName(`${ID}-t.webp`), false);
  assert.equal(isThumbObjectName(`${ID}.jpg`), false);
});
