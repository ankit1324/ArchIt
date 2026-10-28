import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

// Static checks over supabase/migrations, applied in filename order (the
// order the Supabase CLI uses). They guard the access model the app relies
// on: every public table is RLS deny-all, reachable only by service_role, and
// that role's access is granted explicitly. From 2026-10-30 Supabase no
// longer auto-grants new public tables to service_role, so a CREATE TABLE
// without a matching GRANT would fail at runtime with 42501.

const DIR = new URL("../supabase/migrations/", import.meta.url);

/** SQL with comments removed and whitespace collapsed, lower-cased. */
function normalize(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const migrations = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((file, index) => ({ file, index, sql: normalize(readFileSync(new URL(file, DIR), "utf8")) }));

/** Unqualified names default to public; returns null for other schemas. */
function publicName(raw) {
  const name = raw.replace(/"/g, "").trim();
  if (!name.includes(".")) return name;
  const [schema, rel] = name.split(".");
  return schema === "public" ? rel : null;
}

function* matches(re) {
  for (const m of migrations) {
    for (const hit of m.sql.matchAll(re)) yield { m, hit };
  }
}

/** Public tables -> index of the migration that creates them. */
const tables = new Map();
for (const { m, hit } of matches(/create table (?:if not exists )?([\w."]+)/g)) {
  const name = publicName(hit[1]);
  if (name && !tables.has(name)) tables.set(name, m.index);
}

/** Public functions -> { index, args } of their first definition. */
const functions = new Map();
for (const { m, hit } of matches(/create (?:or replace )?function ([\w."]+) ?\(/g)) {
  const name = publicName(hit[1]);
  if (name && !functions.has(name)) functions.set(name, m.index);
}

/** Every GRANT statement: { index, privs, objects, roles }. */
const grants = [...matches(/grant ([\w ,]+?) on ([\s\S]+?) to ([\w ,"]+?)(?: with grant option)? ?;/g)].map(
  ({ m, hit }) => ({
    index: m.index,
    file: m.file,
    privs: hit[1].split(",").map((p) => p.trim()),
    on: hit[2].trim(),
    roles: hit[3].split(",").map((r) => r.replace(/"/g, "").trim()),
  }),
);

test("there are migrations and public tables to check", () => {
  assert.ok(migrations.length > 0);
  assert.ok(tables.has("properties") && tables.has("purchases"), [...tables.keys()].join(", "));
});

test("every public table enables row level security", () => {
  const rls = new Set();
  for (const { hit } of matches(/alter table (?:if exists )?(?:only )?([\w."]+) enable row level security/g)) {
    const name = publicName(hit[1]);
    if (name) rls.add(name);
  }
  const missing = [...tables.keys()].filter((t) => !rls.has(t));
  assert.deepEqual(missing, [], `tables without RLS: ${missing.join(", ")}`);
});

test("every public table is granted to service_role in the same or a later migration", () => {
  const crud = ["select", "insert", "update", "delete"];
  const missing = [];
  for (const [table, createdIn] of tables) {
    const ok = grants.some((g) => {
      if (g.index < createdIn || !g.roles.includes("service_role")) return false;
      if (!(g.privs.includes("all") || g.privs.includes("all privileges") || crud.every((p) => g.privs.includes(p)))) {
        return false;
      }
      if (/^all tables in schema public$/.test(g.on)) return true;
      const m = g.on.match(/^(?:table )?(.+)$/);
      return m[1].split(",").map(publicName).includes(table);
    });
    if (!ok) missing.push(table);
  }
  assert.deepEqual(missing, [], `tables with no service_role grant: ${missing.join(", ")}`);
});

test("every function is executable by service_role", () => {
  const missing = [];
  for (const [fn, createdIn] of functions) {
    const ok = grants.some(
      (g) =>
        g.index >= createdIn &&
        g.roles.includes("service_role") &&
        (g.privs.includes("execute") || g.privs.includes("all")) &&
        (/^all functions in schema public$/.test(g.on) ||
          g.on
            .replace(/^function /, "")
            .split(/,(?![^(]*\))/)
            .some((sig) => publicName(sig.split("(")[0]) === fn)),
    );
    if (!ok) missing.push(fn);
  }
  assert.deepEqual(missing, [], `functions with no service_role execute grant: ${missing.join(", ")}`);
});

test("no migration grants to anon or authenticated, or creates a policy on a public table", () => {
  // The browser never talks to Postgres: anon/authenticated must have no
  // grants and no policies on public tables. The storage schema is out of
  // scope here (20260711121000_photos_storage.sql only inserts the public
  // `photos` bucket row and creates no storage policy, so writes stay
  // server-only), but a public-table policy would quietly open a hole.
  const leaks = grants
    .filter((g) => g.roles.some((r) => r === "anon" || r === "authenticated" || r === "public"))
    .map((g) => `${g.file}: grant ${g.privs.join(", ")} on ${g.on} to ${g.roles.join(", ")}`);
  for (const { m, hit } of matches(/create policy (?:if not exists )?(?:"[^"]*"|\w+) on ([\w."]+)/g)) {
    if (publicName(hit[1]) !== null) leaks.push(`${m.file}: policy on ${hit[1]}`);
  }
  assert.deepEqual(leaks, []);
});
