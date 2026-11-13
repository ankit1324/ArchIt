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
function engine(names, globals = {}) {
  const ctx = { ...globals };
  vm.createContext(ctx);
  vm.runInContext(names.map(lift).join('\n') + `;globalThis.api = {${names.join(',')}};`, ctx);
  return ctx.api;
}
const H = 2.75, FLH = () => H + 0.12;
const { elevationFrame, elevationSides } = engine(['groundY', 'elevationFrame', 'elevationSides'], { C: { H }, FLH });
const bb = { cx: 2, cz: -1, w: 9.6, d: 6, x0: -2.8, x1: 6.8, z0: -4, z1: 2 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('each side is viewed from outside that side, level, aimed at the house', () => {
  const dir = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
  for (const side of ['N', 'E', 'S', 'W']) {
    const f = elevationFrame(bb, side, 1, 0, 16 / 9);
    const dx = f.pos[0] - bb.cx, dz = f.pos[2] - bb.cz;
    assert.ok(dx * dir[side][0] + dz * dir[side][1] > Math.max(bb.w, bb.d) / 2, `${side}: camera is not outside the house`);
    near(dx * dir[side][1], 0); near(dz * dir[side][0], 0);     // straight on, not at an angle
    near(f.pos[1], f.target[1]);                                 // level, so verticals stay vertical
    near(f.target[0], bb.cx); near(f.target[2], bb.cz);
    assert.ok(Math.hypot(dx, dz) < 30, 'camera stays inside the fog-free range');
  }
});

test('front and rear see the plan width, the sides see its depth', () => {
  near(elevationFrame(bb, 'S', 1, 0, 16 / 9).span, 9.6);
  near(elevationFrame(bb, 'N', 1, 0, 16 / 9).span, 9.6);
  near(elevationFrame(bb, 'E', 1, 0, 16 / 9).span, 6);
  near(elevationFrame(bb, 'W', 1, 0, 16 / 9).span, 6);
});

test('the picture holds the whole house and keeps its shape', () => {
  for (const [floors, active, aspect] of [[1, 0, 16 / 9], [3, 0, 16 / 9], [3, 2, 16 / 9], [2, 1, 1]]) {
    const f = elevationFrame(bb, 'S', floors, active, aspect);
    near(f.halfW / f.halfH, aspect);                             // no stretching
    assert.ok(f.halfW >= f.span / 2 + 2, 'room for the height dimension beside the house');
    const top = f.target[1] + f.halfH, bottom = f.target[1] - f.halfH;
    assert.ok(top >= f.wallTop + 1.3, 'roof headroom');
    assert.ok(bottom <= f.y0 - 1, 'room for the width dimension under the ground line');
  }
});

test('ground and wall top follow the floors, wherever the active floor is', () => {
  const one = elevationFrame(bb, 'S', 1, 0, 16 / 9);
  near(one.y0, 0); near(one.wallTop, H);
  // 3 floors: total wall height is the same whichever floor is being edited
  for (const active of [0, 1, 2]) {
    const f = elevationFrame(bb, 'S', 3, active, 16 / 9);
    near(f.wallTop - f.y0, 2 * FLH() + H);
    near(f.y0, -active * FLH());
  }
});

test('left and right are named for someone standing outside, facing the front', () => {
  const plain = (o) => JSON.parse(JSON.stringify(o));
  // facing a south front you look north: east is on your right, west on your left
  assert.deepEqual(plain(elevationSides('S')), { front: 'S', left: 'W', rear: 'N', right: 'E' });
  assert.deepEqual(plain(elevationSides('N')), { front: 'N', left: 'E', rear: 'S', right: 'W' });
  assert.deepEqual(plain(elevationSides('E')), { front: 'E', left: 'S', rear: 'W', right: 'N' });
  assert.equal(elevationSides('nonsense').front, 'N');           // falls back, never undefined
});
