import assert from "node:assert/strict";
import test from "node:test";

// lib/entitlements-core.ts is the dependency-free half of lib/entitlements.ts
// (which imports "server-only" and ./db); the ledger count is faked here.
import { createEntitlements } from "../lib/entitlements-core.ts";

/** Entitlements over an in-memory ledger; `calls` records every count query. */
function harness({ owned = [], error = null, paywallEnabled = true } = {}) {
  const calls = [];
  const ent = createEntitlements({
    paywallEnabled,
    async countPurchases(userId, purpose, ref) {
      calls.push({ userId, purpose, ref });
      if (error) return { count: null, error };
      const count = owned.filter(
        (p) => p.userId === userId && p.purpose === purpose && (ref === undefined || p.ref === ref),
      ).length;
      return { count, error: null };
    },
  });
  return { ...ent, calls };
}

/** Silence the expected console.error from DB-failure paths, and capture it. */
async function quietErrors(fn) {
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.join(" "));
  try {
    return { result: await fn(), logged };
  } finally {
    console.error = original;
  }
}

test("hasPurchase grants when the ledger has a matching row", async () => {
  const { hasPurchase, calls } = harness({
    owned: [{ userId: "u1", purpose: "contact_owner", ref: "p1" }],
  });
  assert.deepEqual(await hasPurchase("u1", "contact_owner", "p1"), { ok: true, granted: true });
  assert.deepEqual(calls, [{ userId: "u1", purpose: "contact_owner", ref: "p1" }]);
});

test("hasPurchase denies another user, purpose or ref", async () => {
  const { hasPurchase } = harness({
    owned: [{ userId: "u1", purpose: "contact_owner", ref: "p1" }],
  });
  assert.deepEqual(await hasPurchase("u2", "contact_owner", "p1"), { ok: true, granted: false });
  assert.deepEqual(await hasPurchase("u1", "builder_unlock"), { ok: true, granted: false });
  assert.deepEqual(await hasPurchase("u1", "contact_owner", "p2"), { ok: true, granted: false });
});

test("hasPurchase without a ref is not scoped to one", async () => {
  const { hasPurchase, calls } = harness({
    owned: [{ userId: "u1", purpose: "template_unlock", ref: "villa" }],
  });
  assert.deepEqual(await hasPurchase("u1", "template_unlock"), { ok: true, granted: true });
  assert.equal(calls[0].ref, undefined);
});

test("hasPurchase treats a null count as not granted", async () => {
  const ent = createEntitlements({
    paywallEnabled: true,
    countPurchases: async () => ({ count: null, error: null }),
  });
  assert.deepEqual(await ent.hasPurchase("u1", "builder_unlock"), { ok: true, granted: false });
});

test("hasPurchase maps a DB error to ok:false without leaking the message", async () => {
  const { hasPurchase } = harness({ error: { message: "connection reset by peer" } });
  const { result, logged } = await quietErrors(() => hasPurchase("u1", "contact_owner", "p1"));
  assert.deepEqual(result, { ok: false, error: "internal error" });
  assert.equal(logged.length, 1);
  assert.match(logged[0], /contact_owner:p1/);
  assert.match(logged[0], /connection reset by peer/);
});

test("hasBuilderUnlock checks the builder_unlock purpose with no ref", async () => {
  const { hasBuilderUnlock, calls } = harness({
    owned: [{ userId: "u1", purpose: "builder_unlock", ref: null }],
  });
  assert.deepEqual(await hasBuilderUnlock("u1"), { ok: true, granted: true });
  assert.deepEqual(await hasBuilderUnlock("u2"), { ok: true, granted: false });
  assert.deepEqual(calls[0], { userId: "u1", purpose: "builder_unlock", ref: undefined });
});

test("builderUnlockError lets an unlocked user through", async () => {
  const { builderUnlockError } = harness({
    owned: [{ userId: "u1", purpose: "builder_unlock", ref: null }],
  });
  assert.equal(await builderUnlockError("u1"), null);
});

test("builderUnlockError answers 402 with the purpose to buy when not unlocked", async () => {
  const { builderUnlockError } = harness();
  const res = await builderUnlockError("u1");
  assert.ok(res instanceof Response);
  assert.equal(res.status, 402);
  assert.deepEqual(await res.json(), { error: "builder unlock required", purpose: "builder_unlock" });
});

test("builderUnlockError fails closed with 500 when the ledger is unreachable", async () => {
  const { builderUnlockError } = harness({ error: { message: "timeout" } });
  const { result: res } = await quietErrors(() => builderUnlockError("u1"));
  assert.ok(res instanceof Response);
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: "internal error" });
});

test("with the paywall off, builderUnlockError never touches the ledger", async () => {
  const { builderUnlockError, hasBuilderUnlock, calls } = harness({
    paywallEnabled: false,
    error: { message: "would fail if queried" },
  });
  assert.equal(await builderUnlockError("u1"), null);
  assert.deepEqual(calls, []);
  // the ledger lookup itself is unaffected by the switch: past purchases stay provable
  const { result } = await quietErrors(() => hasBuilderUnlock("u1"));
  assert.deepEqual(result, { ok: false, error: "internal error" });
});

test("with the paywall off, hasBuilderUnlock still reports real ownership", async () => {
  const { hasBuilderUnlock } = harness({
    paywallEnabled: false,
    owned: [{ userId: "u1", purpose: "builder_unlock", ref: null }],
  });
  assert.deepEqual(await hasBuilderUnlock("u1"), { ok: true, granted: true });
  assert.deepEqual(await hasBuilderUnlock("u2"), { ok: true, granted: false });
});
