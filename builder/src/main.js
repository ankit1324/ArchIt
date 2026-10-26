import * as THREE from 'three';
import {PAID_TEMPLATES, TEMPLATES, fetchPaidGeometry, loadTemplateCatalog, markTemplateOwned, showTemplatePicker, tRoom, tRoomSpec} from './templates.js';
import {C} from './catalog.js';
import {$, EMBED, VIEW, toast} from './dom.js';
import {dirty, freshState, linkFloor, sel, setDirty, setRedoStack, setSel, setState, setUndoStack, state, ui} from './state.js';
import {boundsOf, roofComponents, unionLoops, wallNeighbors, wallOpenings} from './geometry.js';
import {blocksRoot, camera, controls, pmrem, renderer, scene, setContext, wallMats} from './scene.js';
import {buildRoofGroups, rebuild3D, toggleRoofs} from './house3d.js';
import {resize} from './interact3d.js';
import {exitWalk, walkActive} from './walk.js';
import {closeToolPop, releaseThumbRenderer} from './tools.js';
import {hideModal, renderAll, resetCam, setView} from './ui.js';
import {snapshotBlob} from './export.js';
import {loadProject, tryHashLoad} from './persistence.js';
import {startTutorial} from './tutorial.js';

/* ============================== boot ============================== */
// Builds a paid template's rooms from server-supplied geometry, using the same
// tRoom() renderer the inline free templates use.
function buildFromGeometry(geometry){
  const prof = geometry.profile || 'home';
  // v2 payloads (contract §1) carry object RoomSpecs; v1 carries [type,cx,cz,opts]
  // tuples. A rooms array may mix both forms.
  (geometry.rooms || []).forEach(room=>{
    if(Array.isArray(room)) tRoom(prof, ...room);
    else if(room && typeof room === 'object') tRoomSpec(prof, room);
  });
}

// Templates are authored in plot coordinates (0..W, 0..D); the camera, plot and
// orbit target are origin-centred, so shift the built plan onto 0,0. Doors,
// windows, partitions and furniture are room-local and move with their room.
function centreBlocks(blocks){
  if(!blocks.length) return;
  const bb = boundsOf(blocks);
  const dx = Math.round(bb.cx*10)/10, dz = Math.round(bb.cz*10)/10;
  if(!dx && !dz) return;
  const clean = n=>Math.round(n*1000)/1000;
  blocks.forEach(b=>{ b.cx = clean(b.cx-dx); b.cz = clean(b.cz-dz); });
}
async function newProject(tpl='empty'){
  if(walkActive) exitWalk();   // a template picked mid-walk must not keep the old room's walls
  const floorCount = EMBED ? (state?.floors?.length || 1) : 1;
  let loaded = true;   // false when a paid template's geometry could not be fetched
  setState(freshState());
  while(state.floors.length < floorCount) state.floors.push({blocks:[]});
  if(TEMPLATES[tpl]){
    TEMPLATES[tpl].build();
  }else if(PAID_TEMPLATES.has(tpl)){
    // owned paid template: geometry only exists server-side
    const geometry = await fetchPaidGeometry(tpl);
    if(geometry) buildFromGeometry(geometry);
    else { loaded = false; TEMPLATES.empty.build(); toast && toast('Could not load that template — starting from an empty room.'); }
  }else{
    TEMPLATES.empty.build();
  }
  centreBlocks(state.blocks);
  setUndoStack([]); setRedoStack([]); setSel(null);
  ui.interior = false; ui.focusRoomId = null; ui.tool = null;
  $('#btnIn').classList.remove('on');
  closeToolPop();
  toggleRoofs(true);
  resetCam();
  setDirty(true);
  renderAll();
  setView('2d');
  maybeStartTutorial();
  return loaded;
}
// First visit only. The tour used to open on top of the template picker (and
// restart from step 1 when a template was then picked): wait until the picker or
// any other dialog has closed, and never restart a tour that is already running.
function maybeStartTutorial(){
  let done = EMBED ? '1' : null;
  try{ done = done || localStorage.getItem('architTutDone') || localStorage.getItem('krausTutDone2'); }catch(e){}
  if(done) return;
  setTimeout(function tryStart(){
    if($('#tut').classList.contains('show')) return;
    const dim = $('#dim');
    if(!dim.classList.contains('show')){ startTutorial(); return; }
    const mo = new MutationObserver(()=>{
      if(!dim.classList.contains('show')){ mo.disconnect(); setTimeout(tryStart, 300); }
    });
    mo.observe(dim, {attributes:true, attributeFilter:['class']});
  }, 450);
}
// Local-dev only handle. Everything in this file is module-scoped, which makes the
// builder impossible to drive from a test harness or the devtools console.
if(location.hostname === 'localhost' || location.hostname === '127.0.0.1'){
  window.__archit = {
    get state(){ return state; }, get ui(){ return ui; }, get sel(){ return sel; }, get wallMats(){ return wallMats; },
    C, TEMPLATES, THREE, scene, blocksRoot, camera, controls, renderer,
    rebuild3D, renderAll, newProject, toggleRoofs, buildFromGeometry, tRoomSpec,
    buildRoofGroups, roofComponents, unionLoops, wallOpenings, wallNeighbors,
  };
}
resize();
// Give the GPU contexts back when the page (or the iframe) goes away. Skipped
// when the page is being put in the back/forward cache, since it may come back.
addEventListener('pagehide', e=>{
  if(e.persisted) return;
  releaseThumbRenderer();
  pmrem?.dispose?.();
  renderer.dispose(); renderer.forceContextLoss?.();
});
(async ()=>{
  if(EMBED){
    newProject('empty');
    let initialized = false;
    window.addEventListener('message', async e=>{
      if(e.origin !== location.origin) return;
      const m = e.data;
      // Parent finished checkout for a template. The server is the
      // authority — we just re-read the catalog and open the bought template.
      if(m?.type === 'archit:template-purchased'){
        if(VIEW) return;
        const key = m.payload && m.payload.key;
        if(!key) return;
        await loadTemplateCatalog();
        markTemplateOwned(key);
        hideModal();
        // newProject already explained a failed geometry fetch: don't cover
        // that toast with a false "unlocked"
        if(await newProject(key)) toast('Template unlocked');
        return;
      }
      if(m?.type !== 'archit:init') return;
      const p = m.payload || {};
      // DesignerOverlay keeps this iframe (and its WebGL context) alive and sends
      // archit:init again for every design it opens: start each one from the same
      // clean slate a fresh page load would give it.
      if(initialized){
        if(walkActive) exitWalk();
        hideModal();
        setState(null);
        newProject('empty');
      }
      initialized = true;
      if(p.design?.v === 3 && p.design.state){ setState(p.design.state); linkFloor(); }
      else if(p.floors > 1){
        // pre-create the floors chosen in the setup dialog (new designs only)
        while(state.floors.length < Math.min(p.floors, 3)) state.floors.push({blocks:[]});
      }
      setContext(p.plot, p.neighbors, p.facing);
      setUndoStack([]); setRedoStack([]); setSel(null); setDirty(false);
      resetCam(); renderAll();
      // a viewer wants the house, not the editing plan newProject() opened
      if(VIEW) setView('3d');
    });
    // Parent replies once the design row is written (after the thumbnail
    // upload); only then is the design really saved.
    let saving = false;
    window.addEventListener('message', e=>{
      if(e.origin !== location.origin || e.data?.type !== 'archit:saved') return;
      saving = false;
      const r = e.data.payload || {};
      if(r.ok){ setDirty(false); toast('Saved'); }
      else toast(r.error ? 'Could not save: ' + r.error : 'Could not save — try again');
    });
    document.getElementById('saveMapB').addEventListener('click', async ()=>{
      if(VIEW || saving) return;   // read-only viewer: never posts a save
      const all = (state.floors || [{blocks: state.blocks}]).flatMap(f=>f.blocks);
      if(!all.length){ toast('Add at least one room first'); return; }
      saving = true;
      toast('Saving…');
      const bb = boundsOf(all);
      const R = Math.max(bb.w, bb.d) * 1.15 + 5;
      // 640×360 WebP Blob (structured clone carries it across), not a PNG data URL
      const snapshot = await snapshotBlob([bb.cx + R*.85, R*.7, bb.cz + R*.85], [bb.cx, .6, bb.cz]);
      parent.postMessage({type:'archit:save', payload:{design:{v:3, state}, snapshot}}, location.origin);
    });
    document.getElementById('closeEmbedB').addEventListener('click', ()=>{
      parent.postMessage({type:'archit:close', dirty: VIEW ? false : dirty}, location.origin);
    });
    parent.postMessage({type:'archit:ready'}, location.origin);
  } else if(await tryHashLoad()){
    setUndoStack([]); setRedoStack([]); setSel(null);
    resetCam(); renderAll();
    toast('Shared project loaded');
  } else if(loadProject()){
    setUndoStack([]); setRedoStack([]); setSel(null);
    resetCam(); renderAll();
  } else {
    newProject();
    showTemplatePicker();
  }
  const loader = document.getElementById('loader');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    setTimeout(()=>{
      loader.classList.add('done');
      loader.addEventListener('transitionend', ()=>loader.remove(), {once:true});
    }, 500);
  }));
})();

export {newProject};
