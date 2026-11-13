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

const C = { rooms: {
  hall: { name: 'Hall' }, bed: { name: 'Bedroom' }, stairs: { name: 'Stairs' },
  balcony: { name: 'Balcony', open: true },
} };
let id = 0;
const room = (type, cx, cz, doors = []) => ({ id: ++id, type, cx, cz, w: 3, len: 3, rot: 0, doors, windows: [], partitions: [], furniture: [] });
const door = (type, wall = 1) => ({ wall, t: 0.5, type });

function run(floors) {
  const state = { floors, floor: 0, blocks: floors[0].blocks };
  const api = engine(['designIssues', 'windowFacesNeighbour', 'sharedWall', 'footprint', 'wallLen', 'localToWorld', 'wallPoint'], { C, state });
  const issues = api.designIssues();
  assert.equal(state.blocks, floors[0].blocks, 'state.blocks restored');
  return issues;
}

test('single-floor output is unprefixed and unchanged', () => {
  assert.deepEqual([...run([{ blocks: [room('bed', 0, 0)] }])], ['Bedroom 1: no door']);
});

test('problems on a non-active floor are reported with a floor prefix', () => {
  const g = room('hall', 0, 0, [door('int_hard')]);
  const up = room('bed', 0, 0); // no door
  const issues = [...run([{ blocks: [g] }, { blocks: [up] }])];
  assert.ok(issues.includes('Floor 2: Bedroom 1: no door'), issues.join('|'));
  assert.ok(!issues.some((s) => s.startsWith('Floor 1: Hall')));
});

test('lower floor without stairs is flagged, with stairs is not', () => {
  const mk = (stairs) => [
    { blocks: [room('hall', 0, 0, [door('int_hard')]), ...(stairs ? [room('stairs', 3, 0, [door('int_hard')])] : [])] },
    { blocks: [room('stairs', 3, 0, [door('int_hard')])] },
  ];
  assert.ok([...run(mk(false))].includes('Floor 1: no stairs to floor 2'));
  assert.ok(![...run(mk(true))].some((s) => /no stairs/.test(s)));
});

test('upper-floor exterior door opening to air is flagged; ground-floor and balcony-backed are not', () => {
  const ground = { blocks: [room('hall', 0, 0, [door('ext_hard')]), room('stairs', 0, -3, [door('int_hard')])] };
  const upAir = { blocks: [room('hall', 0, 0, [door('ext_hard')]), room('stairs', 0, -3, [door('int_hard')])] };
  const issues = [...run([ground, upAir])];
  assert.ok(issues.includes('Floor 2: Hall 1: door opens to a drop'), issues.join('|'));
  assert.ok(!issues.some((s) => s.startsWith('Floor 1 - ')));
  // balcony beyond wall 1 (east, +x) at x=3 is shared -> fine
  const upBalc = { blocks: [room('hall', 0, 0, [door('ext_hard')]), room('balcony', 3, 0)] };
  assert.ok(![...run([ground, upBalc])].some((s) => /drop/.test(s)));
});
