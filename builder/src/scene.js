import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {FLH, boundsOf} from './geometry.js';
import {C} from './catalog.js';
import {$} from './dom.js';
import {state} from './state.js';

/* ============================== three.js ============================== */
const canvas = $('#c3d');
// No preserveDrawingBuffer: every pixel read (snapshots, exports) renders
// synchronously right before toDataURL/drawImage, which is all the spec needs.
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
// Once at boot, not per resize — touch devices get 1.5× to keep fill rate sane.
renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Shadow maps are re-rendered only when the geometry changes (rebuild3D, roof /
// wall-opacity toggles set needsUpdate), not every frame.
renderer.shadowMap.autoUpdate = false;
// Render on demand: the loop only draws when something asked for a frame or the
// orbit damping is still moving the camera. Everything that changes what is on
// screen calls requestRender().
let needsRender = true;
function requestRender(){ needsRender = true; }
function requestShadows(){ renderer.shadowMap.needsUpdate = true; needsRender = true; }
// Filmic response instead of raw linear clipping: highlights roll off, so white
// facades and glass stop reading as flat fill. r160 already defaults
// outputColorSpace to SRGBColorSpace — do NOT touch .outputEncoding, it was
// removed in r160 and only logs a warning.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Below 1.0 on purpose: the palette is near-white, and at higher exposure the
// facades sit in the clipped top of the ACES curve with no shading left.
renderer.toneMappingExposure = 0.85;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#eef1f6');
scene.fog = new THREE.Fog('#eef1f6', 30, 70);

// Image-based lighting. Built once at boot (never inside rebuild3D) — every
// MeshStandardMaterial in the scene picks this up with no per-material envMap.
//
// Note r160 has NO scene.environmentIntensity (verified against the bundle; it
// arrives in a later release), so the only way to stop a bright studio IBL
// flattening everything is per-material envMapIntensity. Large diffuse surfaces
// (walls, roof, floor, ground) are damped to ~0.3 where they are created; glass
// and metal keep the default 1.0 so they actually reflect something.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
camera.position.set(10.5, 7.5, 12.5);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.1, 0);
controls.enableDamping = true; controls.dampingFactor = .08;
controls.maxPolarAngle = 1.45; controls.minDistance = 4; controls.maxDistance = 40;
controls.enablePan = false;
controls.addEventListener('change', requestRender);

// Dialled back from 1.15 / 1.6: scene.environment now supplies the ambient fill
// those two were faking. Leaving them high on top of IBL washes out all shading.
scene.add(new THREE.HemisphereLight('#ffffff', '#d8deea', 0.25));
const sun = new THREE.DirectionalLight('#fff6e8', 1.9);
const SUN_DIR = new THREE.Vector3(7, 14, 9).normalize();
sun.position.set(7, 14, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
// frustum is fitted to the plan in fitShadows() on every rebuild
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);   // target must be in the scene for its matrixWorld to update
// Fit the sun's orthographic shadow frustum to the bounding box of every floor's
// blocks (+2 m margin) so the 2048² map is spent on the house, not on 28 m of lawn.
function fitShadows(){
  const floors = state?.floors || [];
  const all = floors.flatMap(f=>f.blocks);
  const bb = all.length ? boundsOf(all) : {cx:0, cz:0, w:4, d:4};
  const fi = state?.floor || 0, top = Math.max(0, floors.length-1);
  const y0 = -fi*FLH(), y1 = (top-fi)*FLH() + C.H + 2.5;
  const R = Math.hypot(bb.w, bb.d, y1-y0)/2 + 2;
  sun.target.position.set(bb.cx, (y0+y1)/2, bb.cz);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, R + 10);
  const sc = sun.shadow.camera;
  sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R;
  sc.near = .5; sc.far = R*2 + 20;
  sc.updateProjectionMatrix();
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300,300),
  new THREE.MeshStandardMaterial({color:'#f2f4f8', roughness:1, envMapIntensity:.25})
);
ground.rotation.x = -Math.PI/2;
scene.add(ground);
const shadowCatcher = new THREE.Mesh(
  new THREE.PlaneGeometry(300,300),
  new THREE.ShadowMaterial({opacity:.14})
);
shadowCatcher.rotation.x = -Math.PI/2; shadowCatcher.position.y = 0.001;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);
const grid = new THREE.GridHelper(80, 80, '#d3d9e3', '#dfe4ec');
grid.position.y = 0.002;
grid.material.transparent = true; grid.material.opacity = .7;
scene.add(grid);

const blocksRoot = new THREE.Group();
scene.add(blocksRoot);

/* plot outline + neighbor context boxes injected by the parent map (embed mode) */
const contextRoot = new THREE.Group();
scene.add(contextRoot);
function setContext(plot, neighbors, facing){
  // Every archit:init (each design DesignerOverlay opens in the kept-alive
  // iframe) rebuilds the plot/neighbour context: free the old GPU buffers,
  // materials and the facing label texture instead of just unparenting them.
  contextRoot.traverse(o=>{
    o.geometry?.dispose();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m=>{ m?.map?.dispose(); m?.dispose(); });
  });
  contextRoot.clear();
  if(plot && plot.w > 0 && plot.d > 0 && facing){
    // compass hint just outside the facing edge; builder -z = north
    const off = {N:[0,-(plot.d/2+2.5)], S:[0,plot.d/2+2.5], E:[plot.w/2+2.5,0], W:[-(plot.w/2+2.5),0]}[facing];
    if(off){
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#e5476f'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 64px system-ui'; g.fillText(facing, 64, 46);
      g.font = '600 26px system-ui'; g.fillText('facing', 64, 98);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c), transparent:true, depthWrite:false}));
      spr.scale.set(3.5, 3.5, 1); spr.position.set(off[0], 1.6, off[1]);
      contextRoot.add(spr);
    }
  }
  if(plot && plot.w > 0 && plot.d > 0){
    const hw = plot.w/2, hd = plot.d/2;
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-hw, .012, -hd), new THREE.Vector3(hw, .012, -hd),
        new THREE.Vector3(hw, .012, hd), new THREE.Vector3(-hw, .012, hd),
      ]),
      new THREE.LineBasicMaterial({color:'#e5476f'})
    );
    contextRoot.add(outline);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(plot.w, plot.d),
      new THREE.MeshStandardMaterial({color:'#f8e9ee', roughness:1})
    );
    plane.rotation.x = -Math.PI/2; plane.position.y = .006;
    contextRoot.add(plane);
  }
  (neighbors || []).forEach(n=>{
    const mat = new THREE.MeshStandardMaterial({color: n.color || '#c8cdd8', transparent:true, opacity:.85});
    let mesh;
    if(n.poly && n.poly.length >= 3){
      // real building footprint: shape in XY, extrude +Z, then rotate so the
      // extrusion points up and shape Y maps onto world -Z (builder z = south)
      const shape = new THREE.Shape(n.poly.map(p => new THREE.Vector2(p[0], -p[1])));
      mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: n.h, bevelEnabled: false}), mat);
      mesh.rotation.x = -Math.PI/2;
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(n.w, n.h, n.d), mat);
      mesh.position.set(n.x, n.h/2, n.z);
    }
    mesh.userData.pick = null;
    contextRoot.add(mesh);
  });
  requestShadows();
}
// Every wall material (paint, reveal, facade) ever created, so the opacity
// dropdown and see-through exports can reach them. Materials are cached and
// reused across rebuilds, so this is a Set, not a per-rebuild list.
const wallMats = new Set();
let selOutline = null;
const selLineMat = new THREE.LineBasicMaterial({color:'#e5476f'});
const selHandleMat = new THREE.MeshBasicMaterial({color:'#e5476f'});

function beam(sx,sy,sz, x,y,z, mat){
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), mat);
  m.position.set(x,y,z); m.castShadow = true;
  return m;
}

export function setNeedsRender(v){ return needsRender = v; }
export function setSelOutline(v){ return selOutline = v; }

export {beam, blocksRoot, camera, canvas, controls, fitShadows, needsRender, pmrem, renderer, requestRender, requestShadows, scene, selHandleMat, selLineMat, selOutline, setContext, wallMats};
