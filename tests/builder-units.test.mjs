import test from 'node:test';
import assert from 'node:assert/strict';
import { loadUnits } from './builder-units-lib.mjs';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('metric output is unchanged from before units existed', () => {
  const u = loadUnits('m');
  assert.equal(u.fmtLen(3.6), '3.6 m');
  assert.equal(u.fmtArea(17.28), '17.28 m²');
  assert.equal(u.fmtSize(3.6, 3), '3.6 × 3 m');
  assert.equal(u.fmtOpening(0.8, 2), '80 × 200 cm');
});

test('feet read as feet and inches, rounded to the inch', () => {
  const u = loadUnits('ft');
  assert.equal(u.fmtLen(3.6576), '12′0″');          // exactly 12 ft
  assert.equal(u.fmtLen(3.6), '11′10″');             // 141.7 in
  assert.equal(u.fmtSize(9.144, 12.192), '30′0″ × 40′0″');
  assert.equal(u.fmtOpening(0.9144, 2.1336), '3′0″ × 7′0″');
});

test('area in feet is whole square feet, Indian digit grouping', () => {
  const u = loadUnits('ft');
  assert.equal(u.fmtArea(9.144 * 12.192), '1,200 sq ft');  // a 30x40 plot
  assert.equal(u.fmtArea(111.484), '1,200 sq ft');
});

test('feet inputs accept the ways people type a length', () => {
  const u = loadUnits('ft');
  const ft12_6 = 12.5 / u.FT_PER_M;
  for (const s of ["12'6\"", "12' 6", '12ft 6in', '12-6', '12.5', "12′6″", ' 12 6 ']) near(u.parseLen(s), ft12_6);
  near(u.parseLen('12'), 12 / u.FT_PER_M);
  near(u.parseLen("12'"), 12 / u.FT_PER_M);
  for (const bad of ['', 'abc', "12'13\"", '-3', "0'0\""]) assert.equal(u.parseLen(bad), null, bad);
});

test('metre inputs take a plain number', () => {
  const u = loadUnits('m');
  near(u.parseLen('3.6'), 3.6);
  near(u.parseLen('3.6 m'), 3.6);
  assert.equal(u.parseLen('3m6'), null);
  assert.equal(u.parseLen('0'), null);
});

test('what the input shows parses back to the same length', () => {
  const u = loadUnits('ft');
  for (const m of [1.2, 3, 3.6, 3.6576, 4.8, 7.99]) {
    const back = u.parseLen(u.lenInputValue(m));
    assert.ok(Math.abs(back - m) <= 0.5 / u.IN_PER_M + 1e-9, `${m} -> ${u.lenInputValue(m)} -> ${back}`);
  }
  assert.equal(u.lenInputValue(3.6576), "12'");
  assert.equal(u.lenInputValue(3.81), "12' 6\"");
});

test('resize snaps to 0.1 m, or to 6 inches in feet', () => {
  const m = loadUnits('m');
  near(m.snapLen(3.64), 3.6);
  const f = loadUnits('ft');
  near(f.snapLen(3.70) * f.FT_PER_M, 12);         // 12.14 ft -> 12 ft
  near(f.snapLen(3.78) * f.FT_PER_M, 12.5);       // 12.40 ft -> 12.5 ft
});

test('door and window sizes: centimetres or whole inches, round-trip', () => {
  const m = loadUnits('m'), f = loadUnits('ft');
  assert.equal(m.openingUnit(), 'cm'); assert.equal(f.openingUnit(), 'in');
  assert.equal(m.toOpening(0.8), 80); assert.equal(f.toOpening(0.9144), 36);
  near(f.fromOpening(36), 0.9144); near(m.fromOpening(80), 0.8);
});

test('unit follows the design: a missing or unknown unit is metres', () => {
  const u = loadUnits(undefined);
  assert.equal(u.isFt(), false);
  u.setUnit('ft'); assert.equal(u.isFt(), true);
  u.setUnit('yards'); assert.equal(u.isFt(), false);
});
