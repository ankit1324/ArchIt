import './persistence.js';
import {$} from './dom.js';

/* ============================== tutorial ============================== */
const TUT_STEPS = [
  {title:'Welcome to ArchIt!',
   body:'Plan your home room by room — compose a hall, kitchen, bedrooms, baths, balcony or veranda, add doors, windows and furniture, and see it in 3D as you go. Here’s a quick tour.'},
  {el:'.viewtoggle', title:'3D and 2D modes',
   body:'Switch between a 3D view of your house and a 2D floor plan. Both stay in sync — edit wherever it’s easier.'},
  {el:'#toolbar', pad:10, title:'Catalogs',
   body:'Layout templates, rooms, partitions, doors, windows and furniture live here. Open the Rooms catalog to add a bedroom, kitchen, bathroom, balcony, veranda or stairs.'},
  {el:'.hs', fallback:'#stage', pad:14, title:'Add and arrange',
   body:'The white “+” buttons around a room add a new one on that side. Click a room to select it, then drag it to move it (it snaps to neighbours), or duplicate, rotate and delete it with the chips above it. Doors and windows drag along walls too — in 2D, and in 3D once selected.'},
  {el:'#side', title:'Configuration panel',
   body:'Every part of the house is configured here — exterior presets, facade, roof, wall paint, floors, windows and doors. Select a room to edit its name, size and finishes.'},
  {el:'#bottombar', pad:10, title:'Area and checks',
   body:'Total area and room count update with every change. Checks flags rooms without a door or windows that open into another room — click it to see what needs fixing.'},
  {el:'#undoB', pad:8, title:'Made a mistake?',
   body:'Undo and redo any step here (Ctrl+Z / Ctrl+Shift+Z). The camera button in the header exports 3D and 2D images, a printable design sheet, a project file or a share link, and “?” replays this tour.'},
];
const tut = $('#tut'), tutHole = $('#tutHole'), tutCard = $('#tutCard');
let tutI = -1;
function tutShow(i){
  tutI = i;
  const s = TUT_STEPS[i], n = TUT_STEPS.length;
  let r = null;
  if(s.el){
    const el = document.querySelector(s.el) || (s.fallback && document.querySelector(s.fallback));
    if(el) r = el.getBoundingClientRect();
  }
  const p = s.pad ?? 8;
  if(r){
    tutHole.style.opacity = '1';
    tutHole.style.left = (r.left-p)+'px'; tutHole.style.top = (r.top-p)+'px';
    tutHole.style.width = (r.width+2*p)+'px'; tutHole.style.height = (r.height+2*p)+'px';
  } else {
    tutHole.style.opacity = '1';
    tutHole.style.left = '50%'; tutHole.style.top = '38%';
    tutHole.style.width = '0px'; tutHole.style.height = '0px';
  }
  tutCard.innerHTML = `
    <div class="stepn">STEP ${i+1} OF ${n}</div>
    <h4>${s.title}</h4><p>${s.body}</p>
    <div class="dots">${TUT_STEPS.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join('')}</div>
    <div class="row">
      <button class="skip" data-tut="skip">Skip tour</button>
      <span class="nav">
        ${i>0?'<button class="back" data-tut="back">Back</button>':''}
        <button class="next" data-tut="next">${i<n-1?'Next':'Got it!'}</button>
      </span>
    </div>`;
  // place card near the hole
  const cw = 320, ch = tutCard.offsetHeight || 220, m = 16, gap = 14;
  let x, y;
  if(!r){
    x = innerWidth/2 - cw/2; y = innerHeight/2 - ch/2;
  } else {
    if(r.bottom + gap + ch + m < innerHeight){        // below
      y = r.bottom + gap + p; x = r.left + r.width/2 - cw/2;
    } else if(r.top - gap - ch - m > 0){              // above
      y = r.top - gap - ch - p; x = r.left + r.width/2 - cw/2;
    } else if(r.right + gap + cw + m < innerWidth){   // right
      x = r.right + gap + p; y = r.top + r.height/2 - ch/2;
    } else {                                          // left
      x = r.left - gap - cw - p; y = r.top + r.height/2 - ch/2;
    }
    x = Math.max(m, Math.min(innerWidth - cw - m, x));
    y = Math.max(m, Math.min(innerHeight - ch - m, y));
  }
  tutCard.style.left = x+'px'; tutCard.style.top = y+'px';
}
function startTutorial(){ tut.classList.add('show'); tutShow(0); }
function endTutorial(){
  tut.classList.remove('show'); tutI = -1;
  try{ localStorage.setItem('architTutDone','1'); }catch(e){}
}
tutCard.addEventListener('click', e=>{
  const b = e.target.closest('[data-tut]'); if(!b) return;
  const a = b.dataset.tut;
  if(a==='skip') endTutorial();
  if(a==='back' && tutI>0) tutShow(tutI-1);
  if(a==='next'){ tutI < TUT_STEPS.length-1 ? tutShow(tutI+1) : endTutorial(); }
});
addEventListener('resize', ()=>{ if(tutI>=0) tutShow(tutI); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && tutI>=0) endTutorial(); });
$('#helpB').addEventListener('click', startTutorial);

export {startTutorial};
