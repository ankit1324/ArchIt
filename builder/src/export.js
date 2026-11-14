import * as THREE from 'three';
import {hideModal, modal, renderAll, resetCam, showModal} from './ui.js';
import {C} from './catalog.js';
import {$, EMBED, VIEW, escapeMarkup, toast} from './dom.js';
import {footprint, linkFloor, sel, setRedoStack, setSel, setState, setUndoStack, state, ui} from './state.js';
import {FLH, boundsOf, elevationFrame, elevationSides, groundY, houseTotals, winKinds, winSpec} from './geometry.js';
import {camera, controls, renderer, requestShadows, scene, setContextVisible, wallMats} from './scene.js';
import {rebuild3D, setSolidAll, toggleRoofs} from './house3d.js';
import {renderHotspots} from './interact3d.js';
import {S, dimOffsets, planOff, planSvg, render2D, viewBounds} from './plan2d.js';
import {shareLink} from './persistence.js';
import {fmtArea, fmtLen, fmtOpening, fmtSize} from './units.js';
import {frontSide} from './plot.js';
import {vastuReport} from './vastu.js';
import {costEstimate, costTiers, fmtINR, fmtQty} from './cost.js';

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
  // the dimension rows sit under and right of the plan: keep them in the crop
  const bb = viewBounds(state.blocks), pad = 46, far = dimOffsets(S)[1] + 26;   // rooms plus the plot outline
  const x = off.ox + bb.x0*S - pad, y = off.oy + bb.z0*S - pad;
  const w = bb.w*S + pad + far, h = bb.d*S + pad + far;
  // replace full-viewport background rects with ones covering the cropped viewBox
  xml = xml.replace(/<rect width="100%" height="100%"[^>]*\/>/g, '');
  xml = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f8f7f2"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#g1)"/>` + xml;
  return {xml, x, y, w, h};
}
function planSVGDoc(p, sizeAttrs){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${p.x} ${p.y} ${p.w} ${p.h}" ${sizeAttrs}>
    <style>text{font-family:'Manrope',system-ui,sans-serif}
    .dimchip{font-size:10px;font-weight:800;fill:#fff}
    .plottxt{font-size:10px;font-weight:800;letter-spacing:.06em;fill:#ad4a31}
    .dims line{stroke:#5d665b;stroke-width:1}.dims line.ext{stroke:#a1a99b;stroke-dasharray:2 3}
    .dimtxt{font-size:10.5px;font-weight:700;fill:#29372c;paint-order:stroke;stroke:#f8f7f2;stroke-width:3px;stroke-linejoin:round}
    .blk-num{font-size:26px;font-weight:800;fill:#c6cbbf}
    .blk-name{font-size:13px;font-weight:700;fill:#5d665b}</style>${p.xml}</svg>`;
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
/* -------- elevations: straight-on views of each side -------- */
const ELEV_NAMES = {front:'Front', rear:'Rear', left:'Left side', right:'Right side'};
// Put the scene in "drawing" state for any number of shots, then put it back:
// every floor solid, roofs on, walls opaque, no selection outline, no plot context.
function withElevationScene(fn){
  const prevSel = sel; setSel(null);
  setSolidAll(true); rebuild3D(); toggleRoofs(true);
  wallMats.forEach(m=>{ m.opacity = 1; m.depthWrite = true; });
  setContextVisible(false);
  const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
  try{ return fn(); }
  finally{
    renderer.setPixelRatio(pr); renderer.setSize(size.x, size.y, false);
    setContextVisible(true);
    wallMats.forEach(m=>{ m.opacity = ui.wallOpacity; m.depthWrite = ui.wallOpacity>0.9; });
    setSolidAll(false); setSel(prevSel); rebuild3D();
    if((ui.interior && ui.view==='3d') || ui.walk) toggleRoofs(false);
    requestShadows();
  }
}
// One side, 1600x900, with the ground line, overall width and wall height drawn on.
// Call inside withElevationScene().
function shootElevation(side, title){
  const W = 1600, H = 900;
  const fr = elevationFrame(boundsOf(state.floors.flatMap(f=>f.blocks)), side, state.floors.length, state.floor, W/H);
  const cam = new THREE.OrthographicCamera(-fr.halfW, fr.halfW, fr.halfH, -fr.halfH, 0.1, 200);
  cam.position.set(fr.pos[0], fr.pos[1], fr.pos[2]);
  cam.lookAt(fr.target[0], fr.target[1], fr.target[2]);
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, cam);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(renderer.domElement, 0, 0, W, H);
  drawElevationDims(g, fr, W, H, title);
  return c.toDataURL('image/png');
}
function drawElevationDims(g, fr, W, H, title){
  const pxm = H/(2*fr.halfH), cy = fr.target[1];
  const X = m=>W/2 + m*pxm, Y = y=>H/2 - (y-cy)*pxm;
  const ink = '#29372c', soft = '#5d665b';
  const line = (x1,y1,x2,y2,col=soft,w=1.5)=>{ g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); };
  const tick = (x,y)=>line(x-7, y+7, x+7, y-7, ink, 1.5);
  const text = (t,x,y,size=28,weight=700,col=ink,align='center')=>{ g.font = `${weight} ${size}px Manrope, system-ui, sans-serif`; g.fillStyle = col; g.textAlign = align; g.fillText(t, x, y); };
  const gy = Y(fr.y0), xl = X(-fr.span/2), xr = X(fr.span/2), ty = Y(fr.wallTop);
  line(0, gy, W, gy, ink, 2.5);                                   // ground
  // overall width, under the ground line
  const wy = gy + 64;
  line(xl, wy, xr, wy); line(xl, gy+8, xl, wy+8); line(xr, gy+8, xr, wy+8); tick(xl, wy); tick(xr, wy);
  text(fmtLen(fr.span), (xl+xr)/2, wy-12);
  // wall height, right of the house
  const hx = xr + 84;
  line(hx, gy, hx, ty); line(xr+10, ty, hx+8, ty); tick(hx, gy); tick(hx, ty);
  g.save(); g.translate(hx-12, (gy+ty)/2); g.rotate(-Math.PI/2); text(fmtLen(fr.wallTop-fr.y0), 0, 0); g.restore();
  // each upper floor's level, left of the house
  for(let i=1; i<state.floors.length; i++){
    const fy = Y(fr.y0 + i*FLH());
    g.setLineDash([6,6]); line(xl-90, fy, xl-8, fy); g.setLineDash([]);
    text('Floor '+(i+1), xl-90, fy-10, 22, 700, soft, 'left');
  }
  text(title, 40, 66, 40, 800, ink, 'left');
  text('ArchIt', W-40, 66, 24, 800, soft, 'right');
}
function showElevations(which = 'front'){
  if(!ELEV_NAMES[which]) which = 'front';
  const sides = elevationSides(frontSide());
  const url = withElevationScene(()=>shootElevation(sides[which], ELEV_NAMES[which]+' elevation'));
  showModal(`<h3>Elevations</h3>
    <p class="hint">Straight-on views of each side with the overall width and wall height. The front is the side ${EMBED ? 'your plot faces' : 'along the bottom of the 2D plan'}.</p>
    <div class="tpl-tabs">${Object.entries(ELEV_NAMES).map(([k,n])=>
      `<button type="button" class="tpl-tab${k===which?' active':''}" data-elev="${k}" aria-pressed="${k===which}">${n}</button>`).join('')}</div>
    <img class="elev-img" src="${url}" alt="${ELEV_NAMES[which]} elevation of the house">
    <button class="mbtn" data-elev-save="${which}">Save this elevation</button>
    <button class="mbtn ghost" data-close>Close</button>`);
}
/* -------- AI photo: ask for a photograph of the design -------- */
// Inside the designer only. Nothing is generated here: the builder sends a clean
// 3D view and the exterior choices to the parent page, which files a request.
// A person makes the photograph; it then shows up under "Your AI photos".
let aiView = 'corner', aiTime = 'day', aiBusy = false, aiTimer = null;
let aiShot = null;      // the view that will be sent, as shown in the dialog
let aiItems = null;     // my requests, from the parent page (null = not loaded yet)
let aiNote = null;      // {ok, text} — the outcome of the last request
let aiListFailed = false;
// Where to stand for the picture that gets painted: outside the front, at about
// eye level, far enough to hold the whole house. `side` swings the camera round
// the corner (0 = straight on). Pure, so it is tested without a renderer.
function photoCamera(bb, front, floors, active, side, fovDeg, aspect){
  const [dx, dz] = {S:[0,1], N:[0,-1], E:[1,0], W:[-1,0]}[front] || [0,1];
  const rx = dz, rz = -dx;                                  // the viewer's right-hand side
  const y0 = groundY(active), h = (floors-1-active)*FLH() + C.H + 1 - y0;
  const vHalf = fovDeg*Math.PI/360, hHalf = Math.atan(Math.tan(vHalf)*aspect);
  const radius = Math.hypot(bb.w, bb.d)/2;
  const dist = Math.max(radius*1.2/Math.tan(hHalf), (h/2 + 1)/Math.tan(vHalf)) + radius*.35;
  const len = Math.hypot(1, side), vx = (dx + rx*side)/len, vz = (dz + rz*side)/len;
  return {pos:[bb.cx + vx*dist, y0 + 1.7 + h*.12, bb.cz + vz*dist], target:[bb.cx, y0 + h*.42, bb.cz]};
}
function shootPhotoBase(view){
  const W = 1280, H = 720;
  return withElevationScene(()=>{
    const cam = photoCamera(boundsOf(state.floors.flatMap(f=>f.blocks)), frontSide(), state.floors.length, state.floor,
      view==='front' ? .16 : .8, camera.fov, W/H);
    const aspect = camera.aspect, fog = scene.fog, near = fog?.near, far = fog?.far;
    if(fog){ fog.near = 500; fog.far = 1000; }             // a big house must not fade into the haze
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    camera.aspect = W/H; camera.updateProjectionMatrix();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    try{ shoot3D(cam.pos, cam.target, false, src=>c.getContext('2d').drawImage(src, 0, 0, W, H)); }
    finally{
      camera.aspect = aspect; camera.updateProjectionMatrix();
      if(fog){ fog.near = near; fog.far = far; }
    }
    return c.toDataURL('image/jpeg', .9);
  });
}
const aiSeg = (name, cur, opts)=>`<span class="unitseg" role="group" aria-label="${name}">${opts.map(([k,n])=>
  `<button type="button" data-ai-${name}="${k}" aria-pressed="${k===cur}" style="min-width:76px">${n}</button>`).join('')}</span>`;
const AI_STATUS = {pending:'Being made', done:'Ready', rejected:'Could not be made'};
const AI_IMAGE_URL = /^\/api\/ai-photos\/[0-9a-f-]{36}\/image(\?v=[0-9a-f]{1,32})?$/;
// Only what the dialog needs, and only in the shapes it expects: this list comes
// over postMessage and its text goes into innerHTML (escaped below).
function cleanAiItems(items){
  if(!Array.isArray(items)) return [];
  return items.filter(it=>it && typeof it === 'object' && AI_STATUS[it.status]).slice(0, 20).map(it=>({
    status: it.status,
    designName: typeof it.designName === 'string' ? it.designName.slice(0, 80) : '',
    createdAt: typeof it.createdAt === 'string' ? it.createdAt : '',
    note: typeof it.note === 'string' ? it.note.slice(0, 300) : '',
    image: typeof it.image === 'string' && AI_IMAGE_URL.test(it.image) ? it.image : null,
  }));
}
function aiListHTML(){
  if(aiListFailed) return '<p class="hint">Could not load your photos right now. Close this and open it again in a minute.</p>';
  if(aiItems === null) return '<p class="hint">Loading your photos…</p>';
  if(!aiItems.length) return '<p class="hint">You have not asked for a photo yet.</p>';
  return aiItems.map(it=>{
    const day = it.createdAt ? new Date(it.createdAt) : null;
    const asked = day && !isNaN(day) ? ' · asked ' + day.toLocaleDateString() : '';
    const name = escapeMarkup(it.designName || 'Your design');
    return `<div class="airesult">
      ${it.image ? `<a href="${it.image}" target="_blank" rel="noopener"><img src="${it.image}" alt="AI photo of ${name}" loading="lazy"></a>`
                 : `<span class="aiwait${it.status==='rejected' ? ' aino' : ''}" aria-hidden="true"></span>`}
      <span><span class="nm">${name}</span>
        <span class="sb">${AI_STATUS[it.status]}${asked}${it.note ? '. ' + escapeMarkup(it.note) : ''}</span>
        ${it.image ? `<a class="ailink" href="${it.image}${it.image.includes('?') ? '&' : '?'}download=1" download>Save photo</a>` : ''}</span>
    </div>`;
  }).join('');
}
const aiDialogOpen = ()=>$('#dim').classList.contains('show') && !!modal.querySelector('[data-ai-go]');
function showAiPhoto(reshoot = true){
  if(reshoot || !aiShot) aiShot = shootPhotoBase(aiView);
  showModal(`<h3>AI photo of your home</h3>
    <p class="hint">Ask for a photograph of this design with your wall and roof choices. If the design is pinned on the map, the photo is set in that area. Our team makes each photo by hand, so it arrives here later, usually within a day.</p>
    <div class="airow"><span>View</span>${aiSeg('view', aiView, [['corner','Corner'],['front','Front']])}</div>
    <div class="airow"><span>Light</span>${aiSeg('time', aiTime, [['day','Day'],['evening','Evening']])}</div>
    <img class="elev-img" src="${aiShot}" alt="The view of the house that will be painted">
    ${aiNote ? `<p class="hint" role="${aiNote.ok ? 'status' : 'alert'}" style="color:${aiNote.ok ? '#547548' : '#ad4a31'};font-weight:700">${escapeMarkup(aiNote.text)}</p>` : ''}
    <button class="mbtn" data-ai-go${aiBusy ? ' disabled' : ''}>${aiBusy ? 'Sending…' : 'Request this photo'}</button>
    <h3 style="margin-top:22px;font-size:15px">Your AI photos</h3>
    <div id="aiList">${aiListHTML()}</div>
    <button class="mbtn ghost" data-close>Close</button>
    <p class="hint" style="margin-top:12px">An AI impression. It follows your design, but small details can differ. Not a construction drawing.</p>`);
}
function openAiPhoto(){
  aiNote = null; aiListFailed = false;
  showAiPhoto(true);
  parent.postMessage({type:'archit:ai-list'}, location.origin);
}
function requestAiPhoto(){
  if(aiBusy || !aiShot) return;
  aiBusy = true; aiNote = null;
  showAiPhoto(false);
  parent.postMessage({type:'archit:ai-request', payload:{image:aiShot, time:aiTime, floors:state.floors.length,
    style:{facade:state.facade, facadeMat:state.facadeMat, roofStyle:state.roofStyle, roofCol:state.roofCol}}}, location.origin);
  // never leave the button stuck if the page never answers
  clearTimeout(aiTimer);
  aiTimer = setTimeout(()=>{
    // it may still go through: say so, and look for it rather than inviting a duplicate
    aiRequested({ok:false, error:'This is taking long. If it went through, it will appear under Your AI photos.'});
    parent.postMessage({type:'archit:ai-list'}, location.origin);
  }, 45000);
}
function aiRequested(r){
  // a success that lands after the timeout gave up: just show it in the list
  if(!aiBusy){ if(r?.ok) parent.postMessage({type:'archit:ai-list'}, location.origin); return; }
  aiBusy = false; clearTimeout(aiTimer);
  aiNote = r?.ok ? {ok:true, text:'Request sent. Your photo will appear below when it is ready.'}
                 : {ok:false, text: typeof r?.error === 'string' && r.error ? r.error.slice(0, 200) : 'Could not send your request. Try again.'};
  // a dialog the user already closed stays closed
  if(aiDialogOpen()) showAiPhoto(false);
  else toast(r?.ok ? 'AI photo requested' : aiNote.text);
  if(r?.ok) parent.postMessage({type:'archit:ai-list'}, location.origin);
}
function aiListed(items, failed){
  aiListFailed = failed === true;
  aiItems = aiListFailed ? aiItems : cleanAiItems(items);
  const el = modal.querySelector('#aiList');
  if(el) el.innerHTML = aiListHTML();
}
window.addEventListener('message', e=>{
  if(e.origin !== location.origin || e.source !== parent) return;
  if(e.data?.type === 'archit:ai-requested') aiRequested(e.data.payload);
  else if(e.data?.type === 'archit:ai-photos') aiListed(e.data.payload?.items, e.data.payload?.error);
});
// Report data for the whole house: every floor, not just the active one.
function reportFloors(floors){
  return floors.map((f,fi)=>({fi, label: fi===0 ? 'Ground floor' : 'Floor '+(fi+1), blocks:f.blocks}));
}
function designSheet(){
  const win = window.open('', '_blank');
  if(!win){ toast('Allow pop-ups to open the design sheet'); return; }
  const bb = boundsOf(state.floors.flatMap(f=>f.blocks)), R = Math.max(bb.w, bb.d)*1.15 + 5;
  const hero  = shoot3D([bb.cx+R*.85, R*.7,  bb.cz+R*.85], [bb.cx, .6, bb.cz], false);
  const front = shoot3D([bb.cx,       R*.45, bb.cz+R*1.15],[bb.cx, 1,  bb.cz], false);
  const back  = shoot3D([bb.cx,       R*.45, bb.cz-R*1.15],[bb.cx, 1,  bb.cz], false);
  const top   = shoot3D([bb.cx+.01,   R*1.5, bb.cz],       [bb.cx, 0,  bb.cz], true);
  const plan  = planSVGDoc(planShot(), 'style="width:100%;height:auto"');
  const vastu = vastuReport(state.floors), est = costEstimate(state.floors, state.cost);
  const sides = elevationSides(frontSide());
  const elevs = withElevationScene(()=>Object.entries(ELEV_NAMES).map(([k,n])=>[n, shootElevation(sides[k], n+' elevation')]));
  const tot = houseTotals(state.floors), multi = state.floors.length>1;
  let roomCards = '';
  reportFloors(state.floors).forEach(fl=>{
   if(multi) roomCards += `<h2 class="flh">${fl.label}</h2>`;
   fl.blocks.forEach((b,i)=>{
    const spec = C.rooms[b.type], [w,d] = footprint(b);
    const rr = Math.max(w,d)*1.05 + 2.2;
    const dy = (fl.fi - state.floor)*FLH();   // scene keeps the active floor at y=0
    const shot = shoot3D([b.cx+rr*.8, dy+rr*.95, b.cz+rr*.8], [b.cx, dy+.5, b.cz], true);
    const wallN = b.paint ? C.paint[b.paint].name : C.paint[state.paint].name+' (house default)';
    const floorN = b.floorCol ? C.floorCol[b.floorCol].name : 'Room default';
    const doors = b.doors.map(x=>C.doors[x.type].name+' '+fmtOpening(x.w, x.h)).join(', ') || '—';
    const wins = b.windows.length ? b.windows.map(x=>{ const sp = winSpec(x); return winKinds()[sp.kind].name.split(' (')[0]+' '+fmtOpening(sp.fw, sp.fh); }).join(', ') : '—';
    const furn = b.furniture.map(f=>C.furniture[f.key].name).join(', ') || '—';
    roomCards += `<div class="card room">
      <img src="${shot}" alt="">
      <div class="rb"><h3>${i+1}. ${escapeMarkup(b.name || spec.name)}</h3><table>
        <tr><td>Size</td><td>${fmtSize(w, d)} — ${fmtArea(b.w*b.len)}</td></tr>
        <tr><td>Walls</td><td>${wallN}</td></tr>
        <tr><td>Floor</td><td>${floorN}</td></tr>
        <tr><td>Doors</td><td>${doors}</td></tr>
        <tr><td>Windows</td><td>${wins}</td></tr>
        <tr><td>Furniture</td><td>${furn}</td></tr>
      </table></div></div>`;
   });
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>ArchIt — Design Sheet</title><style>
    body{font-family:'Manrope',system-ui,sans-serif;color:#29372c;margin:0;background:#eeeee5}
    .wrap{max-width:1000px;margin:0 auto;padding:28px}
    h1{font-size:26px;margin:0 0 4px} h2{font-size:17px;margin:26px 0 10px} h3{font-size:15px;margin:0 0 8px}
    .meta{color:#5d665b;font-size:13px;margin-bottom:18px}
    .card{background:#f8f7f2;border-radius:6px;box-shadow:0 4px 14px rgba(41,55,44,.08);overflow:hidden}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .grid img,.card>img{width:100%;display:block}
    .cap{font-size:12px;font-weight:700;color:#5d665b;padding:8px 12px}
    .summary table,.room table{border-collapse:collapse;width:100%;font-size:13px}
    .summary td,.room td{padding:5px 10px;border-bottom:1px solid #e4e6dc;vertical-align:top}
    .summary td:first-child,.room td:first-child{color:#5d665b;font-weight:700;width:110px;white-space:nowrap}
    .summary{padding:14px}
    .flh{grid-column:1/-1;margin:8px 0 0}.rooms{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .room .rb{padding:12px 14px}
    .plan{padding:10px}
    .printbtn{position:fixed;right:18px;top:18px;background:#ad4a31;color:#f8f7f2;border:0;border-radius:5px;padding:10px 20px;font-weight:800;font-size:14px;cursor:pointer}
    @media print{.printbtn{display:none}body{background:#fff}.card{box-shadow:none;border:1px solid #d8dcd2}.rooms{grid-template-columns:1fr 1fr}.room{break-inside:avoid}}
  </style></head><body>
  <button class="printbtn">Print / PDF</button>
  <div class="wrap">
    <h1>ArchIt — Design Sheet</h1>
    <div class="meta">${new Date().toLocaleDateString()} — ${tot.rooms} rooms — ${fmtArea(tot.area)} total</div>
    <div class="card summary"><table>
      <tr><td>Facade</td><td>${C.facade[state.facade].name}, ${C.facadeMat[state.facadeMat].name}</td></tr>
      <tr><td>Roof</td><td>${C.roofStyle[state.roofStyle].name}, ${C.roofCol[state.roofCol].name}</td></tr>
      <tr><td>Interior</td><td>${C.paint[state.paint].name} walls</td></tr>
      <tr><td>Total area</td><td>${fmtArea(tot.area)} across ${tot.rooms} rooms${multi ? ' on '+state.floors.length+' floors' : ''}</td></tr>
    </table></div>
    <h2>3D previews</h2>
    <div class="card"><img src="${hero}"><div class="cap">Overview</div></div>
    <div class="grid" style="margin-top:14px">
      <div class="card"><img src="${front}"><div class="cap">Front</div></div>
      <div class="card"><img src="${back}"><div class="cap">Back</div></div>
      <div class="card"><img src="${top}"><div class="cap">Top (walls transparent)</div></div>
      <div class="card"><div class="plan">${plan}</div><div class="cap">2D floor plan</div></div>
    </div>
    <h2>Elevations</h2>
    <div class="grid">${elevs.map(([n,src])=>`<div class="card"><img src="${src}" alt="${n} elevation"><div class="cap">${n} elevation</div></div>`).join('')}</div>
    <h2>Cost estimate</h2>
    <div class="card summary"><table>
      <tr><td>Estimate</td><td><b>${fmtINR(est.total)}</b> (${fmtINR(est.low)} – ${fmtINR(est.high)})</td></tr>
      <tr><td>Basis</td><td>${Math.round(est.sqft).toLocaleString('en-IN')} sq ft built-up × ₹${est.rate.toLocaleString('en-IN')} / sq ft — ${costTiers()[est.tier].name} finish</td></tr>
      ${est.budget == null ? '' : `<tr><td>Budget</td><td>${fmtINR(est.budget)} — ${est.diff >= 0 ? fmtINR(est.diff)+' to spare' : 'over by '+fmtINR(-est.diff)}</td></tr>`}
      <tr><td>Materials</td><td>${est.materials.map(m=>m.name+' '+fmtQty(m.qty, m.unit)).join(' · ')}</td></tr>
      <tr><td>Note</td><td>Building work and finishes only, from thumb rules. Land, approvals, fees, compound wall and furniture are extra.</td></tr>
    </table></div>
    ${vastu && vastu.items.length ? `<h2>Vastu guide — ${vastu.score}% match</h2>
    <div class="card summary"><table>${vastu.items.map(x=>
      `<tr><td>${escapeMarkup(x.name)}</td><td>${{good:'Good', ok:'Fine', avoid:'Avoid'}[x.verdict]} · ${x.whereText}${x.tip ? '. '+x.tip : ''}</td></tr>`).join('')}
    </table></div>` : ''}
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
  if(VIEW) return;
  showModal(`
    <h3>Save &amp; export</h3>
    <p class="hint">Save images, a full design sheet, or the project file to continue later on any device.</p>
    <button class="mbtn" data-export="sheet">Design sheet — all previews</button>
    ${EMBED ? '<button class="mbtn" data-export="aiphoto" style="background:#7a5a12">AI photo of your home</button>' : ''}
    <button class="mbtn" data-export="elev" style="background:#3f5a47">Front elevation &amp; side views</button>
    <button class="mbtn" data-export="3d" style="background:#ad4a31">Save 3D image</button>
    <button class="mbtn" data-export="2d" style="background:#293c31">Save 2D plan</button>
    <button class="mbtn" data-export="savep" style="background:#29372c">Save project (.json)</button>
    <button class="mbtn" data-export="share" style="background:#547548">Copy share link</button>
    <button class="mbtn ghost" data-export="openp">Open project…</button>
    <button class="mbtn ghost" data-close>Cancel</button>`);
});
modal.addEventListener('click', e=>{
  if(VIEW) return;
  const aiPick = e.target.closest('[data-ai-view], [data-ai-time]');
  if(aiPick){
    if(aiBusy) return;
    const view = aiPick.dataset.aiView;
    if(view) aiView = view; else aiTime = aiPick.dataset.aiTime;
    showAiPhoto(!!view);            // a new view needs a new picture; the light does not
    // the dialog was rebuilt: put keyboard focus back on the choice just made
    modal.querySelector(view ? `[data-ai-view="${aiView}"]` : `[data-ai-time="${aiTime}"]`)?.focus();
    return;
  }
  if(e.target.closest('[data-ai-go]')){ requestAiPhoto(); modal.querySelector('[data-ai-go]')?.focus(); return; }
  const tab = e.target.closest('[data-elev]');
  if(tab){ showElevations(tab.dataset.elev); return; }
  const sv = e.target.closest('[data-elev-save]');
  if(sv){
    const a = document.createElement('a');
    a.href = modal.querySelector('.elev-img').src; a.download = `archit-${sv.dataset.elevSave}-elevation.png`; a.click();
    return;
  }
  const ex = e.target.closest('[data-export]');
  if(!ex) return;
  hideModal();
  if(ex.dataset.export==='aiphoto') openAiPhoto();
  else if(ex.dataset.export==='elev') showElevations('front');
  else if(ex.dataset.export==='3d') save3D();
  else if(ex.dataset.export==='2d') save2D();
  else if(ex.dataset.export==='savep') saveProjectFile();
  else if(ex.dataset.export==='openp') openProjectFile();
  else if(ex.dataset.export==='share') shareLink();
  else designSheet();
});

export {snapshotBlob};
