import { builderSource } from '../scripts/builder-source.mjs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadUnits } from './builder-units-lib.mjs';

const src = builderSource();
function lift(name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `builder source has no function ${name}()`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unterminated function ${name}()`);
}
function engine(names, globals = {}) {
  const ctx = { ...globals };
  vm.createContext(ctx);
  vm.runInContext(names.map(lift).join('\n') + `;globalThis.api = {${names.join(',')}};`, ctx);
  return ctx.api;
}
const footprint = (b) => (b.rot % 2 ? [b.w, b.len] : [b.len, b.w]);
const room = (cx, cz, len, w, rot = 0) => ({ cx, cz, len, w, rot });

test('edge stops are every distinct room edge, merged within 2 cm', () => {
  const { edgeStops } = engine(['edgeStops'], { footprint });
  // two rooms side by side (0..3.6, 3.6..6.6) and one below spanning both
  const rooms = [room(1.8, 0, 3.6, 3), room(5.1, 0, 3, 3), room(3.3, 3, 6.6, 3)];
  assert.deepEqual(Array.from(edgeStops(rooms, 'x'), (v) => +v.toFixed(2)), [0, 3.6, 6.6]);
  assert.deepEqual(Array.from(edgeStops(rooms, 'z'), (v) => +v.toFixed(2)), [-1.5, 1.5, 4.5]);
  // an edge 1 cm off is the same wall, not a 1 cm segment
  const jog = [room(1.8, 0, 3.6, 3), room(5.105, 0, 3, 3)];
  assert.equal(edgeStops(jog, 'x').length, 3);
});

test('edge stops follow a quarter-turned room', () => {
  const { edgeStops } = engine(['edgeStops'], { footprint });
  assert.deepEqual(Array.from(edgeStops([room(0, 0, 4, 2, 1)], 'x')), [-1, 1]);
  assert.deepEqual(Array.from(edgeStops([room(0, 0, 4, 2, 1)], 'z')), [-2, 2]);
});

test('dimension rows clear the add-room buttons at every zoom', () => {
  const { dimOffsets } = engine(['dimOffsets']);
  for (const S of [8, 30, 54, 70]) {
    const [a, b] = dimOffsets(S);
    const hotspotEdge = 0.62 * S + 20;           // centre 0.62 m out, 40 px button
    assert.ok(a >= hotspotEdge + 8, `S=${S}: row at ${a} vs button edge ${hotspotEdge}`);
    assert.ok(b > a);
  }
});

test('the plan draws a chain and an overall size, labelled in the design units', () => {
  const units = loadUnits('ft');
  const { dimLinesSvg } = engine(['edgeStops', 'dimOffsets', 'dimLinesSvg'], {
    footprint,
    S: 50,
    P: (x, z, ox, oy) => [ox + x * 50, oy + z * 50],
    boundsOf: (bs) => {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      bs.forEach((b) => { const [w, d] = footprint(b); x0 = Math.min(x0, b.cx - w / 2); x1 = Math.max(x1, b.cx + w / 2); z0 = Math.min(z0, b.cz - d / 2); z1 = Math.max(z1, b.cz + d / 2); });
      return { x0, x1, z0, z1 };
    },
    fmtLen: units.fmtLen,
  });
  const ft = (n) => n / units.FT_PER_M;
  const rooms = [room(ft(6), 0, ft(12), ft(10)), room(ft(12 + 9), 0, ft(18), ft(10))];
  const svg = dimLinesSvg(rooms, 0, 0);
  const labels = [...svg.matchAll(/class="dimtxt"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.ok(labels.includes('12′0″'), labels.join('|'));    // room-by-room
  assert.ok(labels.includes('18′0″'), labels.join('|'));
  assert.ok(labels.includes('30′0″'), labels.join('|'));    // overall width
  assert.ok(labels.includes('10′0″'), labels.join('|'));    // depth: one row only
  assert.match(svg, /pointer-events="none"/);
});
