import {C} from './catalog.js';
import {localToWorld} from './state.js';
import {boundsOf} from './geometry.js';

/* ============================== Vastu guide ============================== */
// Traditional Vastu Shastra placement by compass zone. It is guidance many Indian
// families plan by, not a building rule, so it never raises a Checks issue.
// North is up the plan (-z), the same north the plot's facing is read from.
const ZONE_NAME = {N:'north', NE:'north-east', E:'east', SE:'south-east', S:'south', SW:'south-west', W:'west', NW:'north-west', C:'centre'};

// For each kind of room: the zones that suit it and the ones to avoid. Any other
// zone is acceptable. `master` is the main bedroom, `entrance` the main door
// (rated by the direction it faces, not a zone).
function vastuRules(){
  return {
    kitchen: {label:'Kitchen',      good:['SE'],                avoid:['NE','SW','N','C']},
    master:  {label:'Main bedroom', good:['SW'],                avoid:['NE','SE','C']},
    bedroom: {label:'Bedroom',      good:['S','SW','W','NW'],   avoid:['NE','SE','C']},
    puja:    {label:'Puja room',    good:['NE'],                avoid:['S','SW','SE']},
    bath:    {label:'Bathroom',     good:['NW','W'],            avoid:['NE','SW','C']},
    toilet:  {label:'Toilet',       good:['NW','W'],            avoid:['NE','SW','C']},
    hall:    {label:'Living room',  good:['N','NE','E','NW'],   avoid:[]},
    dining:  {label:'Dining',       good:['W','E'],             avoid:[]},
    study:   {label:'Study',        good:['N','NE','E','W'],    avoid:[]},
    store:   {label:'Store',        good:['SW','S','W','NW'],   avoid:['NE']},
    stairs:  {label:'Stairs',       good:['S','SW','W'],        avoid:['NE','C']},
    utility: {label:'Utility',      good:['NW','SE'],           avoid:['NE']},
    parking: {label:'Car parking',  good:['NW','SE','N','E'],   avoid:[]},
    balcony: {label:'Balcony',      good:['N','NE','E'],        avoid:[]},
    veranda: {label:'Veranda',      good:['N','NE','E'],        avoid:[]},
    terrace: {label:'Open terrace', good:['N','NE','E'],        avoid:[]},
    entrance:{label:'Main entrance',good:['N','E'],             avoid:['S']},
  };
}
// Which ninth of the house a point is in: thirds across and thirds down.
function vastuZone(x, z, bb){
  const col = x < bb.x0 + bb.w/3 ? 'W' : x > bb.x1 - bb.w/3 ? 'E' : '';
  const row = z < bb.z0 + bb.d/3 ? 'N' : z > bb.z1 - bb.d/3 ? 'S' : '';
  return row + col || 'C';
}
// The compass direction a wall of room b faces.
function wallFacing(b, wall){
  const [nx, nz] = wall===0 ? [0,1] : wall===1 ? [1,0] : wall===2 ? [0,-1] : [-1,0];
  const [x, z] = localToWorld(b, nx, nz), dx = x-b.cx, dz = z-b.cz;
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'E' : 'W') : (dz > 0 ? 'S' : 'N');
}
function vastuVerdict(rule, where){
  return rule.good.includes(where) ? 'good' : rule.avoid.includes(where) ? 'avoid' : 'ok';
}
// One row per rated room (every floor) plus the main entrance, and a 0-100 match.
function vastuReport(floors){
  const all = floors.flatMap(f=>f.blocks);
  if(!all.length) return null;
  const rules = vastuRules(), bb = boundsOf(all), list = z=>{ const n = z.map(k=>ZONE_NAME[k]); return n.length > 1 ? n.slice(0,-1).join(', ')+' or '+n[n.length-1] : n[0]; };
  // the main bedroom: named so, else the largest bedroom in the house
  const beds = all.filter(b=>b.type==='bedroom');
  const master = beds.find(b=>/master|main/i.test(b.name||'')) || beds.slice().sort((a,b)=>b.w*b.len - a.w*a.len)[0];
  const items = [];
  const rate = (rule, where, name, floor, whereText)=>{
    const verdict = vastuVerdict(rule, where);
    items.push({name, floor, where, whereText, verdict,
      tip: verdict==='good' ? '' : (verdict==='avoid' ? 'Avoid the '+whereText+'. ' : '') + 'Best in the '+list(rule.good)+'.'});
  };
  floors.forEach((fl, fi)=>fl.blocks.forEach((b, i)=>{
    const rule = rules[b === master ? 'master' : b.type];
    if(!rule) return;
    const zone = vastuZone(b.cx, b.cz, bb);
    rate(rule, zone, b.name || (b === master ? rule.label : C.rooms[b.type].name + ' ' + (i+1)), fi, ZONE_NAME[zone]);
  }));
  // main entrance: the first outside door on the ground floor, living spaces first
  const order = ['hall','dining','hallway','study','bedroom','kitchen'];
  const withDoor = floors[0].blocks.filter(b=>b.doors.some(d=>String(d.type).startsWith('ext_')))
    .sort((a,b)=>(order.indexOf(a.type)+1 || 99) - (order.indexOf(b.type)+1 || 99))[0];
  if(withDoor){
    const d = withDoor.doors.find(x=>String(x.type).startsWith('ext_')), dir = wallFacing(withDoor, Number(d.wall));
    const rule = rules.entrance, verdict = vastuVerdict(rule, dir);
    items.unshift({name:rule.label, floor:0, where:dir, whereText:'faces '+ZONE_NAME[dir], verdict,
      tip: verdict==='good' ? '' : (verdict==='avoid' ? 'A south-facing entrance is the least preferred. ' : '') + 'Best facing north or east.'});
  }
  const pts = items.reduce((a,x)=>a + (x.verdict==='good' ? 1 : x.verdict==='ok' ? .5 : 0), 0);
  return {items, score: items.length ? Math.round(100*pts/items.length) : 0,
    good: items.filter(x=>x.verdict==='good').length, avoid: items.filter(x=>x.verdict==='avoid').length};
}

export {ZONE_NAME, vastuReport, vastuRules, vastuZone, wallFacing};
