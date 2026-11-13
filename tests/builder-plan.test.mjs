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
const localToWorld = (b, x, z) => {
  const a = (b.rot * Math.PI) / 2;
  return [b.cx + x * Math.cos(a) + z * Math.sin(a), b.cz - x * Math.sin(a) + z * Math.cos(a)];
};

test('plan label is width-as-drawn x depth-as-drawn', () => {
  const { roomSizeLabel } = engine(['roomSizeLabel'], { fmtSize: loadUnits('m').fmtSize, footprint });
  assert.equal(roomSizeLabel({ w: 3, len: 3.6, rot: 0 }), '3.6 × 3 m');
  assert.equal(roomSizeLabel({ w: 3, len: 3.6, rot: 1 }), '3 × 3.6 m');
  assert.equal(roomSizeLabel({ w: 3, len: 3.6, rot: 2 }), '3.6 × 3 m');
});

test('new room prefers a free side with no window or door', () => {
  const { pickRoomSide } = engine(['wallOnSide', 'pickRoomSide'], { localToWorld });
  const ref = { cx: 0, cz: 0, rot: 0, doors: [], windows: [{ wall: 0 }] };
  const free = () => false;
  // wall 0 faces +z, which is [0,1] and the first candidate: it has a window, so skip it
  assert.deepEqual([...pickRoomSide(ref, free)], [1, 0]);
});

test('new room falls back to the first free side when every free side has an opening', () => {
  const { pickRoomSide } = engine(['wallOnSide', 'pickRoomSide'], { localToWorld });
  const ref = { cx: 0, cz: 0, rot: 0, doors: [{ wall: 1 }], windows: [{ wall: 0 }] };
  const blocked = (sx, sz) => !(sx === 0 && sz === 1) && !(sx === 1 && sz === 0);
  assert.deepEqual([...pickRoomSide(ref, blocked)], [0, 1]);
  assert.equal(pickRoomSide(ref, () => true), undefined);
});

test('side to wall mapping follows the room rotation', () => {
  const { wallOnSide } = engine(['wallOnSide'], { localToWorld });
  assert.equal(wallOnSide({ cx: 0, cz: 0, rot: 0 }, 0, 1), 0);
  assert.equal(wallOnSide({ cx: 0, cz: 0, rot: 0 }, 1, 0), 1);
  assert.equal(wallOnSide({ cx: 5, cz: 5, rot: 1 }, 0, 1), 3);
});

test('plan label reads in feet when the design is in feet', () => {
  const { roomSizeLabel } = engine(['roomSizeLabel'], { fmtSize: loadUnits('ft').fmtSize, footprint });
  assert.equal(roomSizeLabel({ w: 3.048, len: 3.6576, rot: 0 }), '12′0″ × 10′0″');
});
