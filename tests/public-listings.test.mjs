import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// lib/public-listings.ts is server-only and talks to Supabase through ./db.
// Load the real module with those two swapped for in-memory fakes, so the
// tests exercise the actual query chain (live-only filter, id exclusion,
// city matching) without env or network.

/** Every query the fake db builds; each entry is the list of builder calls. */
const queries = [];
/** Rows the next query resolves with. */
let nextRows = [];
let nextError = null;

globalThis.__fakePublicListingsDb = {
  from(table) {
    const calls = [["from", table]];
    queries.push(calls);
    const q = {
      then(resolve, reject) {
        return Promise.resolve({ data: nextError ? null : nextRows, error: nextError }).then(resolve, reject);
      },
    };
    for (const m of ["select", "eq", "neq", "ilike", "order", "limit", "or"]) {
      q[m] = (...args) => {
        calls.push([m, ...args]);
        return q;
      };
    }
    return q;
  },
};

const FAKE_DB = `data:text/javascript,${encodeURIComponent(`
export const db = globalThis.__fakePublicListingsDb;
export const PUBLIC_COLUMNS = "id, city";
export function rowToListing(r) { return { id: r.id, city: r.city, fromRow: true }; }
`)}`;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (specifier === "react") {
      return { url: "data:text/javascript,export const cache = (fn) => fn;", shortCircuit: true };
    }
    if (context.parentURL?.endsWith("/lib/public-listings.ts")) {
      if (specifier === "./db") return { url: FAKE_DB, shortCircuit: true };
      if (specifier.startsWith("./")) return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});

const { cityName, escapeLike, listMoreInCity, MORE_IN_CITY_LIMIT } = await import(
  "../lib/public-listings.ts"
);

function reset(rows = [], error = null) {
  queries.length = 0;
  nextRows = rows;
  nextError = error;
}

test("cityName drops the PIN code and whitespace", () => {
  assert.equal(cityName("Chandigarh, 160015"), "Chandigarh");
  assert.equal(cityName("  Palampur "), "Palampur");
  assert.equal(cityName(""), "");
  assert.equal(cityName(null), "");
  assert.equal(cityName(undefined), "");
});

test("escapeLike neutralises LIKE wildcards", () => {
  assert.equal(escapeLike("50%_off\\"), "50\\%\\_off\\\\");
  assert.equal(escapeLike("Chandigarh"), "Chandigarh");
});

test("listMoreInCity queries live listings only, excluding the current one", async () => {
  reset([]);
  await listMoreInCity({ id: "abc", city: "Chandigarh, 160015" });
  assert.equal(queries.length, 1);
  const calls = queries[0];
  assert.deepEqual(calls[0], ["from", "properties"]);
  assert.ok(calls.some((c) => c[0] === "eq" && c[1] === "status" && c[2] === "live"), "live-only filter");
  assert.ok(calls.some((c) => c[0] === "neq" && c[1] === "id" && c[2] === "abc"), "excludes itself");
  assert.ok(calls.some((c) => c[0] === "ilike" && c[1] === "city" && c[2] === "Chandigarh%"));
  // the select never asks for owner contact or user ids
  const select = calls.find((c) => c[0] === "select");
  assert.ok(!/owner|user_id/.test(select[1]));
});

test("listMoreInCity matches the city name across PIN codes, not prefixes of other cities", async () => {
  reset([
    { id: "a", city: "Chandigarh, 160016" },
    { id: "abc", city: "Chandigarh, 160015" }, // itself, if the DB filter were missed
    { id: "b", city: "chandigarh" },
    { id: "c", city: "Chandigarh Extension, 140000" },
    { id: "d", city: "Chandigarhpur" },
  ]);
  const out = await listMoreInCity({ id: "abc", city: "Chandigarh, 160015" });
  assert.deepEqual(out.map((l) => l.id), ["a", "b"]);
  assert.ok(out.every((l) => l.fromRow), "rows go through rowToListing");
});

test("listMoreInCity caps at the limit", async () => {
  reset(Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, city: "Zirakpur, 140603" })));
  const out = await listMoreInCity({ id: "abc", city: "Zirakpur" });
  assert.equal(out.length, MORE_IN_CITY_LIMIT);
});

test("listMoreInCity never throws and skips the query without a city", async () => {
  reset([], { message: "boom" });
  const origError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await listMoreInCity({ id: "abc", city: "Chandigarh" }), []);
  } finally {
    console.error = origError;
  }
  reset([{ id: "a", city: "" }]);
  assert.deepEqual(await listMoreInCity({ id: "abc", city: " , 160015" }), []);
  assert.equal(queries.length, 0);
});
