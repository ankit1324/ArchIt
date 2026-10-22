import * as THREE from 'three';
import {blockGroups, doorPlacement, updateSelection} from './house3d.js';
import {C} from './catalog.js';
import {chips, ov, stage, toast} from './dom.js';
import {commit, footprint, getBlock, localToWorld, newRoom, redoStack, sel, selBlock, selDoor, selFurn, setSel, snapshot, state, ui, undoStack} from './state.js';
import {clampFurn, nearestWallT, overlaps, sharedWall, snapBlock, worldToLocal} from './geometry.js';
import {blocksRoot, camera, canvas, controls, renderer, requestRender, requestShadows, selOutline} from './scene.js';
import {render2D} from './plan2d.js';
import {renderAll, renderSelection} from './ui.js';

/* -------- hotspots + chips overlay -------- */
let hotspots = [];
function computeHotspots(){
  hotspots = [];
  if(!state.blocks.length){ return; }
  state.blocks.forEach(b=>{
    const [w,d] = footprint(b);
    [ {sx: 1, sz: 0}, {sx:-1, sz: 0}, {sx: 0, sz: 1}, {sx: 0, sz:-1} ].forEach(s=>{
      const cx = b.cx + s.sx*(w+0.02);
      const cz = b.cz + s.sz*(d+0.02);
      if(!overlaps(cx, cz, w, d)){
        hotspots.push({
          bx:b.cx + s.sx*(w/2+0.35), by:C.H*0.55, bz:b.cz + s.sz*(d/2+0.35),
          blockId:b.id, sx:s.sx, sz:s.sz,
        });
      }
    });
  });
}
function addRoomAt(refId, sx, sz, type='bedroom'){
  const ref = getBlock(refId);
  const [rw, rd] = footprint(ref);
  const spec = C.rooms[type];
  const [nw, nd] = ref.rot%2 ? [spec.w, spec.len] : [spec.len, spec.w];
  const cx = ref.cx + sx*((rw+nw)/2 + 0.02), cz = ref.cz + sz*((rd+nd)/2 + 0.02);
  if(overlaps(cx, cz, nw, nd)) { toast('No room on this side'); return; }
  commit(()=>{
    const nb = newRoom(type, cx, cz, ref.rot);
    state.blocks.push(nb);
    setSel({kind:'block', blockId:nb.id});
  });
}

function renderHotspots(){
  ov.querySelectorAll('.hs').forEach(e=>e.remove());
  computeHotspots();
  hotspots.forEach(h=>{
    const el = document.createElement('button');
    el.className = 'hs';
    el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12h14"/></svg>';
    el.addEventListener('click', e=>{ e.stopPropagation(); addRoomAt(h.blockId, h.sx, h.sz); });
    el._h = h;
    ov.appendChild(el);
  });
  _ovlDirty = true;
}
let mouse3 = {x:-1e4, y:-1e4};
canvas.addEventListener('pointermove', e=>{
  const r = canvas.getBoundingClientRect();
  mouse3.x = e.clientX - r.left; mouse3.y = e.clientY - r.top;
});
canvas.addEventListener('pointerleave', ()=>{ mouse3.x = -1e4; mouse3.y = -1e4; });
// Overlay (hotspot "+" buttons, selection chips) is re-projected only when the
// camera, the cursor or the overlay contents changed — not every frame.
const _projV = new THREE.Vector3();
const _ovlCam = new Float64Array(16);
let _ovlDirty = true, _ovlMx = NaN, _ovlMy = NaN;
function updateOverlay3D(){
  if(ui.view!=='3d') return;
  const el = camera.matrixWorld.elements;
  let changed = _ovlDirty || mouse3.x !== _ovlMx || mouse3.y !== _ovlMy;
  if(!changed) for(let i=0;i<16;i++) if(el[i] !== _ovlCam[i]){ changed = true; break; }
  if(!changed) return;
  for(let i=0;i<16;i++) _ovlCam[i] = el[i];
  _ovlMx = mouse3.x; _ovlMy = mouse3.y; _ovlDirty = false;
  const r = canvas.getBoundingClientRect();           // once per update, not per hotspot
  const project = (x,y,z)=>{
    _projV.set(x,y,z).project(camera);
    return {x:(_projV.x*0.5+0.5)*r.width, y:(-_projV.y*0.5+0.5)*r.height, ok:_projV.z<1};
  };
  // compute everything first, then write styles in one batch
  const hs = ov.querySelectorAll('.hs'), out = [];
  hs.forEach(el=>{
    const p = project(el._h.bx, el._h.by, el._h.bz);
    // only reveal "+" when the cursor is near — keeps the 3D view clean
    const dx = p.x-mouse3.x, dy = p.y-mouse3.y;
    out.push({p, near: dx*dx+dy*dy < 130*130});
  });
  const b = selBlock();
  let cp = null;
  if(b){
    let px = b.cx, py = C.H+0.45, pz = b.cz;
    const f = sel.kind==='furn' ? selFurn() : null;
    if(f){ const [wx,wz] = localToWorld(b, f.lx, f.lz); px = wx; pz = wz; py = C.furniture[f.key].h + .5; }
    cp = project(px, py, pz);
  }
  hs.forEach((el, i)=>{
    const {p, near} = out[i];
    el.style.display = p.ok ? '' : 'none';
    el.style.left = p.x+'px'; el.style.top = p.y+'px';
    el.style.opacity = near ? '1' : '0';
    el.style.pointerEvents = near ? '' : 'none';
  });
  if(cp){
    chips.style.display = cp.ok ? 'flex' : 'none';
    chips.style.left = cp.x+'px'; chips.style.top = (cp.y-20)+'px';
  } else chips.style.display = 'none';
}

/* -------- picking + 3D dragging -------- */
const ray = new THREE.Raycaster();
const dragPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
let downPos = null, drag3 = null;
const _rayNdc = new THREE.Vector2(), _dragPt = new THREE.Vector3();   // scratch, no per-event allocs
function rayFrom(e){
  const r = canvas.getBoundingClientRect();
  _rayNdc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(_rayNdc, camera);
  return ray;
}
canvas.addEventListener('pointerdown', e=>{
  downPos = [e.clientX, e.clientY];
  drag3 = null;
  if(!state || !sel) return;
  const hits = rayFrom(e).intersectObjects(blocksRoot.children, true);
  const hit = hits.find(h=>h.object.userData.pick);
  if(!hit) return;
  const p = hit.object.userData.pick;
  if(sel.kind==='block' && p.blockId===sel.blockId){
    const b = selBlock();
    const pt = rayFrom(e).ray.intersectPlane(dragPlane, _dragPt);
    if(pt) drag3 = {kind:'block', b, offX:pt.x-b.cx, offZ:pt.z-b.cz, sx:b.cx, sz:b.cz, snap:snapshot(), moved:false};
  } else if(sel.kind==='door' && p.kind==='door' && p.doorId===sel.doorId){
    const d = selDoor();
    let dg = null;
    blockGroups[sel.blockId].children.forEach(ch=>{ if(ch.userData.doorRoot===d.id) dg = ch; });
    drag3 = {kind:'door', b:selBlock(), d, dg, w0:d.wall, t0:d.t, snap:snapshot(), moved:false};
  } else if(sel.kind==='furn' && p.kind==='furn' && p.furnId===sel.furnId){
    const f = selFurn();
    let fg = null;
    blockGroups[sel.blockId].children.forEach(ch=>{ if(ch.userData.furnRoot===f.id) fg = ch; });
    drag3 = {kind:'furn', b:selBlock(), f, fg, x0:f.lx, z0:f.lz, snap:snapshot(), moved:false};
  }
  if(drag3){ controls.enabled = false; canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener('pointermove', e=>{
  if(!drag3 || !downPos) return;
  const dx = e.clientX-downPos[0], dy = e.clientY-downPos[1];
  if(!drag3.moved && dx*dx+dy*dy < 16) return;
  drag3.moved = true;
  ov.style.visibility = 'hidden';
  const pt = rayFrom(e).ray.intersectPlane(dragPlane, _dragPt);
  if(!pt) return;
  if(drag3.kind==='block'){
    const b = drag3.b;
    const [cx,cz] = snapBlock(b, pt.x-drag3.offX, pt.z-drag3.offZ);
    b.cx = cx; b.cz = cz;
    const g = blockGroups[b.id];
    if(g) g.position.set(cx, 0, cz);
    if(selOutline) selOutline.position.set(cx, C.H/2, cz);
  } else if(drag3.kind==='door'){
    // move the door group along the wall live; the wall opening and the
    // interior/exterior frame are rebuilt once on pointerup (same as furniture)
    const {b,d,dg} = drag3;
    const [lx,lz] = worldToLocal(b, pt.x, pt.z);
    const cand = nearestWallT(b, lx, lz, d.w);
    if(cand.wall!==d.wall || Math.abs(cand.t-d.t)>0.005){
      const wallChanged = cand.wall!==d.wall;
      d.wall = cand.wall; d.t = cand.t;
      const pl = doorPlacement(b, d);
      if(dg){ dg.position.set(pl.x, pl.y, pl.z); dg.rotation.y = pl.rotY; }
      if(wallChanged || !selOutline) updateSelection();   // outline box is wall-orientation dependent
      else { const [wx,wz] = localToWorld(b, pl.x, pl.z); selOutline.position.x = wx; selOutline.position.z = wz; }
    }
  } else if(drag3.kind==='furn'){
    const {b, f, fg} = drag3;
    const [lx, lz] = worldToLocal(b, pt.x, pt.z);
    f.lx = lx; f.lz = lz; clampFurn(b, f);
    if(fg) fg.position.set(f.lx, 0, f.lz);
    if(selOutline){
      const [wx, wz] = localToWorld(b, f.lx, f.lz);
      selOutline.position.x = wx; selOutline.position.z = wz;
    }
  }
  requestShadows();
});
canvas.addEventListener('pointerup', e=>{
  if(drag3){
    controls.enabled = true;
    ov.style.visibility = '';
    const wasDrag = drag3.moved, d3 = drag3;
    drag3 = null;
    if(wasDrag){
      downPos = null;
      if(d3.kind==='block'){
        const [w,d] = footprint(d3.b);
        if(overlaps(d3.b.cx, d3.b.cz, w, d, d3.b.id)){
          d3.b.cx = d3.sx; d3.b.cz = d3.sz;
          toast('Rooms can’t overlap');
        } else if(d3.b.cx!==d3.sx || d3.b.cz!==d3.sz){
          undoStack.push(d3.snap); redoStack.length = 0;
        }
      } else if(d3.kind==='furn'){
        if(d3.f.lx!==d3.x0 || d3.f.lz!==d3.z0){ undoStack.push(d3.snap); redoStack.length = 0; }
      } else if(d3.kind==='door' && (d3.d.wall!==d3.w0 || Math.abs(d3.d.t-d3.t0)>0.005)){
        const nowShared = !!sharedWall(d3.b, d3.d.wall);
        const wasExt = d3.d.type.startsWith('ext');
        if(nowShared && wasExt) d3.d.type = 'int_hard';
        if(!nowShared && !wasExt) d3.d.type = 'ext_hard';
        undoStack.push(d3.snap); redoStack.length = 0;
      }
      renderAll();
      return;
    }
  }
  if(!downPos) return;
  const dx = e.clientX-downPos[0], dy = e.clientY-downPos[1];
  downPos = null;
  if(dx*dx+dy*dy > 25) return;                       // it was an orbit drag
  const hits = rayFrom(e).intersectObjects(blocksRoot.children, true);
  const hit = hits.find(h=>h.object.userData.pick);
  if(hit){
    const p = hit.object.userData.pick;
    if(p.kind==='door') setSel({kind:'door', blockId:p.blockId, doorId:p.doorId});
    else if(p.kind==='furn') setSel({kind:'furn', blockId:p.blockId, furnId:p.furnId});
    else if(p.kind==='window') setSel({kind:'window', blockId:p.blockId, winId:p.winId});
    else setSel({kind:'block', blockId:p.blockId});
  } else setSel(null);
  renderSelection();
});

canvas.addEventListener('pointercancel', ()=>{
  if(drag3){ controls.enabled = true; ov.style.visibility = ''; drag3 = null; renderAll(); }
  downPos = null;
});

/* -------- resize / loop -------- */
function resize(){
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width/r.height; camera.updateProjectionMatrix();
  _ovlDirty = true; requestRender();
  if(ui.view==='2d') render2D();
}
addEventListener('resize', resize);

// overlay contents changed: re-project hotspots/chips on the next frame
export function markOverlayDirty(){ _ovlDirty = true; }

export {addRoomAt, computeHotspots, hotspots, rayFrom, renderHotspots, resize, updateOverlay3D};
