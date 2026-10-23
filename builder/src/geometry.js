import {footprint, localToWorld, state, wallLen, wallPoint} from './state.js';
import {C} from './catalog.js';

/* ============================== summary ============================== */
/**
 * Does this specific window open into a neighbouring room?
 *
 * sharedWall() answers "is this wall shared ANYWHERE along its length", which is
 * too coarse for a window: a long wall can abut a small room over part of its run
 * and still face outdoors where the window actually sits. Checking the wall alone
 * reported spurious issues on correctly-authored plans, so this tests whether the
 * window's own position falls inside the shared span.
 */
function windowFacesNeighbour(b, w){
  const wall = Number(w.wall);
  const [ax, az] = localToWorld(b, ...wallPoint(b, wall, 0));
  const [bx, bz] = localToWorld(b, ...wallPoint(b, wall, 1));
  const [wx, wz] = localToWorld(b, ...wallPoint(b, wall, Number(w.t)));
  const horiz = Math.abs(az-bz) < Math.abs(ax-bx);
  for(const o of state.blocks){
    // open rooms (veranda, balcony) are outdoors: a window onto one is fine
    if(o.id === b.id || C.rooms[o.type]?.open) continue;
    for(let w2=0; w2<4; w2++){
      const [cx, cz] = localToWorld(o, ...wallPoint(o, w2, 0));
      const [dx, dz] = localToWorld(o, ...wallPoint(o, w2, 1));
      if(horiz !== (Math.abs(cz-dz) < Math.abs(cx-dx))) continue;
      if(horiz){
        if(Math.abs(az-cz) > 0.25) continue;
        const lo = Math.max(Math.min(ax,bx), Math.min(cx,dx));
        const hi = Math.min(Math.max(ax,bx), Math.max(cx,dx));
        if(hi-lo >= 0.7 && wx >= lo-0.01 && wx <= hi+0.01) return o;
      } else {
        if(Math.abs(ax-cx) > 0.25) continue;
        const lo = Math.max(Math.min(az,bz), Math.min(cz,dz));
        const hi = Math.min(Math.max(az,bz), Math.max(cz,dz));
        if(hi-lo >= 0.7 && wz >= lo-0.01 && wz <= hi+0.01) return o;
      }
    }
  }
  return null;
}
function designIssues(){
  const iss = [];
  state.blocks.forEach((b,i)=>{
    const nm = (b.name || C.rooms[b.type].name) + ' ' + (i+1);
    if(!C.rooms[b.type].open && !b.doors.length) iss.push(nm + ': no door');
    b.windows.forEach(w=>{
      const into = windowFacesNeighbour(b, w);
      if(into) iss.push(nm + ': window opens into ' + (into.name || C.rooms[into.type].name));
    });
  });
  return iss;
}
function boundsOf(blocks){
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  blocks.forEach(b=>{const [w,d]=footprint(b);
    x0=Math.min(x0,b.cx-w/2); x1=Math.max(x1,b.cx+w/2);
    z0=Math.min(z0,b.cz-d/2); z1=Math.max(z1,b.cz+d/2);});
  return {x0,x1,z0,z1,w:x1-x0,d:z1-z0,cx:(x0+x1)/2,cz:(z0+z1)/2};
}
function overlaps(cx,cz,w,d, skipId){
  return state.blocks.some(b=>{
    if(b.id===skipId) return false;
    const [bw,bd]=footprint(b);
    return Math.abs(b.cx-cx) < (bw+w)/2-0.05 && Math.abs(b.cz-cz) < (bd+d)/2-0.05;
  });
}
function sharedWall(b, wall){
  const [ax, az] = localToWorld(b, ...wallPoint(b, wall, 0));
  const [bx, bz] = localToWorld(b, ...wallPoint(b, wall, 1));
  const horiz = Math.abs(az-bz) < Math.abs(ax-bx);   // wall runs along x?
  for(const o of state.blocks){
    if(o.id===b.id) continue;
    for(let w2=0; w2<4; w2++){
      const [cx, cz] = localToWorld(o, ...wallPoint(o, w2, 0));
      const [dx, dz] = localToWorld(o, ...wallPoint(o, w2, 1));
      const horiz2 = Math.abs(cz-dz) < Math.abs(cx-dx);
      if(horiz!==horiz2) continue;
      if(horiz){
        if(Math.abs(az-cz) > 0.25) continue;
        const lo = Math.max(Math.min(ax,bx), Math.min(cx,dx));
        const hi = Math.min(Math.max(ax,bx), Math.max(cx,dx));
        if(hi-lo >= 0.7) return o;
      } else {
        if(Math.abs(ax-cx) > 0.25) continue;
        const lo = Math.max(Math.min(az,bz), Math.min(cz,dz));
        const hi = Math.min(Math.max(az,bz), Math.max(cz,dz));
        if(hi-lo >= 0.7) return o;
      }
    }
  }
  return null;
}
// world-space endpoints of a wall's centre line, plus which axis it runs along
function wallSegWorld(b, wall){
  const [ax, az] = localToWorld(b, ...wallPoint(b, wall, 0));
  const [bx, bz] = localToWorld(b, ...wallPoint(b, wall, 1));
  return {ax, az, bx, bz, horiz: Math.abs(az-bz) < Math.abs(ax-bx)};
}
// Every other room's wall that is collinear with and overlaps b's `wall`.
// lo/hi are in b's wall u-coordinate (metres from t=0). sharedWall() answers
// "is anything there"; this answers "what, and over which span" — which is what
// party-wall de-duplication and opening transfer need.
function wallNeighbors(b, wall){
  const s = wallSegWorld(b, wall), L = wallLen(b, wall), hits = [];
  if(L <= 0) return hits;
  const ux = (s.bx-s.ax)/L, uz = (s.bz-s.az)/L;
  for(const o of state.blocks){
    if(o.id===b.id) continue;
    for(let w2=0; w2<4; w2++){
      const q = wallSegWorld(o, w2);
      if(q.horiz !== s.horiz) continue;
      if((s.horiz ? Math.abs(s.az-q.az) : Math.abs(s.ax-q.ax)) > 0.25) continue;
      const p0 = (q.ax-s.ax)*ux + (q.az-s.az)*uz;
      const p1 = (q.bx-s.ax)*ux + (q.bz-s.az)*uz;
      const lo = Math.max(0, Math.min(p0,p1)), hi = Math.min(L, Math.max(p0,p1));
      if(hi-lo < 0.7) continue;
      hits.push({other:o, w2, lo, hi});
    }
  }
  return hits;
}
// the hole a window needs in the wall it sits on (matches the meshes at buildBlockGroup)
function winDims(w){
  if(w.kind==='pano'){
    const gh = C.H - .25;
    return {w:2.3, y0:.06, y1:.14 + gh};
  }
  return {w:1.3, y0:1.02, y1:2.08};
}
// Openings to subtract from b's `wall`, merged and clamped. Includes the far
// room's openings when this is a party wall, so a de-duplicated wall still lets
// the neighbour's doorway through.
function wallOpenings(b, wall){
  const L = wallLen(b, wall), s = wallSegWorld(b, wall), ops = [];
  const add = (uc, ow, y0, y1)=>{
    const lo = Math.max(0, uc-ow/2), hi = Math.min(L, uc+ow/2);
    if(hi-lo > .05) ops.push({u0:lo, u1:hi, y0:Math.max(0,y0), y1:Math.min(C.H,y1)});
  };
  const doorOf = d=>add(Number(d.t)*L, (d.w||.8)+.04, 0, (d.h||2)+.06);
  b.doors.forEach(d=>{ if(Number(d.wall)===wall) doorOf(d); });
  b.windows.forEach(w=>{ if(Number(w.wall)===wall){ const k = winDims(w); add(Number(w.t)*L, k.w, k.y0, k.y1); } });
  wallNeighbors(b, wall).forEach(({other:o, w2})=>{
    const mapU = t=>{
      const [wx, wz] = localToWorld(o, ...wallPoint(o, w2, Number(t)));
      return ((wx-s.ax)*(s.bx-s.ax) + (wz-s.az)*(s.bz-s.az)) / L;
    };
    o.doors.forEach(d=>{ if(Number(d.wall)===w2) add(mapU(d.t), (d.w||.8)+.04, 0, (d.h||2)+.06); });
    o.windows.forEach(w=>{ if(Number(w.wall)===w2){ const k = winDims(w); add(mapU(w.t), k.w, k.y0, k.y1); } });
  });
  ops.sort((a,c)=>a.u0-c.u0);
  const merged = [];
  ops.forEach(op=>{
    const last = merged[merged.length-1];
    if(last && op.u0 <= last.u1 + .02){
      last.u1 = Math.max(last.u1, op.u1);
      last.y0 = Math.min(last.y0, op.y0); last.y1 = Math.max(last.y1, op.y1);
    } else merged.push({...op});
  });
  // avoid paper-thin slivers of wall above/below an opening
  merged.forEach(op=>{ if(op.y1 > C.H-.18) op.y1 = C.H; if(op.y0 < .16) op.y0 = 0; });
  return merged;
}
function freeT(list, wallL, need=1.0){
  for(const t of [0.5,0.3,0.7,0.2,0.8,0.4,0.6]){
    if(!list.some(o=>Math.abs(o.t-t)*wallL < need)) return t;
  }
  return 0.5;
}
function tint(hex, k){        // mix hex toward white by k (0..1)
  const n = parseInt(hex.slice(1),16), r=n>>16, g=(n>>8)&255, b=n&255;
  const m = c=>Math.round(c+(255-c)*k).toString(16).padStart(2,'0');
  return '#'+m(r)+m(g)+m(b);
}
function clampFurn(b, f){
  const s = C.furniture[f.key];
  const [fw, fd] = f.rot%2 ? [s.d, s.w] : [s.w, s.d];
  const mx = b.len/2 - .14 - fw/2, mz = b.w/2 - .14 - fd/2;
  if(mx < 0 || mz < 0) return false;
  f.lx = Math.max(-mx, Math.min(mx, f.lx));
  f.lz = Math.max(-mz, Math.min(mz, f.lz));
  return true;
}

/* ---------- one roof per building (Phase 3) ----------
   Roofs used to be built inside buildBlockGroup, so an 11-room house rendered 11
   separate roofs and read as a pile of boxes. These build ONE roof per connected
   group of top-floor blocks, from the union footprint. */

// world-aligned AABB of a block, optionally inflated by an eaves overhang
function blockRect(b, pad=0){
  const [w,d] = footprint(b);
  return {x0:b.cx-w/2-pad, x1:b.cx+w/2+pad, z0:b.cz-d/2-pad, z1:b.cz+d/2+pad};
}
// Rooms up to this far apart still count as one building. Several stock templates
// leave 0.3-0.6 m slack between rooms; a genuinely detached veranda sits >2 m off.
const ROOF_GAP = 1.2;
function roofAdjacent(a, b){
  const ox = Math.min(a.x1,b.x1) - Math.max(a.x0,b.x0);
  const oz = Math.min(a.z1,b.z1) - Math.max(a.z0,b.z0);
  if(ox >= -.02 && oz >= -.02) return true;              // abutting or overlapping
  if(ox > .5 && oz >= -ROOF_GAP) return true;            // stacked in z across a small gap
  if(oz > .5 && ox >= -ROOF_GAP) return true;            // side by side in x
  return false;
}
// the slice of roof that closes the gap between two nearby-but-not-touching rooms
function bridgeRect(a, b){
  const xLo = Math.max(a.x0,b.x0), xHi = Math.min(a.x1,b.x1);
  const zLo = Math.max(a.z0,b.z0), zHi = Math.min(a.z1,b.z1);
  if(xHi-xLo > .5 && zHi < zLo && zLo-zHi <= ROOF_GAP) return {x0:xLo, x1:xHi, z0:zHi, z1:zLo};
  if(zHi-zLo > .5 && xHi < xLo && xLo-xHi <= ROOF_GAP) return {x0:xHi, x1:xLo, z0:zLo, z1:zHi};
  return null;
}
// Group blocks that belong to the same building. A detached veranda across a real
// gap stays its own component, so it never gets a giant roof spanning the gap.
function roofComponents(blocks){
  const r = blocks.map(b=>blockRect(b, 0));
  const parent = r.map((_,i)=>i);
  const find = i=>{ while(parent[i]!==i){ parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for(let i=0;i<r.length;i++) for(let j=i+1;j<r.length;j++)
    if(roofAdjacent(r[i], r[j])) parent[find(i)] = find(j);
  const byRoot = new Map();
  blocks.forEach((b,i)=>{ const k = find(i); if(!byRoot.has(k)) byRoot.set(k, []); byRoot.get(k).push(b); });
  return [...byRoot.values()];
}
// footprint rects for the roof union: every block plus the gap-closing bridges,
// all inflated by the style's eaves overhang
function roofRects(blocks, ov){
  const raw = blocks.map(b=>blockRect(b, 0));
  const out = raw.map(r=>({x0:r.x0-ov, x1:r.x1+ov, z0:r.z0-ov, z1:r.z1+ov}));
  for(let i=0;i<raw.length;i++) for(let j=i+1;j<raw.length;j++){
    const br = bridgeRect(raw[i], raw[j]);
    if(br) out.push({x0:br.x0-ov, x1:br.x1+ov, z0:br.z0-ov, z1:br.z1+ov});
  }
  return out;
}
// Rectilinear union of axis-aligned rects, traced as closed loops in world x/z.
// Positive signed area = outer contour, negative = hole (courtyard plans).
function unionLoops(rects){
  if(!rects.length) return [];
  const xs = [...new Set(rects.flatMap(r=>[r.x0,r.x1]))].sort((a,b)=>a-b);
  const zs = [...new Set(rects.flatMap(r=>[r.z0,r.z1]))].sort((a,b)=>a-b);
  const nx = xs.length-1, nz = zs.length-1;
  const grid = [];
  for(let i=0;i<nx;i++){
    grid[i] = [];
    for(let j=0;j<nz;j++){
      const mx = (xs[i]+xs[i+1])/2, mz = (zs[j]+zs[j+1])/2;
      grid[i][j] = rects.some(r=>mx>r.x0 && mx<r.x1 && mz>r.z0 && mz<r.z1);
    }
  }
  // directed boundary edges, covered area always on the left => outer loops run CCW
  const key = (x,z)=>x.toFixed(4)+','+z.toFixed(4);
  const edges = new Map();
  const link = (a,b)=>{ const k = key(a[0],a[1]); if(!edges.has(k)) edges.set(k, []); edges.get(k).push(b); };
  for(let i=0;i<nx;i++) for(let j=0;j<nz;j++){
    if(!grid[i][j]) continue;
    const x0=xs[i], x1=xs[i+1], z0=zs[j], z1=zs[j+1];
    if(!(j>0 && grid[i][j-1]))    link([x0,z0],[x1,z0]);
    if(!(i<nx-1 && grid[i+1][j])) link([x1,z0],[x1,z1]);
    if(!(j<nz-1 && grid[i][j+1])) link([x1,z1],[x0,z1]);
    if(!(i>0 && grid[i-1][j]))    link([x0,z1],[x0,z0]);
  }
  const loops = [];
  let guard = 0;
  while(edges.size && guard++ < 5000){
    const start = edges.keys().next().value;
    let cur = start; const loop = [];
    for(let n=0; n<20000 && edges.has(cur); n++){
      const list = edges.get(cur), nxt = list.pop();
      if(!list.length) edges.delete(cur);
      loop.push(cur.split(',').map(Number));
      cur = key(nxt[0], nxt[1]);
      if(cur === start) break;
    }
    if(loop.length >= 4) loops.push(dropCollinear(loop));
  }
  return loops;
}
// grid tracing emits a vertex per cell edge; earcut is happier without them
function dropCollinear(loop){
  const out = [];
  for(let i=0;i<loop.length;i++){
    const p = loop[(i-1+loop.length)%loop.length], c = loop[i], n = loop[(i+1)%loop.length];
    const cross = (c[0]-p[0])*(n[1]-c[1]) - (c[1]-p[1])*(n[0]-c[0]);
    if(Math.abs(cross) > 1e-9) out.push(c);
  }
  return out.length >= 3 ? out : loop;
}
function loopArea(l){
  let a = 0;
  for(let i=0;i<l.length;i++){ const [x1,z1] = l[i], [x2,z2] = l[(i+1)%l.length]; a += x1*z2 - x2*z1; }
  return a/2;
}
function pointInLoop(pt, loop){
  let inside = false;
  for(let i=0,j=loop.length-1; i<loop.length; j=i++){
    const [xi,zi] = loop[i], [xj,zj] = loop[j];
    if((zi>pt[1]) !== (zj>pt[1]) && pt[0] < (xj-xi)*(pt[1]-zi)/(zj-zi)+xi) inside = !inside;
  }
  return inside;
}
const FLH = () => C.H + .12;   // floor-to-floor height

/* -------- snapping -------- */
function snapBlock(b, cx, cz){
  const [w,d] = footprint(b);
  let sx = Math.round(cx*4)/4, sz = Math.round(cz*4)/4;   // 0.25 m grid
  let bx = 0.3, bz = 0.3;                                  // neighbour snap radius
  state.blocks.forEach(o=>{
    if(o.id===b.id) return;
    const [ow,od] = footprint(o);
    [o.cx+(ow+w)/2+0.02, o.cx-(ow+w)/2-0.02, o.cx, o.cx+(ow-w)/2, o.cx-(ow-w)/2].forEach(c=>{
      if(Math.abs(c-cx)<bx){ bx = Math.abs(c-cx); sx = c; }
    });
    [o.cz+(od+d)/2+0.02, o.cz-(od+d)/2-0.02, o.cz, o.cz+(od-d)/2, o.cz-(od-d)/2].forEach(c=>{
      if(Math.abs(c-cz)<bz){ bz = Math.abs(c-cz); sz = c; }
    });
  });
  return [sx, sz];
}
// nearest wall + position along it, from a point in block-local coords
function nearestWallT(b, lx, lz, margin){
  const cand = [
    {wall:0, dist:Math.abs(lz-b.w/2),   t:(lx/b.len)+.5},
    {wall:2, dist:Math.abs(lz+b.w/2),   t:.5-(lx/b.len)},
    {wall:1, dist:Math.abs(lx-b.len/2), t:.5-(lz/b.w)},
    {wall:3, dist:Math.abs(lx+b.len/2), t:(lz/b.w)+.5},
  ].sort((p,q)=>p.dist-q.dist)[0];
  const L = wallLen(b, cand.wall), m = (margin/2+0.08)/L;
  cand.t = Math.min(1-m, Math.max(m, cand.t));
  return cand;
}
function worldToLocal(b, wx, wz){
  const a = b.rot*Math.PI/2;
  return [ (wx-b.cx)*Math.cos(a) - (wz-b.cz)*Math.sin(a),
           (wx-b.cx)*Math.sin(a) + (wz-b.cz)*Math.cos(a) ];
}

function resolveWalk(prevX, prevZ, nextX, nextZ, radius, rects) {
  if (!rects || rects.length === 0) {
    return { x: nextX, z: nextZ };
  }
  var r = radius > 0 ? radius : 0;
  var r2 = r * r;
  var EPS = 1e-9;   // a perpendicular gap within this of r counts as clear (kills tangent re-detection)
  var SNAP = 1e-6;  // only clamp at an edge the start is essentially touching

  // Keep the 1-D move start->target out of the open forbidden interval (lo,hi).
  // Directional: only the edge being approached can block, and only when the
  // start sits on (or within SNAP of) the safe side of that edge. A start that
  // is genuinely deep inside a wide interval slides -- the other axis governs it.
  function clamp1D(start, target, lo, hi) {
    if (target > start) {                         // moving toward +; the low edge blocks
      if (start <= lo + SNAP && target > lo) return lo;
      return target;
    }
    if (target < start) {                         // moving toward -; the high edge blocks
      if (start >= hi - SNAP && target < hi) return hi;
      return target;
    }
    return start;
  }

  // Resolve motion along one axis. `movingX` selects the moving axis; `fix` is
  // the frozen other-axis coordinate. Clamps the moving coordinate against every
  // rect whose circle would be entered, sliding along the rest.
  function resolveAxis(start, target, fix, list, movingX) {
    if (target === start) return start;
    var out = target;
    for (var i = 0; i < list.length; i++) {
      var rect = list[i];
      var movLo, movHi, fixLo, fixHi;
      if (movingX) { movLo = rect.x0; movHi = rect.x1; fixLo = rect.z0; fixHi = rect.z1; }
      else         { movLo = rect.z0; movHi = rect.z1; fixLo = rect.x0; fixHi = rect.x1; }
      // Perpendicular gap between the frozen coordinate and the rect's span.
      var gap = fix < fixLo ? fixLo - fix : (fix > fixHi ? fix - fixHi : 0);
      if (gap >= r - EPS) continue;               // too far (or merely tangent) to collide
      var reach = Math.sqrt(r2 - gap * gap);      // half-width the circle projects onto the moving axis
      out = clamp1D(start, out, movLo - reach, movHi + reach);
    }
    return out;
  }

  // Axis-separated: resolve X at z = prevZ, then Z at the resolved X.
  var rx = resolveAxis(prevX, nextX, prevZ, rects, true);
  var rz = resolveAxis(prevZ, nextZ, rx, rects, false);
  return { x: rx, z: rz };
}

export {FLH, boundsOf, clampFurn, designIssues, freeT, loopArea, nearestWallT, overlaps, pointInLoop, resolveWalk, roofComponents, roofRects, sharedWall, snapBlock, tint, unionLoops, wallNeighbors, wallOpenings, wallSegWorld, worldToLocal};
