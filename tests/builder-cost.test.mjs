import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// cost.js only needs roomShell from the catalog: run it whole with a stand-in
const src = readFileSync(new URL('../builder/src/cost.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export \{([^}]*)\};?\s*$/m, (_, names) => `globalThis.api = {${names}};`);
const OPEN = { balcony: 'balcony', terrace: 'balcony', veranda: 'veranda', parking: 'porch' };
const ctx = { roomShell: (t) => OPEN[t] || 'closed' };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const { builtUpSqft, costEstimate, costTiers, fmtINR, fmtQty, materialRules } = ctx.api;
const SQFT = 10.7639104;
const room = (type, len, w) => ({ type, len, w });
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
// a 1,000 sq ft enclosed house
const house = [{ blocks: [room('hall', 1000 / SQFT, 1)] }];

test('built-up area: enclosed rooms in full, open rooms at half, every floor', () => {
  near(builtUpSqft(house), 1000);
  const floors = [
    { blocks: [room('hall', 5, 4), room('parking', 5, 3), room('veranda', 4, 2)] },   // 20 + 7.5 + 4
    { blocks: [room('bedroom', 4, 3), room('balcony', 4, 1), room('terrace', 4, 2)] }, // 12 + 2 + 4
  ];
  near(builtUpSqft(floors), 49.5 * SQFT);
});

test('estimate = built-up area x the finish rate, with a 10% band', () => {
  const e = costEstimate(house, { tier: 'standard' });
  near(e.total, 1000 * costTiers().standard.rate, 1e-3);
  near(e.low, e.total * 0.9, 1e-3); near(e.high, e.total * 1.1, 1e-3);
  assert.equal(e.customRate, false);
  assert.ok(costEstimate(house, { tier: 'basic' }).total < e.total);
  assert.ok(costEstimate(house, { tier: 'premium' }).total > e.total);
});

test('a typed rate wins; a silly one falls back to the finish rate', () => {
  near(costEstimate(house, { tier: 'basic', rate: 2500 }).total, 2500000, 1e-3);
  assert.equal(costEstimate(house, { tier: 'basic', rate: 2500 }).customRate, true);
  for (const rate of [0, -5, 100, 999999, 'abc', null]) {
    assert.equal(costEstimate(house, { tier: 'basic', rate }).rate, costTiers().basic.rate, String(rate));
  }
  assert.equal(costEstimate(house, { tier: 'gold' }).tier, 'standard');
  assert.equal(costEstimate(house, undefined).tier, 'standard');
});

test('materials follow the contractor thumb rules', () => {
  const m = Object.fromEntries(costEstimate(house, {}).materials.map((x) => [x.name, x.qty]));
  assert.equal(m.Cement, 400);          // 0.4 bags per sq ft
  assert.equal(m['Steel (TMT)'], 4000); // 4 kg per sq ft
  assert.equal(m.Bricks, 8000);
  for (const r of materialRules()) assert.ok(r.per > 0 && r.unit, r.name);
});

test('budget: money to spare, or how far over', () => {
  const ok = costEstimate(house, { tier: 'standard', budget: 3000000 });
  near(ok.diff, 3000000 - ok.total, 1e-3); assert.ok(ok.diff > 0);
  assert.ok(costEstimate(house, { tier: 'premium', budget: 2000000 }).diff < 0);
  assert.equal(costEstimate(house, {}).budget, null);
  assert.equal(costEstimate(house, { budget: 0 }).diff, null);
});

test('rupees read the Indian way: lakh and crore', () => {
  assert.equal(fmtINR(2480000), '₹24.8 lakh');
  assert.equal(fmtINR(2000000), '₹20 lakh');
  assert.equal(fmtINR(12500000), '₹1.25 crore');
  assert.equal(fmtINR(20000000), '₹2 crore');
  assert.equal(fmtINR(85000), '₹85,000');
  assert.equal(fmtINR(-350000), '-₹3.5 lakh');
});

test('steel reads in tonnes once it is over a tonne', () => {
  assert.equal(fmtQty(4000, 'kg'), '4 tonnes');
  assert.equal(fmtQty(4500, 'kg'), '4.5 tonnes');
  assert.equal(fmtQty(800, 'kg'), '800 kg');
  assert.equal(fmtQty(125000, 'nos'), '1,25,000 nos');
});

test('an empty house costs nothing', () => {
  const e = costEstimate([{ blocks: [] }], {});
  assert.equal(e.sqft, 0); assert.equal(e.total, 0);
});
