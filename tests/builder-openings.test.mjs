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
const H = 2.75;
const { winSpec, winDims, winKinds } = engine(['winKinds', 'winSpec', 'winDims'], { C: { H } });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const plain = (o) => JSON.parse(JSON.stringify(o));

test('windows saved before sizes existed cut the same hole as before', () => {
  assert.deepEqual(plain(winDims({})), { w: 1.3, y0: 1.02, y1: 2.08 });
  assert.deepEqual(plain(winDims({ kind: 'std' })), { w: 1.3, y0: 1.02, y1: 2.08 });
  const pano = winDims({ kind: 'pano' });
  near(pano.w, 2.3); near(pano.y0, 0.06); near(pano.y1, 0.14 + (H - 0.25));
});

test('a ventilator is small and sits high, under the ceiling', () => {
  const v = winSpec({ kind: 'vent' });
  assert.equal(v.kind, 'vent');
  assert.ok(v.fw <= 0.75 && v.fh <= 0.6);
  assert.ok(v.sill >= 1.8, 'a ventilator sits above head height');
  assert.ok(v.sill + v.fh <= H - 0.08);
});

test('a custom size overrides the kind, and an unknown kind is a standard window', () => {
  const s = winSpec({ kind: 'std', w: 1.8, h: 1.5, sill: 0.6 });
  near(s.fw, 1.8); near(s.fh, 1.5); near(s.sill, 0.6);
  assert.equal(winSpec({ kind: 'bay' }).kind, 'std');
  near(winSpec({ sill: 0 }).sill, 0);           // a sill at floor level is a real value, not "unset"
});

test('whatever is typed, the window stays inside the wall height', () => {
  for (const w of [{ h: 9 }, { sill: 9 }, { h: 2.6, sill: 2 }, { w: 99 }, { w: 0.01, h: 0.01 }, { w: 'x', h: null, sill: undefined }]) {
    const s = winSpec(w);
    assert.ok(s.fw >= 0.4 && s.fw <= 3, JSON.stringify(w));
    assert.ok(s.fh >= 0.3, JSON.stringify(w));
    assert.ok(s.sill >= 0 && s.sill + s.fh <= H - 0.08 + 1e-9, JSON.stringify(w) + ' -> ' + JSON.stringify(s));
  }
});

test('every window kind has a name and a size that fits', () => {
  for (const [key, k] of Object.entries(winKinds())) {
    assert.ok(k.name, key);
    const s = winSpec({ kind: key });
    near(s.fw, k.w); near(s.fh, k.h); near(s.sill, k.sill);   // defaults are not clamped
  }
});

test('an open doorway is an interior door type with no leaf', () => {
  assert.match(src, /int_open:\{name:'Open doorway \(no door\)', grp:'INTERIOR DOORS'\}/);
  // 2D draws no swing for it, 3D no panel
  assert.match(lift('door2D'), /d\.type==='int_open'/);
});
