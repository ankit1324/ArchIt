import { builderSource } from '../scripts/builder-source.mjs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const src = builderSource();

/** Lift one engine function out of the builder source verbatim. */
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

const room = (w, len) => ({ w, len });

test('house totals count every floor, not just the active one', () => {
  const { houseTotals } = engine(['houseTotals']);
  const floors = [
    { blocks: [room(3.6, 4.8), room(3, 3.6)] }, // 17.28 + 10.8
    { blocks: [room(3.6, 4.8)] }, // 17.28
  ];
  const totals = houseTotals(floors);
  assert.equal(totals.rooms, 3);
  assert.ok(Math.abs(totals.area - 45.36) < 1e-9);
});

test('house totals of an empty house are zero', () => {
  const { houseTotals } = engine(['houseTotals']);
  assert.deepEqual({ ...houseTotals([{ blocks: [] }]) }, { area: 0, rooms: 0 });
});

test('the ground drops to the lowest floor so floors under the active one stay visible', () => {
  const FLH = () => 2.87;
  const { groundY } = engine(['groundY'], { FLH });
  // rebuild3D puts floor fi at (fi - active) * FLH; the ground must sit at floor 0
  for (const active of [0, 1, 2]) {
    const lowestFloorY = (0 - active) * FLH();
    assert.equal(groundY(active), lowestFloorY);
  }
  assert.equal(groundY(0), 0);
});

/** On-screen box of the pill chip2D draws, parsed from its SVG. */
function pillBox(svg) {
  const rect = svg.match(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/);
  assert.ok(rect, 'chip2D drew no rect');
  const [x, y, w, h] = rect.slice(1).map(Number);
  const cx = x + w / 2, cy = y + h / 2;
  const vertical = /rotate\(-90/.test(svg);
  const [bw, bh] = vertical ? [h, w] : [w, h];
  return { x0: cx - bw / 2, x1: cx + bw / 2, y0: cy - bh / 2, y1: cy + bh / 2 };
}
const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

test('dimension pills of a selected room never sit under its resize handles', () => {
  const { chip2D, dimPillCentres } = engine(['chip2D', 'dimPillCentres']);
  // rooms from roomy to cramped, in screen px
  for (const [x0, y0, W2, D2] of [[185, 342, 197, 164], [100, 100, 66, 165], [40, 60, 99, 77]]) {
    const [top, left] = dimPillCentres(x0, y0, W2, D2);
    const pills = [
      pillBox(chip2D(top[0], top[1], '3.6 m', '#ad4a31')),
      pillBox(chip2D(left[0], left[1], '3 m', '#ad4a31', true)),
    ];
    // the 8 handles blkSVG draws: an 8px square (+1px stroke) on each corner and edge midpoint
    const handles = [];
    for (const hx of [x0, x0 + W2 / 2, x0 + W2]) for (const hy of [y0, y0 + D2 / 2, y0 + D2]) {
      if (hx === x0 + W2 / 2 && hy === y0 + D2 / 2) continue;
      handles.push({ x0: hx - 5, x1: hx + 5, y0: hy - 5, y1: hy + 5 });
    }
    for (const pill of pills) for (const handle of handles) {
      assert.ok(!overlaps(pill, handle), `pill ${JSON.stringify(pill)} covers handle ${JSON.stringify(handle)}`);
    }
  }
});

test('a dimension pill is centred on the point it is given', () => {
  const { chip2D } = engine(['chip2D']);
  for (const vertical of [false, true]) {
    const box = pillBox(chip2D(200, 120, '4.8 m', '#ad4a31', vertical));
    assert.ok(Math.abs((box.x0 + box.x1) / 2 - 200) < 1e-9);
    assert.ok(Math.abs((box.y0 + box.y1) / 2 - 120) < 1e-9);
  }
});

test('dimension pills let pointer events through to the room underneath', () => {
  const { chip2D } = engine(['chip2D']);
  assert.match(chip2D(0, 0, '3 m', '#ad4a31'), /pointer-events="none"/);
});
