import { builderSource } from '../scripts/builder-source.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadUnits } from './builder-units-lib.mjs';

const src = builderSource();
const html = readFileSync(new URL('../public/builder/builder.html', import.meta.url), 'utf8');

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

const r = (w, len) => ({ w, len });
const round1 = (n) => Math.round(n * 10) / 10;

test('single-floor summary keeps the plain Rooms / Floors / Area rows', () => {
  const houseTotals = engine(['houseTotals']).houseTotals;
  const { summaryRows } = engine(['summaryRows'], { houseTotals, fmtArea: loadUnits('m').fmtArea });
  const rows = Array.from(summaryRows([{ blocks: [r(3, 4), r(2, 2)] }], 0), (x) => Array.from(x));
  assert.deepEqual(rows.map((x) => x[0]), ['Rooms', 'Floors', 'Area']);
  assert.deepEqual(rows.map((x) => x[1]), ['2', '1', '16 m²']);
});

test('multi-floor summary shows whole-house totals plus a labelled current floor', () => {
  const houseTotals = engine(['houseTotals']).houseTotals;
  const { summaryRows } = engine(['summaryRows'], { houseTotals, fmtArea: loadUnits('m').fmtArea });
  const floors = [{ blocks: [r(3, 4), r(2, 2)] }, { blocks: [r(5, 2)] }];
  const rows = Array.from(summaryRows(floors, 1), (x) => Array.from(x));
  const get = (k) => rows.find((x) => x[0] === k)?.[1];
  assert.equal(get('Rooms'), '3');
  assert.equal(get('Area'), '26 m²');
  assert.equal(get('Floors'), '2');
  assert.equal(get('Floor 2'), '1 room · 10 m²');
});

test('summary area follows the design units', () => {
  const houseTotals = engine(['houseTotals']).houseTotals;
  const { summaryRows } = engine(['summaryRows'], { houseTotals, fmtArea: loadUnits('ft').fmtArea });
  const rows = Array.from(summaryRows([{ blocks: [r(9.144, 12.192)] }], 0), (x) => Array.from(x));
  assert.equal(rows.find((x) => x[0] === 'Area')[1], '1,200 sq ft');
});

test('walk chrome hides the stats bar and restores it', () => {
  const el = { style: { display: '' } };
  const { setWalkChrome } = engine(['setWalkChrome'], { $: () => el });
  setWalkChrome(true);
  assert.equal(el.style.display, 'none');
  setWalkChrome(false);
  assert.equal(el.style.display, '');
});

test('mode buttons start with aria-pressed and every on-toggle syncs it', () => {
  for (const id of ['btn3d', 'btn2d', 'btnIn', 'btnWalk']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*aria-pressed="(true|false)"`), id);
  }
  assert.match(src, /setPressed\(\$\('#btnWalk'\), true\)/);
  assert.match(src, /setPressed\(\$\('#btnWalk'\), false\)/);
});

test('icon-only buttons all have an aria-label', () => {
  const tags = html.match(/<button\b[^>]*>/g) || [];
  const need = tags.filter((t) => /data-t=|data-action=|data-a=|id="(undoB|redoB|zoomIn|zoomOut|fsB|shotB|helpB)"/.test(t));
  assert.ok(need.length >= 15);
  for (const t of need) assert.match(t, /aria-label="[^"]+"/, t);
});

test('mobile media query gives header controls a 40px touch target', () => {
  const mq = html.slice(html.indexOf('@media (max-width:760px)'));
  assert.match(mq, /\.viewtoggle button\{[^}]*height:40px/);
  assert.match(mq, /\.ghostbtn\{[^}]*height:40px/);
  assert.match(mq, /\.iconbtn\{[^}]*width:40px;height:40px/);
});
