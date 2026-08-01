import assert from "node:assert/strict";
import test from "node:test";

import { retryTransientDb } from "../lib/retry.ts";

test("retries a transient Supabase fetch failure once", async () => {
  let attempts = 0;
  const result = await retryTransientDb(async () => {
    attempts += 1;
    return attempts === 1
      ? { error: { code: "", message: "TypeError: fetch failed" } }
      : { error: null, data: "ok" };
  });

  assert.equal(attempts, 2);
  assert.equal(result.data, "ok");
});

test("does not retry a permanent database error", async () => {
  let attempts = 0;
  const result = await retryTransientDb(async () => {
    attempts += 1;
    return { error: { code: "42P01", message: "relation does not exist" } };
  });

  assert.equal(attempts, 1);
  assert.equal(result.error?.code, "42P01");
});
