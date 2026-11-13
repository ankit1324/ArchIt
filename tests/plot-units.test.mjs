import test from 'node:test';
import assert from 'node:assert/strict';
import { FT_PER_M, plotSideMeters, sqFt, toMeters } from '../lib/plot-units.ts';

test('a foot is exactly 0.3048 m', () => {
  assert.equal(toMeters(1, 'ft'), 0.3048);
  assert.equal(toMeters(7.5, 'm'), 7.5);
  assert.ok(Math.abs(FT_PER_M - 3.280839895) < 1e-9);
});

test('a 30 x 40 ft plot is stored so it still reads 1,200 sq ft', () => {
  const w = plotSideMeters(30, 'ft'), d = plotSideMeters(40, 'ft');
  assert.equal(w, 9.144);
  assert.equal(d, 12.192);
  assert.equal(Math.round(sqFt(w * d)), 1200);   // centimetre rounding gave 1,199
});

test('common Indian plot sizes keep their square feet', () => {
  for (const [a, b] of [[20, 30], [25, 40], [30, 50], [40, 60], [50, 80], [60, 90]]) {
    const area = sqFt(plotSideMeters(a, 'ft') * plotSideMeters(b, 'ft'));
    assert.equal(Math.round(area), a * b, `${a} x ${b}`);
  }
});

test('metre plots are kept to the millimetre', () => {
  assert.equal(plotSideMeters(12.3456, 'm'), 12.346);
  assert.equal(plotSideMeters(9, 'm'), 9);
});
