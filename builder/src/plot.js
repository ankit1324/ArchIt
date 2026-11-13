import {EMBED} from './dom.js';
import {C, roomShell} from './catalog.js';
import {footprint, state} from './state.js';
import {boundsOf, elevationSides} from './geometry.js';
import {setContext} from './scene.js';

/* ============================== plot ============================== */
// The plot is a w x d rectangle centred on the origin; -z is north, as on the
// 2D plan. In the designer it comes from the design's own details (archit:init);
// standalone, the user types it and it is saved with the project (state.plot).
let embedPlot = null;
function setEmbedPlot(plot, facing){
  embedPlot = plot && plot.w > 0 && plot.d > 0 ? {w:+plot.w, d:+plot.d, facing:cleanFacing(facing)} : null;
}
function cleanFacing(f){ return ['N','E','S','W'].includes(f) ? f : null; }
function currentPlot(){
  if(EMBED) return embedPlot;
  const p = state?.plot;
  return p && p.w > 0 && p.d > 0 ? {w:p.w, d:p.d, facing:cleanFacing(p.facing)} : null;
}
// The front of the house: the side the plot faces, else the bottom edge of the plan.
function frontSide(){ return currentPlot()?.facing || 'S'; }

// Standalone: keep the 3D plot outline in step with state.plot. renderAll calls
// this on every change; it only touches the scene when the plot really changed.
let drawnKey = '';
function syncPlot(){
  if(EMBED) return;
  const p = currentPlot(), key = p ? p.w+'|'+p.d+'|'+p.facing : '';
  if(key === drawnKey) return;
  drawnKey = key;
  setContext(p ? {w:p.w, d:p.d} : null, [], p ? p.facing : null);
}
// A first plot for a house that has none: the house plus 3 m all round, rounded
// up to a whole metre (the user then types the real figures).
function suggestPlot(bb){
  return {w:Math.ceil(bb.w + 6), d:Math.ceil(bb.d + 6), facing:'S'};
}

/* -------- what the plot says about the house (pure) -------- */
// Thresholds for a gentle "check your local rules" nudge. Bye-laws differ by city
// and plot size; these are the loosest figures commonly seen for small plots.
const PLOT_GUIDE = {coverage:0.75, front:1.5};
function plotReport(plot, floors, front){
  const all = floors.flatMap(f=>f.blocks);
  if(!plot || !all.length) return null;
  const hw = plot.w/2, hd = plot.d/2, eps = 0.011;
  const bb = boundsOf(all);
  // room for the house on each compass side (negative = over the plot line)
  const gap = {N:bb.z0 + hd, S:hd - bb.z1, W:bb.x0 + hw, E:hw - bb.x1};
  const sides = elevationSides(front);
  const setbacks = {front:gap[sides.front], rear:gap[sides.rear], left:gap[sides.left], right:gap[sides.right]};
  const outside = [];
  floors.forEach((fl, fi)=>fl.blocks.forEach((b, i)=>{
    const [w, d] = footprint(b);
    if(b.cx-w/2 < -hw-eps || b.cx+w/2 > hw+eps || b.cz-d/2 < -hd-eps || b.cz+d/2 > hd+eps)
      outside.push({floor:fi, name:(b.name || C.rooms[b.type].name) + ' ' + (i+1)});
  }));
  const area = b=>b.w*b.len, plotArea = plot.w*plot.d;
  // ground coverage: everything with a roof on the ground floor (not an open terrace)
  const covered = floors[0].blocks.filter(b=>roomShell(b.type) !== 'balcony').reduce((a,b)=>a+area(b), 0);
  // FAR / FSI: enclosed and roofed floor area on every floor; open terraces,
  // balconies and car parking are left out, as most bye-laws do
  const built = all.filter(b=>roomShell(b.type) !== 'balcony' && b.type !== 'parking').reduce((a,b)=>a+area(b), 0);
  const coverage = covered/plotArea, far = built/plotArea;
  const notes = [];
  if(outside.length) notes.push({level:'bad', text:'Part of the house is outside the plot.'});
  else {
    if(coverage > PLOT_GUIDE.coverage) notes.push({level:'warn', text:'The house covers '+Math.round(coverage*100)+'% of the plot. Many cities allow 60–75% on small plots.'});
    if(setbacks.front < PLOT_GUIDE.front) notes.push({level:'warn', text:'Little space at the front. Most bye-laws want a front setback of 1.5–3 m (5–10 ft).'});
  }
  return {plotArea, coverage, far, setbacks, outside, notes, sides};
}
// Issues for the Checks chip: only the hard one — a room over the plot line.
function plotIssues(){
  const plot = currentPlot();
  if(!plot || !state) return [];
  const r = plotReport(plot, state.floors, frontSide());
  if(!r) return [];
  const multi = state.floors.length > 1;
  return r.outside.map(o=>(multi ? 'Floor '+(o.floor+1)+': ' : '') + o.name + ': outside the plot');
}

export {PLOT_GUIDE, currentPlot, frontSide, plotIssues, plotReport, setEmbedPlot, suggestPlot, syncPlot};
