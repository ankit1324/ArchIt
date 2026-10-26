import './catalog.js';

/* ============================== embed mode ============================== */
// ?embed=1 → driven by the parent map app over postMessage; no localStorage,
// no tutorial, no share links. See DesignerOverlay.tsx for the other side.
const EMBED = new URLSearchParams(location.search).has('embed');
if(EMBED) document.body.classList.add('embed');
// ?embed=1&view=1 → read-only viewer for someone else's published design (the
// /showcase pages and the /find design viewer). Every mutating path returns
// early on VIEW and nothing is ever posted back as a save; body.view hides the
// editing chrome (builder.html). Only meaningful inside embed mode.
const VIEW = EMBED && new URLSearchParams(location.search).has('view');
if(VIEW) document.body.classList.add('view');

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

export {$, EMBED, VIEW, chips, escapeMarkup, ov, round1, side, stage, toast};
