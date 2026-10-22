import * as THREE from 'three';
import {updateOverlay3D} from './interact3d.js';
import {$, stage} from './dom.js';
import {getBlock, state, ui} from './state.js';
import {resolveWalk, sharedWall, wallSegWorld} from './geometry.js';
import {camera, canvas, controls, needsRender, renderer, scene, setNeedsRender} from './scene.js';
import {toggleRoofs} from './house3d.js';
import {setView} from './ui.js';

/* ===== first-person walkthrough (Walk mode) ===== */
function createWalkController(camera, domElement, opts) {
  opts = opts || {};
  var eyeHeight = typeof opts.eyeHeight === 'number' ? opts.eyeHeight : 1.6;
  var speed = typeof opts.speed === 'number' ? opts.speed : 3.2;
  var onLockChange = typeof opts.onLockChange === 'function' ? opts.onLockChange : null;

  var SENS = 0.0022;        // radians per pixel of mouse movement
  var PITCH_LIMIT = 1.5;    // clamp look up/down to ~±1.5 rad

  // Seed yaw/pitch from the camera's current orientation so the first update
  // does not snap the view. Decompose in YXZ to match how we re-apply it.
  var seed = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  var yaw = seed.y;
  var pitch = seed.x;
  if (pitch > PITCH_LIMIT) pitch = PITCH_LIMIT;
  else if (pitch < -PITCH_LIMIT) pitch = -PITCH_LIMIT;

  var locked = false;
  var everLocked = false; // update() is a pure no-op until the first lock

  // Movement key state (WASD + arrows), stored as logical directions.
  var pressed = { forward: false, back: false, left: false, right: false };

  function setKey(code, down) {
    switch (code) {
      case 'KeyW': case 'ArrowUp':    pressed.forward = down; return true;
      case 'KeyS': case 'ArrowDown':  pressed.back = down;    return true;
      case 'KeyA': case 'ArrowLeft':  pressed.left = down;    return true;
      case 'KeyD': case 'ArrowRight': pressed.right = down;   return true;
    }
    return false;
  }

  function onKeyDown(e) { setKey(e.code, true); }
  function onKeyUp(e)   { setKey(e.code, false); }

  // Accumulate look while pointer-locked to our element. Buffered here,
  // applied to the camera in update().
  function onMouseMove(e) {
    if (document.pointerLockElement !== domElement) return;
    yaw -= e.movementX * SENS;
    pitch -= e.movementY * SENS;
    if (pitch > PITCH_LIMIT) pitch = PITCH_LIMIT;
    else if (pitch < -PITCH_LIMIT) pitch = -PITCH_LIMIT;
  }

  function onPointerLockChange() {
    var now = document.pointerLockElement === domElement;
    if (now !== locked) {
      locked = now;
      if (now) everLocked = true;
      if (onLockChange) { try { onLockChange(locked); } catch (err) {} }
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  function lock() {
    if (domElement && typeof domElement.requestPointerLock === 'function') {
      domElement.requestPointerLock();
    }
  }
  function unlock() {
    if (typeof document.exitPointerLock === 'function') {
      document.exitPointerLock();
    }
  }

  function update(dt, resolve) {
    // No-op-safe: do nothing until we have engaged pointer lock at least once.
    if (!everLocked) return;

    // Apply buffered mouse-look as an YXZ euler: yaw about world Y, pitch
    // about local X, no roll.
    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    if (!(dt > 0)) { camera.position.y = eyeHeight; return; }

    // Flat (pitch-ignored) movement intent relative to current yaw.
    var f = (pressed.forward ? 1 : 0) - (pressed.back ? 1 : 0);
    var s = (pressed.right ? 1 : 0) - (pressed.left ? 1 : 0);

    var ix = 0, iz = 0;
    if (f !== 0 || s !== 0) {
      var sy = Math.sin(yaw), cy = Math.cos(yaw);
      // horizontal forward = (-sy, -cy); right = (cy, -sy)
      ix = -sy * f + cy * s;
      iz = -cy * f - sy * s;
      var len = Math.hypot(ix, iz);
      if (len > 1e-8) { ix /= len; iz /= len; } // normalize diagonals
    }

    var prevX = camera.position.x;
    var prevZ = camera.position.z;
    var nextX = prevX + ix * speed * dt;
    var nextZ = prevZ + iz * speed * dt;

    var outX = nextX, outZ = nextZ;
    if (typeof resolve === 'function') {
      var r = resolve(prevX, prevZ, nextX, nextZ);
      if (r) {
        if (typeof r.x === 'number') outX = r.x;
        if (typeof r.z === 'number') outZ = r.z;
      }
    }

    camera.position.x = outX;
    camera.position.z = outZ;
    camera.position.y = eyeHeight; // pin eye height every frame
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    pressed.forward = pressed.back = pressed.left = pressed.right = false;
  }

  var api = { update: update, lock: lock, unlock: unlock, dispose: dispose };
  // Live boolean, matching three.js PointerLockControls.isLocked convention.
  Object.defineProperty(api, 'isLocked', {
    get: function () { return locked; },
    enumerable: true
  });
  return api;
}

function createWalkOverlay() {
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  // Full-bleed, click-through container. pointer-events:none keeps every
  // click flowing to the canvas underneath so pointer-lock still engages.
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.inset = '0';
  el.style.zIndex = '40';
  el.style.display = 'none';
  el.style.overflow = 'hidden';
  el.style.pointerEvents = 'none';
  el.style.fontFamily = FONT;

  // Centered crosshair dot: semi-transparent white with a solid thin dark
  // ring plus a soft blur, so it stays legible over light or dark scenery.
  const crosshair = document.createElement('div');
  crosshair.style.position = 'absolute';
  crosshair.style.left = '50%';
  crosshair.style.top = '50%';
  crosshair.style.width = '8px';
  crosshair.style.height = '8px';
  crosshair.style.transform = 'translate(-50%, -50%)';
  crosshair.style.borderRadius = '50%';
  crosshair.style.background = 'rgba(255, 255, 255, 0.8)';
  crosshair.style.boxShadow = '0 0 0 1.5px rgba(0, 0, 0, 0.55), 0 0 4px 1px rgba(0, 0, 0, 0.35)';
  crosshair.style.pointerEvents = 'none';
  crosshair.style.display = 'none';

  // Bottom-centered hint pill. white-space:pre preserves the spacing around
  // the separators exactly as written.
  const hint = document.createElement('div');
  hint.style.position = 'absolute';
  hint.style.left = '50%';
  hint.style.bottom = '24px';
  hint.style.transform = 'translateX(-50%)';
  hint.style.padding = '8px 16px';
  hint.style.borderRadius = '999px';
  hint.style.background = 'rgba(0, 0, 0, 0.55)';
  hint.style.color = 'rgba(255, 255, 255, 0.95)';
  hint.style.font = '500 12px/1 ' + FONT;
  hint.style.letterSpacing = '0.02em';
  hint.style.whiteSpace = 'pre';
  hint.style.userSelect = 'none';
  hint.style.pointerEvents = 'none';
  hint.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
  hint.style.backdropFilter = 'blur(4px)';
  hint.style.webkitBackdropFilter = 'blur(4px)';
  hint.textContent = 'WASD to move   ·   Mouse to look   ·   Esc to exit';

  // Big centered "paused" prompt, shown only while pointer-lock is off.
  const panel = document.createElement('div');
  panel.style.position = 'absolute';
  panel.style.left = '50%';
  panel.style.top = '50%';
  panel.style.transform = 'translate(-50%, -50%)';
  panel.style.padding = '16px 28px';
  panel.style.borderRadius = '14px';
  panel.style.background = 'rgba(0, 0, 0, 0.62)';
  panel.style.color = '#ffffff';
  panel.style.font = '600 18px/1.2 ' + FONT;
  panel.style.letterSpacing = '0.01em';
  panel.style.textAlign = 'center';
  panel.style.whiteSpace = 'nowrap';
  panel.style.userSelect = 'none';
  panel.style.pointerEvents = 'none';
  panel.style.boxShadow = '0 10px 34px rgba(0, 0, 0, 0.4)';
  panel.style.backdropFilter = 'blur(4px)';
  panel.style.webkitBackdropFilter = 'blur(4px)';
  panel.textContent = 'Click to look around';

  el.appendChild(crosshair);
  el.appendChild(hint);
  el.appendChild(panel);

  function show() { el.style.display = 'block'; }
  function hide() { el.style.display = 'none'; }
  function setLocked(locked) {
    if (locked) {
      panel.style.display = 'none';
      crosshair.style.display = 'block';
    } else {
      panel.style.display = 'block';
      crosshair.style.display = 'none';
    }
  }

  // Default to the unlocked/paused look (prompt visible, crosshair hidden).
  setLocked(false);

  return { el: el, show: show, hide: hide, setLocked: setLocked };
}

let walkCtl=null, walkOverlay=null, walkRects=[], walkActive=false, walkRoom=null, _walkLastT=0;
const WALK_RADIUS=.28, WALK_EYE=1.6, WALK_WALLT=.12;
// Exterior walls become solid collision rects; interior (shared) walls stay
// passable so you can roam room to room. Open room types add nothing.
function buildWalkRects(){
  const rects=[];
  (state.blocks||[]).forEach(b=>{
    if(b.type==='balcony') return;
    const walls = b.type==='veranda' ? [1,2,3] : [0,1,2,3];
    walls.forEach(wall=>{
      if(sharedWall(b,wall)) return;
      const s=wallSegWorld(b,wall);
      rects.push({x0:Math.min(s.ax,s.bx)-WALK_WALLT, x1:Math.max(s.ax,s.bx)+WALK_WALLT,
                  z0:Math.min(s.az,s.bz)-WALK_WALLT, z1:Math.max(s.az,s.bz)+WALK_WALLT});
    });
  });
  return rects;
}
function enterWalk(){
  const b = getBlock(ui.focusRoomId) || (state.blocks && state.blocks[0]); if(!b) return;
  walkActive=true; ui.walk=true; walkRoom=b;
  if(ui.view!=='3d') setView('3d');
  controls.enabled=false;
  toggleRoofs(false);
  walkRects=buildWalkRects();
  camera.position.set(b.cx, WALK_EYE, b.cz);
  camera.rotation.set(0,0,0,'YXZ');
  if(!walkCtl) walkCtl=createWalkController(camera, canvas, {eyeHeight:WALK_EYE, speed:3.2,
    onLockChange:l=>{ walkOverlay&&walkOverlay.setLocked(l); }});
  if(!walkOverlay){ walkOverlay=createWalkOverlay(); stage.appendChild(walkOverlay.el); }
  walkOverlay.setLocked(false); walkOverlay.show();
  const bw=$('#btnWalk'); bw&&bw.classList.add('on');
  _walkLastT=performance.now();
}
function exitWalk(){
  if(!walkActive) return;
  walkActive=false; ui.walk=false;
  walkCtl&&walkCtl.unlock();
  walkOverlay&&walkOverlay.hide();
  controls.enabled=true;
  const bw=$('#btnWalk'); bw&&bw.classList.remove('on');
  const b=walkRoom||(state.blocks&&state.blocks[0]);
  if(b){ controls.target.set(b.cx,1.1,b.cz); camera.position.set(b.cx+6,5.5,b.cz+7); controls.update(); }
  if(!ui.interior) toggleRoofs(true);
}
// Click the scene to grab the mouse for looking; Esc (while paused) leaves Walk.
canvas.addEventListener('click', ()=>{ if(walkActive && walkCtl && !walkCtl.isLocked) walkCtl.lock(); });
document.addEventListener('keydown', e=>{ if(walkActive && e.key==='Escape' && walkCtl && !walkCtl.isLocked) exitWalk(); });

(function loop(){
  requestAnimationFrame(loop);
  if(walkActive){
    const now=performance.now(); const dt=Math.min(.05,(now-_walkLastT)/1000); _walkLastT=now;
    walkCtl.update(dt, (px,pz,nx,nz)=>resolveWalk(px,pz,nx,nz, WALK_RADIUS, walkRects));
    renderer.render(scene, camera); setNeedsRender(false);
    return;
  }
  // OrbitControls.update() returns true while damping is still moving the camera
  const moving = controls.update();
  if(ui.view!=='3d') return;
  if(needsRender || moving){ renderer.render(scene, camera); setNeedsRender(false); }
  updateOverlay3D();
})();

export {enterWalk, exitWalk, walkActive};
