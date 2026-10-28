import assert from "node:assert/strict";
import test from "node:test";

// lib/storage-cleanup.ts holds the logic of lib/storage.ts (which imports
// "server-only" and ./db); storage and the reference queries are faked here.
import { createUploadCleanup, UPLOADS_BUCKET } from "../lib/storage-cleanup.ts";

const HOST = "https://abcd1234.supabase.co";
const urlOf = (name) => `${HOST}/storage/v1/object/public/${UPLOADS_BUCKET}/${name}`;

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const THUMBED = `${UUID_A}-t.jpg`; // has .w64/.w480 variants
const LEGACY = `${UUID_B}.png`; // predates thumbnails

/**
 * Cleanup over in-memory rows. `refs` maps a column (photo | photos | snapshot)
 * to the URLs some row still holds; `errors` makes a column's query fail.
 */
function harness({ refs = {}, errors = {}, removeError = null, removeThrows = null } = {}) {
  const calls = { checked: [], removed: [], warnings: [] };
  const count = (column) => async (url) => {
    calls.checked.push({ column, url });
    if (errors[column]) return { count: null, error: errors[column] };
    return { count: (refs[column] ?? []).filter((u) => u === url).length, error: null };
  };
  const { removeUnreferencedUploads } = createUploadCleanup({
    publicUrl: urlOf,
    references: { photo: count("photo"), photos: count("photos"), snapshot: count("snapshot") },
    async remove(names) {
      if (removeThrows) throw removeThrows;
      calls.removed.push(names);
      return { error: removeError };
    },
  });
  return { removeUnreferencedUploads, calls };
}

/** Capture console.warn for the duration of `fn`. */
async function captureWarnings(calls, fn) {
  const original = console.warn;
  console.warn = (...args) => calls.warnings.push(args.map(String).join(" "));
  try {
    await fn();
  } finally {
    console.warn = original;
  }
}

test("deletes an unreferenced upload together with its thumbnails", async () => {
  const { removeUnreferencedUploads, calls } = harness();
  await removeUnreferencedUploads("test", [urlOf(THUMBED)]);
  assert.deepEqual(calls.removed, [
    [THUMBED, `${UUID_A}-t.w64.webp`, `${UUID_A}-t.w480.webp`],
  ]);
});

test("a pre-thumbnail upload is deleted alone", async () => {
  const { removeUnreferencedUploads, calls } = harness();
  await removeUnreferencedUploads("test", [urlOf(LEGACY)]);
  assert.deepEqual(calls.removed, [[LEGACY]]);
});

test("checks listing photo, listing photos[] and design snapshot for each candidate", async () => {
  const { removeUnreferencedUploads, calls } = harness();
  await removeUnreferencedUploads("test", [urlOf(LEGACY)]);
  assert.deepEqual(
    calls.checked.map((c) => c.column).sort(),
    ["photo", "photos", "snapshot"],
  );
  assert.ok(calls.checked.every((c) => c.url === urlOf(LEGACY)));
});

test("keeps any upload another row still references", async () => {
  for (const column of ["photo", "photos", "snapshot"]) {
    const { removeUnreferencedUploads, calls } = harness({
      refs: { [column]: [urlOf(THUMBED)] },
    });
    await removeUnreferencedUploads("test", [urlOf(THUMBED), urlOf(LEGACY)]);
    assert.deepEqual(calls.removed, [[LEGACY]], `${column} reference keeps it`);
  }
});

test("does nothing when every candidate is still referenced", async () => {
  const { removeUnreferencedUploads, calls } = harness({ refs: { photo: [urlOf(LEGACY)] } });
  await removeUnreferencedUploads("test", [urlOf(LEGACY)]);
  assert.deepEqual(calls.removed, []);
});

test("ignores foreign, variant, thumbnail and non-string URLs without querying", async () => {
  const { removeUnreferencedUploads, calls } = harness();
  await removeUnreferencedUploads("test", [
    `https://images.unsplash.com/photo-1.jpg`,
    `https://evil.example/storage/v1/object/public/photos/${LEGACY}`,
    `http://abcd1234.supabase.co/storage/v1/object/public/photos/${LEGACY}`,
    `${HOST}/storage/v1/object/public/other-bucket/${LEGACY}`,
    `${urlOf(LEGACY)}?download=1`,
    `${urlOf(LEGACY)}#frag`,
    `${HOST}/storage/v1/object/public/photos/${encodeURIComponent(LEGACY).replaceAll("-", "%2D")}`,
    urlOf(`${UUID_A}-t.w480.webp`),
    `${HOST}/storage/v1/object/public/photos/..%2Fsecret`,
    "not a url",
    "",
    null,
    42,
    { url: urlOf(LEGACY) },
  ]);
  assert.deepEqual(calls.checked, []);
  assert.deepEqual(calls.removed, []);
});

test("a URL listed twice is checked and removed once", async () => {
  const { removeUnreferencedUploads, calls } = harness();
  await removeUnreferencedUploads("test", [urlOf(LEGACY), urlOf(LEGACY)]);
  assert.equal(calls.checked.length, 3);
  assert.deepEqual(calls.removed, [[LEGACY]]);
});

test("a failed reference check keeps that upload but still cleans the rest", async () => {
  const { removeUnreferencedUploads, calls } = harness({
    errors: { photos: { message: "statement timeout" } },
  });
  // every candidate's photos[] check fails, so nothing can be proven unused
  await captureWarnings(calls, () =>
    removeUnreferencedUploads("ctx", [urlOf(THUMBED), urlOf(LEGACY)]),
  );
  assert.deepEqual(calls.removed, []);
  assert.equal(calls.warnings.length, 2);
  assert.match(calls.warnings[0], /^ctx: upload reference check failed: statement timeout/);
});

test("a storage remove error is logged, not thrown", async () => {
  const { removeUnreferencedUploads, calls } = harness({ removeError: { message: "bucket gone" } });
  await captureWarnings(calls, () => removeUnreferencedUploads("ctx", [urlOf(LEGACY)]));
  assert.deepEqual(calls.removed, [[LEGACY]]);
  assert.deepEqual(calls.warnings, ["ctx: upload cleanup failed: bucket gone"]);
});

test("a throwing storage client is swallowed", async () => {
  const { removeUnreferencedUploads, calls } = harness({ removeThrows: new Error("socket hang up") });
  await captureWarnings(calls, () => removeUnreferencedUploads("ctx", [urlOf(LEGACY)]));
  assert.equal(calls.warnings.length, 1);
  assert.match(calls.warnings[0], /^ctx: upload cleanup threw: Error: socket hang up/);
});

test("a throwing reference query is swallowed", async () => {
  const calls = { warnings: [] };
  const { removeUnreferencedUploads } = createUploadCleanup({
    publicUrl: urlOf,
    references: {
      photo: async () => {
        throw new Error("fetch failed");
      },
      photos: async () => ({ count: 0, error: null }),
      snapshot: async () => ({ count: 0, error: null }),
    },
    remove: async () => assert.fail("must not remove what it could not check"),
  });
  await captureWarnings(calls, () => removeUnreferencedUploads("ctx", [urlOf(LEGACY)]));
  assert.equal(calls.warnings.length, 1);
  assert.match(calls.warnings[0], /upload cleanup threw/);
});

test("no candidates means no queries at all", async () => {
  const { removeUnreferencedUploads, calls } = harness();
  await removeUnreferencedUploads("test", []);
  assert.deepEqual(calls.checked, []);
  assert.deepEqual(calls.removed, []);
});
