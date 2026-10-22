import * as THREE from 'three';
import {FURN_MATS} from './materials.js';
import {C} from './catalog.js';
import {beam, requestShadows} from './scene.js';

// Realistic procedural furniture models (parallel-authored). Each entry:
// (M) => THREE.Group built centred in X/Z, base on the floor (y=0), height up.
// A catalog entry with a `model` URL overrides its builder via loadModel().
const FURN_BUILDERS = {
  "bed": (M) => { const g = new THREE.Group(); const W=1.6, D=2.0, H=0.9; const legH=0.15, baseH=0.16, mattH=0.22; const mattTop=legH+baseH+mattH; const legGeo=new THREE.CylinderGeometry(0.035,0.028,legH,10); const lx=W/2-0.12, lz=D/2-0.12; [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{ const leg=new THREE.Mesh(legGeo,M.dark); leg.position.set(sx*lx,legH/2,sz*lz); leg.castShadow=true; g.add(leg); }); const base=new THREE.Mesh(new THREE.BoxGeometry(W,baseH,D),M.wood); base.position.set(0,legH+baseH/2,0); base.castShadow=true; g.add(base); const matt=new THREE.Mesh(new THREE.BoxGeometry(W-0.06,mattH,D-0.06),M.white); matt.position.set(0,legH+baseH+mattH/2,0); matt.castShadow=true; g.add(matt); const quiltD=D-0.06-0.55; const quilt=new THREE.Mesh(new THREE.BoxGeometry(W-0.02,0.07,quiltD),M.fabric); quilt.position.set(0,mattTop+0.025,0.275); quilt.castShadow=true; g.add(quilt); const pillMat=M.pillow; const pillGeo=new THREE.BoxGeometry(W/2-0.12,0.11,0.42); [-1,1].forEach(s=>{ const p=new THREE.Mesh(pillGeo,pillMat); p.position.set(s*(W/4-0.02),mattTop+0.055,-D/2+0.36); p.castShadow=true; g.add(p); }); const hb=new THREE.Mesh(new THREE.BoxGeometry(W,H-0.15,0.08),M.fabric); hb.position.set(0,0.15+(H-0.15)/2,-D/2+0.04); hb.castShadow=true; g.add(hb); const postGeo=new THREE.BoxGeometry(0.08,H,0.08); [-1,1].forEach(s=>{ const post=new THREE.Mesh(postGeo,M.wood); post.position.set(s*(W/2-0.04),H/2,-D/2+0.04); post.castShadow=true; g.add(post); }); return g; },
  "bed_single": (M) => { const g = new THREE.Group(); const W=1.0, D=2.0, H=0.8; const legH=0.14, baseH=0.15, mattH=0.2; const mattTop=legH+baseH+mattH; const legGeo=new THREE.CylinderGeometry(0.032,0.026,legH,10); const lx=W/2-0.1, lz=D/2-0.12; [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{ const leg=new THREE.Mesh(legGeo,M.dark); leg.position.set(sx*lx,legH/2,sz*lz); leg.castShadow=true; g.add(leg); }); const base=new THREE.Mesh(new THREE.BoxGeometry(W,baseH,D),M.wood); base.position.set(0,legH+baseH/2,0); base.castShadow=true; g.add(base); const matt=new THREE.Mesh(new THREE.BoxGeometry(W-0.06,mattH,D-0.06),M.white); matt.position.set(0,legH+baseH+mattH/2,0); matt.castShadow=true; g.add(matt); const quiltD=D-0.06-0.5; const quilt=new THREE.Mesh(new THREE.BoxGeometry(W-0.02,0.07,quiltD),M.fabric); quilt.position.set(0,mattTop+0.025,0.25); quilt.castShadow=true; g.add(quilt); const pillMat=M.pillow; const pill=new THREE.Mesh(new THREE.BoxGeometry(W-0.2,0.11,0.42),pillMat); pill.position.set(0,mattTop+0.055,-D/2+0.36); pill.castShadow=true; g.add(pill); const hb=new THREE.Mesh(new THREE.BoxGeometry(W,H-0.14,0.07),M.fabric); hb.position.set(0,0.14+(H-0.14)/2,-D/2+0.035); hb.castShadow=true; g.add(hb); return g; },
  "wardrobe": (M) => { const g = new THREE.Group(); const W=1.8, D=0.6, H=2.2; const plinthH=0.09; const plinth=new THREE.Mesh(new THREE.BoxGeometry(W-0.06,plinthH,D-0.06),M.dark); plinth.position.set(0,plinthH/2,0); plinth.castShadow=true; g.add(plinth); const bodyH=H-plinthH-0.04; const body=new THREE.Mesh(new THREE.BoxGeometry(W,bodyH,D),M.wood); body.position.set(0,plinthH+bodyH/2,0); body.castShadow=true; g.add(body); const corn=new THREE.Mesh(new THREE.BoxGeometry(W+0.04,0.05,D+0.04),M.wood); corn.position.set(0,H-0.025,0); corn.castShadow=true; g.add(corn); const doorT=0.03, gap=0.01; const doorW=(W-0.06)/2-gap; const doorH=bodyH-0.06; const doorY=plinthH+bodyH/2; const doorZ=D/2+doorT/2; [-1,1].forEach(s=>{ const d=new THREE.Mesh(new THREE.BoxGeometry(doorW,doorH,doorT),M.white); d.position.set(s*(doorW/2+gap),doorY,doorZ); d.castShadow=true; g.add(d); const h=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.24,8),M.metal); h.position.set(s*(gap+0.05),doorY,doorZ+doorT/2+0.02); h.castShadow=true; g.add(h); }); return g; },
  "nightstand": (M) => { const g = new THREE.Group(); const W=0.45, D=0.4, H=0.5; const legH=0.14, bodyH=H-legH; const lx=W/2-0.05, lz=D/2-0.05; const legGeo=new THREE.CylinderGeometry(0.018,0.013,legH,10); [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{ const l=new THREE.Mesh(legGeo,M.wood); l.position.set(sx*lx,legH/2,sz*lz); l.castShadow=true; g.add(l); }); const body=new THREE.Mesh(new THREE.BoxGeometry(W,bodyH,D),M.wood); body.position.set(0,legH+bodyH/2,0); body.castShadow=true; g.add(body); const df=new THREE.Mesh(new THREE.BoxGeometry(W-0.06,bodyH-0.08,0.02),M.white); df.position.set(0,legH+bodyH/2,D/2+0.005); df.castShadow=true; g.add(df); const kn=new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,0.045,8),M.metal); kn.rotation.x=Math.PI/2; kn.position.set(0,legH+bodyH/2,D/2+0.03); kn.castShadow=true; g.add(kn); return g; },
  "dresser": (M) => { const g = new THREE.Group(); const W=1.2, D=0.5, H=0.8; const legH=0.1, bodyH=H-legH; const lx=W/2-0.06, lz=D/2-0.06; const legGeo=new THREE.CylinderGeometry(0.025,0.017,legH,10); [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{ const l=new THREE.Mesh(legGeo,M.dark); l.position.set(sx*lx,legH/2,sz*lz); l.castShadow=true; g.add(l); }); const body=new THREE.Mesh(new THREE.BoxGeometry(W,bodyH,D),M.wood); body.position.set(0,legH+bodyH/2,0); body.castShadow=true; g.add(body); const n=3, gapv=0.02; const faceH=(bodyH-gapv*(n+1))/n; const faceW=W-0.06; for(let i=0;i<n;i++){ const cy=legH+gapv*(i+1)+faceH*(i+0.5); const f=new THREE.Mesh(new THREE.BoxGeometry(faceW,faceH,0.02),M.white); f.position.set(0,cy,D/2+0.005); f.castShadow=true; g.add(f); [-1,1].forEach(s=>{ const h=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,0.09,8),M.metal); h.rotation.z=Math.PI/2; h.position.set(s*0.22,cy,D/2+0.03); h.castShadow=true; g.add(h); }); } return g; },
  "bookshelf": (M) => { const g = new THREE.Group(); const W=0.9, D=0.35, H=1.9, t=0.03; [-1,1].forEach(s=>{ const p=new THREE.Mesh(new THREE.BoxGeometry(t,H,D),M.wood); p.position.set(s*(W/2-t/2),H/2,0); p.castShadow=true; g.add(p); }); const back=new THREE.Mesh(new THREE.BoxGeometry(W-2*t,H,0.015),M.wood); back.position.set(0,H/2,-D/2+0.0075); back.castShadow=true; g.add(back); const innerW=W-2*t; const ys=[t/2,0.48,0.94,1.40,H-t/2]; ys.forEach(y=>{ const sh=new THREE.Mesh(new THREE.BoxGeometry(innerW,t,D-0.02),M.wood); sh.position.set(0,y,0.01); sh.castShadow=true; g.add(sh); }); const placeBooks=(baseY,count)=>{ let x=-innerW/2+0.04; for(let i=0;i<count;i++){ const bw=0.035+((i*7)%3)*0.012; const bh=0.24+((i*5)%4)*0.02; const b=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,D-0.08),M.books[i%M.books.length]); b.position.set(x+bw/2,baseY+bh/2,0.0); b.castShadow=true; g.add(b); x+=bw+0.004; } }; placeBooks(t,8); placeBooks(0.48+t/2,7); placeBooks(1.40+t/2,6); return g; },
  "sofa": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z,rx)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(rx)m.rotation.x=rx;m.castShadow=true;g.add(m);return m;};
  const fab=M.fabric, wood=M.wood;
  const foot=new THREE.CylinderGeometry(0.05,0.04,0.09,10);
  [[-0.85,-0.36],[0.85,-0.36],[-0.85,0.36],[0.85,0.36]].forEach(p=>add(foot,wood,p[0],0.045,p[1]));
  add(new THREE.BoxGeometry(1.96,0.24,0.86),fab,0,0.21,0);
  add(new THREE.BoxGeometry(1.62,0.72,0.14),fab,0,0.69,-0.38);
  [-0.90,0.90].forEach(x=>{
    add(new THREE.BoxGeometry(0.20,0.51,0.86),fab,x,0.345,0);
    add(new THREE.CylinderGeometry(0.10,0.10,0.86,12),fab,x,0.60,0,Math.PI/2);
  });
  [-0.54,0,0.54].forEach(x=>add(new THREE.BoxGeometry(0.50,0.14,0.64),fab,x,0.40,0.05));
  [-0.54,0,0.54].forEach(x=>add(new THREE.BoxGeometry(0.50,0.44,0.18),fab,x,0.68,-0.33));
  return g;
},
  "sofa_l": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z,rx)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(rx)m.rotation.x=rx;m.castShadow=true;g.add(m);return m;};
  const fab=M.fabric, wood=M.wood;
  const foot=new THREE.CylinderGeometry(0.05,0.04,0.09,10);
  [[-1.1,-0.7],[1.1,-0.7],[-1.1,-0.1],[0.5,-0.1],[1.1,0.7],[0.5,0.7]].forEach(p=>add(foot,wood,p[0],0.045,p[1]));
  add(new THREE.BoxGeometry(2.36,0.24,0.80),fab,0,0.21,-0.40);
  add(new THREE.BoxGeometry(0.80,0.24,0.80),fab,0.80,0.21,0.40);
  add(new THREE.BoxGeometry(2.36,0.72,0.14),fab,0,0.69,-0.73);
  add(new THREE.BoxGeometry(0.18,0.51,0.80),fab,-1.11,0.345,-0.40);
  add(new THREE.CylinderGeometry(0.09,0.09,0.80,12),fab,-1.11,0.60,-0.40,Math.PI/2);
  add(new THREE.BoxGeometry(0.18,0.51,1.60),fab,1.11,0.345,0.0);
  add(new THREE.CylinderGeometry(0.09,0.09,1.60,12),fab,1.11,0.60,0.0,Math.PI/2);
  [-0.68,0,0.68].forEach(x=>add(new THREE.BoxGeometry(0.62,0.14,0.66),fab,x,0.40,-0.35));
  add(new THREE.BoxGeometry(0.60,0.14,0.72),fab,0.70,0.40,0.40);
  [-0.68,0,0.68].forEach(x=>add(new THREE.BoxGeometry(0.62,0.44,0.18),fab,x,0.68,-0.63));
  return g;
},
  "armchair": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z,rx)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(rx)m.rotation.x=rx;m.castShadow=true;g.add(m);return m;};
  const fab=M.fabric, wood=M.wood;
  const leg=new THREE.CylinderGeometry(0.03,0.022,0.16,10);
  [[-0.34,-0.34],[0.34,-0.34],[-0.34,0.34],[0.34,0.34]].forEach(p=>add(leg,wood,p[0],0.08,p[1]));
  add(new THREE.BoxGeometry(0.86,0.20,0.86),fab,0,0.26,0);
  add(new THREE.BoxGeometry(0.60,0.64,0.14),fab,0,0.68,-0.37);
  [-0.38,0.38].forEach(x=>{
    add(new THREE.BoxGeometry(0.14,0.42,0.80),fab,x,0.37,0);
    add(new THREE.CylinderGeometry(0.07,0.07,0.80,12),fab,x,0.58,0,Math.PI/2);
  });
  add(new THREE.BoxGeometry(0.58,0.14,0.62),fab,0,0.43,0.04);
  add(new THREE.BoxGeometry(0.58,0.42,0.16),fab,0,0.66,-0.32);
  return g;
},
  "coffee": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const wood=M.wood, met=M.metal;
  add(new THREE.BoxGeometry(0.90,0.05,0.55),wood,0,0.395,0);
  add(new THREE.BoxGeometry(0.78,0.035,0.44),wood,0,0.12,0);
  [[-0.40,-0.22],[0.40,-0.22],[-0.40,0.22],[0.40,0.22]].forEach(p=>add(new THREE.BoxGeometry(0.05,0.37,0.05),met,p[0],0.185,p[1]));
  return g;
},
  "tv": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const wood=M.wood, dark=M.dark, met=M.metal, white=M.white;
  const screenMat=M.screen;
  const leg=new THREE.CylinderGeometry(0.028,0.028,0.10,10);
  [[-0.62,-0.15],[0.62,-0.15],[-0.62,0.15],[0.62,0.15]].forEach(p=>add(leg,dark,p[0],0.05,p[1]));
  add(new THREE.BoxGeometry(1.36,0.35,0.36),wood,0,0.275,0);
  [-0.34,0.34].forEach(x=>add(new THREE.BoxGeometry(0.62,0.30,0.02),white,x,0.275,0.185));
  [-0.05,0.05].forEach(x=>add(new THREE.BoxGeometry(0.02,0.12,0.02),met,x,0.275,0.20));
  add(new THREE.BoxGeometry(0.10,0.60,0.06),dark,0,0.72,-0.15);
  add(new THREE.BoxGeometry(1.16,0.72,0.04),dark,0,1.11,-0.14);
  add(new THREE.BoxGeometry(1.06,0.62,0.02),screenMat,0,1.11,-0.115);
  return g;
},
  "side_table": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const wood=M.wood, met=M.metal;
  add(new THREE.CylinderGeometry(0.24,0.24,0.04,12),wood,0,0.53,0);
  add(new THREE.CylinderGeometry(0.20,0.20,0.025,12),wood,0,0.13,0);
  const leg=new THREE.CylinderGeometry(0.018,0.014,0.51,10);
  [[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]].forEach(p=>add(leg,met,p[0],0.255,p[1]));
  return g;
},
  "plant": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const terra=M.terra, green=M.green, dark=M.dark, wood=M.wood;
  add(new THREE.CylinderGeometry(0.18,0.13,0.32,12),terra,0,0.16,0);
  add(new THREE.CylinderGeometry(0.19,0.18,0.05,12),terra,0,0.32,0);
  add(new THREE.CylinderGeometry(0.165,0.165,0.03,12),dark,0,0.335,0);
  add(new THREE.CylinderGeometry(0.03,0.025,0.40,8),wood,0,0.52,0);
  const s=(r,x,y,z)=>add(new THREE.SphereGeometry(r,12,8),green,x,y,z);
  s(0.20,0,0.86,0);
  s(0.13,0.09,0.74,0.04);
  s(0.13,-0.09,0.80,-0.05);
  s(0.18,0.02,1.02,0.02);
  s(0.13,0.0,0.70,0.11);
  return g;
},
  "floor_lamp": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const met=M.metal, dark=M.dark;
  const shadeMat=M.shade;
  const bulbMat=M.bulb;
  add(new THREE.CylinderGeometry(0.17,0.18,0.04,12),dark,0,0.02,0);
  add(new THREE.CylinderGeometry(0.09,0.09,0.02,12),dark,0,0.05,0);
  add(new THREE.CylinderGeometry(0.018,0.018,1.28,10),met,0,0.68,0);
  add(new THREE.SphereGeometry(0.05,12,8),bulbMat,0,1.40,0);
  add(new THREE.CylinderGeometry(0.11,0.19,0.30,12,1,true),shadeMat,0,1.45,0);
  return g;
},
  "kunit": (M) => {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  // recessed toe kick
  add(new THREE.BoxGeometry(1.7, 0.1, 0.48), M.dark, 0, 0.05, -0.03);
  // cabinet carcass
  add(new THREE.BoxGeometry(1.8, 0.76, 0.6), M.wood, 0, 0.48, 0);
  // three doors + bar-pull handles
  for (let i = 0; i < 3; i++) {
    const dx = -0.6 + i * 0.6;
    add(new THREE.BoxGeometry(0.56, 0.68, 0.03), M.wood, dx, 0.5, 0.305);
    add(new THREE.BoxGeometry(0.14, 0.02, 0.03), M.metal, dx + 0.18, 0.8, 0.325);
  }
  // worktop (charcoal stone) built as 4 strips around a sink cutout, top y=0.90
  const wy = 0.88, wh = 0.04;
  add(new THREE.BoxGeometry(1.07, wh, 0.62), M.dark, -0.385, wy, 0);
  add(new THREE.BoxGeometry(0.27, wh, 0.62), M.dark, 0.785, wy, 0);
  add(new THREE.BoxGeometry(0.5, wh, 0.14), M.dark, 0.4, wy, 0.24);
  add(new THREE.BoxGeometry(0.5, wh, 0.14), M.dark, 0.4, wy, -0.24);
  // stainless sink basin (open box) dropped into the notch, rim at 0.90
  add(new THREE.BoxGeometry(0.46, 0.02, 0.30), M.metal, 0.4, 0.75, 0);
  add(new THREE.BoxGeometry(0.02, 0.16, 0.30), M.metal, 0.18, 0.82, 0);
  add(new THREE.BoxGeometry(0.02, 0.16, 0.30), M.metal, 0.62, 0.82, 0);
  add(new THREE.BoxGeometry(0.46, 0.16, 0.02), M.metal, 0.4, 0.82, 0.15);
  add(new THREE.BoxGeometry(0.46, 0.16, 0.02), M.metal, 0.4, 0.82, -0.15);
  // tiled backsplash (reaches H=1.1)
  add(new THREE.BoxGeometry(1.8, 0.2, 0.02), M.white, 0, 1.0, -0.3);
  // gooseneck tap: post + half-torus arch + spout nub
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 12), M.metal, 0.4, 0.96, -0.14);
  const gn = add(new THREE.TorusGeometry(0.07, 0.018, 6, 14, Math.PI), M.metal, 0.4, 1.02, -0.07);
  gn.rotation.y = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 10), M.metal, 0.4, 1.0, 0);
  return g;
},
  "fridge": (M) => {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  // base kick
  add(new THREE.BoxGeometry(0.66, 0.03, 0.66), M.dark, 0, 0.015, 0);
  // stainless body
  add(new THREE.BoxGeometry(0.7, 1.87, 0.7), M.metal, 0, 0.965, 0);
  // upper fridge door (larger)
  add(new THREE.BoxGeometry(0.66, 1.06, 0.04), M.metal, 0, 1.32, 0.36);
  // lower freezer door
  add(new THREE.BoxGeometry(0.66, 0.7, 0.04), M.metal, 0, 0.4, 0.36);
  // vertical handles on the right edge of each door
  add(new THREE.BoxGeometry(0.03, 0.9, 0.04), M.dark, 0.28, 1.3, 0.39);
  add(new THREE.BoxGeometry(0.03, 0.55, 0.04), M.dark, 0.28, 0.425, 0.39);
  return g;
},
  "oven": (M) => {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const darkGlass = M.darkGlass;
  // base kick
  add(new THREE.BoxGeometry(0.56, 0.03, 0.56), M.dark, 0, 0.015, 0);
  // stainless body
  add(new THREE.BoxGeometry(0.6, 0.84, 0.6), M.metal, 0, 0.45, 0);
  // dark enamel cooktop
  add(new THREE.BoxGeometry(0.6, 0.03, 0.6), M.dark, 0, 0.885, 0);
  // 4 hob rings
  const pos = [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]];
  pos.forEach(([rx, rz]) => {
    const ring = add(new THREE.TorusGeometry(0.06, 0.01, 6, 16), M.metal, rx, 0.9, rz);
    ring.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 10), M.dark, rx, 0.9, rz);
  });
  // control panel + knobs
  add(new THREE.BoxGeometry(0.6, 0.1, 0.02), M.dark, 0, 0.8, 0.3);
  for (let i = 0; i < 4; i++) {
    const kn = add(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), M.metal, -0.21 + i * 0.14, 0.8, 0.32);
    kn.rotation.x = Math.PI / 2;
  }
  // oven door: metal frame + dark glass window + horizontal handle
  add(new THREE.BoxGeometry(0.54, 0.56, 0.03), M.metal, 0, 0.42, 0.305);
  add(new THREE.BoxGeometry(0.42, 0.44, 0.02), darkGlass, 0, 0.42, 0.315);
  add(new THREE.BoxGeometry(0.48, 0.03, 0.04), M.metal, 0, 0.71, 0.33);
  return g;
},
  "table": (M) => {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  // top (surface at H=0.9)
  add(new THREE.BoxGeometry(1.4, 0.05, 0.8), M.wood, 0, 0.875, 0);
  // apron rails
  add(new THREE.BoxGeometry(1.24, 0.08, 0.04), M.wood, 0, 0.8, 0.34);
  add(new THREE.BoxGeometry(1.24, 0.08, 0.04), M.wood, 0, 0.8, -0.34);
  add(new THREE.BoxGeometry(0.04, 0.08, 0.64), M.wood, 0.62, 0.8, 0);
  add(new THREE.BoxGeometry(0.04, 0.08, 0.64), M.wood, -0.62, 0.8, 0);
  // 4 legs
  [[0.62, 0.34], [-0.62, 0.34], [0.62, -0.34], [-0.62, -0.34]].forEach(([lx, lz]) =>
    add(new THREE.BoxGeometry(0.06, 0.85, 0.06), M.wood, lx, 0.425, lz));
  return g;
},
  "chair": (M) => {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  // wood seat base + upholstered cushion (~0.49 seat height)
  add(new THREE.BoxGeometry(0.44, 0.04, 0.44), M.wood, 0, 0.44, 0);
  add(new THREE.BoxGeometry(0.4, 0.05, 0.4), M.fabric, 0, 0.485, 0);
  // front legs
  add(new THREE.BoxGeometry(0.04, 0.44, 0.04), M.wood, 0.18, 0.22, 0.18);
  add(new THREE.BoxGeometry(0.04, 0.44, 0.04), M.wood, -0.18, 0.22, 0.18);
  // rear uprights double as back frame (to H=0.9)
  add(new THREE.BoxGeometry(0.04, 0.9, 0.04), M.wood, 0.18, 0.45, -0.18);
  add(new THREE.BoxGeometry(0.04, 0.9, 0.04), M.wood, -0.18, 0.45, -0.18);
  // upholstered backrest panel + wood top rail
  add(new THREE.BoxGeometry(0.36, 0.26, 0.03), M.fabric, 0, 0.72, -0.17);
  add(new THREE.BoxGeometry(0.4, 0.05, 0.05), M.wood, 0, 0.88, -0.18);
  return g;
},
  "bar_stool": (M) => {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  // weighted flared base
  add(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 16), M.metal, 0, 0.015, 0);
  // central post
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.94, 12), M.metal, 0, 0.5, 0);
  // footring
  const fr = add(new THREE.TorusGeometry(0.15, 0.012, 6, 16), M.metal, 0, 0.32, 0);
  fr.rotation.x = Math.PI / 2;
  // round seat: wood ring + fabric cushion (top at H=1.05)
  add(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 16), M.wood, 0, 0.985, 0);
  add(new THREE.CylinderGeometry(0.185, 0.185, 0.05, 16), M.fabric, 0, 1.025, 0);
  return g;
},
  "toilet": (M) => { const g = new THREE.Group(); const c = M.white;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.32, 12), c); foot.scale.set(1.15, 1, 1.05); foot.position.set(0, 0.16, 0.05); foot.castShadow = true; g.add(foot);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.14, 0.16, 12), c); bowl.scale.set(1, 1, 1.2); bowl.position.set(0, 0.37, 0.06); bowl.castShadow = true; g.add(bowl);
  const seat = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.028, 8, 16), c); seat.rotation.x = Math.PI / 2; seat.scale.set(1.02, 1.2, 1); seat.position.set(0, 0.44, 0.07); seat.castShadow = true; g.add(seat);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.03, 12), c); lid.scale.set(1, 1, 1.2); lid.position.set(0, 0.46, 0.07); lid.castShadow = true; g.add(lid);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.15), c); tank.position.set(0, 0.72, -0.24); tank.castShadow = true; g.add(tank);
  const tlid = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.04, 0.18), c); tlid.position.set(0, 0.99, -0.235); tlid.castShadow = true; g.add(tlid);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), M.metal); btn.position.set(0, 1.03, -0.235); btn.castShadow = true; g.add(btn);
  return g; },
  "basin": (M) => { const g = new THREE.Group(); const c = M.white;
  const prof = [[0.14,0],[0.12,0.04],[0.075,0.14],[0.06,0.4],[0.06,0.58],[0.09,0.74],[0.13,0.82],[0.14,0.84]].map(p => new THREE.Vector2(p[0], p[1]));
  const ped = new THREE.Mesh(new THREE.LatheGeometry(prof, 12), c); ped.castShadow = true; g.add(ped);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.15, 0.14, 12), c); bowl.scale.set(1, 1, 0.78); bowl.position.set(0, 0.85, 0); bowl.castShadow = true; g.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.02, 8, 20), c); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 0.78, 1); rim.position.set(0, 0.915, 0); rim.castShadow = true; g.add(rim);
  const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8), M.metal); drain.position.set(0, 0.9, 0); drain.castShadow = true; g.add(drain);
  const fb = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 10), M.metal); fb.position.set(0, 0.94, -0.14); fb.castShadow = true; g.add(fb);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.14, 10), M.metal); sp.rotation.x = 1.0; sp.position.set(0, 0.99, -0.07); sp.castShadow = true; g.add(sp);
  const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), M.metal); hd.rotation.z = Math.PI / 2; hd.position.set(0.06, 0.97, -0.14); hd.castShadow = true; g.add(hd);
  return g; },
  "shower": (M) => { const g = new THREE.Group();
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), M.white); tray.position.set(0, 0.04, 0); tray.castShadow = true; g.add(tray);
  const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8), M.metal); drain.position.set(0, 0.085, 0); drain.castShadow = true; g.add(drain);
  const gz = new THREE.Mesh(new THREE.BoxGeometry(0.88, 2.02, 0.012), M.glass); gz.position.set(0, 1.11, 0.44); gz.castShadow = true; g.add(gz);
  const gx = new THREE.Mesh(new THREE.BoxGeometry(0.012, 2.02, 0.88), M.glass); gx.position.set(0.44, 1.11, 0); gx.castShadow = true; g.add(gx);
  const postGeo = new THREE.CylinderGeometry(0.022, 0.022, 2.2, 10);
  [[0.45,0.45],[0.45,-0.45],[-0.45,0.45]].forEach(p => { const post = new THREE.Mesh(postGeo, M.metal); post.position.set(p[0], 1.1, p[1]); post.castShadow = true; g.add(post); });
  const rz = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.03), M.metal); rz.position.set(0, 2.12, 0.45); rz.castShadow = true; g.add(rz);
  const rx = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.9), M.metal); rx.position.set(0.45, 2.12, 0); rx.castShadow = true; g.add(rx);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 8), M.metal); arm.rotation.x = Math.PI / 2; arm.position.set(0, 2.0, -0.28); arm.castShadow = true; g.add(arm);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 12), M.metal); head.position.set(0, 1.96, -0.1); head.castShadow = true; g.add(head);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 10), M.metal); knob.rotation.x = Math.PI / 2; knob.position.set(0.22, 1.05, -0.44); knob.castShadow = true; g.add(knob);
  return g; },
  "bath": (M) => { const g = new THREE.Group(); const c = M.white;
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.33, 0.52, 12), c); outer.scale.set(2.27, 1, 1); outer.position.set(0, 0.26, 0); outer.castShadow = true; g.add(outer);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.355, 0.04, 8, 24), c); rim.rotation.x = Math.PI / 2; rim.scale.set(2.27, 1, 1); rim.position.set(0, 0.52, 0); rim.castShadow = true; g.add(rim);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 12), M.glass); water.scale.set(2.1, 1, 1); water.position.set(0, 0.525, 0); water.castShadow = true; g.add(water);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.22, 10), M.metal); riser.position.set(0.74, 0.64, 0); riser.castShadow = true; g.add(riser);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.017, 0.26, 10), M.metal); spout.rotation.z = 1.15; spout.position.set(0.6, 0.72, 0); spout.castShadow = true; g.add(spout);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), M.metal); handle.rotation.x = Math.PI / 2; handle.position.set(0.74, 0.58, 0); handle.castShadow = true; g.add(handle);
  return g; },
  "mirror_cab": (M) => { const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.15), M.white); body.position.set(0, 1.5, 0); body.castShadow = true; g.add(body);
  const doorGeo = new THREE.BoxGeometry(0.28, 0.74, 0.012);
  const left = new THREE.Mesh(doorGeo, M.glass); left.position.set(-0.145, 1.5, 0.078); left.castShadow = true; g.add(left);
  const right = new THREE.Mesh(doorGeo, M.glass); right.position.set(0.145, 1.5, 0.078); right.castShadow = true; g.add(right);
  const hgeo = new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8);
  const hl = new THREE.Mesh(hgeo, M.metal); hl.position.set(-0.02, 1.5, 0.09); hl.castShadow = true; g.add(hl);
  const hr = new THREE.Mesh(hgeo, M.metal); hr.position.set(0.02, 1.5, 0.09); hr.castShadow = true; g.add(hr);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.03, 0.17), M.white); top.position.set(0, 1.91, 0); top.castShadow = true; g.add(top);
  const bot = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.03, 0.17), M.white); bot.position.set(0, 1.09, 0); bot.castShadow = true; g.add(bot);
  return g; },
  "desk": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const W=1.2,D=0.6,H=0.9,tt=0.04,lh=H-tt;
  add(new THREE.BoxGeometry(W,tt,D),M.wood,0,H-tt/2,0);
  add(new THREE.BoxGeometry(W-0.1,0.012,D-0.08),M.wood,0,H-tt-0.006,0);
  [[W/2-0.06,D/2-0.07],[-(W/2-0.06),D/2-0.07],[W/2-0.06,-(D/2-0.07)],[-(W/2-0.06),-(D/2-0.07)]]
    .forEach(p=>add(new THREE.BoxGeometry(0.045,lh,0.045),M.metal,p[0],lh/2,p[1]));
  add(new THREE.BoxGeometry(0.9,0.06,0.03),M.metal,0,0.14,-(D/2-0.08));
  const dW=0.42,dH=0.14,dD=0.5,dy=H-tt-dH/2-0.006;
  add(new THREE.BoxGeometry(dW,dH,dD),M.wood,0.3,dy,0);
  add(new THREE.BoxGeometry(dW-0.05,dH-0.035,0.02),M.wood,0.3,dy,dD/2+0.006);
  add(new THREE.BoxGeometry(0.14,0.016,0.02),M.metal,0.3,dy,dD/2+0.028);
  return g;
},
  "office_chair": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const dark=M.dark, fab=M.fabric, met=M.metal, R=0.28;
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5, cx=Math.cos(a), sz=Math.sin(a);
    const leg=add(new THREE.BoxGeometry(R,0.05,0.055),dark,0.5*R*cx,0.055,0.5*R*sz);
    leg.rotation.y=-a;
    add(new THREE.SphereGeometry(0.035,12,8),dark,R*cx,0.035,R*sz);
  }
  add(new THREE.CylinderGeometry(0.05,0.06,0.09,12),met,0,0.085,0);
  add(new THREE.CylinderGeometry(0.028,0.032,0.4,12),met,0,0.31,0);
  add(new THREE.BoxGeometry(0.18,0.06,0.22),dark,0,0.47,0);
  add(new THREE.BoxGeometry(0.5,0.09,0.5),fab,0,0.52,0);
  add(new THREE.BoxGeometry(0.46,0.05,0.46),fab,0,0.575,0);
  add(new THREE.BoxGeometry(0.1,0.16,0.06),dark,0,0.6,-0.2);
  add(new THREE.BoxGeometry(0.46,0.52,0.08),fab,0,0.84,-0.21);
  add(new THREE.BoxGeometry(0.4,0.44,0.03),fab,0,0.85,-0.155);
  [-1,1].forEach(s=>{
    add(new THREE.BoxGeometry(0.04,0.18,0.04),dark,s*0.28,0.6,-0.02);
    add(new THREE.BoxGeometry(0.07,0.04,0.28),dark,s*0.28,0.69,0.0);
  });
  return g;
},
  "wall_art": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const cy=1.5;
  const art=M.art;
  add(new THREE.BoxGeometry(0.72,0.52,0.03),art,0,cy,0.006);
  add(new THREE.BoxGeometry(0.22,0.3,0.008),M.terra,-0.14,cy+0.03,0.021);
  const disc=add(new THREE.CylinderGeometry(0.11,0.11,0.008,16),M.green,0.13,cy-0.06,0.021);
  disc.rotation.x=Math.PI/2;
  add(new THREE.BoxGeometry(0.8,0.05,0.05),M.wood,0,cy+0.275,0);
  add(new THREE.BoxGeometry(0.8,0.05,0.05),M.wood,0,cy-0.275,0);
  add(new THREE.BoxGeometry(0.05,0.6,0.05),M.wood,-0.375,cy,0);
  add(new THREE.BoxGeometry(0.05,0.6,0.05),M.wood,0.375,cy,0);
  return g;
},
  "rug": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const border=M.rugBorder;
  const field=M.rugField;
  add(new THREE.BoxGeometry(1.6,0.02,1.1),border,0,0.01,0);
  add(new THREE.BoxGeometry(1.42,0.008,0.92),field,0,0.019,0);
  add(new THREE.BoxGeometry(1.3,0.005,0.07),M.terra,0,0.024,0.36);
  add(new THREE.BoxGeometry(1.3,0.005,0.07),M.terra,0,0.024,-0.36);
  const dia=add(new THREE.BoxGeometry(0.17,0.005,0.17),border,0,0.024,0);
  dia.rotation.y=Math.PI/4;
  return g;
},
  "ceiling_light": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const H=0.3;
  const bulb=M.bulbWarm;
  add(new THREE.CylinderGeometry(0.055,0.06,0.02,12),M.metal,0,H-0.01,0);
  add(new THREE.CylinderGeometry(0.01,0.01,0.07,8),M.metal,0,H-0.055,0);
  add(new THREE.CylinderGeometry(0.07,0.2,0.15,16,1,true),M.white,0,0.15,0);
  add(new THREE.SphereGeometry(0.055,12,8),bulb,0,0.11,0);
  return g;
},
  "walllamp": (M) => {
  const g = new THREE.Group();
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const H=2.4;
  const bulb=M.bulbWarm;
  add(new THREE.CylinderGeometry(0.06,0.08,0.04,12),M.dark,0,0.02,0);
  add(new THREE.CylinderGeometry(0.03,0.03,0.02,12),M.metal,0,0.05,0);
  add(new THREE.CylinderGeometry(0.016,0.02,2.22,12),M.metal,0,1.15,0);
  add(new THREE.CylinderGeometry(0.055,0.085,0.14,16,1,true),M.white,0,2.33,0);
  add(new THREE.SphereGeometry(0.04,12,8),bulb,0,2.3,0);
  return g;
}
};

// Model dispatch: a realistic FURN_BUILDERS entry when one exists, else the
// legacy box model. A catalog `model` URL (GLB) overrides the mesh once loaded.
function buildFurn(f){
  const M = FURN_MATS();
  const spec = C.furniture[f.key] || {};
  const build = FURN_BUILDERS[f.key];
  const g = build ? build(M) : legacyBuildFurn(f);
  g.position.set(f.lx, 0, f.lz);
  g.rotation.y = f.rot*Math.PI/2;
  g.userData.furnRoot = f.id;
  // legs, knobs, handles, book spines, hob rings: too small to shadow visibly,
  // but each one is another draw call into the shadow map
  g.traverse(o=>{
    if(!o.isMesh || !o.castShadow) return;
    const geo = o.geometry; if(!geo.boundingBox) geo.computeBoundingBox();
    const s = geo.boundingBox.getSize(_tmpV3);
    if(s.x*s.y*s.z < .004) o.castShadow = false;
  });
  if(spec.model){
    loadModel(spec.model, spec).then(model=>{
      if(!model || !g.parent) return;               // dropped before load finished
      g.children.slice().forEach(c=>{ if(c!==model) c.visible = false; });
      g.add(model);
      requestShadows();
    }).catch(()=>{});
  }
  return g;
}
const _tmpV3 = new THREE.Vector3();

// Optional GLB pipeline — dormant until a catalog entry sets `model`. Kept behind
// a dynamic import so a loader hiccup can never break the procedural default.
const _glbCache = new Map();
async function loadModel(url, spec){
  try{
    if(!_glbCache.has(url)){
      _glbCache.set(url, (async()=>{
        const {GLTFLoader} = await import('three/addons/loaders/GLTFLoader.js');
        const gltf = await new GLTFLoader().loadAsync(url);
        const root = gltf.scene;
        if(spec) fitToFootprint(root, spec);
        root.traverse(o=>{ if(o.isMesh) o.castShadow = true; });
        return root;
      })());
    }
    const proto = await _glbCache.get(url);
    return proto.clone(true);
  }catch(e){ console.warn('loadModel failed', url, e); return null; }
}
function fitToFootprint(obj, spec){
  let box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = Math.min(spec.w/(size.x||1), spec.h/(size.y||1), spec.d/(size.z||1));
  obj.scale.setScalar(s);
  box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;
}

function legacyBuildFurn(f){
  const g = new THREE.Group(), M = FURN_MATS(), y0 = .14;
  const B = (sx,sy,sz,x,y,z,m)=>g.add(beam(sx,sy,sz, x,y0+y,z, m));
  switch(f.key){
    case 'bed':
      B(1.6,.28,2.0, 0,.14,0, M.wood); B(1.5,.18,1.9, 0,.37,0, M.white);
      B(1.2,.12,.4, 0,.52,-.7, M.fabric); B(1.6,.62,.08, 0,.45,-.97, M.wood); break;
    case 'wardrobe':
      B(1.8,2.2,.6, 0,1.1,0, M.wood); B(.03,1.7,.02, 0,1.15,.31, M.dark); break;
    case 'nightstand': B(.45,.5,.4, 0,.25,0, M.wood); break;
    case 'sofa':
      B(2.0,.42,.9, 0,.21,0, M.fabric); B(2.0,.55,.22, 0,.62,-.34, M.fabric);
      B(.22,.32,.9, -.89,.55,0, M.fabric); B(.22,.32,.9, .89,.55,0, M.fabric); break;
    case 'coffee': B(.9,.06,.55, 0,.36,0, M.wood); B(.5,.33,.3, 0,.17,0, M.wood); break;
    case 'tv': B(1.4,.5,.4, 0,.25,0, M.wood); B(1.2,.68,.06, 0,1.0,0, M.dark); break;
    case 'table':
      B(1.4,.06,.8, 0,.72,0, M.wood);
      [[-.6,-.33],[.6,-.33],[-.6,.33],[.6,.33]].forEach(([x,z])=>B(.07,.7,.07, x,.35,z, M.wood)); break;
    case 'chair':
      B(.45,.06,.45, 0,.45,0, M.wood); B(.45,.45,.06, 0,.7,-.2, M.wood);
      [[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]].forEach(([x,z])=>B(.05,.44,.05, x,.22,z, M.wood)); break;
    case 'desk':
      B(1.2,.05,.6, 0,.73,0, M.wood); B(.05,.72,.6, -.57,.36,0, M.wood); B(.05,.72,.6, .57,.36,0, M.wood); break;
    case 'fridge': B(.7,1.9,.7, 0,.95,0, M.white); B(.04,.5,.02, .3,1.3,.36, M.metal); break;
    case 'kunit':
      B(1.8,.9,.6, 0,.45,0, M.wood); B(1.84,.05,.64, 0,.93,0, M.white);
      B(.5,.06,.4, .35,.96,0, M.metal); break;
    case 'toilet': B(.4,.42,.5, 0,.21,.06, M.white); B(.4,.5,.14, 0,.62,-.24, M.white); break;
    case 'basin': B(.16,.72,.16, 0,.36,0, M.white); B(.5,.14,.4, 0,.8,0, M.white); break;
    case 'shower':
      B(.9,.06,.9, 0,.03,0, M.white);
      B(.9,2.0,.03, 0,1.06,.43, M.glass); B(.03,2.0,.9, .43,1.06,0, M.glass);
      B(.05,2.0,.05, -.4,1.06,-.4, M.metal); break;
    case 'bath': B(1.7,.6,.75, 0,.3,0, M.white); B(1.5,.08,.55, 0,.58,0, M.glass); break;
    case 'plant': B(.3,.3,.3, 0,.15,0, M.terra); B(.45,.62,.45, 0,.72,0, M.green); break;
    case 'walllamp': {
      B(.05,.22,.05, 0,2.05,0, M.dark);                 // stem
      const lit = new THREE.Mesh(new THREE.BoxGeometry(.13,.2,.13), M.lit);
      lit.position.set(0, y0+2.24, 0); g.add(lit);
      B(.16,.04,.16, 0,2.36,0, M.dark);                 // cap
      break; }
    default: { const s = C.furniture[f.key]; B(s.w, s.h-.14, s.d, 0,(s.h-.14)/2,0, M.wood); }
  }
  g.position.set(f.lx, 0, f.lz);
  g.rotation.y = f.rot*Math.PI/2;
  g.userData.furnRoot = f.id;
  return g;
}

export {FURN_BUILDERS, buildFurn, legacyBuildFurn};
