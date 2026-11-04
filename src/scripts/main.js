import { load } from './api.js';
import { applyAuth, canEdit, initIdentity, openLogin, setState } from './auth.js';
import { startAutoInfo } from './autoinfo.js';
import { openHistory, undoChange } from './history.js';
import { closeInfo, loadInfo, morphOpen, openInfo, openInfoEdit } from './info.js';
import { filterList, renderStats } from './log.js';
import { isOpen, motionOK, toast } from './motion.js';
import { openReview, shareReview, stepReview } from './review.js';
import { closeSheet, openAdd, openBill, openData, openEdit } from './sheets.js';
import { filt, state } from './state.js';
import { loadListening } from './stats/bucket.js';
import { renderStatsView } from './stats/index.js';
import { setRegion, showPin } from './stats/map.js';
import { fitTo } from './stats/venues.js';
import { loadSetlists, syncSetlists } from './stats/setlists.js';
import { showWallTile, updateWall, wallOpts } from './stats/wall.js';
import { $, store } from './util.js';
import { followHash, followStatsLink, openStatsSection, render, setView, statsHash } from './view.js';

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.statsSection !== undefined) { openStatsSection(t.dataset.statsSection); return; }
  if (t.id === 'rvClose') { $('#review').close(); return; }
  if (t.id === 'rvShare') { shareReview(t); return; }
  if (t.dataset.review) { openReview(t.dataset.review); return; }
  if (t.dataset.region) { setRegion(t.dataset.region); return; }
  if (t.dataset.vcity !== undefined) { fitTo(t.dataset.vcity); return; }
  if (t.dataset.wallSort) { wallOpts.sort = t.dataset.wallSort; updateWall(); return; }
  if ('wallClear' in t.dataset) { wallOpts.genre = ''; wallOpts.decade = ''; $('#wallGenre').value = ''; $('#wallDecade').value = ''; updateWall(); return; }
  if (t.id === 'syncSets') { syncSetlists(t); return; }
  if (t.dataset.artist !== undefined) { morphOpen(t, () => openInfo('artists', t.dataset.artist, canEdit() ? t.dataset.id : null)); return; }
  if (t.dataset.venue !== undefined) { morphOpen(t, () => openInfo('venues', t.dataset.venue)); return; }
  if ('closeInfo' in t.dataset) { closeInfo(); return; }
  if (t.dataset.infoEdit) { openInfoEdit(t.dataset.infoEdit, t.dataset.key); return; }
  if (t.dataset.history !== undefined) { closeInfo(); openHistory(t.dataset.history, t.dataset.key); return; }
  if (t.dataset.historyMore) { t.disabled = true; openHistory(state.historyFor.table, state.historyFor.key, t.dataset.historyMore); return; }
  if (t.dataset.undo) { t.disabled = true; undoChange(t.dataset.undo); return; }
  if (t.dataset.edit) { closeInfo(); if (canEdit()) openEdit(t.dataset.edit); else { const a=state.shows.find(s=>s.id===t.dataset.edit); if(a){ $('#q').value=a.artist; filt.q=a.artist; filterList(); } } }
  else if (t.id==='btnAuth') { if (state.user) { state.idn.logout().finally(()=>{ state.user=null; applyAuth(); toast('Signed out'); }); } else openLogin(); }
  else if (t.dataset.addto) openAdd(state.shows.find(s=>s.id===t.dataset.addto));
  else if (t.dataset.bill) openBill(t.dataset.bill);
  else if ('close' in t.dataset) closeSheet();
  else if (t.dataset.q !== undefined){ closeInfo(); $('#q').value = t.dataset.q; filt.q = t.dataset.q; setView('log'); filterList(); window.scrollTo({top:0}); }
  else if (t.dataset.view){ setView(t.dataset.view); }
  else if (t.id==='moreBtn'){ state.showAllMost=!state.showAllMost; renderStats(); }
  else if (t.dataset.type !== undefined){ filt.type = t.dataset.type; document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed', b===t)); filterList(); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'wallGenre') { wallOpts.genre = e.target.value; updateWall(); }
  if (e.target.id === 'wallDecade') { wallOpts.decade = e.target.value; updateWall(); }
});
['pointerover', 'focusin'].forEach(type => document.addEventListener(type, e => {
  const tile = e.target.closest?.('#wall button');
  if (tile) showWallTile(tile);
}));
$('#scrim').onclick = () => { closeSheet(); closeInfo(); };
addEventListener('popstate', followHash);
document.addEventListener('keydown', e => { if (e.key==='Escape') { if (isOpen($('#sheet'))) closeSheet(); else if (isOpen($('#info'))) closeInfo(); } });
$('#q').addEventListener('input', e => { filt.q = e.target.value.trim(); filterList(); });
document.addEventListener('change', e => { if (e.target.id==='f-move' && e.target.value){ store.set('show-log-move', e.target.value); renderStatsView(); } });
$('#city').addEventListener('change', e => { filt.city = e.target.value; filterList(); });
$('#btnAdd').onclick = () => openAdd(null);
$('#btnData').onclick = openData;

// Map pins aren't buttons, so they get their own click and keyboard handling
$('#statsView').addEventListener('click', e => { const p = e.target.closest('[data-pin]'); if (p) showPin(p.dataset.pin); });
$('#statsView').addEventListener('keydown', e => {
  const p = e.target.closest('[data-pin]');
  if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showPin(p.dataset.pin); }
});

// Year in review: tap the right side for next, the left for back. Arrow keys work too.
$('#review').addEventListener('click', e => {
  if (e.target.closest('button,a')) return;
  let by = 1;
  if (e.clientX < innerWidth / 3) by = -1;
  stepReview(by);
});
// On the document: redrawing a slide drops focus out of the dialog
document.addEventListener('keydown', e => {
  if (!$('#review').open) return;
  if (e.key === 'ArrowRight') stepReview(1);
  if (e.key === 'ArrowLeft') stepReview(-1);
});
$('#review').addEventListener('close', () => {
  let hash = location.pathname + location.search;
  if (state.view === 'stats') hash = statsHash();
  try { history.replaceState(null, '', hash); } catch {}
});

// Stubs tilt toward the cursor and the foil follows it, a little more on repeat sightings
if (motionOK() && matchMedia('(hover:hover)').matches) {
  let frame = 0, last = null;
  $('#list').addEventListener('pointermove', e => {
    last = e;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const el = last.target.closest('.stub'); if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (last.clientX - r.left) / r.width, py = (last.clientY - r.top) / r.height;
      let tilt = 1.2;
      if (el.classList.contains('rep')) tilt = 2.2;
      el.style.setProperty('--ry', `${((px - .5) * tilt * 2).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${((.5 - py) * tilt * 2).toFixed(2)}deg`);
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    });
  });
}

// The Up and Stats/Log buttons appear when the year headers start pinning, so they arrive together:
// in the log, once the first year header pins to the top; in stats, which has no years,
// once the section links have scrolled off. Filters and tabs move things without scrolling, so watch size too.
let upFrame = 0;
function floatNavShown(){
  if (state.view === 'stats') {
    const links = $('#statsView .subnav');
    if (!links) return false;
    return links.getBoundingClientRect().bottom <= 0;
  }
  // Every year header sits in #list, so the first one stays pinned at 0 until the list ends
  const year = $('#list .year');
  // A pixel of slack for sub-pixel scroll positions
  if (year) return year.getBoundingClientRect().top <= 1;
  return $('#list').getBoundingClientRect().top <= 0;
}
function queueUp(){
  if (upFrame) return;
  upFrame = requestAnimationFrame(() => {
    upFrame = 0;
    $('#floatNav').classList.toggle('on', floatNavShown());
  });
}
addEventListener('scroll', queueUp, {passive: true});
addEventListener('resize', queueUp);
new ResizeObserver(queueUp).observe(document.body);
function backToTop(){
  let behavior = 'auto';
  if (motionOK()) behavior = 'smooth';
  window.scrollTo({top: 0, behavior});
  // The buttons are about to hide, so keep keyboard focus at the top with the page
  $('.tabs button[aria-selected=true]').focus({preventScroll: true});
}
$('#toTop').onclick = backToTop;
// Jumps to the other view (Stats from the log, Log from stats) and starts it at the top
$('#toView').onclick = () => {
  let next = 'stats';
  if (state.view === 'stats') next = 'log';
  setView(next);
  backToTop();
};

load().then(async () => {
  if (state.mode==='netlify') await initIdentity();
  await Promise.all([loadInfo(), loadSetlists(), loadListening()]);
  render(); applyAuth();
  startAutoInfo();
  followStatsLink();
  const reviewYear = /^#review-(\d{4})$/.exec(location.hash);
  if (reviewYear) { setView('stats', 'overview'); openReview(reviewYear[1]); }
  if (state.mode!=='netlify') setState('Saved in this browser');
});
