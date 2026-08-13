#!/usr/bin/env node
/**
 * Independent audit of the GENERATED paid geometry.
 *
 *   node --experimental-strip-types --conditions=react-server scripts/check-templates.mjs
 *
 * Deliberately does NOT import anything from scripts/gen-templates.mjs: it reads
 * lib/template-geometry.ts (the artefact the API actually serves) and validates it
 * against the `C` catalog parsed out of public/builder/builder.html (the engine that
 * actually consumes it). If the generator's internal mirror of C ever drifts from
 * builder.html, this is what catches it.
 *
 * `--conditions=react-server` makes `import "server-only"` resolve to its empty
 * build, exactly as it does in a Next.js server bundle.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const { getTemplateGeometry } = await import(join(ROOT, "lib", "template-geometry.ts"));
const { TEMPLATE_CATALOG } = await import(join(ROOT, "lib", "template-catalog.ts"));

/* ---- parse C out of builder.html (source of truth for keys) ---- */
const html = readFileSync(join(ROOT, "public", "builder", "builder.html"), "utf8");
function section(name) {
  const start = html.indexOf(`\n  ${name}:{`);
  if (start < 0) throw new Error(`C.${name} not found in builder.html`);
  let i = html.indexOf("{", start), depth = 0, end = i;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (!depth) { end = i; break; } }
  }
  return html.slice(start, end + 1);
}
const keysOf = (name) => new Set([...section(name).matchAll(/^\s{4}(\w+)\s*:/gm)].map((m) => m[1]));
const C = {
  rooms: keysOf("rooms"), paint: keysOf("paint"), floorCol: keysOf("floorCol"),
  doors: keysOf("doors"), furniture: keysOf("furniture"),
};
const roomsSrc = section("rooms");
const OPEN = new Set([...roomsSrc.matchAll(/^\s{4}(\w+)\s*:.*open:\s*true/gm)].map((m) => m[1]));
const [, roomMin, roomMax] = html.match(/roomMin:\s*([\d.]+),\s*roomMax:\s*([\d.]+)/).map(Number);

const paidKeys = TEMPLATE_CATALOG.filter((t) => t.paid).map((t) => t.key);
const fails = [];
const fail = (k, m) => fails.push(`${k}: ${m}`);
let roomCount = 0, doorCount = 0, winCount = 0, furnCount = 0, panoCount = 0;
const rows = [];

for (const key of paidKeys) {
  const g = getTemplateGeometry(key);
  if (!g) { fail(key, "no geometry"); continue; }
  if (g.v !== 2) fail(key, `expected v:2, got ${JSON.stringify(g.v)}`);
  if (!["home", "office"].includes(g.profile)) fail(key, `bad profile ${g.profile}`);
  if (!Array.isArray(g.rooms) || !g.rooms.length) { fail(key, "no rooms"); continue; }

  const boxes = [];
  for (const [i, r] of g.rooms.entries()) {
    const at = `room ${i} (${r.name ?? r.type})`;
    roomCount++;
    if (Array.isArray(r)) { fail(key, `${at}: v1 tuple in a v2 payload`); continue; }
    if (!C.rooms.has(r.type)) fail(key, `${at}: unknown room type "${r.type}"`);
    if (typeof r.cx !== "number" || typeof r.cz !== "number") fail(key, `${at}: cx/cz not numbers`);
    const rot = r.rot ?? 0;
    if (!Number.isInteger(rot) || rot < 0 || rot > 3) fail(key, `${at}: rot=${rot}`);
    for (const dim of ["w", "len"]) {
      const v = r[dim];
      if (v === undefined) continue;
      if (!(v >= roomMin && v <= roomMax)) fail(key, `${at}: ${dim}=${v} outside ${roomMin}..${roomMax}`);
    }
    if (r.paint && !C.paint.has(r.paint)) fail(key, `${at}: unknown paint "${r.paint}"`);
    if (r.floorCol && !C.floorCol.has(r.floorCol)) fail(key, `${at}: unknown floorCol "${r.floorCol}"`);

    const dimsFor = (room) => {
      const spec = roomsSrc.match(new RegExp(`${room.type}\\s*:\\{[^}]*w:\\s*([\\d.]+),\\s*len:\\s*([\\d.]+)`));
      return [room.w ?? Number(spec[1]), room.len ?? Number(spec[2])];
    };
    const [w, len] = dimsFor(r);
    const [fx, fz] = rot % 2 ? [w, len] : [len, w];
    boxes.push({ at, cx: r.cx, cz: r.cz, fx, fz });

    for (const dr of r.doors ?? []) {
      doorCount++;
      const [wall, t, type] = dr;
      if (!Number.isInteger(wall) || wall < 0 || wall > 3) fail(key, `${at}: door wall=${JSON.stringify(wall)}`);
      if (typeof t !== "number" || !(t >= 0 && t <= 1)) fail(key, `${at}: door t=${JSON.stringify(t)}`);
      if (type !== undefined && !C.doors.has(type)) fail(key, `${at}: unknown door type "${type}"`);
      if (dr[3] !== undefined && !(dr[3] >= 0.6 && dr[3] <= 2.6)) fail(key, `${at}: door width ${dr[3]}`);
    }
    for (const wn of r.wins ?? []) {
      winCount++;
      const [wall, t, kind] = wn;
      if (kind === "pano") panoCount++;
      if (!Number.isInteger(wall) || wall < 0 || wall > 3) fail(key, `${at}: window wall=${JSON.stringify(wall)}`);
      if (typeof t !== "number" || !(t >= 0 && t <= 1)) fail(key, `${at}: window t=${JSON.stringify(t)}`);
      if (kind !== undefined && kind !== "std" && kind !== "pano") fail(key, `${at}: window kind "${kind}"`);
    }
    for (const f of r.furniture ?? []) {
      furnCount++;
      if (!C.furniture.has(f[0])) fail(key, `${at}: unknown furniture "${f[0]}"`);
      if (typeof f[1] !== "number" || typeof f[2] !== "number") fail(key, `${at}: furniture lx/lz`);
      if (f[3] !== undefined && !(Number.isInteger(f[3]) && f[3] >= 0 && f[3] <= 3))
        fail(key, `${at}: furniture rot ${f[3]}`);
    }
    if (!OPEN.has(r.type) && !(r.doors ?? []).length) fail(key, `${at}: no door`);
  }

  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (Math.abs(a.cx - b.cx) < (a.fx + b.fx) / 2 - 0.05 && Math.abs(a.cz - b.cz) < (a.fz + b.fz) / 2 - 0.05)
        fail(key, `${a.at} overlaps ${b.at}`);
    }

  const x0 = Math.min(...boxes.map((b) => b.cx - b.fx / 2)), x1 = Math.max(...boxes.map((b) => b.cx + b.fx / 2));
  const z0 = Math.min(...boxes.map((b) => b.cz - b.fz / 2)), z1 = Math.max(...boxes.map((b) => b.cz + b.fz / 2));
  const area = boxes.reduce((n, b) => n + b.fx * b.fz, 0);
  rows.push([key, g.profile, boxes.length,
    `${(x1 - x0).toFixed(1)} × ${(z1 - z0).toFixed(1)}`, `${area.toFixed(0)} m²`]);
}

if (paidKeys.length !== 20) fail("catalog", `expected 20 paid keys, found ${paidKeys.length}`);

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("key", 16) + pad("profile", 9) + pad("rooms", 7) + pad("bbox (m)", 14) + "floor area");
for (const r of rows) console.log(pad(r[0], 16) + pad(r[1], 9) + pad(r[2], 7) + pad(r[3], 14) + r[4]);
console.log(`\n${paidKeys.length} paid templates · ${roomCount} rooms · ${doorCount} doors · ` +
  `${winCount} windows (${panoCount} pano) · ${furnCount} placed furniture items`);

if (fails.length) {
  console.error(`\nFAIL — ${fails.length} problem(s):`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("PASS — all assertions hold");
