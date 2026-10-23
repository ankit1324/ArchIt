import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/* ============================== geometry batching ============================== */
// A room's walls used to be one Mesh per wall piece, each a 6-material box (6 draw
// calls apiece), plus a Mesh per reveal, rail baluster and stair tread. BoxBatch
// collects all of those axis-aligned boxes into ONE BufferGeometry with a group
// per material, so a room's whole shell costs one draw call per material.
//
// UVs are in metres of room-local space (texture repeat 1 = one tile per metre),
// so facade and wall-finish textures run continuously across piers and lintels.

// face order matches BoxGeometry: [+x, -x, +y, -y, +z, -z]
const FACES = [
  {n:[ 1,0,0], u:[0,0,-1], v:[0,1,0]},
  {n:[-1,0,0], u:[0,0, 1], v:[0,1,0]},
  {n:[0, 1,0], u:[1,0,0],  v:[0,0,-1]},
  {n:[0,-1,0], u:[1,0,0],  v:[0,0, 1]},
  {n:[0,0, 1], u:[1,0,0],  v:[0,1,0]},
  {n:[0,0,-1], u:[-1,0,0], v:[0,1,0]},
];
for(const f of FACES){
  const u = f.u.map(Math.abs), v = f.v.map(Math.abs);
  f.ccw = (u[1]*v[2]-u[2]*v[1])*f.n[0] + (u[2]*v[0]-u[0]*v[2])*f.n[1] + (u[0]*v[1]-u[1]*v[0])*f.n[2] > 0;
}

export class BoxBatch {
  constructor(){ this.parts = new Map(); }   // material -> {pos, nrm, uv, idx}
  /**
   * Box centred at (x,y,z) with size (sx,sy,sz). `mat` is one material or an
   * array of six in BoxGeometry face order.
   */
  add(x, y, z, sx, sy, sz, mat){
    const half = [sx/2, sy/2, sz/2], c = [x, y, z];
    FACES.forEach((f, fi)=>{
      const m = Array.isArray(mat) ? mat[fi] : mat;
      let p = this.parts.get(m);
      if(!p) this.parts.set(m, p = {pos:[], nrm:[], uv:[], idx:[]});
      const base = p.pos.length/3;
      // the face's four corners: centre + n*h ± u*h ± v*h
      for(const [su, sv] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
        const q = [0,1,2].map(k=>c[k] + f.n[k]*half[k] + su*Math.abs(f.u[k])*half[k] + sv*Math.abs(f.v[k])*half[k]);
        p.pos.push(...q);
        p.nrm.push(...f.n);
        p.uv.push(q[0]*f.u[0] + q[1]*f.u[1] + q[2]*f.u[2], q[0]*f.v[0] + q[1]*f.v[1] + q[2]*f.v[2]);
      }
      // the corners run counter-clockwise seen from the side |u| x |v| points to;
      // wind the triangles so the front face looks along n
      if(f.ccw) p.idx.push(base, base+1, base+2, base, base+2, base+3);
      else      p.idx.push(base, base+2, base+1, base, base+3, base+2);
    });
  }
  get empty(){ return this.parts.size === 0; }
  /** One Mesh (geometry groups + material array), or null when nothing was added. */
  toMesh(){
    if(this.empty) return null;
    const pos = [], nrm = [], uv = [], idx = [], mats = [];
    const geo = new THREE.BufferGeometry();
    for(const [m, p] of this.parts){
      const off = pos.length/3, start = idx.length;
      pos.push(...p.pos); nrm.push(...p.nrm); uv.push(...p.uv);
      for(const i of p.idx) idx.push(i + off);
      geo.addGroup(start, p.idx.length, mats.length);
      mats.push(m);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return new THREE.Mesh(geo, mats);
  }
}

/**
 * Flatten a procedurally built model (a Group of small meshes) into one merged
 * geometry per (material, casts-shadow) pair. Parts are baked in the group's
 * own frame. Source geometries are disposed. Returns [{geometry, material, castShadow}].
 */
export function flattenModel(root, castsShadow = o=>o.castShadow){
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const m4 = new THREE.Matrix4();
  root.traverse(o=>{
    if(!o.isMesh) return;
    const cast = castsShadow(o);
    const key = o.material.uuid + (cast ? '|s' : '|n');
    let bk = buckets.get(key);
    if(!bk) buckets.set(key, bk = {material:o.material, castShadow:cast, geos:[]});
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for(const name of Object.keys(g.attributes)) if(!['position','normal','uv'].includes(name)) g.deleteAttribute(name);
    g.clearGroups();
    g.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
    bk.geos.push(g);
  });
  root.traverse(o=>{ if(o.geometry) o.geometry.dispose(); });
  return [...buckets.values()].map(bk=>{
    const geometry = bk.geos.length === 1 ? bk.geos[0] : mergeGeometries(bk.geos, false);
    if(bk.geos.length > 1) bk.geos.forEach(g=>g.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return {geometry, material:bk.material, castShadow:bk.castShadow};
  });
}
