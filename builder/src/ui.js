import * as THREE from 'three';
import {closeToolPop, syncToolCursor} from './tools.js';
import {C} from './catalog.js';
import {$, VIEW, chips, round1, stage, toast} from './dom.js';
import {commit, ensureExteriorState, firstRoom, footprint, getBlock, localToWorld, nudge, nudgeBegin, nudgeEnd, redo, redoStack, sel, selBlock, selDoor, selFurn, selWin, setSel, state, ui, undo, undoStack} from './state.js';
import {FLH, boundsOf, clampFurn, designIssues, overlaps} from './geometry.js';
import {camera, controls, requestRender, requestShadows, selOutline, wallMats} from './scene.js';
import {partMat} from './materials.js';
import {blockGroups, rebuild3D, toggleRoofs, updateSelection} from './house3d.js';
import {markOverlayDirty, renderHotspots} from './interact3d.js';
import {enterWalk, exitWalk, walkActive} from './walk.js';
import {S, fitPlan, planSvg, render2D, setPlanScale} from './plan2d.js';
import {renderSidebar} from './sidebar.js';
import {saveProject} from './persistence.js';
import {showTemplatePicker} from './templates.js';
import {newProject} from './main.js';

function updateChip(){
  let area = 0; state.blocks.forEach(b=>area += b.w*b.len);
  document.getElementById('areaV').textContent = round1(area) + ' m²';
  document.getElementById('roomsV').textContent = state.blocks.length;
  const iss = designIssues();
  const wv = document.getElementById('warnV');
  wv.textContent = iss.length ? iss.length + ' issue' + (iss.length>1?'s':'') : 'OK';
  wv.style.color = iss.length ? '#e5476f' : '#3aa06b';
  const wc = document.getElementById('warnCell');
  wc.title = iss.join('\n');
  wc.onclick = ()=>{ if(iss.length) toast(iss.slice(0,3).join(' · ') + (iss.length>3 ? ` (+${iss.length-3} more)` : '')); };
}
// Selection-only refresh: outline, overlay chips/hotspots and the sidebar.
// No 3D rebuild, no localStorage write.
function renderSelection(){
  if(!state) return;
  updateSelection();
  if(ui.view==='2d') render2D(); else renderHotspots();
  renderSidebar();
  syncToolCursor();
}

/* ============================== modals ============================== */
const dim = $('#dim'), modal = $('#modal');
function showModal(html){ modal.innerHTML = html; dim.classList.add('show'); }
function hideModal(){ dim.classList.remove('show'); }
dim.addEventListener('click', e=>{ if(e.target===dim && state) hideModal(); });
modal.addEventListener('click', e=>{
  if(e.target.closest('[data-close]')) hideModal();
});

modal.addEventListener('click', e=>{
  const rst = e.target.closest('[data-reset]');
  if(rst && !VIEW){ try{ localStorage.removeItem('architHome'); localStorage.removeItem('krausHome'); }catch(e){} newProject(); showTemplatePicker(); }
});
$('#resetB').addEventListener('click', ()=>{
  if(VIEW) return;
  showModal(`
    <h3>Start over?</h3>
    <p class="hint">The current project will be deleted and replaced with a fresh single-room house.</p>
    <button class="mbtn" data-reset style="background:#e5476f">Yes, start over</button>
    <button class="mbtn ghost" data-close>Cancel</button>`);
});

/* ============================== header / stage controls ============================== */
function resetCam(){
  controls.minDistance = 4; controls.maxPolarAngle = 1.45;
  // Frame every floor's footprint from the default 3/4 angle. Saved designs and
  // paid geometry aren't guaranteed to be origin-centred, and big plans
  // (farmhouse, bungalow) don't fit the old fixed 18 m orbit.
  const floors = state?.floors || [{blocks: state?.blocks || []}];
  const all = floors.flatMap(f=>f.blocks);
  const bb = all.length ? boundsOf(all) : {cx:0, cz:0, w:0, d:0};
  // +1.2 m for eaves overhang, +2.5 m headroom for a pitched roof
  const R = Math.hypot(bb.w + 1.2, bb.d + 1.2, FLH()*floors.length + 2.5) / 2;
  const vHalf = camera.fov * Math.PI / 360;
  // a 0x0 frame (hidden iframe) leaves aspect 0 or NaN: frame for a square
  // view rather than writing NaN into the camera
  const aspect = camera.aspect > 0 && Number.isFinite(camera.aspect) ? camera.aspect : 1;
  const half = Math.min(vHalf, Math.atan(Math.tan(vHalf) * aspect));
  const offset = new THREE.Vector3(10.5, 6.4, 12.5);   // camera (10.5, 7.5, 12.5) around target y 1.1
  const dist = Math.max(offset.length(), R / Math.sin(half) * 1.1);
  controls.maxDistance = Math.max(40, dist * 1.5);
  controls.target.set(bb.cx, 1.1, bb.cz);
  camera.position.copy(controls.target).addScaledVector(offset.normalize(), dist);
  controls.update();
}
function enterInterior(){
  const b = getBlock(ui.focusRoomId);
  if(!b) return;
  const [w,d] = footprint(b);
  controls.minDistance = .3;
  controls.maxDistance = Math.max(w, d)*1.4 + 1;
  controls.maxPolarAngle = 1.62;
  controls.target.set(b.cx, 1.35, b.cz);
  camera.position.set(b.cx + w*.34, 1.55, b.cz + d*.34);
  controls.update();
  toggleRoofs(false);
}
// walkthrough: WASD (and arrows when nothing is selected) move through the room
document.addEventListener('keydown', e=>{
  if(!ui.interior || ui.view!=='3d' || ui.walk) return;   // Walk mode moves itself
  if(e.target.matches('input,textarea')) return;
  const k = e.key.toLowerCase();
  let f = 0, sd = 0;
  if(k==='w'||k==='arrowup') f = 1;
  else if(k==='s'||k==='arrowdown') f = -1;
  else if(k==='a'||k==='arrowleft') sd = -1;
  else if(k==='d'||k==='arrowright') sd = 1;
  else return;
  if(sel && k.startsWith('arrow')) return;   // arrows nudge the selection instead
  e.preventDefault();
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0));
  const mv = dir.multiplyScalar(f*.22).add(right.multiplyScalar(sd*.22));
  camera.position.add(mv); controls.target.add(mv); controls.update();
});
function apply2DInterior(){   // auto-zoom plan to focused room
  const b = getBlock(ui.focusRoomId);
  if(!b) return;
  const [w,d] = footprint(b);
  const r = stage.getBoundingClientRect();
  setPlanScale(Math.min(170, Math.max(16, Math.min(r.width/(w+1.6), r.height/(d+1.6)))));
}
function setInterior(on){
  if(on){
    const b = selBlock() || getBlock(ui.focusRoomId) || state.blocks[0];
    if(!b) return;
    ui.interior = true;
    ui.focusRoomId = b.id;
    if(ui.view==='3d') enterInterior();
    else { apply2DInterior(); render2D(); }
  } else {
    ui.interior = false;
    resetCam();
    toggleRoofs(true);
    if(ui.view==='2d'){ setPlanScale(54); render2D(); }
    else renderHotspots();
  }
  $('#btnIn').classList.toggle('on', ui.interior);
}
function setView(v){
  ui.view = v;
  $('#btn3d').classList.toggle('on', v==='3d');
  $('#btn2d').classList.toggle('on', v==='2d');
  stage.classList.toggle('mode2d', v==='2d');
  if(v==='2d'){ chips.style.display='none'; if(ui.interior) apply2DInterior(); else fitPlan(); render2D(); }
  else { planSvg.innerHTML=''; renderHotspots(); if(ui.interior) enterInterior(); }
  renderSidebar();
  requestRender();
}
$('#btn3d').addEventListener('click', ()=>{ if(walkActive) exitWalk(); setView('3d'); });
$('#btn2d').addEventListener('click', ()=>{ if(walkActive) exitWalk(); setView('2d'); });
$('#btnWalk').addEventListener('click', ()=>{ walkActive ? exitWalk() : enterWalk(); });
$('#btnIn').addEventListener('click', ()=>{
  if(walkActive) exitWalk();
  const b = selBlock();
  if(ui.interior && b && b.id!==ui.focusRoomId) setInterior(true);   // refocus on newly selected room
  else setInterior(!ui.interior);
});

document.querySelectorAll('.dropdown').forEach(dd=>{
  dd.querySelector('.dd-btn').addEventListener('click', e=>{
    e.stopPropagation(); dd.classList.toggle('open');
  });
});
$('#wallsDD .dd-menu').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  ui.wallOpacity = +b.dataset.w;
  $('#wallsDD').classList.remove('open');
  $('#wallsDD .dd-btn').firstChild.textContent = b.textContent+' ';
  document.querySelectorAll('#wallsDD .dd-menu button').forEach(x=>x.classList.toggle('on', x===b));
  wallMats.forEach(m=>{ m.opacity = ui.wallOpacity; m.depthWrite = ui.wallOpacity>0.9; });
  partMat.opacity = Math.min(1, ui.wallOpacity+.1);
  requestShadows();
});
function renderFloorDD(){
  $('#floorDD .dd-btn').firstChild.textContent = `Floor ${state.floor+1} `;
  const canDel = !VIEW && state.floors.length > 1;
  $('#floorDD .dd-menu').innerHTML =
    state.floors.map((f,i)=>`<button data-fl="${i}" class="fl-row ${i===state.floor?'on':''}"><span>Floor ${i+1}${f.blocks.length?'':' (empty)'}</span>${canDel?`<span class="fl-del" data-del="${i}" title="Delete floor ${i+1}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0l1 13h8l1-13"/></svg></span>`:''}</button>`).join('')
    + (VIEW ? '' : `<button data-fl="add">+ Add floor</button>`);
}
$('#floorDD .dd-menu').addEventListener('click', e=>{
  const del = e.target.closest('.fl-del');
  if(del){
    e.stopPropagation();
    if(VIEW) return;
    const i = +del.dataset.del;
    if(state.floors.length<=1) return;
    $('#floorDD').classList.remove('open');
    commit(()=>{
      state.floors.splice(i,1);
      if(state.floor>=i) state.floor = Math.max(0, state.floor-1);
      state.blocks = state.floors[state.floor].blocks;
      setSel(null);
    });
    toast(`Floor ${i+1} deleted — undo to restore`);
    return;
  }
  const btn = e.target.closest('button'); if(!btn) return;
  $('#floorDD').classList.remove('open');
  if(btn.dataset.fl==='add'){
    if(VIEW) return;
    if(state.floors.length>=3){ toast('Up to 3 floors'); return; }
    commit(()=>{
      state.floors.push({blocks:[]});
      state.floor = state.floors.length-1;
      state.blocks = state.floors[state.floor].blocks;
      state.blocks.push(firstRoom());
      setSel(null);
    });
    toast(`Floor ${state.floor+1} added`);
  } else {
    const i = +btn.dataset.fl;
    if(i===state.floor) return;
    state.floor = i;
    state.blocks = state.floors[i].blocks;
    setSel(null);
    renderAll();
  }
});
$('#undoB').addEventListener('click', undo);
$('#redoB').addEventListener('click', redo);
$('#zoomIn').addEventListener('click', ()=>zoomCam(0.85));
$('#zoomOut').addEventListener('click', ()=>zoomCam(1.18));
function zoomCam(f){
  if(ui.view==='2d'){
    setPlanScale(Math.min(170, Math.max(16, S/f)));
    render2D();
    return;
  }
  const v = camera.position.clone().sub(controls.target).multiplyScalar(f);
  const len = v.length();
  if(len>controls.minDistance && len<controls.maxDistance){ camera.position.copy(controls.target).add(v); requestRender(); }
}
planSvg.addEventListener('wheel', e=>{
  if(ui.view!=='2d') return;
  e.preventDefault();
  setPlanScale(Math.min(170, Math.max(16, S*(e.deltaY<0 ? 1.1 : 0.9))));
  render2D();
}, {passive:false});
$('#fsB').addEventListener('click', ()=>{
  if(document.fullscreenElement) document.exitFullscreen();
  else document.getElementById('app').requestFullscreen();
});
document.addEventListener('keydown', e=>{
  if(e.target.matches('input,textarea')) return;
  // Walk mode owns WASD/arrows (walk.js); editing shortcuts here would nudge or
  // delete whatever was selected before (or clicked while grabbing the mouse).
  if(ui.walk) return;
  // read-only viewer: every shortcut below edits (undo/redo/delete/nudge)
  if(VIEW) return;
  if((e.metaKey||e.ctrlKey) && e.key==='z'){ e.preventDefault(); e.shiftKey? redo() : undo(); }
  if((e.metaKey||e.ctrlKey) && e.key==='y'){ e.preventDefault(); redo(); }
  if((e.key==='Delete'||e.key==='Backspace') && sel){
    e.preventDefault();
    if(sel.kind==='door'){
      const b = selBlock(), d = selDoor();
      if(b&&d) commit(()=>{ b.doors = b.doors.filter(x=>x.id!==d.id); setSel({kind:'block', blockId:b.id}); });
    } else if(sel.kind==='furn'){
      const b = selBlock(), f = selFurn();
      if(b&&f) commit(()=>{ b.furniture = b.furniture.filter(x=>x.id!==f.id); setSel({kind:'block', blockId:b.id}); });
    } else if(sel.kind==='window'){
      // a selected window deletes just the window, not the room it sits in
      const b = selBlock(), w = selWin();
      if(b&&w) commit(()=>{ b.windows = b.windows.filter(x=>x.id!==w.id); setSel({kind:'block', blockId:b.id}); });
    } else if(sel.kind==='block' && state.blocks.length>1){
      const b = selBlock();
      if(b) commit(()=>{ state.blocks = state.blocks.filter(x=>x.id!==b.id); setSel(null); });
    }
  }
  const ARROW = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]};
  if(ARROW[e.key] && sel && !(ui.interior && ui.view==='3d')){
    e.preventDefault();
    const [dx,dz] = ARROW[e.key];
    const b = selBlock(); if(!b) return;
    // Coalesced: snapshot once per burst, move the 3D group live, rebuild on
    // keyup / idle (nudgeEnd) instead of a full rebuild per keypress.
    if(sel.kind==='block'){
      const step = .1, [w,d] = footprint(b);
      if(!overlaps(b.cx+dx*step, b.cz+dz*step, w, d, b.id)){
        nudgeBegin();
        b.cx = Math.round((b.cx+dx*step)*100)/100; b.cz = Math.round((b.cz+dz*step)*100)/100;
        const g = blockGroups[b.id];
        if(g) g.position.set(b.cx, 0, b.cz);
        if(selOutline) selOutline.position.set(b.cx, C.H/2, b.cz);
      }
    } else if(sel.kind==='furn'){
      const f = selFurn(); if(!f) return;
      const a = b.rot*Math.PI/2, ca = Math.round(Math.cos(a)), sa = Math.round(Math.sin(a));
      nudgeBegin();
      f.lx += (dx*ca - dz*sa)*.05; f.lz += (dx*sa + dz*ca)*.05; clampFurn(b, f);
      const g = blockGroups[b.id];
      if(g) g.children.forEach(ch=>{ if(ch.userData.furnRoot===f.id) ch.position.set(f.lx, 0, f.lz); });
      if(selOutline){ const [wx, wz] = localToWorld(b, f.lx, f.lz); selOutline.position.x = wx; selOutline.position.z = wz; }
    }
    if(nudge){ markOverlayDirty(); if(ui.view==='2d') render2D(); else requestShadows(); }
  }
  if(e.key==='Escape'){ setSel(null); ui.tool = null; closeToolPop(); renderSelection(); }
});
document.addEventListener('keyup', e=>{ if(nudge && e.key.startsWith('Arrow')) nudgeEnd(); });
function renderAll(){
  if(!state) return;
  ensureExteriorState();
  rebuild3D();
  if(ui.view==='2d') render2D(); else renderHotspots();
  renderSidebar();
  renderFloorDD();
  updateChip();
  saveProject();
  $('#undoB').disabled = !undoStack.length;
  $('#redoB').disabled = !redoStack.length;
  syncToolCursor();
}

export {dim, hideModal, modal, renderAll, renderSelection, resetCam, setView, showModal};
