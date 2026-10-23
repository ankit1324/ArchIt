import * as THREE from 'three';
import {buildFurn} from './furniture.js';
import {C} from './catalog.js';
import {footprint, localToWorld, sel, selBlock, selDoor, selFurn, state, ui, wallLen, wallPoint} from './state.js';
import {FLH, boundsOf, loopArea, pointInLoop, roofComponents, roofRects, sharedWall, tint, unionLoops, wallNeighbors, wallOpenings} from './geometry.js';
import {beam, blocksRoot, fitShadows, requestRender, requestShadows, scene, selHandleMat, selLineMat, selOutline, setSelOutline} from './scene.js';
import {cachedMat, ceilMatCache, curbMat, doorFrameExtMat, doorFrameIntMat, doorGlassFrameMat, doorGlassMat, doorPanelExtMat, doorPanelIntMat, eavesMat, edgeMat, fasciaMat, fasciaSteelMat, handleMat, makeSurfaceTexture, mkFacadeMat, mkPaintMat, mkRevealMat, mkRoofMat, partMat, plantMat, skyFrameMat, skyGlassMat, slabMatCache, soffitMat, stepMat, trimMat, valleyMat, winFrameMat, winGlassMat} from './materials.js';
import {markOverlayDirty} from './interact3d.js';
import {BoxBatch} from './batch.js';

// where a door sits on its wall — shared by buildBlockGroup and the live 3D door drag
function doorPlacement(b, d){
  const [x,z] = wallPoint(b, d.wall, d.t);
  return {x, y:.06, z, rotY:(d.wall===0||d.wall===2) ? 0 : Math.PI/2};
}
// Everything buildBlockGroup reads from outside the block, in the room's own frame:
// per-wall thickness, party-wall de-duplication, the openings to cut (its own and a
// neighbour's on a shared wall) and whether each door sits on a shared wall. Being
// room-local, it is unchanged by moving or rotating the room as a whole.
function blockContext(b){
  const walls = (b.type==='balcony' ? [] : b.type==='veranda' ? [1,2,3] : [0,1,2,3]).map(wall=>{
    const wl = wallLen(b, wall);
    const nbs = wallNeighbors(b, wall);
    return {
      wall, wl,
      // honest thickness: exterior 23 cm, interior party wall 10 cm (was a flat 9 cm)
      wt: nbs.length ? 0.10 : 0.23,
      // build a party wall once, not twice — but only when the neighbour's wall spans
      // this one end to end, otherwise skipping would leave a real gap
      skip: nbs.some(n => n.other.id < b.id && n.lo <= 0.02 && n.hi >= wl-0.02),
      ops: wallOpenings(b, wall),
    };
  });
  return {walls, interior: b.doors.map(d=>!!sharedWall(b, d.wall))};
}
// A room's group is rebuilt only when this changes. Position, rotation and name
// are left out: they never change the room's own geometry (blockContext is local).
function blockSignature(b, ctx){
  const {cx, cz, rot, name, ...own} = b;
  return JSON.stringify([own, ctx, C.paint[b.paint || state.paint].hex, state.facade, state.facadeMat]);
}
function buildBlockGroup(b, ctx = blockContext(b)){
  const g = new THREE.Group();
  b.furniture = b.furniture || [];
  const spec = C.rooms[b.type] || C.rooms.bedroom;
  const L = b.len, W = b.w, H = C.H;
  const paintHex = C.paint[b.paint || state.paint].hex;

  // The shell — wall pieces, reveals, rails, posts and stair treads — goes into one
  // batched mesh with a draw call per material, not a mesh per box.
  const shell = new BoxBatch();
  // walls: box face order [+x,-x,+y,-y,+z,-z]; outward face gets the facade
  const OUT_FACE = {0:4, 2:5, 1:0, 3:1};
  // one paint material for every inward/hidden face in this room (cached by colour
  // and finish, so rooms sharing a paint share the material too). UVs are metres,
  // so the facade texture is the 1 m-repeat one.
  const paintMat = mkPaintMat(paintHex, b.wallMat);
  const facadeMat = mkFacadeMat(1, 1);
  const revealMat = mkRevealMat(paintHex);
  const wallMats = OUT => [0,1,2,3,4,5].map(f=>f===OUT ? facadeMat : paintMat);
  // place a box on `wall`: uc = offset along the wall from its centre, st = depth
  const placeWall = (wall, wt, uc, yc, su, sy, st, mat)=>{
    if(wall===0) shell.add( uc, yc,  W/2-wt/2, su, sy, st, mat);
    if(wall===2) shell.add(-uc, yc, -W/2+wt/2, su, sy, st, mat);
    if(wall===1) shell.add( L/2-wt/2, yc, -uc, st, sy, su, mat);
    if(wall===3) shell.add(-L/2+wt/2, yc,  uc, st, sy, su, mat);
  };
  ctx.walls.forEach(({wall, wl, wt, skip, ops})=>{
    if(skip) return;
    // segment the wall around its openings (same maths as wallLines2D) instead of
    // one solid box with the door pasted in front of it
    const pieces = [];
    let cur = 0;
    ops.forEach(op=>{
      if(op.u0 > cur + .02) pieces.push({u0:cur, u1:op.u0, y0:0, y1:H});        // pier
      if(op.y0 > .02)       pieces.push({u0:op.u0, u1:op.u1, y0:0, y1:op.y0});  // sill course
      if(op.y1 < H-.02)     pieces.push({u0:op.u0, u1:op.u1, y0:op.y1, y1:H});  // lintel
      cur = Math.max(cur, op.u1);
    });
    if(cur < wl-.02) pieces.push({u0:cur, u1:wl, y0:0, y1:H});
    const mats = wallMats(OUT_FACE[wall]);
    pieces.forEach(p=>{
      const su = p.u1-p.u0, sy = p.y1-p.y0;
      if(su <= .01 || sy <= .01) return;
      placeWall(wall, wt, (p.u0+p.u1)/2 - wl/2, (p.y0+p.y1)/2, su, sy, wt, mats);
    });
    // reveals — jambs, head and sill so the wall's depth reads through the opening
    ops.forEach(op=>{
      const ow = op.u1-op.u0, oh = op.y1-op.y0, mid = (op.u0+op.u1)/2 - wl/2;
      [op.u0+.02, op.u1-.02].forEach(u=>
        placeWall(wall, wt, u - wl/2, (op.y0+op.y1)/2, .04, oh, wt+.02, revealMat));
      if(op.y1 < H-.02) placeWall(wall, wt, mid, op.y1-.02, ow, .04, wt+.02, revealMat);
      if(op.y0 > .02)   placeWall(wall, wt, mid, op.y0+.025, ow+.06, .05, wt+.09, revealMat);
    });
  });

  // railing on open edges
  const addRail = wall=>{
    const wl = wallLen(b, wall), n = Math.max(2, Math.round(wl/0.45));
    for(let i=0;i<=n;i++){
      const o = (i/n-0.5)*(wl-0.1);
      const [px,pz] = wall%2 ? [(wall===1?L/2-.05:-L/2+.05), -o] : [o, (wall===0?W/2-.05:-W/2+.05)];
      shell.add(px,.62,pz, .05,.95,.05, trimMat);
    }
    if(wall%2) shell.add((wall===1?L/2-.05:-L/2+.05),1.12,0, .07,.06,wl-.04, trimMat);
    else       shell.add(0,1.12,(wall===0?W/2-.05:-W/2+.05), wl-.04,.06,.07, trimMat);
  };
  if(b.type==='balcony') [0,1,2,3].forEach(addRail);
  if(b.type==='veranda') addRail(0);

  if(b.type==='veranda'){
    [[-L/2+.06,-W/2+.06],[L/2-.06,-W/2+.06],[-L/2+.06,W/2-.06],[L/2-.06,W/2-.06]].forEach(([x,z])=>
      shell.add(x,H/2,z, .09,H,.09, trimMat));
  }

  // signature fixtures
  if(b.type==='stairs'){
    const n = 7, tread = (L-.15)/n, rise = (H-.35)/n;
    for(let i=0;i<n;i++) shell.add(-L/2+.08+tread*(i+.5), .14+rise*(i+1)/2, 0, tread, rise*(i+1), W-.2, stepMat);
  }
  const shellMesh = shell.toMesh();
  if(shellMesh){ shellMesh.castShadow = true; g.add(shellMesh); }

  // floor slab, coloured per room type; an optional material adds a tiled texture
  const floorHex = b.floorCol ? C.floorCol[b.floorCol].hex : spec.floor;
  const slabRx = Math.max(1, Math.round(L)), slabRy = Math.max(1, Math.round(W));
  const slabMat = cachedMat(slabMatCache, floorHex+'|'+(b.floorMat||'')+'|'+slabRx+'|'+slabRy, ()=>{
    const floorTex = b.floorMat ? makeSurfaceTexture(b.floorMat, floorHex, L, W) : null;
    return new THREE.MeshStandardMaterial({color: floorTex ? '#ffffff' : floorHex, map: floorTex,
      roughness: b.floorMat==='marble' ? .55 : b.floorMat==='tile' ? .6 : .9, envMapIntensity:.3});
  });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(L-.03,.08,W-.03), slabMat);
  slab.position.y = .1; g.add(slab);

  // ceiling — mirrors the floor slab at wall height. Open room types (balcony,
  // veranda) get none. Tagged roof:true so toggleRoofs()/interior view strips it
  // together with the roof, otherwise looking in from above shows a lid.
  if(!spec.open){
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(L-.03,.08,W-.03),
      cachedMat(ceilMatCache, paintHex, ()=>new THREE.MeshStandardMaterial({color:tint(paintHex,.4), roughness:.95, envMapIntensity:.2})));
    ceil.position.y = H-.04; ceil.receiveShadow = true;
    ceil.userData.roof = true; g.add(ceil);
  }

  // furniture
  b.furniture.forEach(f=>{
    const fg = buildFurn(f);
    fg.traverse(o=>{ o.userData.pick = {kind:'furn', blockId:b.id, furnId:f.id}; });
    g.add(fg);
  });

  // partitions
  b.partitions.forEach(p=>{
    const px = (p.t-.5)*L;
    const pm = new THREE.Mesh(new THREE.BoxGeometry(.06, H-.2, W-.15), partMat);
    pm.position.set(px, H/2, 0); g.add(pm);
  });
  // openings
  b.windows.forEach(w=>{
    const [x,z] = wallPoint(b, w.wall, w.t);
    const grp = new THREE.Group();
    const frameMat = winFrameMat, glassMat = winGlassMat;
    if(w.kind==='pano'){
      const gw = 2.2, gh = C.H - .25;
      const fr = new THREE.Mesh(new THREE.BoxGeometry(gw+.1, gh+.08, .1), frameMat);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(gw-.06, gh-.08, .04), glassMat);
      gl.position.z = .02;
      const mull = new THREE.Mesh(new THREE.BoxGeometry(.05, gh-.08, .06), frameMat);
      mull.position.set(0,0,.05);
      grp.add(fr, gl, mull);
      grp.position.set(x, .1 + gh/2, z);
    } else {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.3,1.06,.1), frameMat);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(1.16,.92,.04), glassMat);
      gl.position.z = .02;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(.05,.92,.06), frameMat);
      bar.position.set(.12,0,.05);
      grp.add(fr, gl, bar);
      grp.position.set(x,1.55,z);
    }
    grp.rotation.y = (w.wall===0||w.wall===2) ? 0 : Math.PI/2;
    grp.traverse(o=>{o.castShadow = true; o.userData.pick = {kind:'window', blockId:b.id, winId:w.id};});
    g.add(grp);
  });
  b.doors.forEach((d, i)=>{
    const pl = doorPlacement(b, d);
    const grp = new THREE.Group();
    const interior = ctx.interior[i];
    if(d.type==='ext_glass'){
      const fr = new THREE.Mesh(new THREE.BoxGeometry(d.w+.1, d.h+.06, .1), doorGlassFrameMat);
      fr.position.y = (d.h+.06)/2;
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(d.w/2-.04, d.h-.1, .03), doorGlassMat);
      p1.position.set(-d.w/4, d.h/2, .03);
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(d.w/2-.04, d.h-.1, .03), doorGlassMat);
      p2.position.set(d.w/4, d.h/2, -.03);
      grp.add(fr, p1, p2);
    } else {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(d.w+.14, d.h+.08, interior ? .08 : .12),
        interior ? doorFrameIntMat : doorFrameExtMat);
      fr.position.y = (d.h+.08)/2;
      const pn = new THREE.Mesh(new THREE.BoxGeometry(d.w, d.h, interior ? .05 : .07),
        interior ? doorPanelIntMat : doorPanelExtMat);
      pn.position.y = d.h/2; pn.position.z = .02;
      const hd = new THREE.Mesh(new THREE.BoxGeometry(.14,.035,.05), handleMat);
      hd.position.set(d.w/2-.13, d.h*.48, .07);
      grp.add(fr, pn, hd);
    }
    grp.position.set(pl.x, pl.y, pl.z);
    grp.rotation.y = pl.rotY;
    grp.userData.doorRoot = d.id;
    grp.traverse(o=>{o.castShadow = true; o.userData.pick = {kind:'door', blockId:b.id, doorId:d.id};});
    g.add(grp);
  });

  // room border — subtle outline so each room reads separately in 3D
  if(b.type!=='balcony'){
    const bh = H;         // wall height only — the roof is now one unified group
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(L+.03, bh, W+.03)), edgeMat);
    edge.position.y = bh/2;
    edge.raycast = ()=>{};   // lines must not swallow picking clicks
    g.add(edge);
  }

  g.position.set(b.cx, 0, b.cz);
  g.rotation.y = b.rot*Math.PI/2;
  g.traverse(o=>{ if(!o.userData.pick) o.userData.pick = {kind:'block', blockId:b.id}; });
  return g;
}
// Shape lives in XY; Y = -z so that a -PI/2 rotation about X puts the extrusion up
// and maps shape Y back onto world z (same convention as the neighbour extrusions).
function loopsToShapes(loops){
  const outers = loops.filter(l=>loopArea(l) > 0).sort((a,b)=>loopArea(b)-loopArea(a));
  const holes  = loops.filter(l=>loopArea(l) < 0);
  const toV = l=>l.map(([x,z])=>new THREE.Vector2(x, -z));
  return outers.map((o, i)=>{
    const sh = new THREE.Shape(toV(o));
    if(i===0) holes.forEach(h=>{ if(pointInLoop(h[0], o)) sh.holes.push(new THREE.Path(toV(h))); });
    return sh;
  });
}
// eaves / parapet / curb rail traced around the union perimeter
function loopTrim(g, loops, y, h, t, mat){
  loops.forEach(loop=>{
    for(let i=0;i<loop.length;i++){
      const [x1,z1] = loop[i], [x2,z2] = loop[(i+1)%loop.length];
      const len = Math.hypot(x2-x1, z2-z1);
      if(len < .02) continue;
      const alongX = Math.abs(z2-z1) < 1e-6;
      const m = new THREE.Mesh(alongX ? new THREE.BoxGeometry(len+t, h, t)
                                      : new THREE.BoxGeometry(t, h, len+t), mat);
      m.position.set((x1+x2)/2, y, (z1+z2)/2);
      m.castShadow = true; m.userData.roof = true; m.userData.pick = null; g.add(m);
    }
  });
}
const SLAB_ROOFS = {flat:.16, overhang:.7, parapet:.16, cantilever_flat:.72, green_roof:.22};
function buildRoofGroup(blocks){
  const g = new THREE.Group();
  const style = state.roofStyle;
  const roofHex = C.roofCol[state.roofCol].hex;
  const H = C.H;
  if(style in SLAB_ROOFS){
    const ov = SLAB_ROOFS[style];
    const thick = style==='cantilever_flat' ? .12 : style==='green_roof' ? .1 : .09;
    const loops = unionLoops(roofRects(blocks, ov));
    const roofMat = mkRoofMat(roofHex);
    loopsToShapes(loops).forEach(sh=>{
      const geo = new THREE.ExtrudeGeometry(sh, {depth:thick, bevelEnabled:false});
      geo.rotateX(-Math.PI/2);
      const m = new THREE.Mesh(geo, roofMat);
      m.position.y = H + .02;
      m.castShadow = true; m.receiveShadow = true;
      m.userData.roof = true; m.userData.pick = null; g.add(m);
    });
    if(style==='parapet'){
      loopTrim(g, loops, H+.2, .32, .07, roofMat);
    } else if(style==='cantilever_flat'){
      loopTrim(g, loops, H+.06, .16, .08, fasciaMat);
    } else if(style==='green_roof'){
      loopTrim(g, loops, H+.17, .2, .08, curbMat);
      const inner = unionLoops(roofRects(blocks, ov-.14));
      loopsToShapes(inner).forEach(sh=>{
        const geo = new THREE.ExtrudeGeometry(sh, {depth:.12, bevelEnabled:false});
        geo.rotateX(-Math.PI/2);
        const m = new THREE.Mesh(geo, plantMat);
        m.position.y = H + .11; m.castShadow = true;
        m.userData.roof = true; m.userData.pick = null; g.add(m);
      });
    } else {
      // eaves fascia so the slab edge reads as a built roof, not a floating plate
      loopTrim(g, loops, H+.02, .1, .05, eavesMat);
    }
    return g;
  }
  // pitched styles: ridge along the union's longer dimension. The ported code below
  // assumes the ridge runs along local +x, so rotate the whole roof when z is longer.
  const bb = boundsOf(blocks);
  const swap = bb.d > bb.w;
  const L = swap ? bb.d : bb.w, W = swap ? bb.w : bb.d;
  const sub = new THREE.Group();
  sub.position.set(bb.cx, 0, bb.cz);
  sub.rotation.y = swap ? Math.PI/2 : 0;
  buildPitchedRoof(sub, L, W, H);
  g.add(sub);
  return g;
}
// verbatim port of the per-room pitched-roof styles, now driven by the union bbox
function buildPitchedRoof(g, L, W, H){
  const roofHex = C.roofCol[state.roofCol].hex;
  const mkFacade = mkFacadeMat;
    const roofMat = mkRoofMat(roofHex);
    const addRoofEnds = profile=>{
      const geo = new THREE.ExtrudeGeometry(profile, {depth:.08, bevelEnabled:false});
      geo.translate(0,0,-.04);
      geo.rotateY(Math.PI/2);
      [-L/2,L/2].forEach((x,i)=>{
        const end = new THREE.Mesh(i ? geo.clone() : geo, mkFacade(W,H));
        end.position.set(x,H,0); end.castShadow = true; end.userData.roof = true; g.add(end);
      });
    };
    if(state.roofStyle==='gable' || state.roofStyle==='gabled'){
      const steep = state.roofStyle==='gabled';
      const ovh = steep ? .35 : .15;                    // eaves overhang
      const rise = steep ? Math.min(2.3, W*0.5) : Math.min(1.0, W*0.28);
      const half = W/2 + ovh;
      const sh = new THREE.Shape();
      sh.moveTo(-half, 0); sh.lineTo(half, 0); sh.lineTo(0, rise); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, {depth:L+ovh*2, bevelEnabled:false});
      geo.rotateY(Math.PI/2);
      const roof = new THREE.Mesh(geo, roofMat);
      roof.position.set(-(L+ovh*2)/2, H, 0);
      roof.castShadow = true; roof.userData.roof = true; g.add(roof);
      // Gable end walls. At room scale the open triangle was ~3 m wide and barely
      // read; spanning a whole building it is a metre-tall hole into the attic.
      addRoofEnds(sh);
      if(steep){
        // ridge cap
        const cap = beam(L+ovh*2+.04, .07, .16, 0, H+rise, 0, roofMat);
        cap.userData.roof = true; g.add(cap);
        // skylights, evenly spaced on the front (+z) slope
        const ang = Math.atan2(rise, half);
        const slope = Math.hypot(rise, half);
        const skyFrame = skyFrameMat, skyGlass = skyGlassMat;
        const n = Math.max(1, Math.min(3, Math.floor(L/2.4)));
        for(let i=0;i<n;i++){
          const sx = (i-(n-1)/2)*Math.max(1.5, L/(n+.5));
          const grp = new THREE.Group();
          const fr = new THREE.Mesh(new THREE.BoxGeometry(.82, .09, 1.14), skyFrame);
          const gl = new THREE.Mesh(new THREE.BoxGeometry(.7, .1, 1.0), skyGlass);
          grp.add(fr, gl);
          grp.rotation.x = ang;
          // centre of the slope, nudged outward along the slope normal
          const t = .5, nz = Math.sin(ang), ny = Math.cos(ang);
          grp.position.set(sx, H + rise*(1-t) + ny*.05, half*t + nz*.05);
          grp.traverse(o=>{ o.castShadow = true; o.userData.roof = true; });
          g.add(grp);
        }
      }
    } else if(state.roofStyle==='monoslope'){
      const ovh = .35;
      const rise = Math.min(2.4, Math.max(.55, W*.42));
      const half = W/2+ovh;
      const angle = Math.atan2(rise, W+ovh*2);
      const slope = Math.hypot(W+ovh*2, rise);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(L+ovh*2,.1,slope), roofMat);
      roof.rotation.x = angle; roof.position.y = H+rise/2+.04;
      roof.castShadow = true; roof.userData.roof = true; g.add(roof);
      const ends = new THREE.Shape();
      ends.moveTo(-half,0); ends.lineTo(half,0); ends.lineTo(half,rise); ends.closePath();
      addRoofEnds(ends);
      [-1,1].forEach(side=>{
        const fascia = beam(.08,.16,slope, side*(L/2+ovh-.04),H+rise/2+.04,0,fasciaSteelMat);
        fascia.rotation.x = angle; fascia.userData.roof = true; g.add(fascia);
      });
    } else if(state.roofStyle==='butterfly'){
      const ovh = .28, half = W/2+ovh;
      const rise = Math.min(1.55, Math.max(.45, W*.28));
      const angle = Math.atan2(rise, half);
      const slope = Math.hypot(half, rise);
      const ends = new THREE.Shape();
      ends.moveTo(-half,0); ends.lineTo(-half,rise); ends.lineTo(0,0);
      ends.lineTo(half,rise); ends.lineTo(half,0); ends.closePath();
      addRoofEnds(ends);
      [-1,1].forEach(side=>{
        const roof = new THREE.Mesh(new THREE.BoxGeometry(L+ovh*2,.1,slope), roofMat);
        roof.rotation.x = -side*angle;
        roof.position.set(0,H+rise/2+.04,side*half/2);
        roof.castShadow = true; roof.userData.roof = true; g.add(roof);
      });
      const valley = beam(L+ovh*2+.04,.08,.16,0,H+.05,0,valleyMat);
      valley.userData.roof = true; g.add(valley);
    } else if(state.roofStyle==='cantilever_flat'){
      const ovh = .72;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(L+ovh*2,.12,W+ovh*2), roofMat);
      roof.position.y = H+.04; roof.castShadow = true; roof.userData.roof = true; g.add(roof);
      [beam(L+ovh*2+.06,.16,.08,0,H+.04,W/2+ovh,fasciaMat),
       beam(.08,.16,W+ovh*2, L/2+ovh,H+.04,0,fasciaMat),
       beam(.08,.16,W+ovh*2,-L/2-ovh,H+.04,0,fasciaMat)].forEach(m=>{ m.userData.roof = true; g.add(m); });
      const soffit = beam(L+ovh*2-.28,.035,.055,0,H-.045,W/2+ovh-.12,soffitMat);
      soffit.userData.roof = true; g.add(soffit);
    } else if(state.roofStyle==='green_roof'){
      const ovh = .22;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(L+ovh*2,.1,W+ovh*2), roofMat);
      roof.position.y = H+.03; roof.castShadow = true; roof.userData.roof = true; g.add(roof);
      [beam(L+ovh*2,.2,.08,0,H+.15,W/2+ovh-.04,curbMat),
       beam(L+ovh*2,.2,.08,0,H+.15,-W/2-ovh+.04,curbMat),
       beam(.08,.2,W+ovh*2,L/2+ovh-.04,H+.15,0,curbMat),
       beam(.08,.2,W+ovh*2,-L/2-ovh+.04,H+.15,0,curbMat)].forEach(m=>{ m.userData.roof = true; g.add(m); });
      const planted = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.5,L-.28),.12,Math.max(.5,W-.28)), plantMat);
      planted.position.y = H+.16; planted.castShadow = true; planted.userData.roof = true; g.add(planted);
    } else {
      const ov = state.roofStyle==='overhang' ? .7 : .16;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(L+ov, .09, W+ov), roofMat);
      roof.position.y = H+.02; roof.castShadow = true; roof.userData.roof = true; g.add(roof);
      if(state.roofStyle==='parapet'){
        const pm = roofMat;
        [beam(L+.16,.32,.07, 0,H+.2,  W/2+.045, pm),
         beam(L+.16,.32,.07, 0,H+.2, -W/2-.045, pm),
         beam(.07,.32,W+.16,  L/2+.045,H+.2, 0, pm),
         beam(.07,.32,W+.16, -L/2-.045,H+.2, 0, pm)].forEach(m=>{ m.userData.roof = true; g.add(m); });
      }
    }
  g.traverse(o=>{ o.userData.roof = true; o.userData.pick = null; });
}
function buildRoofGroups(blocks){
  const eligible = blocks.filter(b=>b.type!=='balcony');
  if(!eligible.length) return [];
  const out = [];
  roofComponents(eligible).forEach(comp=>{
    try{ out.push(buildRoofGroup(comp)); }
    catch(e){ console.warn('[builder] roof build failed for a component', e); }
  });
  out.forEach(g=>g.traverse(o=>{ o.userData.roof = true; if(o.userData.pick === undefined) o.userData.pick = null; }));
  return out;
}

// Geometry only, and not the furniture models shared by every piece of a kind
// (furniture.js). Materials are shared across rebuilds (see the caches above the
// block builder) and must never be disposed here; the one exception is the
// per-group clones ghostify() makes for inactive floors.
function disposeGroup(g){
  g.traverse(o=>{
    if(o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if(o.material) (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(m.userData.ghost) m.dispose(); });
  });
}
let blockGroups = {};
function toggleRoofs(show){
  blocksRoot.traverse(o=>{ if(o.userData && o.userData.roof) o.visible = show; });
  requestShadows();
}
// Inactive floors are drawn as faint ghosts. Their materials are CLONES of the
// shared ones (same shader program, so no recompile) so the opacity tweak never
// leaks into the active floor; disposeGroup frees the clones by the ghost flag.
function ghostify(g){
  const cloned = new Map();
  const ghostMat = m=>{
    let c = cloned.get(m);
    if(!c){
      c = m.clone(); c.userData.ghost = true;
      c.transparent = true; c.opacity = Math.min(m.opacity, .15); c.depthWrite = false;
      cloned.set(m, c);
    }
    return c;
  };
  g.traverse(o=>{
    o.userData.pick = null;                          // ghosts are not clickable
    o.castShadow = false; o.receiveShadow = false;
    if(o.material) o.material = Array.isArray(o.material) ? o.material.map(ghostMat) : ghostMat(o.material);
  });
}
// Built groups from the last rebuild, keyed by floor + room (or roof) and whether
// the floor was the active one (ghost floors get cloned, faded materials). A group
// is reused as long as its signature is unchanged, so a commit only rebuilds the
// rooms it actually touched: resizing a room rebuilds it and the neighbours whose
// shared walls moved, recolouring one room rebuilds that room alone.
let built = new Map();   // key -> {sig, groups:[Group]}
function rebuild3D(){
  // build the new scene graph first, then swap — a throw mid-build leaves the
  // old house on screen instead of an empty stage
  const next = new Map(), groups = {};
  const topIdx = state.floors.length - 1;
  const liveBlocks = state.blocks;
  const reuse = (key, sig, make)=>{
    const prev = built.get(key);
    const entry = prev && prev.sig === sig ? prev : {sig, groups:make()};
    next.set(key, entry);
    return entry.groups;
  };
  try{
    state.floors.forEach((fl, fi)=>{
      const active = fi === state.floor;
      const y = (fi - state.floor) * FLH();     // active floor always sits at ground level
      // wallNeighbors/sharedWall read state.blocks — point them at the floor being
      // built, or ghost floors get adjacency from the active floor's plan
      state.blocks = fl.blocks;
      fl.blocks.forEach(b=>{
        const ctx = blockContext(b);
        const [g] = reuse(`${fi}|${active}|${b.id}`, blockSignature(b, ctx), ()=>{
          const g = buildBlockGroup(b, ctx);
          if(!active) ghostify(g);
          return [g];
        });
        // placement is not part of the signature: (re)apply it every time, which
        // also snaps back a group that a cancelled drag moved live
        g.position.set(b.cx, y, b.cz);
        g.rotation.y = b.rot*Math.PI/2;
        if(active) groups[b.id] = g;
      });
      // ONE roof per connected building, top floor only (was one per room)
      if(fi === topIdx){
        const sig = JSON.stringify([state.roofStyle, state.roofCol, state.facade, state.facadeMat,
          fl.blocks.map(b=>[b.type, b.cx, b.cz, ...footprint(b)])]);
        reuse(`${fi}|${active}|roof`, sig, ()=>{
          const rgs = buildRoofGroups(fl.blocks);
          if(!active) rgs.forEach(ghostify);
          return rgs;
        }).forEach(rg=>{ rg.position.y = y; });
      }
    });
  } finally {
    state.blocks = liveBlocks;
  }
  const keep = new Set([...next.values()].flatMap(e=>e.groups));
  for(const ch of [...blocksRoot.children]) if(!keep.has(ch)){ blocksRoot.remove(ch); disposeGroup(ch); }
  for(const g of keep) if(g.parent !== blocksRoot){
    blocksRoot.add(g);
    // a fresh group starts with its roof/ceiling showing; match the current mode
    if((ui.interior && ui.view==='3d') || ui.walk) g.traverse(o=>{ if(o.userData.roof) o.visible = false; });
  }
  built = next;
  blockGroups = groups;
  fitShadows();
  updateSelection();
  requestShadows();
}
// Selection outline (block / door / furniture). Separate from rebuild3D so a
// click only rebuilds a handful of line segments, not the whole house.
function updateSelection(){
  if(selOutline){ scene.remove(selOutline); disposeGroup(selOutline); setSelOutline(null); }
  markOverlayDirty();
  const b = selBlock();
  if(b){
    if(sel.kind==='block'){
      const [w,d] = footprint(b);
      setSelOutline(new THREE.Group());
      const lines = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(w+.12, C.H+.12, d+.12)), selLineMat);
      selOutline.add(lines);
      const hGeo = new THREE.BoxGeometry(.09,.09,.09);
      [[-1,-1,-1],[1,-1,-1],[-1,1,-1],[1,1,-1],[-1,-1,1],[1,-1,1],[-1,1,1],[1,1,1]].forEach(([sx,sy,sz])=>{
        const h = new THREE.Mesh(hGeo, selHandleMat);
        h.position.set(sx*(w+.12)/2, sy*(C.H+.12)/2, sz*(d+.12)/2);
        selOutline.add(h);
      });
      selOutline.position.set(b.cx, C.H/2, b.cz);
    } else if(sel.kind==='door'){
      const d = selDoor();
      if(d){
        const [lx,lz] = wallPoint(b, d.wall, d.t);
        const [wx,wz] = localToWorld(b, lx, lz);
        setSelOutline(new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(
            (d.wall%2===0 ? d.w+.2 : .3), d.h+.2, (d.wall%2 ? d.w+.2 : .3))), selLineMat));
        // account for block rotation on the box orientation
        selOutline.rotation.y = b.rot*Math.PI/2;
        selOutline.position.set(wx, d.h/2+.06, wz);
      }
    } else if(sel.kind==='furn'){
      const f = selFurn();
      if(f){
        const s = C.furniture[f.key];
        const [fw, fd] = f.rot%2 ? [s.d, s.w] : [s.w, s.d];
        const [wx, wz] = localToWorld(b, f.lx, f.lz);
        setSelOutline(new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(fw+.1, s.h+.1, fd+.1)), selLineMat));
        selOutline.rotation.y = b.rot*Math.PI/2;
        selOutline.position.set(wx, s.h/2+.1, wz);
      }
    }
    if(selOutline) scene.add(selOutline);
  }
  requestRender();
}

export {blockGroups, buildRoofGroups, doorPlacement, rebuild3D, toggleRoofs, updateSelection};
