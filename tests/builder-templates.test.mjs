import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { allTemplates, checkTemplate, loadFree } from '../scripts/check-plans.mjs';
import { builderSource } from '../scripts/builder-source.mjs';

const html = builderSource();
const catalogTs = readFileSync(new URL('../lib/template-catalog.ts', import.meta.url), 'utf8');
const catalog = JSON.parse(catalogTs.slice(catalogTs.indexOf('=', catalogTs.indexOf('export const TEMPLATE_CATALOG')) + 1, catalogTs.indexOf('\n];') + 2));

// Every free (inline) and paid (generated) plan goes through the same engine-level checks.
for (const template of allTemplates()) {
  test(`${template.key}: plan passes the geometry, door and furniture checks`, () => {
    assert.deepEqual(checkTemplate(template).errors, []);
  });
}

test('free templates in the builder match the served catalog metadata', () => {
  for (const t of loadFree()) {
    const entry = catalog.find(c => c.key === t.key);
    assert.ok(entry, `${t.key} missing from lib/template-catalog.ts`);
    assert.equal(entry.paid, false);
    assert.equal(t.name, entry.name, `${t.key} name`);
    assert.equal(t.desc, entry.desc, `${t.key} desc`);
  }
});

test('generated template modules are up to date and pass the generator gate', () => {
  const gen = fileURLToPath(new URL('../scripts/gen-templates.mjs', import.meta.url));
  assert.match(execFileSync(process.execPath, [gen, '--check'], { encoding: 'utf8' }), /OK/);
});

test('explicit empty furniture keeps passages empty; omitted furniture still auto-furnishes', () => {
  const reader = html.slice(html.indexOf('const clampRot ='), html.indexOf('// Auto-furnish a template room'));
  const context = { C: { rooms: { hallway: {} }, paint: {}, floorCol: {}, furniture: {} }, state: { blocks: [], seq: {} },
    newRoom: () => ({ doors: [], windows: [], furniture: [] }), furnishRoom: b => b.furniture.push({ key: 'auto' }), console };
  vm.createContext(context); vm.runInContext(reader, context);
  context.tRoomSpec('home', { type: 'hallway', furniture: [] });
  context.tRoomSpec('home', { type: 'hallway' });
  assert.equal(context.state.blocks[0].furniture.length, 0);
  assert.equal(context.state.blocks[1].furniture.length, 1);
});

// The checker is the gate, so prove it catches each class of mistake.
function fixture(change = () => {}) {
  const rooms = [
    { type: 'hall', name: 'Living', cx: 0, cz: 0, len: 4.8, w: 3.6, doors: [[0, 0.5, 'ext_hard', 1]], wins: [[3, 0.5]], furniture: [] },
    { type: 'bedroom', name: 'Bedroom', cx: 4.2, cz: -0.3, len: 3.6, w: 3, doors: [[3, 0.5]], wins: [[1, 0.5]], furniture: [['bed', 0, -0.36, 0]] },
  ];
  change(rooms);
  return checkTemplate({ key: 'fixture', name: 'fixture', profile: 'home', free: true, rooms });
}
test('checker accepts a sound plan and rejects broken ones', () => {
  assert.deepEqual(fixture().errors, []);
  const cases = [
    [r => r.push({ type: 'bath', cx: 0, cz: 0, len: 2, w: 2, doors: [[0, 0.5, 'int_pvc']], furniture: [] }), /overlaps/],
    [r => r[0].doors.push([2, 0.5]), /leads outdoors/],
    [r => { r[1].doors = []; }, /unreachable/],
    [r => r[0].furniture.push(['sofa', 0, 1.2, 2]), /blocks the doorway/],
    [r => { r[1].furniture[0][2] = -0.5; }, /clampFurn/],
    [r => r[0].wins.push([1, 0.5]), /faces #2 Bedroom/],
    [r => { delete r[1].furniture; }, /no explicit furniture/],
    // mirrors of the builder's designIssues(): each shows as an issue once the template loads
    [r => { r[1].doors = []; }, /no door of its own/],
    [r => r.push({ type: 'bath', cx: -3.6, cz: 0, len: 2.4, w: 3.6, furniture: [] }), /window on wall 3 opens into #3/],
  ];
  for (const [change, expected] of cases) assert.match(fixture(change).errors.join('\n'), expected);
  // open rooms count as outdoors: a window onto a veranda is not an issue
  assert.doesNotMatch(fixture(r => r.push({ type: 'veranda', cx: -3.6, cz: 0, len: 2.4, w: 3.6, furniture: [] })).errors.join('\n'), /window/);
  assert.match(fixture(r => r[1].furniture.push(['wardrobe', 0, 1.06, 0])).warns.join('\n'), /wardrobe has its back/);
});
