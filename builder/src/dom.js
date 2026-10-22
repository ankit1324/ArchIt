import './catalog.js';

/* ============================== embed mode ============================== */
// ?embed=1 → driven by the parent map app over postMessage; no localStorage,
// no tutorial, no share links. See DesignerOverlay.tsx for the other side.
const EMBED = new URLSearchParams(location.search).has('embed');
if(EMBED) document.body.classList.add('embed');

/* ============================== helpers ============================== */
const $ = s => document.querySelector(s);
const stage = $('#stage'), side = $('#side'), ov = $('#ov'), chips = $('#chips');
let toastTimer=null;
function toast(msg){
  const t=$('#toast'); t.querySelector('span').textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),3200);
}
function round1(v){ return Math.round(v*100)/100; }

function escapeMarkup(value){
  return String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export {$, EMBED, chips, escapeMarkup, ov, round1, side, stage, toast};
