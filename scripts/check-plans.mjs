#!/usr/bin/env node
/**
 * Quality gate for every builder template: the free plans inline in
 * the builder engine (builder/src) and the paid plans in lib/template-geometry.ts.
 *
 *   node scripts/check-plans.mjs                        summary of all templates, exit 1 on any error
 *   node scripts/check-plans.mjs <key> [--png out.png]  full report for one template
 *   node scripts/check-plans.mjs <key> --candidate rooms.js [--png out.png]
 *        check a draft of a FREE template: rooms.js holds the array literal that
 *        is passed to addTemplate() (planRoom(...) calls allowed)
 *   --geometry <path>   read paid plans from another template-geometry.ts
 *
 * Geometry goes through footprint/wallLen/localToWorld/wallPoint lifted out of
 * the builder, and rooms without explicit furniture through the engine's own
 * furnishRoom/clampFurn, so what is checked is what the builder renders.
 *
 * ERROR  the builder would show something broken: overlapping rooms, a door into
 *        a wall or into the wrong room, an unreachable room, furniture that
 *        clampFurn would silently move, furniture in a doorway, anything the
 *        builder's own designIssues() flags (a room without its own door, a window
 *        onto another room or a veranda).
 * WARN   realism heuristics: NBC-style minimum sizes, daylight, privacy,
 *        furniture backed against a wall.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import vm from "node:vm";
import { builderSource } from "./builder-source.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = builderSource();

function between(src, start, end) {
  const i = src.indexOf(start);
  if (i < 0) throw new Error(`marker not found: ${start}`);
  const j = src.indexOf(end, i + start.length);
  if (j < 0) throw new Error(`marker not found: ${end}`);
  return src.slice(i, j);
}
const catalogSection = (name) => between(HTML, `\n  ${name}:{`, "\n  },");
const keysOf = (name) => new Set([...catalogSection(name).matchAll(/\n\s{4}(\w+)\s*:\s*\{/g)].map((m) => m[1]));

/* ---------------- catalog, parsed live from the engine ---------------- */

export const ROOMS = {};
for (const m of catalogSection("rooms").matchAll(
  /\n\s{4}(\w+):\s*\{name:'([^']+)',\s*w:([\d.]+),\s*len:([\d.]+),\s*fill:'(#[0-9a-fA-F]+)'([^}]*)\}/g,
)) ROOMS[m[1]] = { name: m[2], w: +m[3], len: +m[4], fill: m[5], open: /open:true/.test(m[6]) };

export const FURN = {};
for (const m of catalogSection("furniture").matchAll(
  /\n\s{4}(\w+):\s*\{name:'([^']+)',\s*w:([\d.]+),\s*d:([\d.]+),\s*h:([\d.]+),\s*cat:'(\w+)'/g,
)) FURN[m[1]] = { name: m[2], w: +m[3], d: +m[4], h: +m[5], cat: m[6] };

const DOOR_TYPES = keysOf("doors");
const PAINT = keysOf("paint");
const FLOOR_COL = keysOf("floorCol");
const [, ROOM_MIN, ROOM_MAX] = HTML.match(/roomMin:([\d.]+),\s*roomMax:([\d.]+)/).map(Number);
if (Object.keys(ROOMS).length < 8 || Object.keys(FURN).length < 17 || DOOR_TYPES.size < 8)
  throw new Error("check-plans: could not parse the builder catalog");

/* ---------------- engine functions, lifted verbatim ---------------- */

function fnSource(name) {
  const i = HTML.indexOf(`function ${name}(`);
  if (i < 0) throw new Error(`function ${name} not found in builder/src`);
  for (let k = HTML.indexOf("{", i), depth = 0; k < HTML.length; k++) {
    if (HTML[k] === "{") depth++;
    else if (HTML[k] === "}" && --depth === 0) return HTML.slice(i, k + 1);
  }
  throw new Error(`unbalanced function ${name}`);
}
const engineCtx = vm.createContext({ Math, console, C: { furniture: FURN, rooms: ROOMS }, state: { seq: { furn: 0 } } });
vm.runInContext(
  ["footprint", "wallLen", "localToWorld", "wallPoint", "clampFurn", "furnishRoom", "windowFacesNeighbour"].map(fnSource).join("\n") +
    "\nglobalThis.E = {footprint, wallLen, localToWorld, wallPoint, clampFurn, furnishRoom, windowFacesNeighbour};",
  engineCtx,
);
const E = engineCtx.E;

/* ---------------- template loaders ---------------- */

/** free templates, optionally with draft room arrays substituted: {key: "[planRoom(...), ...]"} */
export function loadFree(overrides = {}) {
  const src = between(HTML, "const TEMPLATES = {};", "// Paid templates (12 office");
  const ctx = vm.createContext({ Math, console, tRoom() {}, tRoomSpec() {} });
  let code = src + "\n;globalThis.__T = TEMPLATES;";
  for (const [key, text] of Object.entries(overrides)) {
    // a draft for a key not in the builder yet is checked as a new home template
    code += `\nif(!__T[${JSON.stringify(key)}]) __T[${JSON.stringify(key)}] = {name:${JSON.stringify(key)}, cat:"indian", desc:"(new)"};`;
    code += `\n__T[${JSON.stringify(key)}].rooms = (${text}\n);`;
  }
  vm.runInContext(code, ctx);
  return Object.entries(ctx.__T).map(([key, t]) => ({
    key, name: t.name, desc: t.desc, cat: t.cat, free: true,
    profile: t.cat === "office" ? "office" : "home", rooms: t.rooms,
  }));
}

/** the JSON literal assigned after `marker` in a generated .ts module (ends at a column-0 `};` or `];`) */
function jsonAfter(ts, marker) {
  const at = ts.indexOf(marker);
  if (at < 0) throw new Error(`marker not found: ${marker}`);
  const open = ts.indexOf("=", at) + 1;
  const close = Math.min(...["\n};", "\n];"].map((m) => ts.indexOf(m, open)).filter((i) => i >= 0));
  return JSON.parse(ts.slice(open, close + 2));
}

/** paid templates as served by /api/templates/<key> */
export function loadPaid(geometryPath = join(ROOT, "lib", "template-geometry.ts")) {
  const geometry = jsonAfter(readFileSync(geometryPath, "utf8"), "const PAID_TEMPLATE_GEOMETRY");
  let names = {};
  try {
    const catalog = jsonAfter(readFileSync(join(dirname(geometryPath), "template-catalog.ts"), "utf8"), "export const TEMPLATE_CATALOG");
    names = Object.fromEntries(catalog.map((t) => [t.key, t]));
  } catch { /* names are cosmetic */ }
  return Object.entries(geometry).map(([key, g]) => ({
    key, name: names[key]?.name ?? key, desc: names[key]?.desc ?? "", cat: names[key]?.cat ?? "?",
    free: false, profile: g.profile, rooms: g.rooms,
  }));
}

/* ---------------- geometry helpers ---------------- */

const clampRot = (v) => ((Number(v) || 0) % 4 + 4) % 4;
const r2 = (n) => Math.round(n * 100) / 100;
const WIN_W = { std: 1.3, pano: 2.2 };
/** flat or wall/ceiling-mounted: may overlap floor furniture and never blocks a doorway */
const OVERLAY = new Set(["rug", "ceiling_light", "wall_art", "walllamp", "mirror_cab"]);
/** backs that belong against a wall */
const WALL_BACKED = new Set(["bed", "bed_single", "wardrobe", "kunit", "bookshelf", "dresser", "toilet", "basin", "tv", "fridge", "oven", "mirror_cab", "wall_art"]);
const SLIM = new Set(["floor_lamp", "plant", "walllamp"]);
const MIN_SIZE = { bedroom: [9.5, 2.7], hall: [9.5, 3.0], kitchen: [5.0, 1.8], bath: [2.8, 1.2], hallway: [0, 1.0], veranda: [0, 1.2], balcony: [0, 1.2] };

/** world segment of an opening centred at t on a room wall */
function openingSeg(b, wall, t, width) {
  const L = E.wallLen(b, wall);
  const [ax, az] = E.localToWorld(b, ...E.wallPoint(b, wall, t - width / 2 / L));
  const [bx, bz] = E.localToWorld(b, ...E.wallPoint(b, wall, t + width / 2 / L));
  const horiz = Math.abs(az - bz) < 1e-6;
  const fixed = horiz ? az : ax;
  return {
    horiz, fixed, L, width, along: t * L,
    lo: horiz ? Math.min(ax, bx) : Math.min(az, bz),
    hi: horiz ? Math.max(ax, bx) : Math.max(az, bz),
    inward: Math.sign((horiz ? b.cz : b.cx) - fixed),   // +1: the room lies on the larger-coordinate side
  };
}

/** rooms directly across a segment's wall line, with how much of it they cover */
function across(rooms, b, seg) {
  const out = [];
  for (const q of rooms) {
    if (q === b) continue;
    const edge = seg.horiz ? (seg.inward < 0 ? q.z0 : q.z1) : (seg.inward < 0 ? q.x0 : q.x1);
    if (Math.abs(edge - seg.fixed) > 0.02) continue;
    const lo = seg.horiz ? q.x0 : q.z0, hi = seg.horiz ? q.x1 : q.z1;
    const ov = Math.min(seg.hi, hi) - Math.max(seg.lo, lo);
    if (ov > 0.01) out.push({ q, full: lo <= seg.lo + 0.001 && seg.hi <= hi + 0.001, margin: Math.min(seg.lo - lo, hi - seg.hi) });
  }
  return out;
}

/** metres of a room side not backed by another room (samples every 5 cm) */
function exposedLength(rooms, b, side) {
  const horiz = side === "N" || side === "S";
  const fixed = { S: b.z1, N: b.z0, E: b.x1, W: b.x0 }[side];
  const [lo, hi] = horiz ? [b.x0, b.x1] : [b.z0, b.z1];
  let open = 0;
  for (let p = lo + 0.025; p < hi; p += 0.05) {
    const covered = rooms.some((q) => q !== b && (horiz
      ? Math.abs((side === "S" ? q.z0 : q.z1) - fixed) < 0.02 && p > q.x0 && p < q.x1
      : Math.abs((side === "E" ? q.x0 : q.x1) - fixed) < 0.02 && p > q.z0 && p < q.z1));
    if (!covered) open += 0.05;
  }
  return open;
}

const boxOverlap = (a, b) =>
  Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.01 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 0.01;

/* ---------------- the check ---------------- */

function normalize(spec, i, profile, err) {
  const s = Array.isArray(spec) ? { type: spec[0], cx: spec[1], cz: spec[2], ...(spec[3] || {}) } : { ...spec };
  const R = ROOMS[s.type];
  const label = `#${i + 1} ${s.name || R?.name || s.type}`;
  if (!R) { err(`${label}: unknown room type "${s.type}"`); return null; }
  const b = {
    i, label, type: s.type, name: s.name || R.name, open: R.open,
    cx: Number(s.cx) || 0, cz: Number(s.cz) || 0, rot: clampRot(s.rot),
    w: s.w ?? R.w, len: s.len ?? R.len, explicitFurniture: Array.isArray(s.furniture),
  };
  for (const dim of ["w", "len"])
    if (!(b[dim] >= ROOM_MIN && b[dim] <= ROOM_MAX)) err(`${label}: ${dim}=${b[dim]} outside ${ROOM_MIN}-${ROOM_MAX} m (the engine clamps it)`);
  if (s.paint && !PAINT.has(s.paint)) err(`${label}: unknown paint "${s.paint}"`);
  if (s.floorCol && !FLOOR_COL.has(s.floorCol)) err(`${label}: unknown floorCol "${s.floorCol}"`);
  b.doors = (s.doors || []).map(([wall, t, type, w, h]) => {
    if (type && !DOOR_TYPES.has(type)) err(`${label}: unknown door type "${type}" (engine falls back to int_hard)`);
    return { wall: clampRot(wall), t: Number(t) || 0, type: type && DOOR_TYPES.has(type) ? type : "int_hard", w: w == null ? 0.8 : Number(w), h: h == null ? 2 : Number(h) };
  });
  b.windows = (s.wins || []).map(([wall, t, kind]) => ({ wall: clampRot(wall), t: Number(t) || 0, kind: kind === "pano" ? "pano" : "std" }));
  if (b.explicitFurniture) {
    b.furniture = s.furniture.map(([key, lx, lz, rot]) => ({ key, lx: Number(lx) || 0, lz: Number(lz) || 0, rot: clampRot(rot), auto: false }));
  } else {
    const probe = { ...b, furniture: [] };
    E.furnishRoom(probe, profile);
    b.furniture = probe.furniture.map((f) => ({ key: f.key, lx: f.lx, lz: f.lz, rot: f.rot, auto: true }));
  }
  const [fx, fz] = E.footprint(b);
  Object.assign(b, { fx, fz, x0: b.cx - fx / 2, x1: b.cx + fx / 2, z0: b.cz - fz / 2, z1: b.cz + fz / 2 });
  return b;
}

export function checkTemplate(t) {
  const errors = [], warns = [];
  const err = (m) => errors.push(m), warn = (m) => warns.push(m);
  const rooms = t.rooms.map((s, i) => normalize(s, i, t.profile, err)).filter(Boolean);
  const home = t.profile === "home";

  // rooms: overlap and slivers
  for (let i = 0; i < rooms.length; i++)
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      if (ox > 0.01 && oz > 0.01) err(`${a.label} overlaps ${b.label} by ${r2(ox)} × ${r2(oz)} m`);
      else if ((ox > 0.3 && -oz > 0.001 && -oz < 0.3) || (oz > 0.3 && -ox > 0.001 && -ox < 0.3))
        warn(`${a.label} and ${b.label} leave a ${r2(Math.max(-ox, -oz))} m sliver gap between walls`);
    }

  // furniture: fit, overlap, placement
  for (const r of rooms) {
    r.boxes = [];
    if (t.free && !r.explicitFurniture) err(`${r.label}: no explicit furniture list (auto-furnish is not tuned to this room)`);
    for (const f of r.furniture) {
      const spec = FURN[f.key];
      if (!spec) { err(`${r.label}: unknown furniture "${f.key}"`); continue; }
      const [fw, fd] = f.rot % 2 ? [spec.d, spec.w] : [spec.w, spec.d];
      const mx = r.len / 2 - 0.14 - fw / 2, mz = r.w / 2 - 0.14 - fd / 2;
      if (mx < -1e-6 || mz < -1e-6) err(`${r.label}: ${f.key} does not fit the room at all`);
      else if (Math.abs(f.lx) > mx + 1e-6 || Math.abs(f.lz) > mz + 1e-6)
        err(`${r.label}: ${f.key} at (${f.lx}, ${f.lz}) breaks the 14 cm wall clearance, so clampFurn moves it (limits ±${r2(mx)}, ±${r2(mz)})`);
      const [wx, wz] = E.localToWorld(r, f.lx, f.lz);
      const wrot = (f.rot + r.rot) % 4;
      const [dx, dz] = wrot % 2 ? [spec.d, spec.w] : [spec.w, spec.d];
      r.boxes.push({ f, key: f.key, auto: f.auto, wrot, h: spec.h, overlay: OVERLAY.has(f.key), x0: wx - dx / 2, x1: wx + dx / 2, z0: wz - dz / 2, z1: wz + dz / 2 });
    }
    const tag = (bx) => bx.key + (bx.auto ? " (auto)" : "");
    for (let i = 0; i < r.boxes.length; i++)
      for (let j = i + 1; j < r.boxes.length; j++) {
        const a = r.boxes[i], b = r.boxes[j];
        if (!a.overlay && !b.overlay && boxOverlap(a, b)) err(`${r.label}: ${tag(a)} overlaps ${tag(b)}`);
      }
    for (const bx of r.boxes) {
      if (!WALL_BACKED.has(bx.key)) continue;
      // models face local +z, so after wrot quarter turns the front is +z, +x, -z, -x
      // and the back sits on the opposite side
      const gap = [bx.z0 - r.z0, bx.x0 - r.x0, r.z1 - bx.z1, r.x1 - bx.x1][bx.wrot];
      if (gap > 0.3) warn(`${r.label}: ${tag(bx)} has its back ${r2(gap)} m off the wall (rot ${bx.f.rot})`);
    }
  }

  // openings
  const OUT = { label: "outside" };
  const adj = new Map([[OUT, new Set()], ...rooms.map((r) => [r, new Set()])]);
  const link = (a, b) => { adj.get(a).add(b); adj.get(b).add(a); };
  const doorLinks = [];
  let entrances = 0;
  for (const r of rooms) {
    const segs = [];
    r.doors.forEach((d, k) => {
      const seg = openingSeg(r, d.wall, d.t, d.w), tag = `${r.label} door ${k + 1}`;
      if (seg.along - d.w / 2 < 0.08 || seg.along + d.w / 2 > seg.L - 0.08)
        err(`${tag}: ${d.w} m leaf does not fit the ${r2(seg.L)} m wall (t=${d.t})`);
      const nb = across(rooms, r, seg), full = nb.find((n) => n.full), enclosed = nb.filter((n) => !n.q.open);
      if (d.type.startsWith("ext_")) {
        if (enclosed.length) err(`${tag}: exterior door opens into ${enclosed[0].q.label}`);
        else if (full) { link(r, full.q); entrances++; }
        else { link(r, OUT); entrances++; if (nb.length) warn(`${tag}: straddles the edge of ${nb[0].q.label}`); }
      } else if (!nb.length) err(`${tag}: interior door leads outdoors (use an ext_* type or move it)`);
      else if (!full) err(`${tag}: straddles ${nb.map((n) => n.q.label).join(" / ")}`);
      else {
        link(r, full.q);
        if (full.margin < 0.05) warn(`${tag}: leaf ends within 5 cm of the shared wall's end with ${full.q.label}`);
        if (full.q.open) warn(`${tag}: interior door type opens onto ${full.q.label}`);
      }
      segs.push({ ...seg, wall: d.wall, tag });
      doorLinks.push({ r, seg, d, tag, into: full?.q });
    });
    r.windows.forEach((w, k) => {
      const width = WIN_W[w.kind], seg = openingSeg(r, w.wall, w.t, width), tag = `${r.label} window ${k + 1}`;
      if (seg.along - width / 2 < 0.06 || seg.along + width / 2 > seg.L - 0.06)
        err(`${tag}: ${width} m ${w.kind} window does not fit the ${r2(seg.L)} m wall (t=${w.t})`);
      const enclosed = across(rooms, r, seg).filter((n) => !n.q.open);
      if (enclosed.length) err(`${tag}: faces ${enclosed[0].q.label} across a shared wall`);
      for (const bx of r.boxes) {
        if (bx.overlay || SLIM.has(bx.key) || bx.h < 1.3) continue;
        const near = seg.horiz ? Math.min(Math.abs(bx.z0 - seg.fixed), Math.abs(bx.z1 - seg.fixed)) : Math.min(Math.abs(bx.x0 - seg.fixed), Math.abs(bx.x1 - seg.fixed));
        const [lo, hi] = seg.horiz ? [bx.x0, bx.x1] : [bx.z0, bx.z1];
        if (near < 0.4 && Math.min(hi, seg.hi) - Math.max(lo, seg.lo) > 0.1) warn(`${tag}: tall ${bx.key} stands in front of it`);
      }
      segs.push({ ...seg, wall: w.wall, tag });
      r.hasWindow = true;
    });
    for (let a = 0; a < segs.length; a++)
      for (let b = a + 1; b < segs.length; b++)
        if (segs[a].wall === segs[b].wall && Math.min(segs[a].hi, segs[b].hi) - Math.max(segs[a].lo, segs[b].lo) > -0.08)
          err(`${segs[a].tag} collides with ${segs[b].tag}`);
    r.segs = segs;
  }
  for (const a of doorLinks)
    for (const b of doorLinks)
      if (a.r.i < b.r.i && a.into === b.r && b.into === a.r && Math.min(a.seg.hi, b.seg.hi) - Math.max(a.seg.lo, b.seg.lo) > 0.01)
        err(`${a.tag} and ${b.tag} are the same opening defined twice`);

  // doorways stay clear on both sides
  for (const { r, seg, tag, into } of doorLinks)
    for (const [X, inward] of [[r, seg.inward], [into, -seg.inward]]) {
      if (!X) continue;
      const [a, b] = inward > 0 ? [seg.fixed, seg.fixed + 0.8] : [seg.fixed - 0.8, seg.fixed];
      const zone = seg.horiz ? { x0: seg.lo - 0.05, x1: seg.hi + 0.05, z0: a, z1: b } : { z0: seg.lo - 0.05, z1: seg.hi + 0.05, x0: a, x1: b };
      for (const bx of X.boxes) if (!bx.overlay && boxOverlap(bx, zone)) err(`${tag}: ${bx.key}${bx.auto ? " (auto)" : ""} in ${X.label} blocks the doorway`);
    }

  // the builder's own designIssues(): anything it flags shows as "N issues" the moment
  // the template loads, so it is an error here too
  engineCtx.state.blocks = rooms.map((r) => ({ ...r, id: r.i }));
  for (const r of rooms) {
    if (!r.open && !r.doors.length) err(`${r.label}: no door of its own (the builder flags it; declare the shared door on this room)`);
    for (const w of r.windows) {
      const into = E.windowFacesNeighbour({ ...r, id: r.i }, w);
      if (into) err(`${r.label}: window on wall ${w.wall} opens into ${into.label} (the builder flags it)`);
    }
  }

  // open rooms with a free edge count as reachable from outside
  for (const r of rooms) if (r.open && ["N", "E", "S", "W"].some((s) => exposedLength(rooms, r, s) >= 0.9)) link(r, OUT);
  const reach = (blocked = () => false) => {
    const seen = new Set([OUT]), queue = [OUT];
    for (const n of queue) for (const m of adj.get(n)) if (!seen.has(m) && !blocked(m)) { seen.add(m); queue.push(m); }
    return seen;
  };
  const seen = reach();
  if (!entrances) err("no entrance: add an ext_* door on an outside wall or onto a veranda");
  for (const r of rooms) if (!seen.has(r)) err(`${r.label}: unreachable from the entrance`);
  for (const r of rooms) if (r.open && ![...adj.get(r)].some((n) => n !== OUT)) warn(`${r.label}: no door from the house`);

  // realism
  const bedrooms = rooms.filter((r) => r.type === "bedroom");
  for (const r of rooms) {
    const [minArea, minSide] = MIN_SIZE[r.type] ?? [0, 0];
    const area = r.len * r.w, side = Math.min(r.len, r.w);
    if (home && area < minArea) warn(`${r.label}: ${r2(area)} m² is under the ${minArea} m² minimum for a ${r.type}`);
    if (side < minSide) warn(`${r.label}: ${r2(side)} m wide, under ${minSide} m`);
    if (["bedroom", "hall", "kitchen"].includes(r.type) && !r.hasWindow) warn(`${r.label}: no window (no daylight)`);
    if (r.type === "bath" && !r.hasWindow) warn(`${r.label}: no window or ventilator`);
    if (home) {
      const has = (...keys) => r.furniture.some((f) => keys.includes(f.key));
      if (r.type === "bedroom" && !has("bed", "bed_single")) warn(`${r.label}: no bed`);
      if (r.type === "kitchen" && !has("kunit")) warn(`${r.label}: no kitchen counter`);
      if (r.type === "bath" && !(has("toilet") && has("basin"))) warn(`${r.label}: needs a toilet and a basin`);
      if (r.type === "hall" && !has("sofa", "sofa_l", "armchair", "table")) warn(`${r.label}: no seating`);
      if (r.type === "bath" && [...adj.get(r)].some((n) => n.type === "kitchen")) warn(`${r.label}: opens straight into the kitchen`);
    }
  }
  if (home) {
    for (const b of bedrooms)
      if (!reach((m) => m !== b && m.type === "bedroom").has(b)) warn(`${b.label}: only reachable through another bedroom`);
    const commonBath = rooms.some((r) => r.type === "bath" && reach((m) => m !== r && m.type === "bedroom").has(r));
    if (bedrooms.length >= 2 && !commonBath) warn("no bathroom reachable without walking through a bedroom");
  }

  const bb = {
    x0: Math.min(...rooms.map((r) => r.x0)), x1: Math.max(...rooms.map((r) => r.x1)),
    z0: Math.min(...rooms.map((r) => r.z0)), z1: Math.max(...rooms.map((r) => r.z1)),
  };
  bb.w = bb.x1 - bb.x0; bb.d = bb.z1 - bb.z0;
  const area = rooms.reduce((n, r) => n + r.len * r.w, 0);
  const enclosed = rooms.filter((r) => !r.open).reduce((n, r) => n + r.len * r.w, 0);
  if (area / (bb.w * bb.d) < 0.7) warn(`footprint only ${Math.round((100 * area) / (bb.w * bb.d))}% filled: plan sprawls`);
  const stats = {
    rooms: rooms.length, area: r2(area), enclosed: r2(enclosed), bbox: `${r2(bb.w)} × ${r2(bb.d)}`,
    bedrooms: bedrooms.length, baths: rooms.filter((r) => r.type === "bath").length, entrances,
    doors: rooms.reduce((n, r) => n + r.doors.length, 0), windows: rooms.reduce((n, r) => n + r.windows.length, 0),
    furniture: rooms.reduce((n, r) => n + r.furniture.length, 0),
  };
  return { key: t.key, name: t.name, profile: t.profile, free: t.free, errors, warns, stats, rooms, bb };
}

/* ---------------- drawing ---------------- */

export function renderSvg(res) {
  const S = 70, pad = 1.3, top = 80, { bb } = res;
  const X = (x) => r2((x - bb.x0 + pad) * S), Y = (z) => r2((z - bb.z0 + pad) * S + top);
  const W = Math.ceil((bb.w + 2 * pad) * S), H = Math.ceil((bb.d + 2 * pad) * S + top);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/>`];
  for (let x = Math.floor(bb.x0 - pad); x <= bb.x1 + pad; x++) out.push(`<line x1="${X(x)}" y1="${top}" x2="${X(x)}" y2="${H}" stroke="#eef0f2"/>`);
  for (let z = Math.floor(bb.z0 - pad); z <= bb.z1 + pad; z++) out.push(`<line x1="0" y1="${Y(z)}" x2="${W}" y2="${Y(z)}" stroke="#eef0f2"/>`);
  for (const r of res.rooms)
    out.push(`<rect x="${X(r.x0)}" y="${Y(r.z0)}" width="${r2(r.fx * S)}" height="${r2(r.fz * S)}" fill="${ROOMS[r.type].fill}" stroke="#2d3436" stroke-width="3"${r.open ? ' stroke-dasharray="9 6"' : ""}/>`);
  for (const r of res.rooms) for (const d of r.doors) {
    const s = openingSeg(r, d.wall, d.t, d.w);
    const zone = s.horiz ? [X(s.lo), Y(s.inward > 0 ? s.fixed : s.fixed - 0.8), r2(s.width * S), r2(0.8 * S)] : [X(s.inward > 0 ? s.fixed : s.fixed - 0.8), Y(s.lo), r2(0.8 * S), r2(s.width * S)];
    out.push(`<rect x="${zone[0]}" y="${zone[1]}" width="${zone[2]}" height="${zone[3]}" fill="#f5a623" fill-opacity=".13"/>`);
  }
  for (const r of res.rooms) for (const bx of r.boxes) {
    const fill = bx.overlay ? "none" : bx.auto ? "#e3d3f0" : "#d9c7a7";
    out.push(`<rect x="${X(bx.x0)}" y="${Y(bx.z0)}" width="${r2((bx.x1 - bx.x0) * S)}" height="${r2((bx.z1 - bx.z0) * S)}" fill="${fill}" stroke="#6d5d45" stroke-width="1.2"${bx.overlay ? ' stroke-dasharray="4 3"' : ""}/>`);
    const front = [[bx.x0, bx.z1, bx.x1, bx.z1], [bx.x1, bx.z0, bx.x1, bx.z1], [bx.x0, bx.z0, bx.x1, bx.z0], [bx.x0, bx.z0, bx.x0, bx.z1]][bx.wrot];
    if (!bx.overlay) out.push(`<line x1="${X(front[0])}" y1="${Y(front[1])}" x2="${X(front[2])}" y2="${Y(front[3])}" stroke="#c0392b" stroke-width="3"/>`);
    out.push(`<text x="${X((bx.x0 + bx.x1) / 2)}" y="${Y((bx.z0 + bx.z1) / 2) + 3}" font-size="9" text-anchor="middle" fill="#3d3326">${esc(bx.key)}</text>`);
  }
  for (const r of res.rooms) {
    for (const w of r.windows) {
      const s = openingSeg(r, w.wall, w.t, WIN_W[w.kind]);
      const [x1, y1, x2, y2] = s.horiz ? [X(s.lo), Y(s.fixed), X(s.hi), Y(s.fixed)] : [X(s.fixed), Y(s.lo), X(s.fixed), Y(s.hi)];
      out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2f80ed" stroke-width="8"/>`);
    }
    for (const d of r.doors) {
      const s = openingSeg(r, d.wall, d.t, d.w), c = d.type.startsWith("ext_") ? "#c0392b" : "#2d3436";
      const n = s.inward * s.width;
      const [hx, hz, lx, lz, ex, ez] = s.horiz ? [s.lo, s.fixed, s.lo, s.fixed + n, s.hi, s.fixed] : [s.fixed, s.lo, s.fixed + n, s.lo, s.fixed, s.hi];
      const [x1, y1, x2, y2] = s.horiz ? [X(s.lo), Y(s.fixed), X(s.hi), Y(s.fixed)] : [X(s.fixed), Y(s.lo), X(s.fixed), Y(s.hi)];
      out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="6"/>`);
      out.push(`<path d="M${X(hx)} ${Y(hz)} L${X(lx)} ${Y(lz)} A${r2(s.width * S)} ${r2(s.width * S)} 0 0 ${(s.horiz ? s.inward > 0 : s.inward < 0) ? 0 : 1} ${X(ex)} ${Y(ez)}" fill="none" stroke="${c}" stroke-width="2"/>`);
    }
  }
  for (const r of res.rooms) {
    const lx = X(r.x0) + 6, ly = Y(r.z0) + 15;
    out.push(`<text x="${lx}" y="${ly}" font-size="12" font-weight="700" fill="#1e272e">${esc(r.name)}</text>`);
    out.push(`<text x="${lx}" y="${ly + 13}" font-size="10" fill="#57606f">${r2(r.len)} × ${r2(r.w)} m · ${r2(r.len * r.w)} m²</text>`);
  }
  const st = res.stats;
  out.push(`<text x="12" y="24" font-size="16" font-weight="700" fill="#1e272e">${esc(res.key)} — ${esc(res.name)}</text>`);
  out.push(`<text x="12" y="44" font-size="12" fill="${res.errors.length ? "#c0392b" : "#27ae60"}">${res.errors.length} errors · ${res.warns.length} warnings · ${st.bbox} m · ${st.area} m² (${st.enclosed} enclosed) · ${st.bedrooms} bed · ${st.baths} bath</text>`);
  out.push(`<text x="${W - 12}" y="24" font-size="13" font-weight="700" text-anchor="end" fill="#c0392b">N ↑ (−z)</text>`);
  out.push(`<text x="12" y="62" font-size="10" fill="#57606f">red edge = furniture front · orange = door clearance · purple = auto-furnished · blue = window · dashed room = open (veranda/balcony)</text>`);
  out.push("</svg>");
  return out.join("\n");
}

/* ---------------- CLI ---------------- */

export function allTemplates({ geometry, overrides } = {}) {
  return [...loadFree(overrides).filter((t) => t.key !== "empty"), ...loadPaid(geometry)];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? resolve(args.splice(i, 2)[1]) : undefined; };
  const geometry = opt("--geometry"), png = opt("--png"), candidate = opt("--candidate");
  const key = args.find((a) => !a.startsWith("--"));
  const overrides = candidate ? { [key]: readFileSync(candidate, "utf8") } : {};
  const list = allTemplates({ geometry, overrides });
  if (!key) {
    let bad = 0;
    console.log("key".padEnd(15), "rooms", "area m²".padStart(8), "bbox m".padStart(12), "  E   W");
    for (const t of list) {
      const res = checkTemplate(t);
      if (res.errors.length) bad++;
      console.log(t.key.padEnd(15), String(res.stats.rooms).padStart(5), String(res.stats.area).padStart(8), res.stats.bbox.padStart(12), String(res.errors.length).padStart(3), String(res.warns.length).padStart(3));
    }
    console.log(bad ? `\nFAIL: ${bad} template(s) with errors` : `\nPASS: ${list.length} templates, no errors`);
    process.exit(bad ? 1 : 0);
  }
  const t = list.find((x) => x.key === key);
  if (!t) { console.error(`unknown template ${key}`); process.exit(2); }
  const res = checkTemplate(t);
  console.log(`${res.key} — ${res.name} (${res.profile}${res.free ? ", free" : ", paid"})`);
  console.log(Object.entries(res.stats).map(([k, v]) => `${k}: ${v}`).join(" · "));
  for (const e of res.errors) console.log("ERROR " + e);
  for (const w of res.warns) console.log("WARN  " + w);
  if (!res.errors.length && !res.warns.length) console.log("clean");
  if (png) {
    const { default: sharp } = await import("sharp");
    await sharp(Buffer.from(renderSvg(res))).png().toFile(resolve(png));
    console.log(`plan drawn to ${resolve(png)}`);
  }
  process.exit(res.errors.length ? 1 : 0);
}
