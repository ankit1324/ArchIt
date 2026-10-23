import * as THREE from 'three';
import {hideModal, modal, renderAll, resetCam, showModal} from './ui.js';
import {C} from './catalog.js';
import {$, escapeMarkup, round1, toast} from './dom.js';
import {footprint, linkFloor, sel, setRedoStack, setSel, setState, setUndoStack, state, ui} from './state.js';
import {boundsOf} from './geometry.js';
import {camera, controls, renderer, requestShadows, scene, wallMats} from './scene.js';
import {renderHotspots} from './interact3d.js';
import {S, planOff, planSvg, render2D} from './plan2d.js';
import {shareLink} from './persistence.js';

/* -------- export: 3D image, 2D plan, full design sheet -------- */
// Pose the camera, render synchronously and read the pixels in the same task
// (no preserveDrawingBuffer needed). `grab` reads from renderer.domElement and
// returns whatever the caller wants; default is a full-size PNG data URL.
function shoot3D(pos, tgt, seeThrough, grab){
  const pc = camera.position.clone(), tc = controls.target.clone();
  const mn = controls.minDistance, mx = controls.maxDistance, mp = controls.maxPolarAngle;
  controls.minDistance = 0; controls.maxDistance = 1000; controls.maxPolarAngle = Math.PI;
  if(seeThrough) wallMats.forEach(m=>{ m.opacity = .3; m.depthWrite = false; });
  camera.position.set(pos[0], pos[1], pos[2]);
  controls.target.set(tgt[0], tgt[1], tgt[2]);
  controls.update();
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  const out = grab ? grab(renderer.domElement) : renderer.domElement.toDataURL('image/png');
  if(seeThrough) wallMats.forEach(m=>{ m.opacity = ui.wallOpacity; m.depthWrite = ui.wallOpacity>0.9; });
  controls.minDistance = mn; controls.maxDistance = mx; controls.maxPolarAngle = mp;
  camera.position.copy(pc); controls.target.copy(tc); controls.update();
  requestShadows();
  return out;
}
// Small thumbnail for the saved-designs list: 640×360 at 1×, encoded as WebP
// (JPEG where the browser can't encode WebP). Returns a Blob, not a data URL —
// a 2560×1440 PNG data URL was several MB of string to clone and re-decode.
function snapshotBlob(pos, tgt){
  const W = 640, H = 360;
  const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio(), aspect = camera.aspect;
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  camera.aspect = W/H; camera.updateProjectionMatrix();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  shoot3D(pos, tgt, false, src=>c.getContext('2d').drawImage(src, 0, 0, W, H));
  renderer.setPixelRatio(pr); renderer.setSize(size.x, size.y, false);
  camera.aspect = aspect; camera.updateProjectionMatrix();
  requestShadows();
  return new Promise(res=>c.toBlob(b=>{
    if(b && b.type === 'image/webp') return res(b);
    c.toBlob(j=>res(j), 'image/jpeg', .85);          // Safari: no WebP encoder
  }, 'image/webp', .8));
}
function planShot(){
  const prevSel = sel, prevView = ui.view, prevInt = ui.interior;
  setSel(null); ui.view = '2d'; ui.interior = false;   // export always shows the whole floor
  render2D();
  let xml = planSvg.innerHTML;
  const off = {ox:planOff.ox, oy:planOff.oy};
  setSel(prevSel); ui.view = prevView; ui.interior = prevInt;
  if(prevView==='3d'){ planSvg.innerHTML = ''; renderHotspots(); }
  else render2D();
  const bb = boundsOf(state.blocks), pad = 46;
  const x = off.ox + bb.x0*S - pad, y = off.oy + bb.z0*S - pad;
  const w = bb.w*S + pad*2, h = bb.d*S + pad*2;
  // replace full-viewport background rects with ones covering the cropped viewBox
  xml = xml.replace(/<rect width="100%" height="100%"[^>]*\/>/g, '');
  xml = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f7f9fc"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#g1)"/>` + xml;
  return {xml, x, y, w, h};
}
function planSVGDoc(p, sizeAttrs){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${p.x} ${p.y} ${p.w} ${p.h}" ${sizeAttrs}>
    <style>text{font-family:'Manrope',system-ui,sans-serif}
    .dimchip{font-size:10px;font-weight:800;fill:#fff}
    .blk-num{font-size:26px;font-weight:800;fill:#c3cbd8}
    .blk-name{font-size:13px;font-weight:700;fill:#8b96ab}</style>${p.xml}</svg>`;
}
function save3D(){
  const a = document.createElement('a');
  if(ui.view==='3d'){
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    a.href = renderer.domElement.toDataURL('image/png');
  } else {
    const bb = boundsOf(state.blocks), R = Math.max(bb.w, bb.d)*1.15 + 5;
    a.href = shoot3D([bb.cx+R*.85, R*.7, bb.cz+R*.85], [bb.cx, .6, bb.cz], false);
  }
  a.download = 'archit-3d.png'; a.click();
}
function save2D(){
  const p = planShot();
  const img = new Image();
  img.onload = ()=>{
    const c = document.createElement('canvas'); c.width = p.w*2; c.height = p.h*2;
    const g = c.getContext('2d'); g.scale(2,2); g.drawImage(img, 0, 0, p.w, p.h);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png'); a.download = 'archit-plan-2d.png'; a.click();
  };
  img.src = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(planSVGDoc(p, `width="${p.w}" height="${p.h}"`));
}
function designSheet(){
  const win = window.open('', '_blank');
  if(!win){ toast('Allow pop-ups to open the design sheet'); return; }
  const bb = boundsOf(state.blocks), R = Math.max(bb.w, bb.d)*1.15 + 5;
  const hero  = shoot3D([bb.cx+R*.85, R*.7,  bb.cz+R*.85], [bb.cx, .6, bb.cz], false);
  const front = shoot3D([bb.cx,       R*.45, bb.cz+R*1.15],[bb.cx, 1,  bb.cz], false);
  const back  = shoot3D([bb.cx,       R*.45, bb.cz-R*1.15],[bb.cx, 1,  bb.cz], false);
  const top   = shoot3D([bb.cx+.01,   R*1.5, bb.cz],       [bb.cx, 0,  bb.cz], true);
  const plan  = planSVGDoc(planShot(), 'style="width:100%;height:auto"');
  let area = 0; state.blocks.forEach(b=>area += b.w*b.len);
  let roomCards = '';
  state.blocks.forEach((b,i)=>{
    const spec = C.rooms[b.type], [w,d] = footprint(b);
    const rr = Math.max(w,d)*1.05 + 2.2;
    const shot = shoot3D([b.cx+rr*.8, rr*.95, b.cz+rr*.8], [b.cx, .5, b.cz], true);
    const wallN = b.paint ? C.paint[b.paint].name : C.paint[state.paint].name+' (house default)';
    const floorN = b.floorCol ? C.floorCol[b.floorCol].name : 'Room default';
    const doors = b.doors.map(x=>C.doors[x.type].name).join(', ') || '—';
    const wins = b.windows.length ? b.windows.map(x=>x.kind==='pano'?'Panoramic':'Standard').join(', ') : '—';
    const furn = b.furniture.map(f=>C.furniture[f.key].name).join(', ') || '—';
    roomCards += `<div class="card room">
      <img src="${shot}" alt="">
      <div class="rb"><h3>${i+1}. ${escapeMarkup(b.name || spec.name)}</h3><table>
        <tr><td>Size</td><td>${b.len} × ${b.w} m — ${round1(b.w*b.len)} m²</td></tr>
        <tr><td>Walls</td><td>${wallN}</td></tr>
        <tr><td>Floor</td><td>${floorN}</td></tr>
        <tr><td>Doors</td><td>${doors}</td></tr>
        <tr><td>Windows</td><td>${wins}</td></tr>
        <tr><td>Furniture</td><td>${furn}</td></tr>
      </table></div></div>`;
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>ArchIt — Design Sheet</title><style>
    body{font-family:'Manrope',system-ui,sans-serif;color:#2c3b58;margin:0;background:#eef1f6}
    .wrap{max-width:1000px;margin:0 auto;padding:28px}
    h1{font-size:26px;margin:0 0 4px} h2{font-size:17px;margin:26px 0 10px} h3{font-size:15px;margin:0 0 8px}
    .meta{color:#8b96ab;font-size:13px;margin-bottom:18px}
    .card{background:#fff;border-radius:14px;box-shadow:0 4px 14px rgba(44,59,88,.08);overflow:hidden}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .grid img,.card>img{width:100%;display:block}
    .cap{font-size:12px;font-weight:700;color:#8b96ab;padding:8px 12px}
    .summary table,.room table{border-collapse:collapse;width:100%;font-size:13px}
    .summary td,.room td{padding:5px 10px;border-bottom:1px solid #eef1f6;vertical-align:top}
    .summary td:first-child,.room td:first-child{color:#8b96ab;font-weight:700;width:110px;white-space:nowrap}
    .summary{padding:14px}
    .rooms{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .room .rb{padding:12px 14px}
    .plan{padding:10px}
    .printbtn{position:fixed;right:18px;top:18px;background:#1d5bb4;color:#fff;border:0;border-radius:999px;padding:10px 20px;font-weight:800;font-size:14px;cursor:pointer}
    @media print{.printbtn{display:none}body{background:#fff}.card{box-shadow:none;border:1px solid #dde3ec}.rooms{grid-template-columns:1fr 1fr}.room{break-inside:avoid}}
  </style></head><body>
  <button class="printbtn">Print / PDF</button>
  <div class="wrap">
    <h1>ArchIt — Design Sheet</h1>
    <div class="meta">${new Date().toLocaleDateString()} — ${state.blocks.length} rooms — ${round1(area)} m² total</div>
    <div class="card summary"><table>
      <tr><td>Facade</td><td>${C.facade[state.facade].name}, ${C.facadeMat[state.facadeMat].name}</td></tr>
      <tr><td>Roof</td><td>${C.roofStyle[state.roofStyle].name}, ${C.roofCol[state.roofCol].name}</td></tr>
      <tr><td>Interior</td><td>${C.paint[state.paint].name} walls</td></tr>
      <tr><td>Total area</td><td>${round1(area)} m² across ${state.blocks.length} rooms</td></tr>
    </table></div>
    <h2>3D previews</h2>
    <div class="card"><img src="${hero}"><div class="cap">Overview</div></div>
    <div class="grid" style="margin-top:14px">
      <div class="card"><img src="${front}"><div class="cap">Front</div></div>
      <div class="card"><img src="${back}"><div class="cap">Back</div></div>
      <div class="card"><img src="${top}"><div class="cap">Top (walls transparent)</div></div>
      <div class="card"><div class="plan">${plan}</div><div class="cap">2D floor plan</div></div>
    </div>
    <h2>Rooms</h2>
    <div class="rooms">${roomCards}</div>
  </div></body></html>`;
  win.document.write(html);
  win.document.close();
  // about:blank inherits the builder's CSP, which blocks inline handlers
  win.document.querySelector('.printbtn').addEventListener('click', ()=>win.print());
}
function saveProjectFile(){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({v:3, state}, null, 1)], {type:'application/json'}));
  a.download = 'archit-project.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
function openProjectFile(){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = ()=>{
    const f = inp.files[0]; if(!f) return;
    f.text().then(t=>{
      try{
        const o = JSON.parse(t);
        if(!(o && o.v===3 && o.state && Array.isArray(o.state.blocks) && o.state.blocks.length)) throw 0;
        setState(o.state); linkFloor();
        setUndoStack([]); setRedoStack([]); setSel(null);
        resetCam(); renderAll();
        toast('Project loaded');
      }catch(e){ toast('Not a valid project file'); }
    });
  };
  inp.click();
}
$('#shotB').addEventListener('click', ()=>{
  showModal(`
    <h3>Save &amp; export</h3>
    <p class="hint">Save images, a full design sheet, or the project file to continue later on any device.</p>
    <button class="mbtn" data-export="sheet">Design sheet — all previews</button>
    <button class="mbtn" data-export="3d" style="background:#1d5bb4">Save 3D image</button>
    <button class="mbtn" data-export="2d" style="background:#1d5bb4">Save 2D plan</button>
    <button class="mbtn" data-export="savep" style="background:#2c3b58">Save project (.json)</button>
    <button class="mbtn" data-export="share" style="background:#3aa06b">Copy share link</button>
    <button class="mbtn ghost" data-export="openp">Open project…</button>
    <button class="mbtn ghost" data-close>Cancel</button>`);
});
modal.addEventListener('click', e=>{
  const ex = e.target.closest('[data-export]');
  if(!ex) return;
  hideModal();
  if(ex.dataset.export==='3d') save3D();
  else if(ex.dataset.export==='2d') save2D();
  else if(ex.dataset.export==='savep') saveProjectFile();
  else if(ex.dataset.export==='openp') openProjectFile();
  else if(ex.dataset.export==='share') shareLink();
  else designSheet();
});

export {snapshotBlob};
