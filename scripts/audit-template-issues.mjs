// Audits the generated paid-template geometry against builder.html's own
// designIssues() rules, so authoring problems are caught without opening the app.
//
// Mirrors windowFacesNeighbour() in builder.html: a window is only a problem when
// its OWN position falls inside the span shared with a neighbouring room. Checking
// the whole wall (as designIssues used to) produces false positives on long walls
// that abut a small room over part of their run.
//
//   node --experimental-strip-types --conditions=react-server scripts/audit-template-issues.mjs
//
// Exits non-zero when any real issue is found, so it can gate CI.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getTemplateGeometry } from "../lib/template-geometry.ts";
import { TEMPLATE_CATALOG } from "../lib/template-catalog.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// C.rooms is parsed live out of builder.html so this cannot drift from the engine
const html = readFileSync(join(ROOT, "public/builder/builder.html"), "utf8");
const roomsSrc = html.match(/rooms:\s*\{[\s\S]*?\n {2}\}/)[0];
const C_rooms = {};
for (const m of roomsSrc.matchAll(
  /(\w+):\s*\{name:'([^']+)',\s*w:([\d.]+),\s*len:([\d.]+)[^}]*?\}/g,
)) {
  C_rooms[m[1]] = { name: m[2], w: +m[3], len: +m[4], open: /open:true/.test(m[0]) };
}
if (Object.keys(C_rooms).length < 5) {
  console.error("Could not parse C.rooms out of builder.html — did its shape change?");
  process.exit(2);
}

const wallLen = (b, w) => (w % 2 ? b.w : b.len);
function wallPoint(b, wall, t) {
  const L = wallLen(b, wall), o = (t - 0.5) * L;
  if (wall === 0) return [o, b.w / 2];
  if (wall === 2) return [-o, -b.w / 2];
  if (wall === 1) return [b.len / 2, -o];
  return [-b.len / 2, o];
}
function l2w(b, x, z) {
  const a = b.rot * Math.PI / 2;
  return [b.cx + x * Math.cos(a) + z * Math.sin(a), b.cz - x * Math.sin(a) + z * Math.cos(a)];
}

/** The neighbour a window actually opens into, or null. */
function windowFacesNeighbour(blocks, b, w) {
  const wall = Number(w[0]), t = Number(w[1]);
  const [ax, az] = l2w(b, ...wallPoint(b, wall, 0));
  const [bx, bz] = l2w(b, ...wallPoint(b, wall, 1));
  const [wx, wz] = l2w(b, ...wallPoint(b, wall, t));
  const horiz = Math.abs(az - bz) < Math.abs(ax - bx);
  for (const o of blocks) {
    if (o === b) continue;
    for (let w2 = 0; w2 < 4; w2++) {
      const [cx, cz] = l2w(o, ...wallPoint(o, w2, 0));
      const [dx, dz] = l2w(o, ...wallPoint(o, w2, 1));
      if (horiz !== (Math.abs(cz - dz) < Math.abs(cx - dx))) continue;
      if (horiz) {
        if (Math.abs(az - cz) > 0.25) continue;
        const lo = Math.max(Math.min(ax, bx), Math.min(cx, dx));
        const hi = Math.min(Math.max(ax, bx), Math.max(cx, dx));
        if (hi - lo >= 0.7 && wx >= lo - 0.01 && wx <= hi + 0.01) return o;
      } else {
        if (Math.abs(ax - cx) > 0.25) continue;
        const lo = Math.max(Math.min(az, bz), Math.min(cz, dz));
        const hi = Math.min(Math.max(az, bz), Math.max(cz, dz));
        if (hi - lo >= 0.7 && wz >= lo - 0.01 && wz <= hi + 0.01) return o;
      }
    }
  }
  return null;
}

const paid = TEMPLATE_CATALOG.filter((t) => t.paid);
let total = 0;
const offenders = [];

for (const t of paid) {
  const g = getTemplateGeometry(t.key);
  const blocks = g.rooms.map((r) => {
    const spec = C_rooms[r.type] ?? { w: 3, len: 3 };
    return {
      type: r.type, name: r.name, cx: r.cx, cz: r.cz, rot: r.rot ?? 0,
      w: r.w ?? spec.w, len: r.len ?? spec.len,
      doors: r.doors ?? [], wins: r.wins ?? [],
    };
  });
  const iss = [];
  blocks.forEach((b, i) => {
    const spec = C_rooms[b.type] ?? {};
    const nm = `${b.name || spec.name || b.type} ${i + 1}`;
    if (!spec.open && !b.doors.length) iss.push(`${nm}: no door`);
    for (const w of b.wins) {
      const into = windowFacesNeighbour(blocks, b, w);
      if (into) iss.push(`${nm}: window opens into ${into.name || into.type}`);
    }
  });
  total += iss.length;
  if (iss.length) offenders.push({ key: t.key, iss });
}

console.log(`audited ${paid.length} paid templates · ${total} issue(s)`);
for (const o of offenders) console.log(`  ${o.key}: ${o.iss.join(" | ")}`);
if (total === 0) console.log("PASS — no room without a door, no window opening into another room");
process.exit(total === 0 ? 0 : 1);
