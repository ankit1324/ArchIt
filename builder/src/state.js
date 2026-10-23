import './dom.js';
import {C} from './catalog.js';
import {renderAll} from './ui.js';
import {clampRot} from './templates.js';

let dirty = false;

/* ============================== state ============================== */
let state = null, sel = null, ui = {
  view:'3d', wallOpacity:1, tool:null,
  openSecs:new Set(['exterior']),
};
let undoStack = [], redoStack = [];

function freshState(){
  const s = {
    paint:'white', facade:'white', facadeMat:'paint', roofStyle:'flat', roofCol:'light',
    seq:{block:0, door:0, win:0, part:0, furn:0},
    blocks:[], floors:null, floor:0,
  };
  s.floors = [{blocks:s.blocks}];   // state.blocks always aliases the active floor's array
  return s;
}
function ensureExteriorState(){
  if(!C.paint[state.paint]) state.paint = 'white';
  if(!C.facade[state.facade]) state.facade = 'white';
  if(!C.facadeMat[state.facadeMat]) state.facadeMat = 'paint';
  if(!C.roofStyle[state.roofStyle]) state.roofStyle = 'flat';
  if(!C.roofCol[state.roofCol]) state.roofCol = 'light';
}
// Share links (#d=), project files, localStorage and saved designs are all
// untrusted, and the sidebar interpolates ids/names into innerHTML. Coerce every
// field to the type the renderer expects and drop catalog keys it doesn't know.
function sanitizeState(){
  const num = (v, d=0)=>{ v = Number(v); return isFinite(v) ? v : d; };
  const int = v=>Math.trunc(num(v));
  const key = (cat, v, d=null)=>(typeof v === 'string' && Object.hasOwn(cat, v)) ? v : d;
  const arr = v=>Array.isArray(v) ? v.filter(x=>x && typeof x === 'object') : [];
  const name = v=>v == null || v === '' ? undefined : String(v).slice(0, 40);
  const block = b=>({
    ...b, id:int(b.id), type:b.type, name:name(b.name),
    cx:num(b.cx), cz:num(b.cz), w:num(b.w, C.rooms[b.type].w), len:num(b.len, C.rooms[b.type].len), rot:clampRot(b.rot),
    paint:key(C.paint, b.paint), floorCol:key(C.floorCol, b.floorCol),
    floorMat:key(C.floorMat, b.floorMat), wallMat:key(C.wallMat, b.wallMat),
    doors:arr(b.doors).map(d=>({...d, id:int(d.id), wall:clampRot(d.wall), t:num(d.t, .5),
      type:key(C.doors, d.type, 'int_hard'), w:num(d.w, .8), h:num(d.h, 2), color:String(d.color ?? 'blue')})),
    windows:arr(b.windows).map(w=>({...w, id:int(w.id), wall:clampRot(w.wall), t:num(w.t, .5),
      kind:w.kind === 'pano' ? 'pano' : 'std'})),
    partitions:arr(b.partitions).map(p=>({...p, id:int(p.id), t:num(p.t, .5)})),
    furniture:arr(b.furniture).filter(f=>key(C.furniture, f.key)).map(f=>({...f, id:int(f.id),
      lx:num(f.lx), lz:num(f.lz), rot:clampRot(f.rot)})),
  });
  const floors = arr(state.floors).length ? arr(state.floors) : [{blocks:state.blocks}];
  state.floors = floors.slice(0, 3).map(fl=>({...fl, blocks:arr(fl.blocks).filter(b=>key(C.rooms, b.type)).map(block)}));
  state.floor = Math.max(0, int(state.floor));
  const seq = state.seq && typeof state.seq === 'object' ? state.seq : {};
  state.seq = {block:int(seq.block), door:int(seq.door), win:int(seq.win), part:int(seq.part), furn:int(seq.furn)};
}
// after JSON round-trips (undo/restore/load) the alias breaks — re-link it
function linkFloor(){
  sanitizeState();
  if(!state.floors){ state.floors = [{blocks:state.blocks}]; state.floor = 0; }
  state.floor = Math.min(state.floor||0, state.floors.length-1);
  state.blocks = state.floors[state.floor].blocks;
}
function newRoom(type, cx=0, cz=0, rot=0){
  const spec = C.rooms[type];
  return {id:++state.seq.block, type, cx, cz, rot, w:spec.w, len:spec.len,
    paint:null, floorCol:null, floorMat:null, wallMat:null, doors:[], windows:[], partitions:[], furniture:[]};
}
function firstRoom(){
  const b = newRoom('hall', 0, 0, 0);
  b.windows.push({id:++state.seq.win, wall:0, t:0.42});
  b.doors.push({id:++state.seq.door, wall:1, t:0.5, type:'ext_hard', w:0.8, h:2.0, color:'blue'});
  return b;
}

function footprint(b){ return b.rot%2 ? [b.w, b.len] : [b.len, b.w]; }
function wallLen(b,wall){ return wall%2 ? b.w : b.len; }
function localToWorld(b, x, z){
  const a = b.rot * Math.PI/2;
  return [ b.cx + x*Math.cos(a) + z*Math.sin(a),
           b.cz - x*Math.sin(a) + z*Math.cos(a) ];
}
// local center point of an opening on a wall
function wallPoint(b, wall, t){
  const L = wallLen(b,wall), o = (t-0.5)*L;
  if(wall===0) return [o,  b.w/2];
  if(wall===2) return [-o, -b.w/2];
  if(wall===1) return [b.len/2, -o];
  return [-b.len/2, o];
}
// direction along the wall (local)
function wallDir(wall){ return wall===0?[1,0] : wall===2?[-1,0] : wall===1?[0,-1] : [0,1]; }

/* ============================== undo ============================== */
function snapshot(){ return JSON.stringify({state, sel}); }
function commit(fn){
  nudgeEnd(false);                      // an in-flight arrow-key burst lands first
  undoStack.push(snapshot()); if(undoStack.length>60) undoStack.shift();
  redoStack.length = 0;
  dirty = true;
  fn();
  renderAll();
}
function restore(s){ const o = JSON.parse(s); state = o.state; sel = o.sel; linkFloor(); renderAll(); }
function undo(){ nudgeEnd(false); if(!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); }
function redo(){ nudgeEnd(false); if(!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); }
// Arrow-key nudges are coalesced: one undo snapshot per burst (first keydown),
// the 3D groups are moved live, and the real rebuild happens on keyup / 300 ms idle.
let nudge = null;
function nudgeBegin(){
  if(!nudge) nudge = {snap:snapshot(), timer:null};
  clearTimeout(nudge.timer); nudge.timer = setTimeout(nudgeEnd, 300);
}
function nudgeEnd(render=true){
  if(!nudge) return;
  clearTimeout(nudge.timer);
  undoStack.push(nudge.snap); if(undoStack.length>60) undoStack.shift();
  redoStack.length = 0; dirty = true; nudge = null;
  if(render) renderAll();
}
function getBlock(id){ return state.blocks.find(b=>b.id===id); }
function selBlock(){ return sel && getBlock(sel.blockId); }
function selDoor(){ const b = selBlock(); return b && sel.kind==='door' ? b.doors.find(d=>d.id===sel.doorId) : null; }
function selFurn(){ const b = selBlock(); return b && sel.kind==='furn' ? b.furniture.find(f=>f.id===sel.furnId) : null; }
function selWin(){ const b = selBlock(); return b && sel.kind==='window' ? b.windows.find(w=>w.id===sel.winId) : null; }

export function setDirty(v){ return dirty = v; }
export function setState(v){ return state = v; }
export function setSel(v){ return sel = v; }
export function setUndoStack(v){ return undoStack = v; }
export function setRedoStack(v){ return redoStack = v; }

export {commit, dirty, ensureExteriorState, firstRoom, footprint, freshState, getBlock, linkFloor, localToWorld, newRoom, nudge, nudgeBegin, nudgeEnd, redo, redoStack, sel, selBlock, selDoor, selFurn, selWin, snapshot, state, ui, undo, undoStack, wallDir, wallLen, wallPoint};
