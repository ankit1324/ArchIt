import './export.js';
import {EMBED, toast} from './dom.js';
import {linkFloor, setState, state} from './state.js';
import {modal, showModal} from './ui.js';

/* ============================== render all ============================== */
// localStorage persistence is debounced (~500 ms after the last change) and
// flushed when the page is hidden/unloaded, instead of a synchronous
// JSON.stringify + write on every render.
let _saveTimer = null;
function saveProject(){
  if(EMBED) return; // embedded designs live in the map app's DB, not localStorage
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(flushProject, 500);
}
function flushProject(){
  if(!_saveTimer) return;
  clearTimeout(_saveTimer); _saveTimer = null;
  if(EMBED || !state) return;
  try{ localStorage.setItem('architHome', JSON.stringify({v:3, state})); }catch(e){}
}
addEventListener('pagehide', flushProject);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'hidden') flushProject(); });
function loadProject(){
  try{
    const o = JSON.parse(localStorage.getItem('architHome') || localStorage.getItem('krausHome'));
    if(o && o.v===3 && o.state && Array.isArray(o.state.blocks) && o.state.blocks.length){
      setState(o.state); linkFloor(); return true;
    }
  }catch(e){}
  return false;
}

/* ============================== share link ============================== */
async function packState(){
  const raw = new TextEncoder().encode(JSON.stringify({v:3, state}));
  let bytes = raw, mode = 'p';
  if(window.CompressionStream){
    const buf = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    bytes = new Uint8Array(buf); mode = 'g';
  }
  let bin = ''; bytes.forEach(x=>bin += String.fromCharCode(x));
  return mode + btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function unpackState(h){
  const mode = h[0];
  const bin = atob(h.slice(1).replace(/-/g,'+').replace(/_/g,'/'));
  let bytes = new Uint8Array([...bin].map(c=>c.charCodeAt(0)));
  if(mode==='g'){
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    bytes = new Uint8Array(buf);
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function shareLink(){
  const url = location.origin + location.pathname + '#d=' + await packState();
  try{
    await navigator.clipboard.writeText(url);
    toast('Share link copied to clipboard');
  }catch(e){
    showModal(`<h3>Share link</h3>
      <input class="inp" value="${url.replace(/"/g,'&quot;')}" data-select-all readonly>
      <button class="mbtn" data-close>Done</button>`);
    modal.querySelector('[data-select-all]').addEventListener('click', e=>e.target.select());
  }
}
async function tryHashLoad(){
  if(!location.hash.startsWith('#d=')) return false;
  try{
    const o = await unpackState(location.hash.slice(3));
    if(o && o.v===3 && o.state && Array.isArray(o.state.blocks)){
      setState(o.state); linkFloor();
      history.replaceState(null, '', location.pathname);
      return true;
    }
  }catch(e){}
  return false;
}

export {loadProject, saveProject, shareLink, tryHashLoad};
