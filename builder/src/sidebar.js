import './plan2d.js';
import {C, MODERN_PRESETS} from './catalog.js';
import {$, VIEW, escapeMarkup, round1, side, toast} from './dom.js';
import {commit, ensureExteriorState, getBlock, sel, selBlock, selDoor, selFurn, selWin, setSel, state, ui} from './state.js';
import {boundsOf, freeT, overlaps, refitFurniture, sharedWall} from './geometry.js';
import {openToolPop} from './tools.js';
import {renderSelection} from './ui.js';

/* ============================== sidebar ============================== */
const SEL_H = {};   // select handlers registry
function selectHTML(id, itemsHTML, currentHTML){
  return `<div class="sel" data-sel="${id}">
    <button class="sel-btn" type="button">${currentHTML}
      <svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <div class="sel-menu">${itemsHTML}</div>
  </div>`;
}
function optionsFrom(map, cur){
  return Object.entries(map).map(([k,v])=>`
    <button class="sel-item" data-v="${k}">
      ${v.hex?`<span class="dot" style="background:${v.hex}"></span>`:''}
      <span><span class="nm">${v.name}</span></span>
      ${k===cur?'<svg style="margin-left:auto;color:#1d5bb4" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m5 13 4 4L19 7"/></svg>':''}
    </button>`).join('');
}
function curLabel(map, k){
  const v = map[k];
  return `${v.hex?`<span class="dot" style="background:${v.hex}"></span>`:''}<span>${v.name}</span>`;
}
function defOptions(map, cur){
  const def = `<button class="sel-item" data-v="_def">
    <span class="dot" style="background:#fff"></span><span><span class="nm">Default</span></span>
    ${cur==null?'<svg style="margin-left:auto;color:#1d5bb4" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m5 13 4 4L19 7"/></svg>':''}
  </button>`;
  return def + optionsFrom(map, cur);
}
function roomColLabel(map, cur, defName){
  return cur ? curLabel(map, cur) : `<span class="dot" style="background:#fff"></span><span>${defName}</span>`;
}
function stdSelect(id, map, key, onPick){
  SEL_H[id] = v=>commit(()=>{ state[key]=v; onPick&&onPick(v); });
  return selectHTML(id, optionsFrom(map, state[key]), curLabel(map, state[key]));
}
function applyModernPreset(key){
  if(VIEW) return;
  const preset = MODERN_PRESETS[key];
  if(!preset) return;
  commit(()=>{
    Object.assign(state, {
      paint:preset.paint,
      facade:preset.facade,
      facadeMat:preset.facadeMat,
      roofStyle:preset.roofStyle,
      roofCol:preset.roofCol,
    });
    ensureExteriorState();
  });
}
function modernPresetButtons(){
  return '<div class="f-label">Modern presets</div><div class="preset-grid">'+
    Object.entries(MODERN_PRESETS).map(([key,preset])=>
      '<button type="button" class="preset-btn" data-preset="'+key+'">'+preset.name+'</button>'
    ).join('')+'</div>';
}

function renderSidebar(){
  renderPanel();
  // phones: the panel is a bottom sheet; its handle names what the panel shows
  const h = side.querySelector('h2');
  $('#sheetT').textContent = h ? h.firstChild.textContent.trim() : 'Details';
}
function renderPanel(){
  if(!state){ side.innerHTML=''; return; }
  const b = selBlock();
  if(b && sel.kind==='block') return renderBlockPanel(b);
  if(b && sel.kind==='door')  return renderDoorPanel(b, selDoor());
  if(b && sel.kind==='furn')  return renderFurnPanel(b, selFurn());
  if(b && sel.kind==='window') return renderWinPanel(b, selWin());

  const bb = state.blocks.length ? boundsOf(state.blocks) : {w:0,d:0};
  const secs = [
    ['exterior','Exterior', ()=>modernPresetButtons()+`
      <div class="f-label">Facade material</div>${stdSelect('facadeMat', C.facadeMat, 'facadeMat')}
      <div class="f-label">Facade colour</div>${stdSelect('facade', C.facade, 'facade')}
      <div class="f-label">Roof style</div>${stdSelect('roofStyle', C.roofStyle, 'roofStyle')}
      <div class="f-label">Roof colour</div>${stdSelect('roofCol', C.roofCol, 'roofCol')}`],
    ['interior','Interior', ()=>`
      <div class="f-label">Wall paint (house default)</div>
      ${stdSelect('paint', C.paint, 'paint')}
      <div class="note"><svg width="14" height="14" style="flex:none" viewBox="0 0 24 24" fill="none" stroke="#8b96ab" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>
      Rooms without their own colour use this paint</div>`],
    ['windows','Windows', ()=>{
      let rows = '';
      state.blocks.forEach((bl,i)=>bl.windows.forEach((w,j)=>{
        rows += `<div class="optrow"><span class="nm">Window ${j+1} · ${escapeMarkup((bl.name||C.rooms[bl.type].name).toLowerCase())} ${i+1}</span>
          <button class="end iconbtn" data-act="delwin" data-b="${bl.id}" data-w="${w.id}" title="Remove">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/></svg></button></div>`;
      }));
      return rows + `<button class="addbtn" data-act="addwin">+ Add window</button>`;
    }],
    ['doors','Doors', ()=>{
      let rows = '';
      state.blocks.forEach((bl,i)=>bl.doors.forEach((d,j)=>{
        rows += `<button class="itemrow" data-act="seldoor" data-b="${bl.id}" data-d="${d.id}">
          <span class="ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="3.5" width="12" height="17" rx="1.2"/><circle cx="14.6" cy="12" r="1" fill="currentColor"/></svg></span>
          <span><span class="nm" style="font-size:13px;font-weight:700">${C.doors[d.type].name}</span>
          <span style="display:block;font-size:11.5px;color:#8b96ab">${escapeMarkup(bl.name||C.rooms[bl.type].name+" "+(i+1))}</span></span></button>`;
      }));
      return rows + `<button class="addbtn" data-act="opendoors">+ Add door</button>`;
    }],
    ['furniture','Furniture', ()=>{
      let rows = '';
      state.blocks.forEach((bl,i)=>(bl.furniture||[]).forEach(f=>{
        rows += `<div class="optrow"><span class="nm">${C.furniture[f.key].name}
          <span style="display:block;font-size:11.5px;color:#8b96ab;font-weight:600">${escapeMarkup(bl.name||C.rooms[bl.type].name+" "+(i+1))}</span></span>
          <button class="end iconbtn" data-act="delfurn" data-b="${bl.id}" data-f="${f.id}" title="Remove">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/></svg></button></div>`;
      }));
      return (rows || `<div class="note">Pick a piece in the toolbar catalog, then tap a room to place it.</div>`);
    }],
  ];
  let area = 0; state.blocks.forEach(bl=>area += bl.w*bl.len);
  side.innerHTML = `
    <div class="sum">
      <h2>${VIEW ? 'This house' : 'My house <sup>?</sup>'}</h2>
      <p>Floor ${state.floor+1} of ${state.floors.length}</p>
    </div>
    <div class="stats">
      <div class="row"><span>Rooms</span><b>${state.blocks.length}</b></div>
      <div class="row"><span>Floors</span><b>${state.floors.length}</b></div>
      <div class="row"><span>Area</span><b>${round1(area)} m²</b></div>
      <div class="row"><span>Size</span><b>${round1(bb.w)} m × ${round1(bb.d)} m</b></div>
    </div>
    ${ui.view==='2d' && !VIEW ? '<div class="plan-hint"><b>Plan room by room</b><br>Select a room to edit its dimensions. Drag to move; use corner handles to resize. The fit button brings the full plan back into view.</div>' : ''}
    ${VIEW ? '' : `<div class="acc">
      ${secs.map(([id,name,body])=>`
        <div class="sec ${ui.openSecs.has(id)?'open':''}" data-sec="${id}">
          <button type="button">
            <svg class="chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
            ${name}
          </button>
          <div class="body">${ui.openSecs.has(id)? body() : ''}</div>
        </div>`).join('')}
    </div>`}`;
}

function renderBlockPanel(b){
  const i = state.blocks.indexOf(b)+1;
  const spec = C.rooms[b.type];
  SEL_H['rtype'] = v=>commit(()=>{ b.type = v; });
  SEL_H['rpaint'] = v=>commit(()=>{ b.paint = v==='_def' ? null : v; });
  SEL_H['rfloor'] = v=>commit(()=>{ b.floorCol = v==='_def' ? null : v; });
  SEL_H['rfloormat'] = v=>commit(()=>{ b.floorMat = v==='_def' ? null : v; });
  SEL_H['rwallmat'] = v=>commit(()=>{ b.wallMat = v==='_def' ? null : v; });
  const typeOpts = Object.entries(C.rooms).map(([k,v])=>`
    <button class="sel-item" data-v="${k}">
      <span><span class="nm">${v.name}</span>
      <span class="sb">${v.w} × ${v.len} m</span></span>
      ${k===b.type?'<svg style="margin-left:auto;color:#1d5bb4" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m5 13 4 4L19 7"/></svg>':''}
    </button>`).join('');
  side.innerHTML = `<div class="selpanel">
    <div class="selhead">
      <span class="cube"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 2 8 4.5v9L12 20l-8-4.5v-9L12 2z"/><path d="M4 6.5 12 11l8-4.5M12 11v9"/></svg></span>
      <div><h2>${escapeMarkup(b.name || spec.name+' '+i)}</h2><div class="pr" style="color:#8b96ab">${round1(b.w*b.len)} m²</div></div>
      <button class="x" data-act="close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="hr"></div>
    <div class="f-label">Name</div>
    <input class="inp" data-act="rname" type="text" maxlength="24" value="${escapeMarkup(b.name||'')}" placeholder="${spec.name} ${i}">
    <div class="f-label">Room type</div>
    ${selectHTML('rtype', typeOpts, `<span>${spec.name}</span>`)}
    <div class="grid2" style="margin-top:12px">
      <div><div class="f-label" style="margin-top:0">Width, m</div>
        <input class="inp" data-act="rw" type="number" step="0.1" min="${C.roomMin}" max="${C.roomMax}" value="${b.w}"></div>
      <div><div class="f-label" style="margin-top:0">Length, m</div>
        <input class="inp" data-act="rl" type="number" step="0.1" min="${C.roomMin}" max="${C.roomMax}" value="${b.len}"></div>
    </div>
    <div class="dimrow" style="margin-top:8px"><span>Height</span><b>${C.H} m</b></div>
    <div class="dimrow"><span>Area</span><b>${round1(b.w*b.len)} m²</b></div>
    <div class="f-label">Wall colour</div>
    ${selectHTML('rpaint', defOptions(C.paint, b.paint), roomColLabel(C.paint, b.paint, 'House default'))}
    <div class="f-label">Floor colour</div>
    ${selectHTML('rfloor', defOptions(C.floorCol, b.floorCol), roomColLabel(C.floorCol, b.floorCol, 'Room default'))}
    <div class="f-label">Floor material</div>
    ${selectHTML('rfloormat', defOptions(C.floorMat, b.floorMat), roomColLabel(C.floorMat, b.floorMat, 'Flat colour'))}
    <div class="f-label">Wall material</div>
    ${selectHTML('rwallmat', defOptions(C.wallMat, b.wallMat), roomColLabel(C.wallMat, b.wallMat, 'Flat paint'))}
    <button class="collapse" data-act="close">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg> Collapse
    </button>
  </div>`;
}

function renderDoorPanel(b, d){
  if(!d){ setSel(null); return renderSidebar(); }
  const idx = b.doors.indexOf(d)+1;
  SEL_H['dtype'] = v=>commit(()=>{ d.type = v; });
  SEL_H['dcolor'] = v=>commit(()=>{ d.color = v; });
  const interior = !!sharedWall(b, d.wall);
  const typeOpts = Object.entries(C.doors)
    .filter(([,v])=>v.grp === (interior?'INTERIOR DOORS':'EXTERIOR DOORS'))
    .map(([k,v])=>`
    <button class="sel-item" data-v="${k}">
      <span><span class="nm">${v.name}</span><span class="sb">${v.grp==='EXTERIOR DOORS'?'exterior':'interior'}</span></span>
      ${k===d.type?'<svg style="margin-left:auto;color:#1d5bb4" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m5 13 4 4L19 7"/></svg>':''}
    </button>`).join('');
  const colorMap = {blue:{name:'Blue',hex:'#2e5296'}, white:{name:'White',hex:'#f2f4f7'}, gray:{name:'Gray',hex:'#c6cbd3'}};
  const colorOpts = Object.entries(colorMap).map(([k,v])=>`
    <button class="sel-item" data-v="${k}"><span class="dot" style="background:${v.hex}"></span>
      <span><span class="nm">${v.name}</span></span>
      ${k===d.color?'<svg style="margin-left:auto;color:#1d5bb4" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m5 13 4 4L19 7"/></svg>':''}
    </button>`).join('');
  side.innerHTML = `<div class="selpanel">
    <div class="selhead">
      <span class="cube"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="3.5" width="12" height="17" rx="1.2"/><circle cx="14.6" cy="12" r="1" fill="currentColor"/></svg></span>
      <div><h2>Door ${idx}</h2><div class="pr" style="color:#8b96ab">${Math.round(d.w*100)} × ${Math.round(d.h*100)} cm</div></div>
      <button class="x" data-act="close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="hr"></div>
    <div class="f-label">Type</div>
    ${selectHTML('dtype', typeOpts, `<span>${C.doors[d.type].name}</span>`)}
    <div class="grid2" style="margin-top:12px">
      <div><div class="f-label" style="margin-top:0">Width</div><input class="inp" data-act="dw" type="number" step="5" min="60" max="120" value="${Math.round(d.w*100)}"> </div>
      <div><div class="f-label" style="margin-top:0">Height</div><input class="inp" data-act="dh" type="number" step="5" min="180" max="220" value="${Math.round(d.h*100)}"></div>
    </div>
    <div class="f-label">Colour</div>
    ${selectHTML('dcolor', colorOpts, curLabel(colorMap, d.color))}
    <div class="grid2" style="margin-top:12px">
      <button class="collapse" data-act="flipdoor" style="margin-top:0">Flip hinge</button>
      <button class="collapse" data-act="swingdoor" style="margin-top:0">Swing ${d.out?'in':'out'}</button>
    </div>
    <button class="collapse" data-act="deldoor" style="color:#e5476f;border-color:#f3c8d4">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/></svg> Remove door
    </button>
    <button class="collapse" data-act="close">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg> Collapse
    </button>
  </div>`;
}

function renderWinPanel(b, w){
  if(!w){ setSel({kind:'block', blockId:b.id}); return renderSidebar(); }
  const kinds = {std:{name:'Standard'}, pano:{name:'Panoramic (floor-to-ceiling)'}};
  SEL_H['wkind'] = v=>commit(()=>{ w.kind = v==='std' ? undefined : v; });
  const cur = w.kind||'std';
  const kindOpts = Object.entries(kinds).map(([k,v])=>`
    <button class="sel-item" data-v="${k}"><span><span class="nm">${v.name}</span></span>
      ${k===cur?'<svg style="margin-left:auto;color:#1d5bb4" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m5 13 4 4L19 7"/></svg>':''}
    </button>`).join('');
  side.innerHTML = `<div class="selpanel">
    <div class="selhead">
      <span class="cube"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M12 4v16M4 12h16"/></svg></span>
      <div><h2>Window</h2><div class="pr" style="color:#8b96ab">${cur==='pano'?'2.2 m · full height':'1.3 × 1.06 m'}</div></div>
      <button class="x" data-act="close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="hr"></div>
    <div class="f-label">Type</div>
    ${selectHTML('wkind', kindOpts, `<span>${kinds[cur].name}</span>`)}
    <button class="collapse" data-act="delwin" data-b="${b.id}" data-w="${w.id}" style="color:#e5476f;border-color:#f3c8d4;margin-top:14px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/></svg> Remove window
    </button>
    <button class="collapse" data-act="close">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg> Collapse
    </button>
  </div>`;
}

function renderFurnPanel(b, f){
  if(!f){ setSel({kind:'block', blockId:b.id}); return renderSidebar(); }
  const s = C.furniture[f.key];
  side.innerHTML = `<div class="selpanel">
    <div class="selhead">
      <span class="cube"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 18v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6"/><path d="M4 11V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M6 18v2M18 18v2"/></svg></span>
      <div><h2>${s.name}</h2><div class="pr" style="color:#8b96ab">${s.w} × ${s.d} × ${s.h} m</div></div>
      <button class="x" data-act="close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="hr"></div>
    <div class="note">Drag it in the 3D or 2D view to move it inside the room. Use the chips above it to duplicate, rotate or delete.</div>
    <button class="collapse" data-act="delfurn" data-b="${b.id}" data-f="${f.id}" style="color:#e5476f;border-color:#f3c8d4">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/></svg> Remove
    </button>
    <button class="collapse" data-act="close">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg> Collapse
    </button>
  </div>`;
}

/* sidebar event delegation */
side.addEventListener('click', e=>{
  if(VIEW) return;   // view mode renders no controls in the sidebar
  const secBtn = e.target.closest('.sec > button');
  if(secBtn){
    const id = secBtn.parentElement.dataset.sec;
    ui.openSecs.has(id) ? ui.openSecs.delete(id) : ui.openSecs.add(id);
    renderSidebar(); return;
  }
  const selBtn = e.target.closest('.sel-btn');
  if(selBtn){
    const wrap = selBtn.closest('.sel');
    document.querySelectorAll('.sel.open').forEach(s=>s!==wrap&&s.classList.remove('open'));
    wrap.classList.toggle('open'); return;
  }
  const preset = e.target.closest('[data-preset]');
  if(preset){
    applyModernPreset(preset.dataset.preset);
    return;
  }
  const item = e.target.closest('.sel-item');
  if(item){
    const wrap = item.closest('.sel');
    const h = SEL_H[wrap.dataset.sel];
    wrap.classList.remove('open');
    h && h(item.dataset.v); return;
  }
  const act = e.target.closest('[data-act]');
  if(!act) return;
  const a = act.dataset.act;
  if(a==='close'){ setSel(null); renderSelection(); }
  if(a==='deldoor'){
    const b = selBlock(), d = selDoor(); if(!b||!d) return;
    commit(()=>{ b.doors = b.doors.filter(x=>x.id!==d.id); setSel({kind:'block', blockId:b.id}); });
  }
  if(a==='delfurn'){
    const b = getBlock(+act.dataset.b);
    commit(()=>{ b.furniture = b.furniture.filter(f=>f.id!==+act.dataset.f); if(sel&&sel.kind==='furn'&&sel.furnId===+act.dataset.f) setSel(null); });
  }
  if(a==='addwin'){
    const b = selBlock() || state.blocks[0]; if(!b) return;
    commit(()=>{
      const t = freeT([...b.windows.filter(w=>w.wall===0), ...b.doors.filter(d=>d.wall===0)], b.len, 1.5);
      b.windows.push({id:++state.seq.win, wall:0, t});
    });
  }
  if(a==='delwin'){
    const b = getBlock(+act.dataset.b);
    commit(()=>{ b.windows = b.windows.filter(w=>w.id!==+act.dataset.w);
      if(sel&&sel.kind==='window'&&sel.winId===+act.dataset.w) setSel(null); });
  }
  if(a==='seldoor'){ setSel({kind:'door', blockId:+act.dataset.b, doorId:+act.dataset.d}); renderSelection(); }
  if(a==='opendoors'){ openToolPop('doors'); }
  if(a==='flipdoor'){ const d = selDoor(); if(d) commit(()=>{ d.flip = !d.flip || undefined; }); }
  if(a==='swingdoor'){ const d = selDoor(); if(d) commit(()=>{ d.out = !d.out || undefined; }); }
});
side.addEventListener('change', e=>{
  if(VIEW) return;
  const el = e.target;
  if(el.dataset.act==='rname'){
    const b = selBlock(); if(!b) return;
    commit(()=>{ b.name = el.value.trim() || undefined; });
    return;
  }
  if(el.dataset.act==='dw'||el.dataset.act==='dh'){
    const d = selDoor(); if(!d) return;
    const v = Math.max(+el.min, Math.min(+el.max, +el.value||0));
    commit(()=>{ d[el.dataset.act==='dw'?'w':'h'] = v/100; });
  }
  if(el.dataset.act==='rw'||el.dataset.act==='rl'){
    const b = selBlock(); if(!b) return;
    const v = Math.round(Math.max(C.roomMin, Math.min(C.roomMax, +el.value||0))*10)/10;
    const nw = el.dataset.act==='rw' ? v : b.w;
    const nl = el.dataset.act==='rl' ? v : b.len;
    const [fw, fd] = b.rot%2 ? [nw, nl] : [nl, nw];
    if(overlaps(b.cx, b.cz, fw, fd, b.id)){
      toast('No space — the room would overlap a neighbour');
      renderSidebar();
      return;
    }
    commit(()=>{ b.w = nw; b.len = nl; refitFurniture(b); });   // keep furniture inside a shrunk room
    return;
  }
});
document.addEventListener('click', e=>{
  if(!e.target.closest('.sel')) document.querySelectorAll('.sel.open').forEach(s=>s.classList.remove('open'));
  if(!e.target.closest('.dropdown')) document.querySelectorAll('.dropdown.open').forEach(s=>s.classList.remove('open'));
});

export {renderSidebar};

/* phones: the details panel is a bottom sheet under the stage (CSS); the handle
   above it opens and closes it */
$('#sheetB').addEventListener('click', ()=>{
  const open = $('#app').classList.toggle('sheet-open');
  $('#sheetB').setAttribute('aria-expanded', String(open));
});
