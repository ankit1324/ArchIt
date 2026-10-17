import assert from "node:assert/strict";
import test from "node:test";
import { nextImageUrl, safeImageUrl } from "../lib/url.ts";

const STORAGE = "https://tdbnwismmyllpufurqus.supabase.co/storage/v1/object/public/designs/a.png";

test("safeImageUrl allows only https on allowlisted hosts", () => {
  assert.equal(safeImageUrl(STORAGE), STORAGE);
  assert.equal(safeImageUrl("http://images.unsplash.com/x.jpg"), null);
  assert.equal(safeImageUrl("https://evil.example.com/x.png"), null);
  assert.equal(safeImageUrl("javascript:alert(1)"), null);
  assert.equal(safeImageUrl(undefined), null);
});

test("nextImageUrl mirrors next.config.ts remotePatterns", () => {
  assert.equal(nextImageUrl(STORAGE), STORAGE);
  assert.equal(nextImageUrl("https://images.unsplash.com/photo-1?w=800"), "https://images.unsplash.com/photo-1?w=800");
  // Supabase host, but outside the public storage path
  assert.equal(nextImageUrl("https://tdbnwismmyllpufurqus.supabase.co/x"), null);
  assert.equal(nextImageUrl("https://tdbnwismmyllpufurqus.supabase.co/rest/v1/designs"), null);
  assert.equal(nextImageUrl(`${STORAGE}?download=1`), null);
  assert.equal(nextImageUrl("https://evil.example.com/storage/v1/object/public/a.png"), null);
  assert.equal(nextImageUrl(null), null);
});
