import {state} from './state.js';

/* ============================== units ============================== */
// Geometry is always stored in metres. Only what the user reads and types
// changes: Indian buyers plan in feet and square feet ("30x40 plot, 1200 sq ft"),
// so `state.unit` ('m' | 'ft') travels with the design.
const FT_PER_M = 3.280839895;
const IN_PER_M = FT_PER_M*12;
const SQFT_PER_M2 = FT_PER_M*FT_PER_M;

function isFt(){ return state?.unit === 'ft'; }
const r2 = v=>Math.round(v*100)/100;

// 3.6 -> "3.6 m" or "11′10″" (nearest inch)
function fmtLen(m, ft = isFt()){
  if(!ft) return r2(m) + ' m';
  const inches = Math.round(m*IN_PER_M);
  return Math.floor(inches/12) + '′' + (inches%12) + '″';
}
function fmtArea(m2, ft = isFt()){
  return ft ? Math.round(m2*SQFT_PER_M2).toLocaleString('en-IN') + ' sq ft' : r2(m2) + ' m²';
}
// width x depth: "3.6 × 3 m" or "11′10″ × 9′10″"
function fmtSize(a, b, ft = isFt()){
  return ft ? fmtLen(a, true) + ' × ' + fmtLen(b, true) : r2(a) + ' × ' + r2(b) + ' m';
}
// Drag-resize snap: 0.1 m, or 6 inches so feet plans read 12′0″, 11′6″
function lenStep(ft = isFt()){ return ft ? 6/IN_PER_M : 0.1; }
function snapLen(m, ft = isFt()){ const s = lenStep(ft); return Math.round(m/s)*s; }

// Room size inputs: metres as a plain number, feet as 11'10" (what users type back)
function lenInputValue(m, ft = isFt()){
  if(!ft) return String(r2(m));
  const inches = Math.round(m*IN_PER_M), i = inches%12;
  return Math.floor(inches/12) + "'" + (i ? ' ' + i + '"' : '');
}
// Accepts 12, 12.5, 12', 12'6", 12' 6, 12ft 6in, 12-6. Returns metres or null.
function parseLen(text, ft = isFt()){
  const s = String(text).trim().toLowerCase().replace(/[′’]/g, "'").replace(/[″”]/g, '"');
  if(!s) return null;
  if(!ft){ const v = Number(s.replace(/\s*m$/, '')); return isFinite(v) && v > 0 ? v : null; }
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)?\s*(?:[-\s]\s*)?(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/);
  if(!m) return null;
  const feet = Number(m[1]), inch = m[2] ? Number(m[2]) : 0;
  if(inch >= 12) return null;
  const v = (feet + inch/12)/FT_PER_M;
  return v > 0 ? v : null;
}

// Door and window sizes: centimetres, or whole inches
function openingUnit(ft = isFt()){ return ft ? 'in' : 'cm'; }
function toOpening(m, ft = isFt()){ return Math.round(ft ? m*IN_PER_M : m*100); }
function fromOpening(v, ft = isFt()){ return ft ? v/IN_PER_M : v/100; }
function fmtOpening(w, h, ft = isFt()){
  return ft ? fmtLen(w, true) + ' × ' + fmtLen(h, true) : Math.round(w*100) + ' × ' + Math.round(h*100) + ' cm';
}

export {FT_PER_M, IN_PER_M, SQFT_PER_M2, fmtArea, fmtLen, fmtOpening, fmtSize, fromOpening, isFt, lenInputValue, lenStep, openingUnit, parseLen, snapLen, toOpening};
