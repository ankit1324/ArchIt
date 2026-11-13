import { builderSource } from '../scripts/builder-source.mjs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

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
const footprint = (b) => (b.rot % 2 ? [b.w, b.len] : [b.len, b.w]);
const OPEN_SKY = new Set(['balcony', 'terrace']);
const ctx = {
  footprint,
  C: { rooms: new Proxy({}, { get: (_, k) => ({ name: String(k)[0].toUpperCase() + String(k).slice(1) }) }) },
  roomShell: (t) => (OPEN_SKY.has(t) ? 'balcony' : t === 'parking' ? 'porch' : 'closed'),
  PLOT_GUIDE: { coverage: 0.75, front: 1.5 },
};
vm.createContext(ctx);
vm.runInContext(['boundsOf', 'elevationSides', 'plotReport', 'suggestPlot'].map(lift).join('\n') + ';globalThis.api = {plotReport, suggestPlot};', ctx);
const { plotReport, suggestPlot } = ctx.api;
const room = (type, cx, cz, len, w, rot = 0) => ({ type, cx, cz, len, w, rot });
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const plot = { w: 12, d: 18 };   // x -6..6, z -9..9 (north is -z)

test('setbacks are the space left to each plot line, named from the front', () => {
  // house 8 x 10, pushed north-east: x -2..6, z -7..3
  const r = plotReport(plot, [{ blocks: [room('hall', 2, -2, 8, 10)] }], 'S');
  near(r.setbacks.front, 6);   // south: 9 - 3
  near(r.setbacks.rear, 2);    // north: -7 - -9
  near(r.setbacks.right, 0);   // east (on the right of someone facing a south front): 6 - 6
  near(r.setbacks.left, 4);    // west: -2 - -6
  assert.equal(r.outside.length, 0);
});

test('the same house on an east-facing plot: front is the east gap', () => {
  const r = plotReport(plot, [{ blocks: [room('hall', 2, -2, 8, 10)] }], 'E');
  near(r.setbacks.front, 0); near(r.setbacks.rear, 4);
  near(r.setbacks.left, 6);    // south is on the left of someone facing an east front
  near(r.setbacks.right, 2);
});

test('a room over the plot line is reported, by floor and name', () => {
  const floors = [{ blocks: [room('hall', 0, 0, 8, 10)] }, { blocks: [room('bedroom', 4, 0, 6, 4)] }];   // upstairs x 1..7 > 6
  const r = plotReport(plot, floors, 'S');
  assert.deepEqual(JSON.parse(JSON.stringify(r.outside)), [{ floor: 1, name: 'Bedroom 1' }]);
  assert.ok(r.setbacks.right < 0);
  assert.equal(r.notes[0].level, 'bad');
});

test('a room exactly on the plot line is inside', () => {
  const r = plotReport(plot, [{ blocks: [room('hall', 0, 0, 12, 18)] }], 'S');
  assert.equal(r.outside.length, 0);
});

test('ground coverage counts roofed ground-floor area; FAR counts enclosed area on every floor', () => {
  const floors = [
    { blocks: [room('hall', 0, 0, 8, 10), room('parking', 0, 7, 5, 3), room('terrace', 0, -7, 4, 3)] },
    { blocks: [room('bedroom', 0, 0, 8, 5), room('balcony', 0, 4, 8, 1.5)] },
  ];
  const r = plotReport(plot, floors, 'S');
  near(r.plotArea, 216);
  near(r.coverage, (80 + 15) / 216);       // hall + car porch; the open terrace has no roof
  near(r.far, (80 + 40) / 216);            // hall + upstairs bedroom; no parking, terrace or balcony
});

test('guidance: a crowded plot or a thin front gets a note, a roomy one gets none', () => {
  const tight = plotReport({ w: 10, d: 10 }, [{ blocks: [room('hall', 0, 0, 9.5, 9.5)] }], 'S');
  assert.equal(tight.notes.length, 2);
  assert.ok(tight.notes.every((n) => n.level === 'warn'));
  const roomy = plotReport({ w: 20, d: 30 }, [{ blocks: [room('hall', 0, 0, 8, 10)] }], 'S');
  assert.equal(roomy.notes.length, 0);
});

test('no plot or no rooms: no report', () => {
  assert.equal(plotReport(null, [{ blocks: [room('hall', 0, 0, 4, 4)] }], 'S'), null);
  assert.equal(plotReport(plot, [{ blocks: [] }], 'S'), null);
});

test('a suggested plot holds the house with room to spare', () => {
  const p = suggestPlot({ w: 9.6, d: 9.9 });
  assert.ok(p.w >= 9.6 + 6 && p.d >= 9.9 + 6);
  assert.equal(p.w % 1, 0); assert.equal(p.d % 1, 0);
  assert.equal(p.facing, 'S');
});
