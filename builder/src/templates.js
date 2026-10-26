import './tutorial.js';
import {C} from './catalog.js';
import {EMBED, VIEW, escapeMarkup} from './dom.js';
import {firstRoom, footprint, localToWorld, newRoom, state, wallLen, wallPoint} from './state.js';
import {boundsOf, clampFurn} from './geometry.js';
import {dim, hideModal, modal, showModal} from './ui.js';
import {newProject} from './main.js';

/* ============================== templates ============================== */
// Template reader. Accepts the v1 tuple form [type,cx,cz,opts] and the v2 object
// RoomSpec form (plans/02-template-v2-contract.md §2/§3). Everything past
// type/cx/cz is optional and defaults to v1 behaviour, so the already-sold paid
// templates keep building identically.
const clampRot = v => ((Number(v)||0)%4 + 4)%4;
function tRoomSpec(profile, spec){
  const type = spec.type;
  if(!C.rooms[type]){ console.warn('[builder] unknown room type in template:', type); return null; }
  const b = newRoom(type, Number(spec.cx)||0, Number(spec.cz)||0, clampRot(spec.rot));
  // §2 optional overrides — a template can finally vary size, rotation and finish
  if(spec.w   != null && isFinite(spec.w))   b.w   = Math.min(C.roomMax, Math.max(C.roomMin, Number(spec.w)));
  if(spec.len != null && isFinite(spec.len)) b.len = Math.min(C.roomMax, Math.max(C.roomMin, Number(spec.len)));
  if(spec.name) b.name = String(spec.name);
  if(spec.paint && C.paint[spec.paint]) b.paint = spec.paint;
  if(spec.floorCol && C.floorCol[spec.floorCol]) b.floorCol = spec.floorCol;
  // §4: several v1 templates pass '0'/'0.85' as strings and wallPoint uses strict
  // equality, so wall/t/size all have to be coerced with Number() right here.
  (spec.doors||[]).forEach(([wall,t,dt,dw,dh])=>b.doors.push({
    id:++state.seq.door, wall:clampRot(wall), t:Number(t)||0,
    type:(dt && C.doors[dt]) ? dt : 'int_hard',
    w: dw==null ? 0.8 : Number(dw), h: dh==null ? 2.0 : Number(dh), color:'blue'}));
  (spec.wins||[]).forEach(([wall,t,kind])=>b.windows.push({
    id:++state.seq.win, wall:clampRot(wall), t:Number(t)||0,
    kind: kind==='pano' ? 'pano' : 'std'}));
  // §2.3 explicit furniture REPLACES auto-furnish; clampFurn drops get logged, not swallowed
  if(Array.isArray(spec.furniture)){
    spec.furniture.forEach(([key,lx,lz,rot])=>{
      if(!C.furniture[key]){ console.warn('[builder] unknown furniture key in template:', key); return; }
      const f = {id:++state.seq.furn, key, lx:Number(lx)||0, lz:Number(lz)||0, rot:clampRot(rot)};
      if(clampFurn(b, f)) b.furniture.push(f);
      else console.warn('[builder] furniture dropped, room too small:', key, 'in', type);
    });
  } else furnishRoom(b, profile);
  state.blocks.push(b);
  return b;
}
function tRoom(profile, type, cx, cz, opts={}){
  return tRoomSpec(profile, Object.assign({}, opts, {type, cx, cz}));
}
// Auto-furnish a template room so models read as lived-in homes/offices, not empty
// shells. Room footprints are fixed per type (newRoom uses the catalog w/len), so
// placements are tuned to those dims; clampFurn keeps every piece inside the walls.
function furnishRoom(b, profile){
  const office = profile === 'office';
  const put = (key, lx, lz, rot=0)=>{
    const f = {id:++state.seq.furn, key, lx, lz, rot};
    if(clampFurn(b, f)) b.furniture.push(f);
  };
  switch(b.type){
    case 'bedroom':
      if(office){ put('desk',0,-1.06); put('chair',0,-0.3,2); put('plant',1.4,1.1); }
      else { put('bed',-0.5,-0.36); put('nightstand',0.55,-1.2); put('wardrobe',0.4,1.06); put('plant',1.5,-1.1); }
      break;
    case 'hall':
      if(office){ put('desk',-0.9,-0.4); put('chair',-0.9,0.4,2); put('desk',0.9,-0.4); put('chair',0.9,0.4,2); put('plant',2.0,-1.3); }
      else {
        put('sofa',-0.4,-1.21); put('coffee',-0.4,-0.2); put('tv',-0.4,1.46); put('plant',2.0,-1.3);
        put('table',1.5,0.6); put('chair',1.5,-0.1,0); put('chair',1.5,1.3,2); put('chair',0.85,0.6,1); put('chair',2.15,0.6,3);
      }
      break;
    case 'kitchen':
      put('kunit',0,-0.76); put('fridge',1.01,0.71);
      if(!office) put('kunit',-1.06,0,1);
      break;
    case 'bath':
      put('toilet',-0.7,-0.435); put('basin',0.6,-0.56);
      if(!office) put('shower',0.61,0.31);
      break;
    case 'hallway':
      put('plant',-1.4,0.2); put('walllamp',1.5,0.3);
      break;
    case 'veranda':
      put('coffee',0,0); put('chair',-0.7,0,1); put('chair',0.7,0,3); put('plant',1.4,-0.7);
      break;
    case 'balcony':
      put('chair',0.5,0,3); put('plant',-1.1,0);
      break;
  }
}
const TEMPLATES = {};
function addTemplate(key, name, cat, desc, rooms, profile){
  const prof = profile || (cat === 'office' ? 'office' : 'home');
  TEMPLATES[key] = {name, cat, desc, rooms, build(){ rooms.forEach(room=>Array.isArray(room) ? tRoom(prof, ...room) : tRoomSpec(prof, room)); }};
}
const D = {front:{doors:[[2,.5,'ext_hard']]}, entry:{doors:[[0,.85,'ext_hard']]}, glass:{doors:[[0,.5,'ext_glass']]}, plain:{doors:[[0,.5]]}, side:{doors:[[3,.5]]}, win:{wins:[[1,.5]]}, back:{wins:[[2,.5]]}};
const room = (type, cx, cz, opts={})=>[type, cx, cz, opts];

// Rectangular starter plans share exact wall coordinates. w is the Z dimension;
// len is X in the renderer. Explicit furniture keeps circulation clear.
function planRoom(type, x0, z0, x1, z1, options={}){
  const clean = n=>Math.round(n*1000)/1000;
  return {type, cx:clean((x0+x1)/2), cz:clean((z0+z1)/2), len:clean(x1-x0), w:clean(z1-z0), ...options};
}

// Indian houses (12)
addTemplate('in_1bhk', '1BHK Compact Indian House', 'indian', 'Veranda, living room, kitchen, bedroom and bath', [
  planRoom('hall',-3.6,0,3.6,3.6,{name:'Living & dining',doors:[[0,.5,'ext_hard',1]],wins:[[3,.5],[1,.5]],furniture:[['sofa',-2.7,0,1],['coffee',-1.5,0],['table',2,0],['chair',2,-.8],['chair',2,.8,2]]}),
  planRoom('bedroom',-3.6,-3.6,0,0,{name:'Bedroom',doors:[[1,.25]],wins:[[3,.5],[2,.5]],furniture:[['bed',-.5,-.66],['wardrobe',-.3,1.36,2]]}),
  planRoom('kitchen',0,-3.6,3.6,-1.8,{name:'Kitchen',doors:[[0,.25]],wins:[[2,.7]],furniture:[['kunit',0,-.46],['fridge',1.3,-.41]]}),
  planRoom('hallway',0,-1.8,1.8,0,{name:'Passage',doors:[[0,.5]],furniture:[]}),
  planRoom('bath',1.8,-1.8,3.6,0,{name:'Bathroom',doors:[[3,.5]],wins:[[1,.5]],furniture:[['toilet',.5,-.4],['basin',.5,.55,2]]}),
  planRoom('veranda',-1.8,3.6,1.8,5.1,{name:'Entry porch',furniture:[['plant',-1.4,0],['chair',1.2,0]]}),
]);
addTemplate('in_2bhk', '2BHK Indian Family Home', 'indian', 'Family hall, kitchen, two bedrooms and two baths', [
  planRoom('hall',-4.8,1.2,1.2,4.2,{name:'Living & dining',doors:[[0,.65,'ext_hard',1]],wins:[[3,.5]],furniture:[['sofa',-1.5,-.91],['coffee',-1.5,.1],['table',2.16,.96],['chair',1.7,.1],['chair',2.6,.1]]}),
  planRoom('hallway',-1.2,-4.2,1.2,1.2,{name:'Family passage',doors:[[0,.5]],wins:[[2,.5]],furniture:[]}),
  planRoom('bedroom',-4.8,-4.2,-1.2,-.6,{name:'Main bedroom',doors:[[1,.75]],wins:[[3,.5],[2,.5]],furniture:[['bed',-.55,-.66],['wardrobe',-.4,1.36,2]]}),
  planRoom('bedroom',1.2,-4.2,4.8,-.6,{name:'Bedroom 2',doors:[[3,.75]],wins:[[1,.5],[2,.5]],furniture:[['bed',.55,-.66],['wardrobe',.4,1.36,2]]}),
  planRoom('bath',-4.8,-.6,-1.2,1.2,{name:'Bathroom 1',doors:[[1,.5]],wins:[[3,.5]],furniture:[['shower',-1.2,0],['toilet',0,-.4],['basin',.75,-.5]]}),
  planRoom('bath',1.2,-.6,4.8,1.2,{name:'Bathroom 2',doors:[[3,.5]],wins:[[1,.5]],furniture:[['shower',1.2,0],['toilet',0,-.4],['basin',-.75,-.5]]}),
  planRoom('kitchen',1.2,1.2,4.8,4.2,{name:'Kitchen',doors:[[3,.25]],wins:[[1,.5],[0,.5]],furniture:[['kunit',-.05,-1.06],['fridge',1.25,-1.01]]}),
  planRoom('veranda',-2.4,4.2,1.2,5.7,{name:'Entry porch',furniture:[['plant',-1.4,0],['chair',1.2,0]]}),
]);
addTemplate('in_3bhk', '3BHK Modern Indian Home', 'indian', 'Living hall, kitchen, three bedrooms, bath and balcony', [
  planRoom('bedroom',0,0,3.6,3.6,{name:'Bedroom 2',paint:'blush',floorCol:'oak',doors:[[1,0.167]],wins:[[2,0.583],[3,0.417]],furniture:[['bed',-0.65,-0.3,1],['nightstand',-1.45,-1.35,1],['nightstand',-1.45,0.75,1],['wardrobe',-0.5,1.35,2],['desk',1.05,-1.35],['office_chair',1.05,-0.55,2],['rug',0.1,-0.3,1]]}),
  planRoom('bedroom',0,3.6,3.6,7.8,{name:'Master bedroom',paint:'sage',floorCol:'walnut',doors:[[1,0.143]],wins:[[3,0.452]],furniture:[['bed',-0.65,-0.2,1],['nightstand',-1.45,-1.45,1],['nightstand',-1.45,1.05,1],['wardrobe',0.75,-1.65],['dresser',-0.4,1.7,2],['rug',0.1,-0.2,1]]}),
  planRoom('hallway',3.6,0,4.8,7.8,{name:'Bedroom passage',floorCol:'ash',doors:[[0,0.5]],furniture:[]}),
  planRoom('bedroom',4.8,0,8,3.6,{name:'Bedroom 3',paint:'lavender',floorCol:'ash',doors:[[3,0.833]],wins:[[2,0.5],[1,0.556]],furniture:[['bed',0.45,-0.2,3],['nightstand',1.25,-1.35,3],['nightstand',1.25,0.95,3],['wardrobe',0.15,1.35,2],['rug',-0.1,-0.2,1]]}),
  planRoom('bath',4.8,3.6,8,5.4,{name:'Common bath',paint:'white',floorCol:'wtile',doors:[[3,0.5,'int_pvc',0.75]],wins:[[1,0.5]],furniture:[['bath',0.6,-0.375],['toilet',-0.2,0.425,2],['basin',0.5,0.55,2],['mirror_cab',0.5,0.675,2]]}),
  planRoom('kitchen',4.8,5.4,8,7.8,{name:'Kitchen',paint:'mint',floorCol:'gtile',doors:[[0,0.188]],wins:[[1,0.5]],furniture:[['kunit',-0.55,-0.75],['kunit',1.15,-0.15,3],['fridge',0.2,0.7,2]]}),
  planRoom('hall',0,7.8,8,11.4,{name:'Living & dining hall',paint:'cream',floorCol:'honey',doors:[[0,0.525,'ext_hard',1],[1,0.194,'ext_glass',0.9]],wins:[[0,0.225],[0,0.825],[3,0.5]],furniture:[['tv',-2.2,-1.45],['sofa',-2.2,1.2,2],['coffee',-2.2,0],['armchair',-3.4,0,1],['rug',-2.2,0],['plant',-0.9,-1.4],['table',2.6,-0.1],['chair',2.2,-0.95],['chair',3,-0.95],['chair',2.2,0.75,2],['chair',2.95,0.75,2]]}),
  planRoom('balcony',8,7.8,9.5,11.4,{name:'Balcony',floorCol:'slate',furniture:[['chair',0.3,-0.7,3],['chair',0.3,0,3],['plant',0.25,-1.4]]}),
]);
addTemplate('in_vastu', 'Vastu 2BHK Home', 'indian', 'Living, kitchen and bedrooms arranged in vastu zones', [
  planRoom('bedroom',0,0,3.6,3.6,{name:'Bedroom 2 (north-west)',paint:'blush',floorCol:'oak',doors:[[1,0.167]],wins:[[2,0.5],[3,0.417]],furniture:[['bed',-0.65,-0.3,1],['nightstand',-1.45,-1.35,1],['nightstand',-1.45,0.75,1],['wardrobe',-0.5,1.35,2],['rug',0.1,-0.3,1]]}),
  planRoom('bath',0,3.6,3.6,5.4,{name:'Bath (west)',paint:'white',floorCol:'wtile',doors:[[1,0.278,'int_pvc',0.75]],wins:[[3,0.5]],furniture:[['bath',-0.8,-0.375],['toilet',-0.6,0.425,2],['basin',0.6,-0.55],['mirror_cab',0.6,-0.675]]}),
  planRoom('bedroom',0,5.4,3.6,9,{name:'Master bedroom (south-west)',paint:'sage',floorCol:'walnut',doors:[[1,0.222]],wins:[[3,0.5],[0,0.528]],furniture:[['bed',-0.65,0,1],['nightstand',-1.45,-1.25,1],['nightstand',-1.45,1.25,1],['wardrobe',0.75,-1.35],['dresser',0.1,1.4,2],['rug',0.1,0,1]]}),
  planRoom('hall',3.6,0,9.6,4.2,{name:'Living room (north-east)',paint:'cream',floorCol:'honey',doors:[[1,0.714,'ext_hard',1]],wins:[[2,0.867],[2,0.5,'pano']],furniture:[['sofa',0,-1.5],['tv',0,1.75,2],['coffee',0,0],['rug',0,0],['armchair',1.7,0.2,3],['armchair',-1.7,-0.2,1],['plant',2.6,-1.7]]}),
  planRoom('veranda',9.6,0,11.4,4.2,{name:'East entrance veranda',floorCol:'terra',furniture:[['chair',0.4,0.3,3],['chair',0.4,1.1,3],['plant',0.4,-1.6]]}),
  planRoom('hall',3.6,4.2,6.6,9,{name:'Dining (centre)',paint:'beige',floorCol:'honey',doors:[[2,0.5]],wins:[[0,0.5]],furniture:[['table',0,0.3,1],['chair',-0.85,-0.1,1],['chair',-0.85,0.7,1],['chair',0.85,-0.1,3],['chair',0.85,0.7,3],['plant',1.1,2]]}),
  planRoom('kitchen',6.6,4.2,9.6,9,{name:'Kitchen (south-east)',paint:'mint',floorCol:'gtile',doors:[[3,0.167]],wins:[[1,0.417],[0,0.45]],furniture:[['fridge',1,-1.9],['kunit',1.05,0.4,3],['kunit',-0.15,1.95,2],['kunit',-1.05,0.6,1]]}),
]);
addTemplate('in_villa', 'South Indian Courtyard Villa', 'indian', 'Front and rear verandas with three bedrooms', [
  planRoom('veranda',3.3,0,8.7,1.8,{name:'Rear veranda',floorCol:'terra',furniture:[['armchair',0,0,2],['side_table',0.75,0],['armchair',1.5,0,2],['plant',2.25,-0.4]]}),
  planRoom('kitchen',0,1.8,3.3,4.8,{name:'Kitchen',paint:'cream',floorCol:'terra',doors:[[1,0.5],[3,0.2,'ext_metal',0.8]],wins:[[2,0.394]],furniture:[['kunit',0.6,-1.05],['kunit',-0.45,1.05,2],['fridge',-1.15,0.3,1]]}),
  planRoom('hall',3.3,1.8,8.7,4.8,{name:'Dining hall',paint:'beige',floorCol:'terra',doors:[[2,0.796,'ext_glass',0.9]],wins:[[2,0.259]],furniture:[['table',0.3,0],['chair',-0.1,-0.85],['chair',0.7,-0.85],['chair',-0.1,0.85,2],['chair',0.7,0.85,2],['chair',-0.85,0,1],['chair',1.45,0,3]]}),
  planRoom('bedroom',8.7,1.8,12,6.6,{name:'Bedroom 3',paint:'lavender',floorCol:'ash',doors:[[3,0.312]],wins:[[2,0.303],[1,0.5]],furniture:[['bed',0.5,0,3],['nightstand',1.3,-1.05,3],['nightstand',1.3,1.05,3],['wardrobe',0,1.95,2],['desk',-0.35,-1.95],['office_chair',-0.35,-1.35,2],['rug',-0.95,0,1]]}),
  planRoom('bath',0,4.8,3.3,6.6,{name:'Common bath',paint:'white',floorCol:'wtile',doors:[[1,0.5,'int_pvc',0.75]],wins:[[3,0.5]],furniture:[['bath',-0.65,0.375,2],['toilet',-1.15,-0.425],['basin',-0.05,-0.55],['mirror_cab',-0.05,-0.675]]}),
  planRoom('hallway',3.3,4.8,4.5,8.4,{name:'West courtyard passage',floorCol:'terra',doors:[[2,0.5],[0,0.5]],furniture:[]}),
  planRoom('veranda',4.5,4.8,7.5,8.4,{name:'Nadumuttam courtyard',floorCol:'slate',furniture:[['plant',0,-0.2],['plant',-1.1,-1.4],['plant',1.1,-1.4]]}),
  planRoom('hallway',7.5,4.8,8.7,8.4,{name:'East courtyard passage',floorCol:'terra',doors:[[2,0.5],[0,0.5]],furniture:[]}),
  planRoom('hallway',0,6.6,3.3,8.4,{name:'Pooja room',paint:'cream',floorCol:'wtile',doors:[[1,0.5]],wins:[[3,0.5]],furniture:[['side_table',-1.05,0],['wall_art',-0.05,-0.725],['rug',0.05,0]]}),
  planRoom('bath',8.7,6.6,12,8.4,{name:'Master bath',paint:'white',floorCol:'wtile',doors:[[0,0.273,'int_pvc',0.75]],wins:[[1,0.5]],furniture:[['bath',0.65,0.375,2],['toilet',0.15,-0.425],['basin',-1.25,-0.55],['mirror_cab',-1.2,-0.675]]}),
  planRoom('bedroom',0,8.4,3.3,12,{name:'Bedroom 2',paint:'blush',floorCol:'oak',doors:[[1,0.833]],wins:[[3,0.556],[0,0.5]],furniture:[['bed',-0.5,0.2,1],['nightstand',-1.3,-0.85,1],['nightstand',-1.3,1.25,1],['wardrobe',1.2,0.7,3],['rug',0.15,0.2,1]]}),
  planRoom('hall',3.3,8.4,8.7,12,{name:'Living hall',paint:'cream',floorCol:'terra',doors:[[0,0.5,'ext_hard',1],[2,0.5,'ext_glass',1.5]],wins:[[0,0.185],[0,0.815]],furniture:[['sofa',-2.1,0.4,1],['coffee',-1,0.4,1],['tv',2.35,0.4,3],['floor_lamp',2.35,-0.53],['rug',-0.6,0.4,1],['plant',2.3,1.4]]}),
  planRoom('bedroom',8.7,8.4,12,12,{name:'Master bedroom',paint:'sage',floorCol:'walnut',doors:[[3,0.167]],wins:[[1,0.444],[0,0.5]],furniture:[['bed',0.5,0.2,3],['nightstand',1.3,-0.85,3],['nightstand',1.3,1.25,3],['wardrobe',-1.2,0.7,1],['rug',0.55,0.2,1]]}),
  planRoom('veranda',3.3,12,8.7,14.1,{name:'Thinnai (front veranda)',floorCol:'terra',furniture:[['armchair',-1.4,0,1],['armchair',1.4,0,3],['plant',-2.25,0.6],['plant',2.25,0.6]]}),
]);
addTemplate('in_kothi', 'North Indian Kothi (4BHK)', 'indian', 'Foyer, living, kitchen, four bedrooms and balconies', [
  planRoom('balcony',6,-1.5,10.2,0,{name:'Master balcony',floorCol:'slate',furniture:[['chair',-1.4,0,2],['side_table',-0.9,0],['chair',-0.4,0,2],['plant',1.7,0]]}),
  planRoom('bedroom',0,0,4.2,3.6,{name:'Bedroom 3',paint:'lavender',floorCol:'ash',doors:[[0,0.857]],wins:[[2,0.5],[3,0.444]],furniture:[['bed',-0.95,-0.2,1],['nightstand',-1.75,-1.3,1],['nightstand',-1.75,0.9,1],['wardrobe',1.65,-0.5,3],['dresser',-0.8,1.4,2],['rug',-0.1,-0.2,1]]}),
  planRoom('bath',4.2,0,6,3.6,{name:'Common bath',paint:'white',floorCol:'wtile',doors:[[0,0.5,'int_pvc',0.75]],wins:[[2,0.5]],furniture:[['basin',-0.45,-1.45],['mirror_cab',-0.45,-1.575],['toilet',0.45,-1.325],['shower',0.3,0.1,3]]}),
  planRoom('bedroom',6,0,10.2,3.6,{name:'Master bedroom',paint:'sage',floorCol:'walnut',doors:[[0,0.31],[2,0.333,'ext_glass',0.9]],wins:[[2,0.762]],furniture:[['bed',-0.95,-0.2,1],['nightstand',-1.75,-1.25,1],['nightstand',-1.75,0.85,1],['wardrobe',1.65,-0.3,3],['rug',-0.1,-0.2,1]]}),
  planRoom('bath',10.2,0,12,3.6,{name:'Master bath',paint:'white',floorCol:'wtile',doors:[[3,0.833,'int_pvc',0.75]],wins:[[1,0.444]],furniture:[['shower',0.3,-1.2],['toilet',0.425,0.2,3],['basin',-0.55,-0.4,1],['mirror_cab',-0.675,-0.4,1]]}),
  planRoom('kitchen',0,3.6,3,7.2,{name:'Kitchen',paint:'mint',floorCol:'gtile',doors:[[0,0.8]],wins:[[3,0.5]],furniture:[['kunit',-1.05,-0.75,1],['kunit',0.45,-1.35],['fridge',1,0.1,3]]}),
  planRoom('hallway',3,3.6,7.8,4.8,{name:'Bedroom corridor',floorCol:'ash',doors:[[0,0.813]],furniture:[]}),
  planRoom('hallway',3,4.8,4.8,7.2,{name:'Pooja room',paint:'cream',floorCol:'wtile',doors:[[0,0.5]],furniture:[['side_table',0,-0.8],['wall_art',0,-1.025],['rug',0,-0.1,1]]}),
  planRoom('hallway',4.8,4.8,6,7.2,{name:'Store',floorCol:'slate',doors:[[1,0.25]],furniture:[['bookshelf',0,-0.875]]}),
  planRoom('hallway',6,4.8,7.8,12.6,{name:'Foyer & gallery',paint:'beige',floorCol:'terra',doors:[[0,0.5,'ext_hard',1]],furniture:[]}),
  planRoom('bedroom',7.8,3.6,12,7.2,{name:'Bedroom 2',paint:'blush',floorCol:'oak',doors:[[3,0.667]],wins:[[1,0.5]],furniture:[['bed',0.95,0,3],['nightstand',1.75,-1.05,3],['nightstand',1.75,1.05,3],['wardrobe',-1.05,-1.35],['desk',-0.9,1.35,2],['office_chair',-0.9,0.6],['rug',-0.5,0,1]]}),
  planRoom('bath',7.8,7.2,12,9,{name:'Bath 2',paint:'white',floorCol:'wtile',doors:[[3,0.5,'int_pvc',0.75]],wins:[[1,0.5]],furniture:[['basin',-0.9,-0.55],['mirror_cab',-0.9,-0.675],['toilet',0.1,-0.425],['bath',1.1,0.375,2]]}),
  planRoom('hall',0,7.2,6,12.6,{name:'Living & dining',paint:'cream',floorCol:'honey',doors:[[1,0.444,'int_panel',1.5]],wins:[[3,0.315],[0,0.25],[0,0.75]],furniture:[['table',0,-1],['chair',-0.4,-1.65],['chair',0.4,-1.65],['chair',-0.4,-0.35,2],['chair',0.4,-0.35,2],['chair',-1.15,-1,1],['chair',1.15,-1,3],['tv',-2.65,1,1],['sofa',0.3,1,3],['coffee',-1.1,1,1],['rug',-1,1,1],['armchair',-1.1,2.1,2],['plant',2.6,2.3]]}),
  planRoom('bedroom',7.8,9,12,12.6,{name:'Bedroom 4',paint:'greige',floorCol:'oak',doors:[[3,0.167],[1,0.333,'ext_glass',1.2]],wins:[[0,0.524]],furniture:[['bed',0.1,-0.65],['nightstand',-1.05,-1.45],['nightstand',1.35,-1.45],['wardrobe',-1.65,0.7,1],['dresser',0.1,1.4,2],['rug',0.1,-0.2]]}),
  planRoom('balcony',12,9,13.5,12.6,{name:'Balcony',floorCol:'slate',furniture:[['chair',0.35,-1.2,3],['chair',0.35,-0.5,3],['plant',0.35,1.4]]}),
  planRoom('veranda',0,12.6,7.8,14.4,{name:'Front porch',floorCol:'slate',furniture:[['armchair',-2.7,0],['coffee',-1.6,0],['armchair',-0.5,0],['plant',1.7,0],['plant',3.5,0.4]]}),
]);
addTemplate('in_row', 'Builder Floor / Row House', 'indian', 'Long home with porch, living, kitchen and two bedrooms', [
  planRoom('hall',-3,3,3,6,{name:'Living & dining',doors:[[0,.5,'ext_hard',1]],wins:[[3,.5],[1,.5]],furniture:[['sofa',-1.7,0],['coffee',-1.7,.85],['table',1,0],['chair',1,-.8],['chair',1,.8,2]]}),
  planRoom('hallway',1.5,-3.6,3,3,{name:'Passage',doors:[[0,.5]],wins:[[1,.45]],furniture:[]}),
  planRoom('kitchen',-3,1.2,1.5,3,{name:'Kitchen',doors:[[1,.5]],wins:[[3,.5]],furniture:[['kunit',.3,-.46],['fridge',-1,-.41]]}),
  planRoom('bedroom',-3,-2.4,1.5,1.2,{name:'Bedroom 2',doors:[[1,.3]],wins:[[3,.5]],furniture:[['bed',-.7,-.66],['wardrobe',-.5,1.36,2]]}),
  planRoom('bedroom',-3,-6,1.5,-2.4,{name:'Main bedroom',doors:[[1,1/6],[2,.5,'ext_glass',1]],wins:[[3,.5]],furniture:[['bed',-1.11,0,1],['wardrobe',1.81,-.6,3]]}),
  planRoom('bath',1.5,-6,3,-3.6,{name:'Bathroom',doors:[[0,.5]],wins:[[1,.5]],furniture:[['toilet',0,-.65],['basin',.41,.1,3]]}),
  planRoom('veranda',-1.8,6,1.8,7.5,{name:'Entry porch',furniture:[['plant',-1.4,0],['chair',1.2,0]]}),
  planRoom('balcony',-3,-7.5,1.5,-6,{name:'Rear balcony',furniture:[['chair',1.6,0],['plant',-1.7,0]]}),
]);
addTemplate('in_village', '1KTH Village House', 'indian', 'Front veranda, large hall, kitchen and bathroom', [
  planRoom('hall',-3,0,3,4.2,{name:'Hall',doors:[[0,.5,'ext_hard',1]],wins:[[3,.5],[1,.5],[0,.2]],furniture:[['sofa',-2.41,.9,1],['coffee',-1.4,.9,1],['table',-1.9,-1.5],['chair',-2.3,-.65,2],['chair',-1.5,-.65,2],['bed',1.86,-.2,3],['wardrobe',1.9,1.66,2]]}),
  planRoom('kitchen',-3,-2.4,.6,0,{name:'Kitchen',doors:[[0,.75]],wins:[[3,.5],[2,.5]],furniture:[['kunit',0,-.76],['kunit',-1.36,-.1,1],['fridge',1.31,-.71]]}),
  planRoom('bath',.6,-2.4,3,0,{name:'Bathroom',doors:[[0,.3]],wins:[[2,.7]],furniture:[['toilet',-.5,-.735],['shower',.61,-.61],['basin',.86,.5,3]]}),
  planRoom('veranda',-3,4.2,3,6.6,{name:'Front veranda',furniture:[['bed_single',-1.86,.1,1],['chair',1.3,.2],['chair',2.1,.2],['plant',2.5,-.8]]}),
]);
addTemplate('in_courtyard', 'Traditional Courtyard House', 'indian', 'Perimeter rooms around a central family hall', [
  planRoom('hall',-2.4,-2.4,2.4,2.4,{name:'Family hall',doors:[[0,.5417,'ext_hard',1]],wins:[[0,.1875]],furniture:[['sofa',-1.15,-.3,1],['coffee',-.2,-.3,1],['rug',-.6,-.3,1],['table',1,-.3,1],['chair',1,-1.25],['chair',1,.65,2],['chair',1.65,-.3,3]]}),
  planRoom('veranda',-2.4,2.4,1.2,5.4,{name:'Entrance veranda',furniture:[['chair',-1.2,.3,1],['coffee',-.5,.3,1],['chair',.2,.3,3],['plant',-1.43,1.13],['plant',1.43,1.13]]}),
  planRoom('bedroom',-5.4,-5.4,-1.2,-2.4,{name:'Bedroom 1',doors:[[0,.857]],wins:[[3,.5],[2,.5]],furniture:[['bed',-.6,-.36],['nightstand',-1.625,-1.16],['nightstand',.425,-1.16],['wardrobe',1.66,-.46,3]]}),
  planRoom('bath',-1.2,-5.4,1.2,-2.4,{name:'Common bath',doors:[[0,.5]],wins:[[2,.7]],furniture:[['toilet',-.6,-1.035],['shower',.61,-.91],['basin',-.86,.2,1]]}),
  planRoom('hallway',1.2,-5.4,2.4,-2.4,{name:'Store',doors:[[0,.5]],furniture:[['bookshelf',0,-1.185],['bookshelf',-.285,-.3,1]]}),
  planRoom('bedroom',2.4,-5.4,5.4,-1.2,{name:'Bedroom 2',doors:[[3,.857]],wins:[[1,.5]],furniture:[['bed',.36,0,3],['nightstand',1.16,-1.025,3],['nightstand',1.16,1.025,3],['wardrobe',-.46,-1.66]]}),
  planRoom('kitchen',2.4,-1.2,5.4,2.4,{name:'Kitchen',doors:[[3,.5]],wins:[[1,.5]],furniture:[['kunit',1.06,0,3],['kunit',0,-1.36],['fridge',1.01,1.31,2]]}),
  planRoom('bedroom',1.2,2.4,5.4,5.4,{name:'Bedroom 3',doors:[[2,.857]],wins:[[0,.5],[3,.5]],furniture:[['bed',0,.36,2],['nightstand',-1.025,1.16,2],['nightstand',1.025,1.16,2],['wardrobe',1.66,-.46,3]]}),
  planRoom('bedroom',-5.4,1.2,-2.4,5.4,{name:'Bedroom 4',doors:[[1,.857]],wins:[[3,.476],[1,.357]],furniture:[['bed',-.36,-.1,1],['nightstand',-1.16,-1.125,1],['nightstand',-1.16,.925,1],['wardrobe',0,1.66,2]]}),
  planRoom('bath',-5.4,-2.4,-2.4,0,{name:'Bath 2',doors:[[1,.5]],wins:[[3,.5]],furniture:[['toilet',-1.035,-.6,1],['shower',.2,-.61],['basin',-.6,.86,2]]}),
  planRoom('hallway',-5.4,0,-2.4,1.2,{name:'Pooja',doors:[[1,.5]],furniture:[['side_table',-1.06,0],['wall_art',-1.335,0,1]]}),
]);
addTemplate('in_bungalow', 'Luxury 5BHK Indian Villa', 'indian', 'Grand hall, kitchen, five bedrooms, baths and balconies', [
  planRoom('veranda',-3.6,6,3.6,8.4,{name:'Entrance veranda',furniture:[['armchair',-2.9,.1,1],['coffee',-2,.1,1],['armchair',-1.1,.1,3],['plant',1.2,-.8],['plant',3,.7]]}),
  planRoom('hall',-3.6,0,3.6,6,{name:'Grand hall',doors:[[0,.5,'ext_hard',1.2]],wins:[[0,.1806,'pano'],[0,.8194,'pano']],furniture:[['tv',-3.26,1.6,1],['sofa',-1.2,1.6,3],['coffee',-2.2,1.6,1],['rug',-2.2,1.6,1],['table',2,.9],['chair',1.6,.05],['chair',2.4,.05],['chair',1.6,1.75,2],['chair',2.4,1.75,2],['chair',.85,.9,1],['chair',3.15,.9,3],['plant',-3.235,-2.635],['plant',3.235,-2.635],['plant',0,-2.635]]}),
  planRoom('bedroom',-8,2.4,-3.6,6,{name:'Bedroom 1',doors:[[1,.8333]],wins:[[3,.5],[0,.432]],furniture:[['bed',-.3,.66,2],['nightstand',-1.325,1.46,2],['nightstand',.725,1.46,2],['wardrobe',1.76,.66,3],['dresser',-1.81,-.2,1]]}),
  planRoom('bath',-8,0,-5.6,2.4,{name:'Bath 1 (attached)',doors:[[0,.6]],wins:[[3,.5]],furniture:[['toilet',-.735,-.3,1],['shower',.61,-.61],['basin',-.86,.6,1]]}),
  planRoom('bath',-5.6,0,-3.6,2.4,{name:'Common bath',doors:[[2,.75]],furniture:[['toilet',-.5,.735,2],['basin',.5,.86,2],['shower',.41,-.61]]}),
  planRoom('kitchen',3.6,2.4,8,6,{name:'Kitchen',doors:[[3,.1667]],wins:[[1,.5],[0,.591]],furniture:[['kunit',1.76,0,3],['kunit',.4,1.36,2],['fridge',-.9,1.31,2],['oven',1.76,1.25,3]]}),
  planRoom('hallway',3.6,0,5.6,2.4,{name:'Store',doors:[[0,.5]],furniture:[['bookshelf',-.685,-.3,1],['bookshelf',.685,-.3,3],['bookshelf',0,-.885]]}),
  planRoom('bath',5.6,0,8,2.4,{name:'Bath 3',doors:[[2,.7]],wins:[[1,.7]],furniture:[['shower',.61,.61],['toilet',.735,-.4,3],['basin',-.86,.3,1]]}),
  planRoom('hallway',-8,-1.4,0,0,{name:'West corridor',doors:[[0,.775,'int_panel',1.2]],furniture:[]}),
  planRoom('hallway',0,-1.4,8,0,{name:'East corridor',doors:[[0,.225,'int_panel',1.2]],furniture:[]}),
  planRoom('bedroom',-8,-5.4,-4,-1.4,{name:'Bedroom 2',doors:[[0,.75],[2,.275,'ext_glass',1]],wins:[[3,.475],[2,.75]],furniture:[['bed',-.86,-.1,1],['nightstand',-1.66,-1.125,1],['nightstand',-1.66,.925,1],['wardrobe',1.56,0,3]]}),
  planRoom('bedroom',-4,-5.4,0,-1.4,{name:'Bedroom 3',doors:[[0,.25],[2,.725,'ext_glass',1]],wins:[[2,.25]],furniture:[['bed',.86,-.1,3],['nightstand',1.66,-1.125,3],['nightstand',1.66,.925,3],['wardrobe',-1.56,0,1]]}),
  planRoom('bedroom',0,-5.4,4,-1.4,{name:'Bedroom 4',doors:[[0,.75],[2,.275,'ext_glass',1]],wins:[[2,.75]],furniture:[['bed',-.86,-.1,1],['nightstand',-1.66,-1.125,1],['nightstand',-1.66,.925,1],['wardrobe',1.56,0,3]]}),
  planRoom('bedroom',4,-5.4,8,-1.4,{name:'Bedroom 5',doors:[[0,.25],[2,.725,'ext_glass',1]],wins:[[1,.525],[2,.25]],furniture:[['bed',.86,-.1,3],['nightstand',1.66,-1.125,3],['nightstand',1.66,.925,3],['wardrobe',-1.56,0,1]]}),
  planRoom('balcony',-8,-6.9,-4,-5.4,{name:'Balcony 2',furniture:[['chair',-1.2,-.1],['chair',-.5,-.1],['plant',1.635,-.385]]}),
  planRoom('balcony',-4,-6.9,0,-5.4,{name:'Balcony 3',furniture:[['chair',1.2,-.1],['chair',.5,-.1],['plant',-1.635,-.385]]}),
  planRoom('balcony',0,-6.9,4,-5.4,{name:'Balcony 4',furniture:[['chair',-1.2,-.1],['chair',-.5,-.1],['plant',1.635,-.385]]}),
  planRoom('balcony',4,-6.9,8,-5.4,{name:'Balcony 5',furniture:[['chair',1.2,-.1],['chair',.5,-.1],['plant',-1.635,-.385]]}),
]);
addTemplate('in_3bhk_porch', '3BHK East-Facing Home with Car Porch', 'indian', 'East-facing 30x40 home: car porch, pooja, 3 beds, 2 attached baths', [
  planRoom('bedroom',-6.1,-4.6,-1.9,-1.6,{'name':'Bedroom 2','doors':[[0,0.81]],'wins':[[2,0.619],[3,0.5]],'furniture':[['bed',-0.5,-0.36],['nightstand',-1.525,-1.16],['nightstand',0.525,-1.16],['wardrobe',1.66,-0.41,3],['rug',-0.5,0.6]],'paint':'blush','floorCol':'oak'}),
  planRoom('hallway',-3.5,-1.6,-1.9,0.8,{'name':'Bedroom lobby','doors':[[1,0.75]],'furniture':[]}),
  planRoom('bath',-6.1,-1.6,-3.5,0.8,{'name':'Master bath','doors':[[0,0.769,'int_pvc',0.75]],'wins':[[3,0.375]],'furniture':[['toilet',-0.7,-0.735],['shower',0.71,-0.61],['basin',-0.5,0.86,2],['mirror_cab',-0.5,0.985,2]],'paint':'white','floorCol':'wtile'}),
  planRoom('bedroom',-6.1,0.8,-1.9,4.5,{'name':'Master bedroom','doors':[[2,0.19]],'wins':[[3,0.514],[0,0.381]],'furniture':[['bed',-0.96,0.05,1],['nightstand',-1.76,-0.975,1],['nightstand',-1.76,1.075,1],['wardrobe',1.66,-0.05,3],['rug',-0.1,0.05,1]],'paint':'sage','floorCol':'walnut'}),
  planRoom('bath',-1.9,-4.6,-0.3,-1.6,{'name':'Common bath','doors':[[0,0.687,'int_pvc',0.75]],'wins':[[2,0.5]],'furniture':[['toilet',-0.3,-1.035],['shower',0.21,-0.1],['basin',-0.46,0.9,1],['mirror_cab',-0.585,0.9,1]],'paint':'white','floorCol':'wtile'}),
  planRoom('bedroom',-0.3,-4.6,4.2,-1.6,{'name':'Bedroom 3','doors':[[0,0.156]],'wins':[[2,0.4]],'furniture':[['bed',0.45,-0.36],['nightstand',-0.575,-1.16],['nightstand',1.475,-1.16],['wardrobe',-1.81,-0.46,1],['rug',0.45,0.6]],'paint':'lavender','floorCol':'ash'}),
  planRoom('bath',4.2,-4.6,6.1,-2.9,{'name':'Bath 3','doors':[[3,0.725,'int_pvc',0.75]],'wins':[[2,0.474]],'furniture':[['toilet',-0.45,-0.385],['basin',0.35,-0.51],['mirror_cab',0.35,-0.635],['shower',0.36,0.26]],'paint':'white','floorCol':'wtile'}),
  planRoom('hallway',4.2,-2.9,6.1,-1.6,{'name':'Pooja','doors':[[0,0.316]],'furniture':[['side_table',0.56,0],['wall_art',0.785,0,3]],'paint':'cream','floorCol':'wtile'}),
  planRoom('hall',-1.9,-1.6,6.1,1.5,{'name':'Living & dining','doors':[[0,0.888,'ext_hard',1]],'wins':[[1,0.5,'pano'],[0,0.575]],'furniture':[['tv',0.6,-1.21],['sofa',0.6,0.96,2],['coffee',0.6,-0.1],['rug',0.6,-0.05],['armchair',2.3,-0.05,3],['plant',3.635,-1.185],['table',-2.05,0,1],['chair',-2.85,-0.35,1],['chair',-2.85,0.35,1],['chair',-1.25,-0.35,3],['chair',-1.25,0.35,3]],'paint':'cream','floorCol':'honey'}),
  planRoom('kitchen',-1.9,1.5,1.1,4.5,{'name':'Kitchen','doors':[[2,0.2]],'wins':[[0,0.367],[1,0.533]],'furniture':[['kunit',-0.46,1.06,2],['kunit',-1.06,-0.14,1],['fridge',1.01,1.01,3],['oven',1.06,0.36,3]],'paint':'mint','floorCol':'gtile'}),
  planRoom('veranda',1.1,1.5,6.1,4.5,{'name':'Car porch','furniture':[['plant',-2.135,-1.135],['plant',2.135,-0.4]],'floorCol':'slate'}),
]);
addTemplate('in_farmhouse', 'Indian Farmhouse with Sit-outs', 'indian', 'Farmhouse: wraparound sit-outs, big kitchen, store, wash yard, 3BHK', [
  planRoom('bedroom',0,5.4,4.2,9.6,{name:'Main bedroom',paint:'sage',floorCol:'oak',doors:[[1,0.8571,'int_hard',0.9]],wins:[[0,0.381,'std'],[3,0.2143,'std']],furniture:[['bed',-0.96,0.3,1],['nightstand',-1.76,-0.75,1],['nightstand',-1.76,1.325,1],['wardrobe',1.66,0.7,3],['dresser',0.6,-1.71],['rug',-0.1,0.3,1]]}),
  planRoom('bath',0,3.6,4.2,5.4,{name:'Main bath',paint:'white',floorCol:'gtile',doors:[[0,0.2857,'int_pvc',0.75]],wins:[[3,0.5,'std']],furniture:[['toilet',-1.5,-0.435],['bath',1.11,-0.385],['basin',0.5,0.56,2],['mirror_cab',0.5,0.685,2]]}),
  planRoom('bedroom',0,0,4.2,3.6,{name:'Bedroom 2',paint:'cream',floorCol:'oak',doors:[[1,0.1667,'int_hard',0.9]],wins:[[2,0.5,'std'],[3,0.5,'std']],furniture:[['bed',-0.5,0.66,2],['nightstand',-1.55,1.46,2],['nightstand',0.525,1.46,2],['wardrobe',1.66,-0.76,3]]}),
  planRoom('hallway',4.2,0,5.4,5.4,{name:'Bedroom passage',floorCol:'terra',doors:[[0,0.5,'int_hard',0.9]],furniture:[]}),
  planRoom('bath',5.4,0,7.2,2.4,{name:'Common bath',paint:'white',floorCol:'gtile',doors:[[3,0.3333,'int_pvc',0.75]],wins:[[2,0.4444,'std']],furniture:[['shower',0.31,0.61],['toilet',-0.5,0.735,2],['basin',0.3,-0.86]]}),
  planRoom('bedroom',5.4,2.4,10.2,5.4,{name:'Bedroom 3',paint:'blush',floorCol:'ash',doors:[[3,0.7333,'int_hard',0.9]],wins:[[2,0.3125,'std']],furniture:[['bed',1.26,0,3],['nightstand',2.06,-1.025,3],['nightstand',2.06,1.025,3],['wardrobe',-0.65,1.06,2],['desk',-1.6,-1.06],['office_chair',-1.6,-0.45,2]]}),
  planRoom('hall',4.2,5.4,10.2,9.6,{name:'Living room',paint:'cream',floorCol:'terra',doors:[[0,0.4,'ext_hard',1.2],[1,0.5,'int_panel',1.5]],wins:[[0,0.7667,'pano']],furniture:[['tv',0.8,-1.76],['sofa',0.8,0.7,2],['coffee',0.8,-0.3],['rug',0.8,-0.2],['armchair',-0.9,-0.3,1],['plant',-2.6,1.7],['floor_lamp',2.5,1.7]]}),
  planRoom('hall',10.2,5.4,14.4,9.6,{name:'Dining',paint:'beige',floorCol:'terra',doors:[[2,0.7619,'int_hard',0.9],[1,0.5,'ext_glass',1.5],[0,0.8095,'ext_glass',0.9]],wins:[[0,0.3333,'pano']],furniture:[['table',0,-0.7,1],['table',0,0.7,1],['chair',0,-1.7],['chair',0,1.7,2],['plant',-1.7,1.7]]}),
  planRoom('kitchen',10.2,2.4,14.4,5.4,{name:'Kitchen',paint:'cream',floorCol:'wtile',doors:[[2,0.8095,'ext_metal',0.9]],wins:[[1,0.5,'std']],furniture:[['kunit',1.66,0.3,3],['kunit',0.4,1.06,2],['fridge',-1.61,0,1]]}),
  planRoom('hallway',12.3,0,14.4,2.4,{name:'Store',floorCol:'slate',doors:[[0,0.619,'int_hard',0.8]],wins:[[1,0.5833,'std']],furniture:[['bookshelf',-0.735,0,1],['bookshelf',0.05,-0.885]]}),
  planRoom('balcony',7.2,0,12.3,2.4,{name:'Utility & wash yard',floorCol:'slate',furniture:[['basin',2.05,0.86,2],['plant',-2.15,-0.8],['chair',-0.75,0],['chair',0.05,0]]}),
  planRoom('veranda',4.2,9.6,10.2,12,{name:'Front sit-out',floorCol:'terra',furniture:[['armchair',0.5,0.2,1],['coffee',1.4,0.2,1],['armchair',2.3,0.2,3],['plant',-2.6,0.8]]}),
  planRoom('veranda',10.2,9.6,14.4,12,{name:'Corner veranda',floorCol:'terra',furniture:[['chair',-1.1,0.4],['side_table',-0.3,0.4],['chair',0.5,0.4],['plant',1.7,0.8]]}),
  planRoom('veranda',14.4,5.4,16.8,12,{name:'Side sit-out',floorCol:'terra',furniture:[['armchair',-0.2,0.7,1],['side_table',-0.2,1.5],['armchair',-0.2,2.3,1],['plant',0.8,-2.9],['chair',-0.2,-2.7,1]]}),
]);

// Paid templates (12 office + 8 other) are deliberately NOT defined here.
// builder.html is a public static file, so anything inline is free to anyone —
// their geometry is the product. Metadata comes from /api/templates; geometry
// from /api/templates/<key>, which 402s unless a template_unlock purchase exists.
const PAID_TEMPLATES = new Map(); // key -> {name, cat, desc, owned}
let templateCatalogLoaded = false;

async function loadTemplateCatalog(){
  try{
    const res = await fetch('/api/templates', {credentials:'same-origin'});
    if(!res.ok) return false;
    const data = await res.json();
    const ownedSet = new Set(data.owned || []);
    PAID_TEMPLATES.clear();
    (data.templates || []).forEach(t=>{
      if(t.paid) PAID_TEMPLATES.set(t.key, {name:t.name, cat:t.cat, desc:t.desc, owned:ownedSet.has(t.key)});
    });
    templateCatalogLoaded = true;
    return true;
  }catch(e){ return false; }
}

// Geometry for an owned paid template. Returns {profile, rooms} or null.
async function fetchPaidGeometry(key){
  try{
    const res = await fetch('/api/templates/'+encodeURIComponent(key), {credentials:'same-origin'});
    if(!res.ok) return null;
    return await res.json();
  }catch(e){ return null; }
}
addTemplate('empty', 'Empty — single hall', 'other', 'Start from a single blank room', []);
TEMPLATES.empty.build = ()=>state.blocks.push(firstRoom());

// Only the free templates are defined inline now, so the assert covers those.
// Paid ones are validated server-side against lib/template-catalog.ts.
function assertTemplateCatalog(){
  const counts = {indian:0, office:0, other:0};
  Object.entries(TEMPLATES).forEach(([key, template])=>{
    if(!template.name || !template.cat || typeof template.build !== 'function') throw new Error('Invalid template '+key);
    if(key !== 'empty') counts[template.cat]++;
  });
  if(counts.indian !== 12 || counts.office !== 0 || counts.other !== 0) throw new Error('Template catalog count mismatch');
  return true;
}
assertTemplateCatalog();

const TEMPLATE_PRICE = '₹99';
let activeTplCat = 'indian';
function templatePreview(entry){
  if(!entry.rooms?.length) return '';
  const rooms = entry.rooms.map(spec=>{
    const r = Array.isArray(spec) ? {type:spec[0],cx:spec[1],cz:spec[2],...spec[3]} : spec;
    return {rot:0, ...C.rooms[r.type], ...r};
  });
  const bb = boundsOf(rooms), pad=.5;
  let drawing = rooms.map(r=>{
    const [w,d] = footprint(r);
    return `<rect x="${r.cx-w/2}" y="${r.cz-d/2}" width="${w}" height="${d}" fill="${C.rooms[r.type].fill}" stroke="#54604e" stroke-width=".09"/>`;
  }).join('');
  // Opening gaps use exactly the same coordinate helpers as the editor.
  rooms.forEach(r=>(r.doors||[]).forEach(([wall,t,type,width=.8])=>{
    const L=wallLen(r,Number(wall));
    const a=localToWorld(r,...wallPoint(r,Number(wall),Number(t)-width/2/L));
    const b=localToWorld(r,...wallPoint(r,Number(wall),Number(t)+width/2/L));
    drawing+=`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="#fafbf7" stroke-width=".15"/>`;
  }));
  rooms.forEach(r=>{
    const [w,d]=footprint(r);
    if(Math.min(w,d)<1.6) return;
    const label=r.type==='bedroom'?'Bed':r.type==='hall'?'Living':C.rooms[r.type].name;
    drawing+=`<text x="${r.cx}" y="${r.cz+.08}" text-anchor="middle" font-size=".25" fill="#455342">${escapeMarkup(label)}</text>`;
  });
  const area=rooms.reduce((n,r)=>n+r.len*r.w,0), beds=rooms.filter(r=>r.type==='bedroom').length;
  return `<svg class="tpl-preview" viewBox="${bb.x0-pad} ${bb.z0-pad} ${bb.w+pad*2} ${bb.d+pad*2}" aria-hidden="true">${drawing}</svg>`+
    `<span class="tpl-meta">${bb.w.toFixed(1)} × ${bb.d.toFixed(1)} m footprint · ${area.toFixed(1)} m² total${beds?' · '+beds+' bed':''}</span>`;
}
function tplCard(key, entry, opts){
  const locked = opts && opts.locked;
  const starter = ['in_1bhk','in_2bhk','in_row'].includes(key);
  return '<button class="tpl-card'+(key === 'empty' ? ' ghost' : '')+(locked ? ' locked' : '')+'" '+
    'data-tpl="'+escapeMarkup(key)+'"'+(locked ? ' data-tpl-locked="1"' : '')+'>'+
    (starter ? '<span class="tpl-badge">Connected starter plan</span>' : '')+
    '<span class="nm">'+escapeMarkup(entry.name)+(locked ? ' <span class="tpl-lock">🔒 '+TEMPLATE_PRICE+'</span>' : '')+'</span>'+
    '<span class="desc">'+escapeMarkup(entry.desc)+'</span>'+templatePreview(entry)+'</button>';
}

function renderTplList(cat){
  // free templates that live in this file
  const free = Object.entries(TEMPLATES)
    .filter(([key, t])=>key === 'empty' || t.cat === cat)
    .sort(([a],[b])=>{ const rank=k=>['in_1bhk','in_2bhk','in_row','empty'].indexOf(k); return (rank(a)<0?99:rank(a))-(rank(b)<0?99:rank(b)); })
    .map(([key, t])=>tplCard(key, t, {locked:false}));
  // paid templates from the catalog; locked until purchased
  const paid = [...PAID_TEMPLATES.entries()]
    .filter(([, t])=>t.cat === cat)
    .map(([key, t])=>tplCard(key, t, {locked: !t.owned}));
  const cards = cat === 'indian' ? free.concat(paid) : paid.concat(free);
  if(!cards.length) return '<p class="hint">Could not load templates. Check your connection and reopen.</p>';
  return cards.join('');
}

function tplCatCount(cat){
  const free = Object.values(TEMPLATES).filter(t=>t.cat === cat).length - (cat === 'other' ? 1 : 0);
  const paid = [...PAID_TEMPLATES.values()].filter(t=>t.cat === cat).length;
  return free + paid;
}

function renderTplModal(){
  // With the paywall off (or everything bought) every paid layout reads as
  // owned: don't advertise a price nobody is charged.
  const paid = [...PAID_TEMPLATES.values()];
  const pricing = paid.length && paid.every(t=>t.owned)
    ? 'Every layout below is included. '
    : 'Indian house layouts are free; office and speciality layouts are '+TEMPLATE_PRICE+' each, unlocked forever. ';
  return '<div class="tpl-modal"><h3>Choose a starting layout</h3>'+
    '<p class="hint">Start from a layout template or begin with an empty room. '+
    pricing+
    'Previews show the actual room layout; dimensions include porches and balconies. Templates open in 2D for editing.</p>'+
    '<div class="tpl-tabs">'+
      '<button type="button" class="tpl-tab'+(activeTplCat==='indian'?' active':'')+'" data-tpl-cat="indian">Indian Houses ('+tplCatCount('indian')+')</button>'+
      '<button type="button" class="tpl-tab'+(activeTplCat==='office'?' active':'')+'" data-tpl-cat="office">Offices ('+tplCatCount('office')+')</button>'+
      '<button type="button" class="tpl-tab'+(activeTplCat==='other'?' active':'')+'" data-tpl-cat="other">Other Layouts ('+tplCatCount('other')+')</button>'+
    '</div>'+
    '<div class="tpl-grid" id="tplGrid">'+renderTplList(activeTplCat)+'</div></div>';
}

let templateReplaceWarning = false;
async function showTemplatePicker(replace=false){
  if(VIEW) return;
  templateReplaceWarning = replace;
  activeTplCat = 'indian';
  showModal(renderTplModal());
  // catalog is cheap and reflects purchases made since load, so refresh each open
  if(await loadTemplateCatalog() && dim.classList.contains('show') && modal.querySelector('.tpl-modal')) showModal(renderTplModal());
}

// Parent (DesignerOverlay) tells us a template purchase completed.
function markTemplateOwned(key){
  const entry = PAID_TEMPLATES.get(key);
  if(entry) entry.owned = true;
}
modal.addEventListener('click', e=>{
  const tab = e.target.closest('[data-tpl-cat]');
  if(tab){
    activeTplCat = tab.dataset.tplCat;
    modal.querySelectorAll('.tpl-tab').forEach(button=>button.classList.toggle('active', button === tab));
    const grid = modal.querySelector('#tplGrid');
    if(grid) grid.innerHTML = renderTplList(activeTplCat);
    return;
  }
  const template = e.target.closest('[data-tpl]');
  if(!template) return;
  const key = template.dataset.tpl;

  // Locked: hand off to the parent app, which owns the checkout. We never
  // see the geometry until the server agrees a purchase exists.
  if(template.dataset.tplLocked){
    const entry = PAID_TEMPLATES.get(key);
    // Standalone builder (no parent app): parent === window and nothing handles
    // the message, so the click used to do nothing at all. Say so inside the
    // dialog (a toast would sit underneath it).
    if(!EMBED){
      let note = modal.querySelector('.tpl-signin');
      if(!note){
        note = document.createElement('p');
        note.className = 'hint tpl-signin'; note.style.color = '#e5476f'; note.style.fontWeight = '700';
        modal.querySelector('.tpl-tabs')?.before(note);
      }
      note.textContent = 'Sign in to ArchIt and open the Designer to unlock '+(entry ? entry.name : 'this layout')+'.';
      return;
    }
    // the bought layout replaces the current one as soon as checkout returns
    if(templateReplaceWarning && !confirm('Replace the current layout with '+(entry ? entry.name : 'this layout')+' once it is unlocked? Save your current design first if you want to keep it.')) return;
    parent.postMessage({type:'archit:buy-template', payload:{key, name: entry ? entry.name : key}}, location.origin);
    return;
  }

  if(templateReplaceWarning && !confirm('Replace the current layout with '+(TEMPLATES[key] || PAID_TEMPLATES.get(key)).name+'? Save your current design first if you want to keep it.')) return;
  hideModal();
  newProject(key);
});

export {PAID_TEMPLATES, TEMPLATES, clampRot, fetchPaidGeometry, loadTemplateCatalog, markTemplateOwned, showTemplatePicker, tRoom, tRoomSpec};
