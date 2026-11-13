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
const localToWorld = (b, x, z) => {
  const a = (b.rot * Math.PI) / 2;
  return [b.cx + x * Math.cos(a) + z * Math.sin(a), b.cz - x * Math.sin(a) + z * Math.cos(a)];
};
const ZONE_NAME = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west', C: 'centre' };
const ctx = {
  footprint, localToWorld, ZONE_NAME,
  C: { rooms: new Proxy({}, { get: (_, k) => ({ name: String(k)[0].toUpperCase() + String(k).slice(1) }) }) },
};
vm.createContext(ctx);
vm.runInContext(['boundsOf', 'vastuRules', 'vastuZone', 'wallFacing', 'vastuVerdict', 'vastuReport'].map(lift).join('\n')
  + ';globalThis.api = {vastuRules, vastuZone, wallFacing, vastuReport};', ctx);
const { vastuRules, vastuZone, wallFacing, vastuReport } = ctx.api;
const room = (type, cx, cz, extra = {}) => ({ type, cx, cz, len: 3, w: 3, rot: 0, doors: [], ...extra });
const bb = { x0: 0, x1: 9, z0: 0, z1: 9, w: 9, d: 9 };

test('zones are thirds of the house, with north up the plan (-z)', () => {
  assert.equal(vastuZone(1, 1, bb), 'NW');
  assert.equal(vastuZone(8, 1, bb), 'NE');
  assert.equal(vastuZone(8, 8, bb), 'SE');
  assert.equal(vastuZone(1, 8, bb), 'SW');
  assert.equal(vastuZone(4.5, 1, bb), 'N');
  assert.equal(vastuZone(8, 4.5, bb), 'E');
  assert.equal(vastuZone(4.5, 4.5, bb), 'C');
});

test('a wall faces the compass direction it is drawn on, also when the room is turned', () => {
  const r = room('hall', 0, 0);
  assert.equal(wallFacing(r, 0), 'S');   // wall 0 is the +z edge
  assert.equal(wallFacing(r, 1), 'E');
  assert.equal(wallFacing(r, 2), 'N');
  assert.equal(wallFacing(r, 3), 'W');
  const seen = new Set([0, 1, 2, 3].map((w) => wallFacing({ ...r, rot: 1 }, w)));
  assert.equal(seen.size, 4);            // a quarter turn moves every wall to a new side
  assert.notEqual(wallFacing({ ...r, rot: 1 }, 0), 'S');
});

test('the classic placements score as good', () => {
  // 9 x 9 house: kitchen SE, puja NE, main bedroom SW, bathroom NW, living N, entrance facing east
  const floors = [{ blocks: [
    room('kitchen', 7.5, 7.5), room('puja', 7.5, 1.5), room('bedroom', 1.5, 7.5, { name: 'Master bedroom' }),
    room('bath', 1.5, 1.5), room('hall', 4.5, 1.5, { doors: [{ type: 'ext_hard', wall: 2 }] }),
  ] }];
  const r = vastuReport(floors);
  const by = Object.fromEntries(r.items.map((x) => [x.name, x.verdict]));
  assert.equal(by['Kitchen 1'], 'good');
  assert.equal(by['Puja 2'], 'good');
  assert.equal(by['Master bedroom'], 'good');
  assert.equal(by['Bath 4'], 'good');
  assert.equal(by['Main entrance'], 'good');   // door on wall 2 faces north
  assert.equal(r.score, 100);
  assert.equal(r.avoid, 0);
});

test('a kitchen in the north-east and a toilet in the centre are flagged, with where to move them', () => {
  const floors = [{ blocks: [room('kitchen', 7.5, 1.5), room('toilet', 4.5, 4.5), room('hall', 1.5, 7.5)] }];
  const r = vastuReport(floors);
  const k = r.items.find((x) => x.name === 'Kitchen 1'), t = r.items.find((x) => x.name === 'Toilet 2');
  assert.equal(k.verdict, 'avoid'); assert.match(k.tip, /south-east/);
  assert.equal(t.verdict, 'avoid'); assert.match(t.tip, /north-west or west/);
  assert.ok(r.score < 50);
});

test('the main bedroom is the one named so, else the largest', () => {
  const floors = [{ blocks: [
    room('bedroom', 1.5, 7.5), room('bedroom', 7.5, 1.5, { len: 5, w: 4 }), room('hall', 7.5, 7.5),
  ] }];
  const r = vastuReport(floors);
  // the big bedroom in the NE is rated as the main bedroom, which should be SW
  const main = r.items.find((x) => x.name === 'Main bedroom');
  assert.equal(main.where, 'NE'); assert.equal(main.verdict, 'avoid');
});

test('a south-facing entrance is the least preferred; west is acceptable', () => {
  const house = (wall) => [{ blocks: [room('hall', 0, 0, { doors: [{ type: 'ext_hard', wall }] })] }];
  assert.equal(vastuReport(house(0)).items[0].verdict, 'avoid');   // faces south
  assert.equal(vastuReport(house(3)).items[0].verdict, 'ok');      // faces west
  assert.equal(vastuReport(house(1)).items[0].verdict, 'good');    // faces east
});

test('upper floors are rated too, against the whole house', () => {
  const floors = [{ blocks: [room('hall', 1.5, 1.5), room('kitchen', 7.5, 7.5)] }, { blocks: [room('puja', 7.5, 1.5)] }];
  const p = vastuReport(floors).items.find((x) => x.floor === 1);
  assert.equal(p.where, 'NE'); assert.equal(p.verdict, 'good');
});

test('every rule names real zones, and no zone is both good and avoided', () => {
  for (const [key, r] of Object.entries(vastuRules())) {
    for (const z of [...r.good, ...r.avoid]) assert.ok(ZONE_NAME[z], `${key}: unknown zone ${z}`);
    assert.equal(r.good.filter((z) => r.avoid.includes(z)).length, 0, key);
    assert.ok(r.good.length, key);
  }
});

test('an empty house has no report', () => {
  assert.equal(vastuReport([{ blocks: [] }]), null);
});
