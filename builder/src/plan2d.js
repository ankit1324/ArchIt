import './walk.js';
import {C} from './catalog.js';
import {$, VIEW, chips, escapeMarkup, ov, round1, stage, toast} from './dom.js';
import {commit, footprint, getBlock, localToWorld, redoStack, sel, selBlock, setDirty, setSel, snapshot, state, ui, undoStack, wallDir, wallLen, wallPoint} from './state.js';
import {boundsOf, clampFurn, nearestWallT, overlaps, refitFurniture, sharedWall, snapBlock, tint, worldToLocal} from './geometry.js';
import {addRoomAt, computeHotspots, hotspots} from './interact3d.js';
import {renderAll, renderSelection} from './ui.js';
import {placeFurniture} from './tools.js';

/* ============================== 2D plan ============================== */
const planSvg = $('#plan');
let S = 54;                 // px per metre (2D zoom changes it)
function fitPlan(){
  if(!state?.blocks.length) return;
  const bb = boundsOf(state.blocks), r = stage.getBoundingClientRect();
  S = Math.max(8, Math.min(70, (r.width-150)/Math.max(bb.w,1), (r.height-180)/Math.max(bb.d,1)));
  if(ui.view==='2d') render2D();
}
$('#fitPlan').addEventListener('click', fitPlan);
function P(x,z,ox,oy){ return [ox + x*S, oy + z*S]; }
let drag2 = null, justDragged2 = false, planOff = {ox:0, oy:0};
function render2D(){
  if(ui.view!=='2d'){ return; }
  const r = stage.getBoundingClientRect();
  const focus = ui.interior ? getBlock(ui.focusRoomId) : null;   // interior mode: single-room plan
  const blks = focus ? [focus] : state.blocks;
  const bb = blks.length ? boundsOf(blks) : {cx:0,cz:0};
  let ox = r.width/2 - bb.cx*S, oy = r.height/2 - bb.cz*S;
  if(drag2){ ox = drag2.ox; oy = drag2.oy; }        // freeze origin while dragging
  planOff = {ox, oy};
  let s = `<defs>
    <pattern id="g1" width="${S}" height="${S}" patternUnits="userSpaceOnUse">
      <path d="M ${S} 0 L 0 0 0 ${S}" fill="none" stroke="#e4e6dc" stroke-width="1"/>
    </pattern>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#29372c" flood-opacity="0.14"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#f8f7f2"/>
  <rect width="100%" height="100%" fill="url(#g1)"/>`;

  // ghost outline of the floor below, for aligning walls and stairs
  if(!focus && state.floor>0){
    state.floors[state.floor-1].blocks.forEach(b=>{
      const [w,d] = footprint(b);
      const [gx,gy] = P(b.cx-w/2, b.cz-d/2, ox, oy);
      s += `<rect x="${gx}" y="${gy}" width="${w*S}" height="${d*S}" fill="#d8dcd2" fill-opacity=".4"
        stroke="#a1a99b" stroke-width="2" stroke-dasharray="6 5"/>`;
    });
  }

  blks.forEach(b=>{ s += blockSvg(b, ox, oy); });
  planSvg.innerHTML = s;

  // hotspots (+) around blocks — html overlay (hidden in interior focus mode)
  ov.querySelectorAll('.hs').forEach(e=>e.remove());
  if(!focus && !VIEW){
  computeHotspots();
  hotspots.filter(h=>state.blocks.length===1 || (sel?.kind==='block' && h.blockId===sel.blockId)).forEach(h=>{
    const b = getBlock(h.blockId); const [w,d]=footprint(b);
    const [px,py] = P(b.cx + h.sx*(w/2+0.62), b.cz + h.sz*(d/2+0.62), ox, oy);
    const el = document.createElement('button');
    el.className='hs';
    el.style.left = px+'px'; el.style.top = py+'px';
    el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12h14"/></svg>';
    el.addEventListener('click', e=>{ e.stopPropagation(); addRoomAt(h.blockId, h.sx, h.sz); });
    ov.appendChild(el);
  });
  }
  // chips above selected block
  const b = selBlock();
  if(b && (sel.kind==='block' || sel.kind==='furn')){
    const [w,d] = footprint(b);
    const [px,py] = P(b.cx, b.cz-d/2, ox, oy);
    chips.style.display='flex'; chips.style.left=px+'px'; chips.style.top=(py-58)+'px';
  } else chips.style.display='none';

  planSvg.onclick = ()=>{ if(justDragged2) return; setSel(null); renderSelection(); };
}

// One room's plan: floor, walls, openings, furniture, label and (when selected)
// its resize handles — everything that moves with it, in one <g class="blk">.
function blockSvg(b, ox, oy){
  const seld = sel && sel.blockId===b.id && sel.kind==='block';
  const col = seld ? '#ad4a31' : '#29372c';
  const [w,d] = footprint(b);
  const spec = C.rooms[b.type];
  const [x0,y0] = P(b.cx-w/2, b.cz-d/2, ox,oy);
  const W2 = w*S, D2 = d*S;
  let s = `<g class="blk" data-id="${b.id}" style="cursor:pointer">`;
  s += `<rect x="${x0}" y="${y0}" width="${W2}" height="${D2}" fill="${b.floorCol ? tint(C.floorCol[b.floorCol].hex, .45) : spec.fill}"${drag2 ? '' : ' filter="url(#soft)"'}/>`;
  // walls with door gaps
  s += wallLines2D(b, ox, oy, col);
  // windows
  b.windows.forEach(wd=>{
    const seg = openSeg2D(b, wd.wall, wd.t, wd.kind==='pano' ? 2.2 : 1.2, ox, oy);
    s += `<g data-win="${wd.id}" data-blk="${b.id}" style="cursor:grab">
          <line x1="${seg[0]}" y1="${seg[1]}" x2="${seg[2]}" y2="${seg[3]}" stroke="#b8c6c4" stroke-width="7" stroke-linecap="butt"/>
          <line x1="${seg[0]}" y1="${seg[1]}" x2="${seg[2]}" y2="${seg[3]}" stroke="#f8f7f2" stroke-width="2.5"/>
          <line x1="${seg[0]}" y1="${seg[1]}" x2="${seg[2]}" y2="${seg[3]}" stroke="transparent" stroke-width="16"/>
          </g>`;
  });
  // partitions
  b.partitions.forEach(p=>{
    const [ax,az] = localToWorld(b,(p.t-.5)*b.len,-b.w/2+0.05);
    const [bx,bz] = localToWorld(b,(p.t-.5)*b.len, b.w/2-0.05);
    const [px1,py1]=P(ax,az,ox,oy),[px2,py2]=P(bx,bz,ox,oy);
    s += `<g data-part="${p.id}" data-blk="${b.id}" style="cursor:grab">
          <line x1="${px1}" y1="${py1}" x2="${px2}" y2="${py2}" stroke="${col}" stroke-width="2.5"/>
          <line x1="${px1}" y1="${py1}" x2="${px2}" y2="${py2}" stroke="transparent" stroke-width="16"/>
          </g>`;
  });
  // furniture symbols
  b.furniture.forEach(f=>{
    const s2 = C.furniture[f.key];
    const [fw, fd] = f.rot%2 ? [s2.d, s2.w] : [s2.w, s2.d];
    const pts = [[-fw/2,-fd/2],[fw/2,-fd/2],[fw/2,fd/2],[-fw/2,fd/2]].map(([px,pz])=>{
      const [ax,az] = localToWorld(b, f.lx+px, f.lz+pz);
      return P(ax, az, ox, oy).join(',');
    }).join(' ');
    const selF = sel && sel.kind==='furn' && sel.furnId===f.id;
    s += `<g data-furn="${f.id}" data-blk="${b.id}" style="cursor:grab">
      <polygon points="${pts}" fill="rgba(248,247,242,.55)" stroke="${selF?'#ad4a31':'#5d665b'}" stroke-width="1.6"/>
      </g>`;
  });
  // doors (gap + swing)
  b.doors.forEach(dd=>{ s += door2D(b, dd, ox, oy, sel&&sel.kind==='door'&&sel.doorId===dd.id ? '#ad4a31' : col); });
  // Quiet, bounded labels keep the plan readable at whole-house zoom.
  const [ncx,ncy] = P(b.cx, b.cz, ox, oy);
  const fullName = b.name || spec.name;
  const labelSize = Math.min(12, Math.max(8, W2/12));
  const maxChars = Math.max(4, Math.floor((W2-12)/(labelSize*.65)));
  const label = fullName.length>maxChars ? fullName.slice(0,maxChars-1)+'…' : fullName;
  const showDims = W2>85 && D2>55;
  s += `<g pointer-events="none"><title>${escapeMarkup(fullName)}</title>
    <rect x="${x0+5}" y="${ncy-12}" width="${Math.max(0,W2-10)}" height="${showDims?34:23}" rx="4" fill="#f8f7f2" fill-opacity=".82"/>
    <text x="${ncx}" y="${ncy+3}" text-anchor="middle" style="font-size:${labelSize}px;font-weight:700;fill:#29372c">${escapeMarkup(label)}</text>`;
  if(showDims) s += `<text x="${ncx}" y="${ncy+17}" text-anchor="middle" style="font-size:10px;fill:#5d665b">${round1(b.len)} × ${round1(b.w)} m</text>`;
  s += '</g>';
  if(seld){
    // side dimension pills + corner handles
    s += chip2D(x0+W2/2-24, y0-9, `${round1(b.rot%2? b.w : b.len)} m`, '#ad4a31');
    s += chip2D(x0-14, y0+D2/2-9, `${round1(b.rot%2? b.len : b.w)} m`, '#ad4a31', true);
    [[x0,y0,-1,-1],[x0+W2,y0,1,-1],[x0,y0+D2,-1,1],[x0+W2,y0+D2,1,1],
     [x0+W2/2,y0,0,-1],[x0+W2/2,y0+D2,0,1],[x0,y0+D2/2,-1,0],[x0+W2,y0+D2/2,1,0]].forEach(([hx,hy,sx,sz])=>{
      const cur = sx&&sz ? (sx*sz>0?'nwse-resize':'nesw-resize') : (sx?'ew-resize':'ns-resize');
      s += `<g data-hdl data-sx="${sx}" data-sz="${sz}" data-blk="${b.id}" style="cursor:${cur}">
        <rect x="${hx-11}" y="${hy-11}" width="22" height="22" fill="transparent"/>
        <rect x="${hx-4}" y="${hy-4}" width="8" height="8" rx="2" fill="#f8f7f2" stroke="#ad4a31" stroke-width="2"/></g>`;
    });
  }
  return s + `</g>`;
}
// Swap just this room's <g> for a fresh one. Dragging a door, window, partition,
// piece of furniture or a resize handle changes one room, so pointermove redraws
// that room instead of re-serialising the whole plan.
function redrawBlock2D(b){
  const old = planSvg.querySelector(`.blk[data-id="${b.id}"]`);
  if(!old){ render2D(); return; }
  old.insertAdjacentHTML('afterend', blockSvg(b, planOff.ox, planOff.oy));
  old.remove();
}

/* -------- 2D dragging -------- */
planSvg.addEventListener('pointerdown', e=>{
  // placing a door or a piece of furniture: the click handler takes the tap
  if(VIEW || !state || ui.tool==='door-place' || ui.tool==='furn-place') return;
  const hg = e.target.closest('[data-hdl]');
  const dg = e.target.closest('[data-door]');
  const wg = e.target.closest('[data-win]');
  const pg = e.target.closest('[data-part]');
  const fg2 = e.target.closest('[data-furn]');
  const bg = e.target.closest('.blk');
  const {ox, oy} = planOff;
  const r = stage.getBoundingClientRect();
  if(hg){
    const b = getBlock(+hg.dataset.blk);
    const [w,d] = footprint(b);
    drag2 = {kind:'resize', b, sx:+hg.dataset.sx, sz:+hg.dataset.sz,
      L0:b.cx-w/2, R0:b.cx+w/2, T0:b.cz-d/2, B0:b.cz+d/2,
      cx0:b.cx, cz0:b.cz, len0:b.len, w0:b.w,
      ox, oy, snap:snapshot(), moved:false};
  } else if(dg){
    const b = getBlock(+dg.dataset.blk);
    const d = b.doors.find(x=>x.id===+dg.dataset.door);
    drag2 = {kind:'door', b, o:d, ox, oy, snap:snapshot(), moved:false, w0:d.wall, t0:d.t};
  } else if(wg){
    const b = getBlock(+wg.dataset.blk);
    const o = b.windows.find(x=>x.id===+wg.dataset.win);
    drag2 = {kind:'win', b, o, ox, oy, snap:snapshot(), moved:false, w0:o.wall, t0:o.t};
  } else if(pg){
    const b = getBlock(+pg.dataset.blk);
    const o = b.partitions.find(x=>x.id===+pg.dataset.part);
    drag2 = {kind:'part', b, o, ox, oy, snap:snapshot(), moved:false, t0:o.t};
  } else if(fg2){
    const b = getBlock(+fg2.dataset.blk);
    const o = b.furniture.find(x=>x.id===+fg2.dataset.furn);
    drag2 = {kind:'furn', b, o, ox, oy, snap:snapshot(), moved:false, x0f:o.lx, z0f:o.lz};
  } else if(bg){
    const b = getBlock(+bg.dataset.id);
    const wx = (e.clientX-r.left-ox)/S, wz = (e.clientY-r.top-oy)/S;
    drag2 = {kind:'block', b, offX:wx-b.cx, offZ:wz-b.cz, sx:b.cx, sz:b.cz, ox, oy, snap:snapshot(), moved:false};
  }
  if(drag2){
    drag2.x0 = e.clientX; drag2.y0 = e.clientY;
    planSvg.setPointerCapture(e.pointerId);
  }
});
planSvg.addEventListener('pointermove', e=>{
  if(VIEW || !drag2) return;
  const dx = e.clientX-drag2.x0, dy = e.clientY-drag2.y0;
  if(!drag2.moved && dx*dx+dy*dy < 16) return;
  if(!drag2.moved){
    // hotspots and chips are placed for the old layout: hide them until drop
    ov.style.visibility = 'hidden'; chips.style.display = 'none';
    drag2.el = planSvg.querySelector(`.blk[data-id="${drag2.b.id}"]`);
    drag2.el?.querySelector('rect')?.removeAttribute('filter');
  }
  drag2.moved = true;
  const r = stage.getBoundingClientRect();
  const wx = (e.clientX-r.left-drag2.ox)/S, wz = (e.clientY-r.top-drag2.oy)/S;
  if(drag2.kind==='block'){
    const b = drag2.b;
    const [cx,cz] = snapBlock(b, wx-drag2.offX, wz-drag2.offZ);
    b.cx = cx; b.cz = cz;
    // a move is rigid: shift the room's existing <g> instead of redrawing it
    drag2.el?.setAttribute('transform', `translate(${(cx-drag2.sx)*S} ${(cz-drag2.sz)*S})`);
    return;
  } else if(drag2.kind==='resize'){
    const b = drag2.b, mn = C.roomMin, mx = C.roomMax;
    let L = drag2.L0, R = drag2.R0, T = drag2.T0, B = drag2.B0;
    if(drag2.sx<0) L = Math.min(R-mn, Math.max(R-mx, wx));
    if(drag2.sx>0) R = Math.max(L+mn, Math.min(L+mx, wx));
    if(drag2.sz<0) T = Math.min(B-mn, Math.max(B-mx, wz));
    if(drag2.sz>0) B = Math.max(T+mn, Math.min(T+mx, wz));
    const rw = Math.round((R-L)*10)/10, rd = Math.round((B-T)*10)/10;  // snap 0.1 m
    if(drag2.sx<0) L = R-rw; else R = L+rw;
    if(drag2.sz<0) T = B-rd; else B = T+rd;
    b.cx = (L+R)/2; b.cz = (T+B)/2;
    if(b.rot%2){ b.w = rw; b.len = rd; } else { b.len = rw; b.w = rd; }
  } else if(drag2.kind==='part'){
    const b = drag2.b;
    const [lx] = worldToLocal(b, wx, wz);
    drag2.o.t = Math.min(.92, Math.max(.08, lx/b.len + .5));
  } else if(drag2.kind==='furn'){
    const b = drag2.b, o = drag2.o;
    const [lx, lz] = worldToLocal(b, wx, wz);
    o.lx = lx; o.lz = lz; clampFurn(b, o);
  } else {
    const b = drag2.b, o = drag2.o;
    const [lx,lz] = worldToLocal(b, wx, wz);
    const cand = nearestWallT(b, lx, lz, drag2.kind==='door' ? o.w : 1.2);
    o.wall = cand.wall; o.t = cand.t;
  }
  redrawBlock2D(drag2.b);
});
planSvg.addEventListener('pointercancel', ()=>{ if(drag2){ drag2 = null; ov.style.visibility = ''; renderAll(); } });
planSvg.addEventListener('pointerup', ()=>{
  if(VIEW || !drag2) return;
  const d2 = drag2;
  drag2 = null;
  if(!d2.moved){
    // pointer capture retargets the click to the svg root, so the per-element
    // click handlers never fire — select here instead
    justDragged2 = true; setTimeout(()=>justDragged2 = false, 0);
    if(d2.kind==='door') setSel({kind:'door', blockId:d2.b.id, doorId:d2.o.id});
    else if(d2.kind==='win') setSel({kind:'window', blockId:d2.b.id, winId:d2.o.id});
    else if(d2.kind==='furn') setSel({kind:'furn', blockId:d2.b.id, furnId:d2.o.id});
    else setSel({kind:'block', blockId:d2.b.id});
    renderSelection();
    return;
  }
  if(d2.moved){
    justDragged2 = true; setTimeout(()=>justDragged2 = false, 0);
    ov.style.visibility = '';
    let changed = true;
    if(d2.kind==='block'){
      const [w,d] = footprint(d2.b);
      if(overlaps(d2.b.cx, d2.b.cz, w, d, d2.b.id)){
        d2.b.cx = d2.sx; d2.b.cz = d2.sz;
        toast('Rooms can’t overlap');
        changed = false;
      } else changed = (d2.b.cx!==d2.sx || d2.b.cz!==d2.sz);
    } else if(d2.kind==='resize'){
      const b = d2.b, [w,d] = footprint(b);
      if(overlaps(b.cx, b.cz, w, d, b.id)){
        b.cx = d2.cx0; b.cz = d2.cz0; b.len = d2.len0; b.w = d2.w0;
        toast('Rooms can’t overlap');
        changed = false;
      } else {
        changed = b.len!==d2.len0 || b.w!==d2.w0 || b.cx!==d2.cx0 || b.cz!==d2.cz0;
        if(changed) refitFurniture(b);   // a shrunk room keeps its furniture inside
      }
    } else if(d2.kind==='part'){
      changed = Math.abs(d2.o.t-d2.t0) > 0.004;
    } else if(d2.kind==='furn'){
      changed = d2.o.lx!==d2.x0f || d2.o.lz!==d2.z0f;
    } else {
      changed = d2.o.wall!==d2.w0 || Math.abs(d2.o.t-d2.t0) > 0.004;
    }
    if(changed && d2.kind==='door'){
      const nowShared = !!sharedWall(d2.b, d2.o.wall);
      const wasExt = d2.o.type.startsWith('ext');
      if(nowShared && wasExt) d2.o.type = 'int_hard';
      if(!nowShared && !wasExt) d2.o.type = 'ext_hard';
    }
    if(changed){ undoStack.push(d2.snap); redoStack.length = 0; setDirty(true); }
    renderAll();
  }
});
function chip2D(x,y,label,color,vert){
  const w = label.length*6.4+18;
  const t = vert ? ` transform="rotate(-90 ${x} ${y})"` : '';
  return `<g${t}><rect x="${x-(vert?w/2:0)}" y="${y}" width="${w}" height="18" rx="9" fill="${color}"/>
    <text class="dimchip" x="${x-(vert?w/2:0)+w/2}" y="${y+12.5}" text-anchor="middle">${label}</text></g>`;
}
function openSeg2D(b, wall, t, len, ox, oy){
  const L = wallLen(b,wall), dir = wallDir(wall);
  const [cx,cz] = wallPoint(b, wall, t);
  const h = len/2;
  const [ax,az] = localToWorld(b, cx-dir[0]*h, cz-dir[1]*h);
  const [bx,bz] = localToWorld(b, cx+dir[0]*h, cz+dir[1]*h);
  const [x1,y1] = P(ax,az,ox,oy), [x2,y2] = P(bx,bz,ox,oy);
  return [x1,y1,x2,y2];
}
function wallLines2D(b, ox, oy, col){
  let out = '';
  for(let wall=0; wall<4; wall++){
    const L = wallLen(b, wall);
    // collect gaps (doors) on this wall
    const gaps = b.doors.filter(d=>d.wall===wall)
      .map(d=>[Math.max(0,d.t-(d.w/2)/L), Math.min(1,d.t+(d.w/2)/L)])
      .sort((a,b2)=>a[0]-b2[0]);
    let segs = [], cur = 0;
    gaps.forEach(([g0,g1])=>{ if(g0>cur) segs.push([cur,g0]); cur = Math.max(cur,g1); });
    if(cur<1) segs.push([cur,1]);
    segs.forEach(([t0,t1])=>{
      const dir = wallDir(wall);
      const [sx,sz] = wallPoint(b, wall, t0), [ex,ez] = wallPoint(b, wall, t1);
      const [wx1,wz1] = localToWorld(b, sx, sz), [wx2,wz2] = localToWorld(b, ex, ez);
      const [x1,y1] = P(wx1,wz1,ox,oy), [x2,y2] = P(wx2,wz2,ox,oy);
      out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="3.5" stroke-linecap="square"/>`;
    });
  }
  return out;
}
function door2D(b, d, ox, oy, col){
  const L = wallLen(b, d.wall), dir = wallDir(d.wall);
  const [cx,cz] = wallPoint(b, d.wall, d.t);
  const hw = d.w/2;
  // hinge at one end of the gap (d.flip mirrors it), leaf swings inward (d.out reverses)
  const hs = d.flip ? 1 : -1;
  const hingeL = [cx + dir[0]*hw*hs, cz + dir[1]*hw*hs];
  let inward = d.wall===0 ? [0,-1] : d.wall===2 ? [0,1] : d.wall===1 ? [-1,0] : [1,0];
  if(d.out) inward = [-inward[0], -inward[1]];
  const tip = [hingeL[0] + inward[0]*d.w, hingeL[1] + inward[1]*d.w];
  const [h1x,h1z] = localToWorld(b, hingeL[0], hingeL[1]);
  const [t1x,t1z] = localToWorld(b, tip[0], tip[1]);
  const [e1x,e1z] = localToWorld(b, cx-dir[0]*hw*hs, cz-dir[1]*hw*hs);
  const [px1,py1] = P(h1x,h1z,ox,oy), [px2,py2] = P(t1x,t1z,ox,oy), [px3,py3] = P(e1x,e1z,ox,oy);
  return `<g data-door="${d.id}" data-blk="${b.id}" style="cursor:grab">
    <line x1="${px1}" y1="${py1}" x2="${px2}" y2="${py2}" stroke="${col}" stroke-width="2.5"/>
    <path d="M ${px2} ${py2} A ${d.w*S} ${d.w*S} 0 0 ${arcSweep(px1,py1,px2,py2,px3,py3)} ${px3} ${py3}" fill="none" stroke="${col}" stroke-width="1.4" stroke-dasharray="1 4"/>
    <line x1="${px1}" y1="${py1}" x2="${px3}" y2="${py3}" stroke="transparent" stroke-width="18"/>
    <circle cx="${(px1+px3)/2}" cy="${(py1+py3)/2}" r="12" fill="transparent"/>
  </g>`;
}
function arcSweep(hx,hy,tx,ty,ex,ey){
  const cross = (tx-hx)*(ey-hy)-(ty-hy)*(ex-hx);
  return cross>0 ? 1 : 0;
}
planSvg.addEventListener('click', e=>{
  if(VIEW || justDragged2) return;
  if(ui.tool==='furn-place'){
    const bg = e.target.closest('.blk');
    e.stopImmediatePropagation();
    if(!bg){ toast('Tap inside a room'); return; }
    const b = getBlock(+bg.dataset.id), r = stage.getBoundingClientRect();
    placeFurniture(b, ...worldToLocal(b, (e.clientX-r.left-planOff.ox)/S, (e.clientY-r.top-planOff.oy)/S));
    return;
  }
  const dg = e.target.closest('[data-door]');
  if(dg){ e.stopPropagation(); setSel({kind:'door', blockId:+dg.dataset.blk, doorId:+dg.dataset.door}); renderSelection(); return; }
  const fg = e.target.closest('[data-furn]');
  if(fg){ e.stopPropagation(); setSel({kind:'furn', blockId:+fg.dataset.blk, furnId:+fg.dataset.furn}); renderSelection(); return; }
  const wg = e.target.closest('[data-win]');
  if(wg){ e.stopPropagation(); setSel({kind:'window', blockId:+wg.dataset.blk, winId:+wg.dataset.win}); renderSelection(); return; }
  // room body — delegated here instead of re-binding every .blk on each render2D
  const bg = e.target.closest('.blk');
  if(bg){
    e.stopPropagation();
    const id = +bg.dataset.id;
    if(ui.tool==='door-place'){ placeDoorByClick(id, e); return; }
    setSel({kind:'block', blockId:id});
    renderSelection();
  }
}, true);

function placeDoorByClick(blockId, e){
  if(VIEW) return;
  const b = getBlock(blockId);
  const r = stage.getBoundingClientRect();
  // the origin render2D actually drew with: in Interior mode the plan is centred
  // on the focused room, not on the whole house, so recomputing it from all
  // rooms put the door on the wrong wall
  const wx = (e.clientX-r.left-planOff.ox)/S, wz = (e.clientY-r.top-planOff.oy)/S;
  const [lx, lz] = worldToLocal(b, wx, wz);
  // nearest wall
  const cand = [
    {wall:0, dist:Math.abs(lz-b.w/2), t:(lx/b.len)+.5},
    {wall:2, dist:Math.abs(lz+b.w/2), t:.5-(lx/b.len)},
    {wall:1, dist:Math.abs(lx-b.len/2), t:.5-(lz/b.w)},
    {wall:3, dist:Math.abs(lx+b.len/2), t:(lz/b.w)+.5},
  ].sort((p,q)=>p.dist-q.dist)[0];
  const t = Math.min(.88, Math.max(.12, cand.t));
  commit(()=>{
    const type = sharedWall(b, cand.wall) ? 'int_hard' : (ui.pendingDoorType||'ext_hard');
    const d = {id:++state.seq.door, wall:cand.wall, t, type,
      w: type==='ext_glass' ? 1.6 : 0.8, h:2.0, color:'blue'};
    b.doors.push(d);
    setSel({kind:'door', blockId:b.id, doorId:d.id});
    ui.tool = null;
  });
}

export function setPlanScale(v){ return S = v; }

export {S, fitPlan, planOff, planSvg, render2D};
