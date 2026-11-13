import {roomShell} from './catalog.js';

/* ============================== cost estimate ============================== */
// A first budget figure the way Indian builders quote: built-up area x a rate per
// square foot, plus material quantities from the usual thumb rules. It is a
// starting point for talking to contractors, never a quotation.
const SQFT = 10.7639104;   // sq ft per m²

// Typical 2026 all-in civil + finishing rates, Rs per sq ft of built-up area.
// Published guides put standard construction at roughly Rs 1,800-2,500.
function costTiers(){
  return {
    basic:   {name:'Basic',    rate:1700, note:'Simple finishes: ceramic tiles, basic fittings, standard paint'},
    standard:{name:'Standard', rate:2200, note:'Vitrified tiles, branded fittings, putty and good paint'},
    premium: {name:'Premium',  rate:3000, note:'Marble or wood floors, premium fittings, false ceilings'},
  };
}
// Quantity per sq ft of built-up area: the contractor's thumb rules.
function materialRules(){
  return [
    {name:'Cement',      per:0.4,  unit:'bags'},
    {name:'Steel (TMT)', per:4,    unit:'kg'},
    {name:'Sand',        per:1.8,  unit:'cu ft'},
    {name:'Aggregate',   per:1.35, unit:'cu ft'},
    {name:'Bricks',      per:8,    unit:'nos'},
    {name:'Floor tiles', per:1.3,  unit:'sq ft'},
    {name:'Paint',       per:0.18, unit:'litres'},
  ];
}
// Built-up area in sq ft over every floor. Rooms open on their sides or to the
// sky (balcony, veranda, car porch, terrace) count at half, as builders bill them.
function builtUpSqft(floors){
  let m2 = 0;
  floors.forEach(f=>f.blocks.forEach(b=>{ m2 += b.w*b.len * (roomShell(b.type)==='closed' ? 1 : .5); }));
  return m2*SQFT;
}
function costEstimate(floors, cost){
  const tiers = costTiers(), tier = tiers[cost?.tier] ? cost.tier : 'standard';
  const custom = Number(cost?.rate), rate = custom >= 500 && custom <= 20000 ? custom : tiers[tier].rate;
  const sqft = builtUpSqft(floors), total = sqft*rate;
  const budget = Number(cost?.budget) > 0 ? Number(cost.budget) : null;
  return {
    tier, rate, customRate: rate !== tiers[tier].rate, sqft, total,
    low: total*.9, high: total*1.1,                       // rates move about 10% either way
    materials: materialRules().map(m=>({name:m.name, unit:m.unit, qty:Math.round(sqft*m.per)})),
    budget, diff: budget == null ? null : budget - total, // positive: money left
  };
}
// Rs 24,80,000 -> "Rs 24.8 lakh"; crore above 1,00,00,000; plain below a lakh
function fmtINR(n){
  const v = Math.round(Math.abs(n)), s = n < 0 ? '-' : '';
  if(v >= 1e7) return s + '\u20b9' + (v/1e7).toFixed(2).replace(/\.?0+$/, '') + ' crore';
  if(v >= 1e5) return s + '\u20b9' + (v/1e5).toFixed(1).replace(/\.0$/, '') + ' lakh';
  return s + '\u20b9' + v.toLocaleString('en-IN');
}
function fmtQty(q, unit){
  return unit === 'kg' && q >= 1000 ? (q/1000).toFixed(1).replace(/\.0$/, '') + ' tonnes' : q.toLocaleString('en-IN') + ' ' + unit;
}

export {builtUpSqft, costEstimate, costTiers, fmtINR, fmtQty, materialRules};
