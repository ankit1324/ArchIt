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

test('report lists rooms of every floor, grouped and labelled', () => {
  const { reportFloors } = engine(['reportFloors']);
  const a = { name: 'A' }, b = { name: 'B' }, c = { name: 'C' };
  const out = reportFloors([{ blocks: [a, b] }, { blocks: [c] }]);
  assert.equal(out.length, 2);
  assert.equal(out[0].label, 'Ground floor');
  assert.equal(out[1].label, 'Floor 2');
  assert.equal(out[1].fi, 1);
  assert.equal(out[0].blocks.length + out[1].blocks.length, 3);
});

test('design sheet totals come from houseTotals over all floors and escape names', () => {
  const sheet = lift('designSheet');
  assert.match(sheet, /houseTotals\(state\.floors\)/);
  assert.doesNotMatch(sheet, /state\.blocks/);
  assert.match(sheet, /escapeMarkup\(b\.name \|\| spec\.name\)/);
});
