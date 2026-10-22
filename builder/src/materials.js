import * as THREE from 'three';
import {wallMats} from './scene.js';
import {C} from './catalog.js';
import {state, ui} from './state.js';
import {tint} from './geometry.js';

const facadeTexCache = {};
// ponytail: Procedural textures cap fidelity; add hosted PBR maps when asset loading is justified.
function makeFacadeTexture(matKey, hex){          // 256px ≈ 1 m × 1 m
  const ck = matKey+hex;
  if(facadeTexCache[ck]) return facadeTexCache[ck];
  if(matKey==='paint') return null;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = hex; g.fillRect(0,0,256,256);
  g.fillStyle = 'rgba(0,0,0,.14)';
  if(matKey==='wood'){                            // vertical slats ~12 cm
    for(let x=0; x<256; x+=32) g.fillRect(x,0,3,256);
    g.fillStyle = 'rgba(255,255,255,.05)';
    for(let x=16; x<256; x+=32) g.fillRect(x,0,8,256);
  } else if(matKey==='fluted_wood'){
    for(let x=0; x<256; x+=26){
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x,0,4,256);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x+5,0,2,256);
      g.fillStyle = 'rgba(0,0,0,.035)'; g.fillRect(x+18,0,1,256);
    }
  } else if(matKey==='brick'){                    // running bond, rows ~8 cm
    for(let y=0; y<256; y+=21){
      g.fillRect(0,y,256,2);
      const off = (y/21)%2 ? 32 : 0;
      for(let x=off; x<256; x+=64) g.fillRect(x,y,2,21);
    }
  } else if(matKey==='stone_cladding'){
    for(let row=0,y=0; y<256; row++,y+=48){
      g.fillStyle = 'rgba(0,0,0,.13)'; g.fillRect(0,y,256,2);
      const off = row%2 ? -36 : 0;
      for(let col=0,x=off; x<256; col++,x+=72){
        g.fillStyle = 'rgba(0,0,0,.11)'; g.fillRect(x,y,2,48);
        const shade = ((row*17 + col*31)%9)-4;
        g.fillStyle = shade<0 ? 'rgba(0,0,0,'+(-shade/100)+')' : 'rgba(255,255,255,'+(shade/100)+')';
        g.fillRect(x+2,y+2,70,44);
        g.fillStyle = 'rgba(255,255,255,.045)'; g.fillRect(x+12,y+15+(col%3)*7,42,1);
      }
    }
  } else if(matKey==='metal_panel'){
    for(let x=0; x<256; x+=64){
      g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(x,0,3,256);
      g.fillStyle = 'rgba(255,255,255,.11)'; g.fillRect(x+3,0,2,256);
      g.fillStyle = 'rgba(0,0,0,.025)'; g.fillRect(x+46,0,1,256);
    }
    g.fillStyle = 'rgba(0,0,0,.045)'; g.fillRect(0,128,256,2);
  } else if(matKey==='stucco_matte'){
    for(let y=4; y<256; y+=7) for(let x=4; x<256; x+=7){
      const grain = (x*13 + y*29)%11;
      if(grain<3){
        g.fillStyle = grain===0 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.035)';
        g.fillRect(x,y,grain===0?2:1,1);
      }
    }
  } else if(matKey==='concrete'){                 // panel joints
    g.fillStyle = 'rgba(0,0,0,.08)';
    g.fillRect(0,124,256,4); g.fillRect(124,0,4,256);
    for(let i=0;i<400;i++){
      g.fillStyle = `rgba(0,0,0,${Math.random()*.04})`;
      g.fillRect(Math.random()*256, Math.random()*256, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  facadeTexCache[ck] = tex;
  return tex;
}
/* ===== interior surface materials (procedural, tinted by colour) ===== */
const SURFACE_TEX = {
  plank: (g,S,hex)=>{ const pw=S/4;
  for(let i=0;i<4;i++){ const x=i*pw; const t=((i*37)%7-3)/120;
    g.fillStyle=t<0?'rgba(0,0,0,'+(-t)+')':'rgba(255,255,255,'+t+')'; g.fillRect(x,0,pw,S);
    g.fillStyle='rgba(0,0,0,.15)'; g.fillRect(x,0,2,S);
    g.fillStyle='rgba(255,255,255,.05)'; g.fillRect(x+2,0,1.5,S);
    for(let k=0;k<8;k++){ const gx=x+((i*13+k*29)%(pw-4))+2; const a=.015+((k*17)%3)*.012;
      g.fillStyle='rgba(0,0,0,'+a+')'; g.fillRect(gx,0,1,S); }
    const ey=((i*53+29)%S); g.fillStyle='rgba(0,0,0,.11)'; g.fillRect(x,ey,pw,2); g.fillRect(x,ey-S,pw,2); }
},
  carpet: (g,S,hex)=>{ for(let y=0;y<S;y+=2) for(let x=0;x<S;x+=2){ const h=(x*13+y*29)%11;
    if(h<4){ const a=h===0?.05:.03; g.fillStyle=h%2?'rgba(0,0,0,'+a+')':'rgba(255,255,255,'+a+')'; g.fillRect(x,y,2,1); } }
  for(let y=0;y<S;y+=4){ g.fillStyle='rgba(255,255,255,.02)'; g.fillRect(0,y,S,1); } },
  concrete: (g,S,hex)=>{ const b=16;
  for(let y=0;y<S;y+=b) for(let x=0;x<S;x+=b){ const h=(((x*13+y*29)/b)|0)%9; const a=(h-4)/170;
    g.fillStyle=a<0?'rgba(0,0,0,'+(-a)+')':'rgba(255,255,255,'+a+')'; g.fillRect(x,y,b,b); }
  for(let i=0;i<320;i++){ const x=(i*97)%S,y=(i*57)%S; g.fillStyle='rgba(0,0,0,'+(((i*7)%5)/140)+')'; g.fillRect(x,y,1,1); }
  g.fillStyle='rgba(0,0,0,.07)'; g.fillRect(S/2-1,0,2,S); },
  plaster: (g,S,hex)=>{ for(let y=0;y<S;y+=3) for(let x=0;x<S;x+=3){ const h=(x*17+y*31)%13;
    if(h<3){ g.fillStyle=h===0?'rgba(255,255,255,.045)':'rgba(0,0,0,.03)'; g.fillRect(x,y,h===0?2:1,1); } } },
  wallpaper: (g,S,hex)=>{ const sw=S/16;
  for(let i=0;i<16;i++){ if(i%2){ g.fillStyle='rgba(255,255,255,.028)'; g.fillRect(i*sw,0,sw,S);} }
  g.strokeStyle='rgba(0,0,0,.05)'; g.lineWidth=1; const d=S/8;
  for(let gy=0;gy<=8;gy++) for(let gx=0;gx<=8;gx++){ const cx=gx*d,cy=gy*d;
    g.beginPath(); g.moveTo(cx,cy-4); g.lineTo(cx+4,cy); g.lineTo(cx,cy+4); g.lineTo(cx-4,cy); g.closePath(); g.stroke(); } },
  tile: (g, S, hex) => {
  const n = 2;
  const t = S / n;
  const gw = Math.max(2, S * 0.016);
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const x = ix * t, y = iy * t;
      const h = (ix * 13 + iy * 29) % 5;
      if (h < 2) { g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(x, y, t, t); }
      else if (h > 3) { g.fillStyle = 'rgba(0,0,0,0.025)'; g.fillRect(x, y, t, t); }
      const gr = g.createRadialGradient(x + t / 2, y + t / 2, t * 0.08, x + t / 2, y + t / 2, t * 0.72);
      gr.addColorStop(0, 'rgba(255,255,255,0.10)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      gr.addColorStop(1, 'rgba(0,0,0,0.05)');
      g.fillStyle = gr;
      g.fillRect(x, y, t, t);
      g.fillStyle = 'rgba(255,255,255,0.09)';
      g.fillRect(x + gw, y + gw, t - 2 * gw, 1.5);
      g.fillRect(x + gw, y + gw, 1.5, t - 2 * gw);
      g.fillStyle = 'rgba(0,0,0,0.09)';
      g.fillRect(x + gw, y + t - gw - 1.5, t - 2 * gw, 1.5);
      g.fillRect(x + t - gw - 1.5, y + gw, 1.5, t - 2 * gw);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.16)';
  for (let i = 0; i <= n; i++) {
    const p = i * t;
    g.fillRect(p - gw / 2, 0, gw, S);
    g.fillRect(0, p - gw / 2, S, gw);
  }
  g.fillStyle = 'rgba(0,0,0,0.10)';
  for (let i = 0; i <= n; i++) {
    const p = i * t;
    g.fillRect(p - gw / 4, 0, gw / 2, S);
    g.fillRect(0, p - gw / 4, S, gw / 2);
  }
},
  marble: (g, S, hex) => {
  const blob = (cx, cy, r, col, a) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const x = cx + dx * S, y = cy + dy * S;
      if (x + r < 0 || x - r > S || y + r < 0 || y - r > S) continue;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col + a + ')');
      gr.addColorStop(1, col + '0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
    }
  };
  for (let i = 0; i < 9; i++) {
    const cx = ((i * 67 + 23) % 100) / 100 * S;
    const cy = ((i * 41 + 57) % 100) / 100 * S;
    const r = S * (0.25 + ((i * 29) % 40) / 100);
    const light = (i % 2) === 0;
    blob(cx, cy, r, light ? 'rgba(255,255,255,' : 'rgba(0,0,0,', light ? '0.05' : '0.045');
  }
  const M = S * 0.14;
  const edgeFade = (x, y) => Math.max(0, Math.min(1, Math.min(x, S - x, y, S - y) / M));
  const vein = (x0, y0, ang, len, amp, freq, col, baseA, width) => {
    const steps = 48;
    const perp = ang + Math.PI / 2;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps, t1 = (s + 1) / steps;
      const o0 = Math.sin(t0 * freq * Math.PI * 2) * amp;
      const o1 = Math.sin(t1 * freq * Math.PI * 2) * amp;
      const ax = x0 + Math.cos(ang) * len * t0 + Math.cos(perp) * o0;
      const ay = y0 + Math.sin(ang) * len * t0 + Math.sin(perp) * o0;
      const bx = x0 + Math.cos(ang) * len * t1 + Math.cos(perp) * o1;
      const by = y0 + Math.sin(ang) * len * t1 + Math.sin(perp) * o1;
      const a = baseA * edgeFade((ax + bx) / 2, (ay + by) / 2);
      if (a <= 0.002) continue;
      g.strokeStyle = col + a.toFixed(3) + ')';
      g.lineWidth = width * (0.5 + 0.5 * Math.sin(t0 * Math.PI));
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    }
  };
  vein(S * 0.10, S * 0.22, 0.7, S * 0.95, S * 0.05, 1.5, 'rgba(0,0,0,', 0.11, 1.7);
  vein(S * 0.22, S * 0.05, 0.95, S * 0.9, S * 0.04, 2.2, 'rgba(0,0,0,', 0.07, 1.1);
  vein(S * 0.78, S * 0.14, 2.3, S * 0.8, S * 0.06, 1.2, 'rgba(255,255,255,', 0.12, 1.5);
  vein(S * 0.05, S * 0.72, 0.28, S * 0.85, S * 0.035, 2.8, 'rgba(255,255,255,', 0.08, 0.9);
  vein(S * 0.45, S * 0.32, 1.15, S * 0.5, S * 0.03, 3.0, 'rgba(0,0,0,', 0.06, 0.8);
},
  terrazzo: (g, S, hex) => {
  const rnd = (i, s) => {
    let h = (i * 374761393 + s * 668265263) | 0;
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 1274126177) | 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  };
  const chip = (cx, cy, r, rot, sides, i, col, a) => {
    g.fillStyle = col + a + ')';
    g.beginPath();
    for (let k = 0; k < sides; k++) {
      const ang = rot + k / sides * Math.PI * 2;
      const rr = r * (0.6 + 0.4 * rnd(i, 20 + k));
      const px = cx + Math.cos(ang) * rr;
      const py = cy + Math.sin(ang) * rr;
      if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
  };
  const place = (cx, cy, r, draw) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const x = cx + dx * S, y = cy + dy * S;
      if (x + r < 0 || x - r > S || y + r < 0 || y - r > S) continue;
      draw(x, y);
    }
  };
  const N = 130;
  for (let i = 0; i < N; i++) {
    const cx = rnd(i, 1) * S, cy = rnd(i, 2) * S;
    const r = S * (0.008 + rnd(i, 3) * 0.03);
    const rot = rnd(i, 4) * Math.PI * 2;
    const sides = 4 + Math.floor(rnd(i, 5) * 4);
    const shade = rnd(i, 6);
    let col, a;
    if (shade < 0.42) { col = 'rgba(0,0,0,'; a = (0.06 + rnd(i, 7) * 0.10).toFixed(3); }
    else if (shade < 0.82) { col = 'rgba(255,255,255,'; a = (0.06 + rnd(i, 7) * 0.11).toFixed(3); }
    else { col = 'rgba(255,255,255,'; a = (0.14 + rnd(i, 7) * 0.07).toFixed(3); }
    place(cx, cy, r, (x, y) => chip(x, y, r, rot, sides, i, col, a));
  }
  for (let j = 0; j < 70; j++) {
    const cx = rnd(j, 11) * S, cy = rnd(j, 12) * S;
    const r = S * (0.004 + rnd(j, 13) * 0.008);
    const dark = rnd(j, 14) < 0.5;
    const col = dark ? 'rgba(0,0,0,' : 'rgba(255,255,255,';
    const a = (0.05 + rnd(j, 15) * 0.06).toFixed(3);
    place(cx, cy, r, (x, y) => { g.fillStyle = col + a + ')'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
  }
}
};
const _surfCanvas = {};
function surfaceCanvas(key, hex){
  const ck = key+hex;
  if(_surfCanvas[ck]) return _surfCanvas[ck];
  const draw = SURFACE_TEX[key]; if(!draw) return null;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = hex; g.fillRect(0,0,256,256);
  draw(g, 256, hex);
  return (_surfCanvas[ck] = c);
}
// One CanvasTexture per (finish, colour, repeat) over a cached canvas. Textures
// are owned by the material caches below and never disposed per rebuild.
const _surfTex = new Map();
function makeSurfaceTexture(key, hex, rx, ry){
  const c = surfaceCanvas(key, hex); if(!c) return null;
  rx = Math.max(1, Math.round(rx||1)); ry = Math.max(1, Math.round(ry||1));
  const ck = key+hex+'|'+rx+'|'+ry;
  if(_surfTex.has(ck)) return _surfTex.get(ck);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  _surfTex.set(ck, t);
  return t;
}

// Shared furniture material table — created once, never disposed. Every piece of
// furniture in every rebuild reuses these, so no shader recompiles per piece.
let _furnMats = null;
const FURN_MATS = ()=>_furnMats ??= {
  wood: new THREE.MeshStandardMaterial({color:'#c9a97c', roughness:.75}),
  fabric: new THREE.MeshStandardMaterial({color:'#a9b6c6', roughness:.9}),
  white: new THREE.MeshStandardMaterial({color:'#f5f7f9', roughness:.5}),
  metal: new THREE.MeshStandardMaterial({color:'#b9c0cb', roughness:.35, metalness:.5}),
  dark:  new THREE.MeshStandardMaterial({color:'#5c6470', roughness:.6}),
  green: new THREE.MeshStandardMaterial({color:'#6f9d67', roughness:.85}),
  terra: new THREE.MeshStandardMaterial({color:'#b56548', roughness:.8}),
  glass: new THREE.MeshStandardMaterial({color:'#b9d2ea', roughness:.15, metalness:.3, transparent:true, opacity:.5}),
  // per-model extras that used to be allocated inside each builder
  pillow: new THREE.MeshStandardMaterial({color:'#f2ede4', roughness:.9, metalness:0}),
  screen: new THREE.MeshStandardMaterial({color:'#0a0e14', emissive:'#12233a', emissiveIntensity:.6, roughness:.35, metalness:.1}),
  shade: new THREE.MeshStandardMaterial({color:'#fff4d6', emissive:'#ffdca3', emissiveIntensity:.85, roughness:.6, metalness:0, transparent:true, opacity:.92, side:THREE.DoubleSide}),
  bulb: new THREE.MeshStandardMaterial({color:'#fff2cc', emissive:'#ffe4ad', emissiveIntensity:1, roughness:.5}),
  bulbWarm: new THREE.MeshStandardMaterial({color:'#fff3d0', emissive:'#ffdf9e', emissiveIntensity:1.1, roughness:1, metalness:0}),
  lit: new THREE.MeshStandardMaterial({color:'#ffe9c4', roughness:.4, emissive:'#ffca7a', emissiveIntensity:.9}),
  darkGlass: new THREE.MeshStandardMaterial({color:'#141418', roughness:.15, metalness:.3}),
  art: new THREE.MeshStandardMaterial({color:'#9fb1c0', roughness:.9, metalness:0}),
  rugBorder: new THREE.MeshStandardMaterial({color:'#d9ceb8', roughness:1, metalness:0}),
  rugField: new THREE.MeshStandardMaterial({color:'#8ea6b3', roughness:1, metalness:0}),
  books: ['#8a4b3a','#3a5a8a','#4a7a55','#b0873f','#7a4a6a','#c96a4a'].map(c=>new THREE.MeshStandardMaterial({color:c, roughness:.85, metalness:0})),
};
// Wall/facade material factories. Module-level because the unified roof (built
// outside buildBlockGroup) needs facade material for gable end walls.
//
// Every material here is cached by its inputs and shared across rooms, floors and
// rebuilds — a rebuild allocates geometry only, so there are no shader recompiles
// and nothing to dispose. Ghost floors get per-group CLONES (see ghostify), so the
// in-place opacity tweak never leaks into the active floor.
const facadeMatCache = new Map(), paintMatCache = new Map(), revealMatCache = new Map();
const slabMatCache = new Map(), ceilMatCache = new Map(), roofMatCache = new Map();
const cachedMat = (cache, key, make)=>{ let m = cache.get(key); if(!m){ m = make(); cache.set(key, m); } return m; };
function mkWallMat(opts){
  const m = new THREE.MeshStandardMaterial(Object.assign({roughness:.88, metalness:0, envMapIntensity:.3,
    transparent:true, opacity:ui.wallOpacity}, opts));
  m.depthWrite = ui.wallOpacity > 0.9;
  wallMats.add(m); return m;
}
function mkFacadeMat(faceW, faceH){
  const facadeHex = C.facade[state.facade].hex;
  const rx = Math.max(1, Math.round(faceW*4)/4), ry = Math.max(1, Math.round(faceH*4)/4);
  const ck = state.facadeMat+facadeHex+'|'+rx+'|'+ry;
  return cachedMat(facadeMatCache, ck, ()=>{
    const tex = makeFacadeTexture(state.facadeMat, facadeHex);
    const m = mkWallMat({color:facadeHex});
    if(tex){ m.map = tex.clone(); m.map.needsUpdate = true; m.map.repeat.set(rx, ry); }
    return m;
  });
}
function mkPaintMat(paintHex, wallMat, L, W){
  const rx = wallMat ? Math.max(1, Math.round(Math.max(L,W))) : 0;
  return cachedMat(paintMatCache, paintHex+'|'+(wallMat||'')+'|'+rx, ()=>{
    const m = mkWallMat({color:paintHex});
    // optional wall finish: a tiled texture over the inward faces. Fine-grained
    // finishes (plaster/wallpaper/concrete) tolerate the per-face UV tiling.
    const wt = wallMat ? makeSurfaceTexture(wallMat, paintHex, Math.max(L,W), C.H) : null;
    if(wt){ m.map = wt; m.color.set('#ffffff'); }
    return m;
  });
}
function mkRevealMat(paintHex){ return cachedMat(revealMatCache, paintHex, ()=>mkWallMat({color:tint(paintHex, .3)})); }
function mkRoofMat(roofHex){
  return cachedMat(roofMatCache, roofHex, ()=>new THREE.MeshStandardMaterial({color:roofHex, roughness:.8, envMapIntensity:.35}));
}
// fixed-colour materials shared by every room / roof
const trimMat = new THREE.MeshStandardMaterial({color:'#eef0f2', roughness:.6});
const stepMat = new THREE.MeshStandardMaterial({color:'#d9cdb8', roughness:.8});
const partMat = new THREE.MeshStandardMaterial({color:'#eef0f3', roughness:.9, transparent:true, opacity:Math.min(1, ui.wallOpacity+.1)});
const winFrameMat = new THREE.MeshStandardMaterial({color:'#e4e7ec', roughness:.6});
const winGlassMat = new THREE.MeshStandardMaterial({color:'#b9d2ea', roughness:.15, metalness:.3, transparent:true, opacity:.75});
const doorGlassFrameMat = new THREE.MeshStandardMaterial({color:'#aab2c0', roughness:.4, metalness:.4});
const doorGlassMat = new THREE.MeshStandardMaterial({color:'#b9d2ea', roughness:.12, metalness:.3, transparent:true, opacity:.55});
const doorFrameIntMat = new THREE.MeshStandardMaterial({color:'#eceff2', roughness:.6});
const doorFrameExtMat = new THREE.MeshStandardMaterial({color:'#dfe3e9', roughness:.6});
const doorPanelIntMat = new THREE.MeshStandardMaterial({color:'#fbfcfd', roughness:.5});
const doorPanelExtMat = new THREE.MeshStandardMaterial({color:'#f8f9fb', roughness:.5});
const handleMat = new THREE.MeshStandardMaterial({color:'#aab2c0', metalness:.6, roughness:.35});
const edgeMat = new THREE.LineBasicMaterial({color:'#7f8aa0', transparent:true, opacity:.55});
const fasciaMat = new THREE.MeshStandardMaterial({color:'#30343b', roughness:.6, metalness:.25});
const fasciaSteelMat = new THREE.MeshStandardMaterial({color:'#30343b', roughness:.65, metalness:.25});
const curbMat = new THREE.MeshStandardMaterial({color:'#30343b', roughness:.7, metalness:.18});
const valleyMat = new THREE.MeshStandardMaterial({color:'#30343b', roughness:.55, metalness:.35});
const eavesMat = new THREE.MeshStandardMaterial({color:'#3a3f47', roughness:.7, metalness:.2});
const plantMat = new THREE.MeshStandardMaterial({color:'#6f8258', roughness:1});
const skyFrameMat = new THREE.MeshStandardMaterial({color:'#3a3f47', roughness:.5, metalness:.3});
const skyGlassMat = new THREE.MeshStandardMaterial({color:'#cfe2f4', roughness:.1, metalness:.25,
  emissive:'#9db8d4', emissiveIntensity:.18, transparent:true, opacity:.85});
const soffitMat = new THREE.MeshStandardMaterial({color:'#ffd69a', roughness:.45, emissive:'#ffb85c', emissiveIntensity:.75});

export {FURN_MATS, cachedMat, ceilMatCache, curbMat, doorFrameExtMat, doorFrameIntMat, doorGlassFrameMat, doorGlassMat, doorPanelExtMat, doorPanelIntMat, eavesMat, edgeMat, fasciaMat, fasciaSteelMat, handleMat, makeSurfaceTexture, mkFacadeMat, mkPaintMat, mkRevealMat, mkRoofMat, partMat, plantMat, skyFrameMat, skyGlassMat, slabMatCache, soffitMat, stepMat, trimMat, valleyMat, winFrameMat, winGlassMat};
