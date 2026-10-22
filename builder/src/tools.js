import * as THREE from 'three';
import './sidebar.js';
import {C} from './catalog.js';
import {$, chips, toast} from './dom.js';
import {commit, footprint, getBlock, newRoom, sel, selBlock, selFurn, setSel, state, ui} from './state.js';
import {clampFurn, freeT, overlaps, sharedWall} from './geometry.js';
import {blocksRoot, canvas} from './scene.js';
import {FURN_MATS} from './materials.js';
import {FURN_BUILDERS, legacyBuildFurn} from './furniture.js';
import {rayFrom} from './interact3d.js';
import {showTemplatePicker} from './templates.js';

/* ============================== chips actions ============================== */
chips.addEventListener('click', e=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const b = selBlock(); if(!b) return;
  const a = btn.dataset.a;
  if(sel.kind==='furn'){
    const f = selFurn(); if(!f) return;
    if(a==='rot') commit(()=>{ f.rot = (f.rot+1)%4; clampFurn(b, f); });
    if(a==='del') commit(()=>{ b.furniture = b.furniture.filter(x=>x.id!==f.id); setSel({kind:'block', blockId:b.id}); });
    if(a==='dup') commit(()=>{
      const nf = Object.assign({}, f, {id:++state.seq.furn, lx:f.lx+.3, lz:f.lz+.3});
      clampFurn(b, nf); b.furniture.push(nf); setSel({kind:'furn', blockId:b.id, furnId:nf.id});
    });
    return;
  }
  if(a==='dup'){
    const [w,d] = footprint(b);
    const spots = [[0,1],[1,0],[0,-1],[-1,0]];
    const spot = spots.find(([sx,sz])=>!overlaps(b.cx+sx*(w+0.02), b.cz+sz*(d+0.02), w, d));
    if(!spot){ toast('No free side to duplicate to'); return; }
    commit(()=>{
      const nb = JSON.parse(JSON.stringify(b));
      nb.id = ++state.seq.block;
      nb.cx = b.cx+spot[0]*(w+0.02); nb.cz = b.cz+spot[1]*(d+0.02);
      nb.doors.forEach(dd=>dd.id = ++state.seq.door);
      nb.windows.forEach(ww=>ww.id = ++state.seq.win);
      nb.partitions.forEach(pp=>pp.id = ++state.seq.part);
      nb.furniture.forEach(ff=>ff.id = ++state.seq.furn);
      state.blocks.push(nb);
      setSel({kind:'block', blockId:nb.id});
    });
  }
  if(a==='rot'){
    commit(()=>{ b.rot = (b.rot+1)%4; });
  }
  if(a==='del'){
    if(state.blocks.length===1){ toast('The house needs at least one room'); return; }
    commit(()=>{
      state.blocks = state.blocks.filter(x=>x.id!==b.id);
      setSel(null);
    });
  }
});

/* ============================== tool popups ============================== */
const toolpop = $('#toolpop');
const ICONS = {
  door:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="3.5" width="12" height="17" rx="1.2"/><circle cx="14.6" cy="12" r="1" fill="currentColor"/></svg>',
  gen:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12h6"/></svg>',
};
/* ===== furniture catalog: live thumbnails + category browser ===== */
const FURN_CATS = [['all','All'],['living','Living'],['bedroom','Bedroom'],['kitchen','Kitchen'],['bath','Bath'],['office','Office']];
let furnCat = 'all', furnQuery = '';
let _thumbR, _thumbScene, _thumbCam;
const _thumbCache = {};
// Render a small 3D preview of a furniture model once, cache as a data URL.
function furnThumb(key){
  if(_thumbCache[key]) return _thumbCache[key];
  if(!_thumbR){
    _thumbR = new THREE.WebGLRenderer({antialias:true, alpha:true});
    _thumbR.setSize(120,120); _thumbR.setPixelRatio(2);
    _thumbScene = new THREE.Scene();
    _thumbScene.add(new THREE.HemisphereLight('#ffffff','#c8ccd2',1.25));
    const dl = new THREE.DirectionalLight('#ffffff',1.35); dl.position.set(3,6,4); _thumbScene.add(dl);
    _thumbCam = new THREE.PerspectiveCamera(38,1,.05,100);
  }
  const M = FURN_MATS();
  const g = FURN_BUILDERS[key] ? FURN_BUILDERS[key](M) : legacyBuildFurn({key,lx:0,lz:0,rot:0,id:0});
  _thumbScene.add(g);
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const rad = Math.max(size.x,size.y,size.z)*0.72 + 0.3;
  _thumbCam.position.set(c.x + rad*1.05, c.y + rad*0.95, c.z + rad*1.35);
  _thumbCam.lookAt(c.x, c.y*0.92, c.z);
  _thumbR.render(_thumbScene, _thumbCam);
  const url = _thumbR.domElement.toDataURL('image/webp', 0.82);
  _thumbScene.remove(g);
  g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); });   // materials are the shared table
  return (_thumbCache[key] = url);
}
// The thumbnail renderer is a second WebGL context; keep it only while a grid
// is being built, then hand the context back (furnThumb recreates it on demand).
function releaseThumbRenderer(){
  if(!_thumbR) return;
  _thumbR.dispose(); _thumbR.forceContextLoss();
  _thumbR = null;
}
function furnGridHTML(){
  const q = furnQuery.trim().toLowerCase();
  const items = Object.entries(C.furniture).filter(([k,v]) =>
    (furnCat === 'all' || v.cat === furnCat) && (!q || v.name.toLowerCase().includes(q)));
  if(!items.length) return `<div class="note" style="grid-column:1/-1">No matching furniture</div>`;
  const html = items.map(([k,v]) =>
    `<button class="fitem" draggable="true" data-add-furn="${k}" data-furnkey="${k}" title="${v.name} · ${v.w} × ${v.d} m">
      <img class="fthumb" src="${furnThumb(k)}" alt="" draggable="false">
      <span class="fnm">${v.name}</span></button>`).join('');
  releaseThumbRenderer();
  return html;
}
function furnCatalogHTML(X){
  const tabs = FURN_CATS.map(([k,n]) => `<button class="fcat${k===furnCat?' on':''}" data-fcat="${k}">${n}</button>`).join('');
  return `<h3>Furniture ${X}</h3>
    <input class="fsearch" placeholder="Search furniture…" value="${furnQuery}">
    <div class="fcats">${tabs}</div>
    <div class="fgrid">${furnGridHTML()}</div>`;
}
function refreshFurnGrid(){ const grid = toolpop.querySelector('.fgrid'); if(grid) grid.innerHTML = furnGridHTML(); }

function openToolPop(tool){
  ui.tool = null;
  document.querySelectorAll('#toolbar button').forEach(b=>b.classList.toggle('on', b.dataset.t===tool));
  let html = '';
  const X = `<button class="x" data-close><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
  if(tool==='blocks'){
    html = `<h3>Rooms ${X}</h3>` + Object.entries(C.rooms).map(([k,v])=>`
      <button class="itemrow" data-add-room="${k}">
        <span class="ic">${ICONS.gen}</span>
        <span><span class="nm">${v.name}</span>
        <span style="display:block;font-size:11.5px;color:#8b96ab">${v.w} × ${v.len} m</span></span>
      </button>`).join('');
  } else if(tool==='doors'){
    const groups = {};
    Object.entries(C.doors).forEach(([k,v])=>{ (groups[v.grp] = groups[v.grp]||[]).push([k,v]); });
    html = `<h3>Doors ${X}</h3>` + Object.entries(groups).map(([g,items])=>
      `<div class="grp">${g}</div>` + items.map(([k,v])=>`
        <button class="itemrow" data-add-door="${k}">
          <span class="ic">${ICONS.door}</span>
          <span><span class="nm">${v.name}</span></span>
        </button>`).join('')).join('');
  } else if(tool==='partitions'){
    html = `<h3>Partitions ${X}</h3>
      <button class="itemrow" data-add-part><span class="ic">${ICONS.gen}</span>
      <span><span class="nm">Interior partition</span></span></button>`;
  } else if(tool==='furniture'){
    html = furnCatalogHTML(X);
  }
  toolpop.innerHTML = html;
  toolpop.classList.toggle('furni', tool==='furniture');
  toolpop.classList.add('show');
}
function closeToolPop(){
  toolpop.classList.remove('show');
  document.querySelectorAll('#toolbar button').forEach(b=>b.classList.remove('on'));
}
document.getElementById('toolbar').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  // Templates opens the picker, not a tool popup. Starting a template replaces
  // the current layout, so confirm first when there is work to lose.
  if(b.dataset.action === 'templates'){
    closeToolPop();
    const placed = (state.floors || [{blocks: state.blocks}]).flatMap(f=>f.blocks).length;
    showTemplatePicker(placed > 0);
    return;
  }
  if(b.classList.contains('on')) closeToolPop();
  else openToolPop(b.dataset.t);
});
// Live filter as you type in the catalog search.
toolpop.addEventListener('input', e=>{
  if(e.target.classList.contains('fsearch')){ furnQuery = e.target.value; refreshFurnGrid(); }
});
// Drag a catalog item onto the 3D view to place it in the room under the cursor.
toolpop.addEventListener('dragstart', e=>{
  const item = e.target.closest('[data-furnkey]');
  if(!item) return;
  e.dataTransfer.setData('text/furnkey', item.dataset.furnkey);
  e.dataTransfer.effectAllowed = 'copy';
});
canvas.addEventListener('dragover', e=>{
  if([...e.dataTransfer.types].includes('text/furnkey')){ e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
});
canvas.addEventListener('drop', e=>{
  const key = e.dataTransfer.getData('text/furnkey');
  if(!key || !C.furniture[key]) return;
  e.preventDefault();
  closeToolPop();
  if(ui.view === '2d'){ toast('Switch to 3D to drop furniture'); return; }
  const hits = rayFrom(e).intersectObjects(blocksRoot.children, true);
  const hit = hits.find(h => h.object.userData.pick && h.object.userData.pick.blockId != null);
  const b = hit ? getBlock(hit.object.userData.pick.blockId)
                : (state.blocks.length === 1 ? state.blocks[0] : selBlock());
  if(!b){ toast('Drop onto a room'); return; }
  const f = {id:++state.seq.furn, key, lx:0, lz:0, rot:0};
  if(hit){  // world hit point -> the room's local coordinates
    const a = b.rot*Math.PI/2, dx = hit.point.x - b.cx, dz = hit.point.z - b.cz;
    f.lx = dx*Math.cos(a) - dz*Math.sin(a);
    f.lz = dx*Math.sin(a) + dz*Math.cos(a);
  }
  if(!clampFurn(b, f)){ toast('The room is too small for that'); return; }
  commit(()=>{ b.furniture.push(f); setSel({kind:'furn', blockId:b.id, furnId:f.id}); });
});
toolpop.addEventListener('click', e=>{
  if(e.target.closest('[data-close]')){ closeToolPop(); return; }
  const fcat = e.target.closest('[data-fcat]');
  if(fcat){
    furnCat = fcat.dataset.fcat;
    toolpop.querySelectorAll('.fcat').forEach(c=>c.classList.toggle('on', c.dataset.fcat===furnCat));
    refreshFurnGrid();
    return;
  }
  const addRoom = e.target.closest('[data-add-room]');
  if(addRoom){
    const type = addRoom.dataset.addRoom;
    const ref = selBlock() || state.blocks[state.blocks.length-1];
    const [rw, rd] = footprint(ref);
    const spec = C.rooms[type];
    const [nw, nd] = ref.rot%2 ? [spec.w, spec.len] : [spec.len, spec.w];
    const spot = [[0,1],[1,0],[0,-1],[-1,0]].find(([sx,sz])=>
      !overlaps(ref.cx+sx*((rw+nw)/2+.02), ref.cz+sz*((rd+nd)/2+.02), nw, nd));
    if(!spot){ toast('No free side to add a room'); return; }
    commit(()=>{
      const nb = newRoom(type, ref.cx+spot[0]*((rw+nw)/2+.02), ref.cz+spot[1]*((rd+nd)/2+.02), ref.rot);
      state.blocks.push(nb); setSel({kind:'block', blockId:nb.id});
    });
    closeToolPop(); return;
  }
  const addDoor = e.target.closest('[data-add-door]');
  if(addDoor){
    const type = addDoor.dataset.addDoor;
    if(ui.view==='2d'){
      ui.pendingDoorType = type; ui.tool = 'door-place';
      closeToolPop();
      toast('Click a wall on the plan to place the door');
      return;
    }
    const b = selBlock() || state.blocks[0];
    commit(()=>{
      const wall = 0;
      const t = freeT([...b.doors.filter(d=>d.wall===wall), ...b.windows.filter(w=>w.wall===wall)], b.len, 1.2);
      const finalType = sharedWall(b, wall) ? (type.startsWith('ext') ? 'int_hard' : type) : type;
      const d = {id:++state.seq.door, wall, t, type:finalType, w: finalType==='ext_glass' ? 1.6 : 0.8, h:2.0, color:'blue'};
      b.doors.push(d); setSel({kind:'door', blockId:b.id, doorId:d.id});
    });
    closeToolPop();
    toast('Use the right panel to choose door type and size');
    return;
  }
  const addFurn = e.target.closest('[data-add-furn]');
  if(addFurn){
    const b = selBlock() || (state.blocks.length===1 ? state.blocks[0] : null);
    if(!b){ toast('Select a room first'); return; }
    const f = {id:++state.seq.furn, key:addFurn.dataset.addFurn, lx:0, lz:0, rot:0};
    if(!clampFurn(b, f)){ toast('The room is too small for that'); return; }
    // nudge off other furniture at the exact centre
    while(b.furniture.some(o=>Math.abs(o.lx-f.lx)<.2 && Math.abs(o.lz-f.lz)<.2) && clampFurn(b, f) && f.lx < b.len/2){ f.lx += .4; }
    clampFurn(b, f);
    commit(()=>{ b.furniture.push(f); setSel({kind:'furn', blockId:b.id, furnId:f.id}); });
    return;
  }
  const addPart = e.target.closest('[data-add-part]');
  if(addPart){
    const b = selBlock() || state.blocks[0];
    commit(()=>{
      const t = freeT(b.partitions, b.len, 1.0);
      b.partitions.push({id:++state.seq.part, t});
      setSel({kind:'block', blockId:b.id});
    });
    closeToolPop(); return;
  }
});

export {closeToolPop, openToolPop, releaseThumbRenderer};
