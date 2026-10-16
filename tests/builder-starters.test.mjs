import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../public/builder/builder.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('const TEMPLATES = {};'), html.indexOf('// Paid templates (12 office'));
const defaults = {bedroom:[3.6,3],hall:[4.8,3.6],hallway:[3.6,1.4],kitchen:[3,2.4],bath:[2.4,1.8],veranda:[3.6,2.4],balcony:[3,1.5]};
const open = r => ['veranda','balcony'].includes(r.type);
const ctx = { result:[], tRoom(profile,type,cx,cz,opts){ctx.result.push({type,cx,cz,...opts});}, tRoomSpec(profile,spec){ctx.result.push(spec);} };
vm.createContext(ctx);
vm.runInContext(source+'; globalThis.templates = TEMPLATES;', ctx);
function roomsFor(key){
  ctx.result=[]; ctx.templates[key].build();
  return ctx.result.map(r=>{
    const len=r.len??defaults[r.type][0],w=r.w??defaults[r.type][1];
    const [dx,dz]=(r.rot??0)%2?[w,len]:[len,w];
    return {...r,len,w,x0:r.cx-dx/2,x1:r.cx+dx/2,z0:r.cz-dz/2,z1:r.cz+dz/2};
  });
}
function opening(r,[wall,t,type,width=.8]){
  // Revised starters use unrotated rectangles, with the engine's local wall convention.
  assert.equal(r.rot??0,0);
  const horiz=wall%2===0,L=horiz?r.len:r.w;
  const along=(wall===0||wall===3?t:1-t)*L+(horiz?r.x0:r.z0);
  const fixed=[r.z1,r.x1,r.z0,r.x0][wall];
  return {wall,horiz,fixed,lo:along-width/2,hi:along+width/2,type};
}
function neighbor(r,o,rooms){
  return rooms.find(q=>q!==r && Math.abs(([q.z0,q.x0,q.z1,q.x1][o.wall])-o.fixed)<.001 && o.lo >= (o.horiz?q.x0:q.z0)-.001 && o.hi <= (o.horiz?q.x1:q.z1)+.001);
}
for(const key of ['in_1bhk','in_2bhk','in_row']){
  test(`${key}: no overlap and every room is reachable from the entrance`,()=>{
    const rooms=roomsFor(key), edges=rooms.map(()=>new Set()), entrances=[];
    for(let i=0;i<rooms.length;i++){
      const r=rooms[i];
      for(let j=i+1;j<rooms.length;j++){
        const q=rooms[j];
        assert.ok(Math.min(r.x1,q.x1)-Math.max(r.x0,q.x0)<.01 || Math.min(r.z1,q.z1)-Math.max(r.z0,q.z0)<.01,`${r.type} overlaps ${q.type}`);
      }
      assert.ok(r.len>=1.2&&r.len<=8&&r.w>=1.2&&r.w<=8);
      for(const door of r.doors??[]){
        const o=opening(r,door), q=neighbor(r,o,rooms);
        assert.ok(o.lo >= (o.horiz?r.x0:r.z0)-.001 && o.hi <= (o.horiz?r.x1:r.z1)+.001,'door fits wall');
        if(o.type?.startsWith('ext_')){
          assert.ok(!q||open(q),'external door must face outdoors or a porch');
          entrances.push(i);
        }else assert.ok(q,'internal door must connect to another room across its full width');
        if(q){const j=rooms.indexOf(q);edges[i].add(j);edges[j].add(i);}
      }
      for(const window of r.wins??[]){
        const o=opening(r,[window[0],window[1],'window',1.3]);
        assert.ok(!neighbor(r,o,rooms),'window must face outdoors');
      }
    }
    const seen=new Set(entrances),queue=[...entrances];
    for(const i of queue)for(const j of edges[i])if(!seen.has(j)){seen.add(j);queue.push(j);}
    rooms.forEach((r,i)=>assert.ok(open(r)||seen.has(i),`${r.type} is unreachable from an exterior door`));
  });
}

const furniture = {bed:[1.6,2],wardrobe:[1.8,.6],sofa:[2,.9],coffee:[.9,.55],table:[1.4,.8],chair:[.45,.45],kunit:[1.8,.6],fridge:[.7,.7],toilet:[.4,.65],basin:[.5,.4],shower:[.9,.9],plant:[.45,.45]};
for(const key of ['in_1bhk','in_2bhk','in_row']){
  test(`${key}: furniture fits rooms without overlapping`,()=>{
    for(const room of roomsFor(key)){
      assert.ok(Array.isArray(room.furniture), 'starter furniture is deliberate, including empty passages');
      const boxes=room.furniture.map(([key,x,z,rot=0])=>{
        const dims=furniture[key];assert.ok(dims,`known furniture: ${key}`);
        const [w,d]=rot%2?[dims[1],dims[0]]:dims;
        assert.ok(Math.abs(x)+w/2<=room.len/2-.04,`${key} fits width in ${room.name}`);
        assert.ok(Math.abs(z)+d/2<=room.w/2-.04,`${key} fits depth in ${room.name}`);
        return {key,x,z,w,d};
      });
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
        const a=boxes[i],b=boxes[j];
        assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2-.01 || Math.abs(a.z-b.z)>=(a.d+b.d)/2-.01,`${a.key} overlaps ${b.key} in ${room.name}`);
      }
    }
  });
}

test('explicit empty furniture keeps passages empty; omitted furniture still auto-furnishes',()=>{
  const reader=html.slice(html.indexOf('const clampRot ='),html.indexOf('// Auto-furnish a template room'));
  const context={C:{rooms:{hallway:{}},paint:{},floorCol:{},furniture:{}},state:{blocks:[],seq:{}},
    newRoom:()=>({doors:[],windows:[],furniture:[]}),furnishRoom:b=>b.furniture.push({key:'auto'}), console};
  vm.createContext(context);vm.runInContext(reader,context);
  context.tRoomSpec('home',{type:'hallway',furniture:[]});
  context.tRoomSpec('home',{type:'hallway'});
  assert.equal(context.state.blocks[0].furniture.length,0);
  assert.equal(context.state.blocks[1].furniture.length,1);
});
