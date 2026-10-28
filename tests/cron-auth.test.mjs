import assert from "node:assert/strict";
import test from "node:test";

// lib/cron-auth.ts imports only node:crypto, so the real guard is tested here.
import { isCronRequest } from "../lib/cron-auth.ts";

const SECRET = "cron_s3cret_value";

function req(authorization) {
  const headers = authorization === undefined ? {} : { authorization };
  return new Request("https://example.test/api/cron/reconcile", { headers });
}

/** Run `fn` with CRON_SECRET set to `value` (undefined = unset), then restore it. */
function withSecret(value, fn) {
  const saved = process.env.CRON_SECRET;
  if (value === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
}

test("refuses every call when CRON_SECRET is unset or empty", () => {
  for (const secret of [undefined, ""]) {
    withSecret(secret, () => {
      assert.equal(isCronRequest(req(undefined)), false);
      assert.equal(isCronRequest(req("Bearer ")), false);
      assert.equal(isCronRequest(req(`Bearer ${SECRET}`)), false);
    });
  }
});

test("refuses a missing, wrong, shorter or longer bearer", () => {
  withSecret(SECRET, () => {
    assert.equal(isCronRequest(req(undefined)), false, "no header");
    assert.equal(isCronRequest(req("")), false, "empty header");
    assert.equal(isCronRequest(req(`Bearer ${SECRET.replace(/.$/, "X")}`)), false, "wrong, same length");
    assert.equal(isCronRequest(req(`Bearer ${SECRET.slice(0, -1)}`)), false, "too short");
    assert.equal(isCronRequest(req(`Bearer ${SECRET}x`)), false, "too long");
    assert.equal(isCronRequest(req(SECRET)), false, "no Bearer scheme");
    assert.equal(isCronRequest(req(`bearer ${SECRET}`)), false, "scheme is case-sensitive");
  });
});

test("accepts exactly `Bearer $CRON_SECRET`", () => {
  withSecret(SECRET, () => {
    assert.equal(isCronRequest(req(`Bearer ${SECRET}`)), true);
  });
});
