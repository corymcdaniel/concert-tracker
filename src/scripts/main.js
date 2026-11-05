import { analyticsReady, initAnalytics, track } from './analytics.js';
import { load } from './api.js';
import { applyAuth, canEdit, initIdentity, openLogin, setState } from './auth.js';
import { startAutoInfo } from './autoinfo.js';
import { jumpToNight, jumpToYear, renderEnd } from './endcap.js';
import { openHistory, undoChange } from './history.js';
import { closeInfo, loadInfo, morphOpen, openInfo, openInfoEdit, openInfoPhoto } from './info.js';
import { dealIn, filterList, fullNight, paintStubPhotos } from './log.js';
import { loadPhotos, nightPhotos, uploadPhotos } from './photos.js';
import { openViewer, stepViewer } from './viewer.js';
import { effectsOn, isOpen, motionOK, toast } from './motion.js';
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
import { followHash, followStatsLink, openStatsSection, opensStats, render, setView, statsHash } from './view.js';

/* ---------- events ---------- */
// The night a ticket's + Photos button is uploading to
let photoFor = null;
const photosChanged = () => { paintStubPhotos(); renderEnd(); };
$('#photoPick').addEventListener('change', e => {
  if (photoFor) uploadPhotos(photoFor, e.target.files, photosChanged);
  e.target.value = '';
});
// The viewer closes on its backdrop and steps with the arrow keys
$('#viewer').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
document.addEventListener('keydown', e => {
  if (!$('#viewer').open) return;
  if (e.key === 'ArrowRight') stepViewer(1);
  if (e.key === 'ArrowLeft') stepViewer(-1);
});
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.statsSection !== undefined) { openStatsSection(t.dataset.statsSection); return; }
  if (t.id === 'rvClose') { $('#review').close(); return; }
  if (t.id === 'rvShare') { shareReview(t); return; }
  if (t.dataset.review) { openReview(t.dataset.review); return; }
  if (t.dataset.region) { setRegion(t.dataset.region); return; }
  if (t.dataset.vcity !== undefined) { fitTo(t.dataset.vcity); return; }
  if (t.dataset.year) { jumpToYear(t.dataset.year); return; }
  if (t.dataset.snap) { photoFor = t.dataset.snap; $('#photoPick').click(); return; }
  if (t.dataset.photosOf) { const n = fullNight(t.dataset.photosOf); if (n) openViewer(nightPhotos(n).map(p => ({p, n})), +t.dataset.at); return; }
  if (t.dataset.infoPhoto !== undefined) { openInfoPhoto(t.dataset.infoPhoto); return; }
  if (t.dataset.vwStep) { stepViewer(+t.dataset.vwStep); return; }
  if ('vwClose' in t.dataset) { $('#viewer').close(); return; }
  if (t.dataset.night) { jumpToNight(t.dataset.night); return; }
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
  else if (t.id==='moreBtn'){ state.showAllMost=!state.showAllMost; renderStatsView(); }
  else if (t.dataset.type !== undefined){ track('filter', {filter: 'type', value: t.dataset.type || 'all'}); filt.type = t.dataset.type; document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed', b===t)); filterList(); }
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
$('#city').addEventListener('change', e => { filt.city = e.target.value; filterList(); track('filter', {filter: 'city', value: e.target.value || 'all'}); });
// A search counts once it's committed (Enter, or leaving the box), not on every keystroke
$('#q').addEventListener('change', e => { const term = e.target.value.trim(); if (term) track('search', {search_term: term}); });
$('#btnAdd').onclick = () => openAdd(null);
$('#btnData').onclick = openData;
initAnalytics();

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
    if (!effectsOn()) return;
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

// Navy by default; the light scheme is remembered in this browser. Base.astro sets it before the page paints.
function setTheme(light){
  const root = document.documentElement;
  if (light) root.dataset.theme = 'light';
  else delete root.dataset.theme;
  $('#btnTheme').setAttribute('aria-pressed', String(light));
  let saved = 'navy';
  if (light) saved = 'light';
  store.set('show-log-theme', saved);
  track('theme_change', {theme: saved});
}
$('#btnTheme').setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'light'));
$('#btnTheme').onclick = () => {
  const light = document.documentElement.dataset.theme !== 'light';
  // Cross-fade the whole page between schemes where the browser can
  if (motionOK() && document.startViewTransition) { document.startViewTransition(() => setTheme(light)); return; }
  setTheme(light);
};

// Effects on by default; off is the simple view (see _effects.scss), remembered in this browser.
// Base.astro sets it before the page paints. The light switch disappears with effects off, so the lights come back up.
let lightsUp = () => {};
function setEffects(on){
  const root = document.documentElement;
  if (on) delete root.dataset.effects;
  else { root.dataset.effects = 'off'; lightsUp(); $('#spotlight').classList.remove('on'); }
  $('#btnEffects').setAttribute('aria-pressed', String(on));
  let saved = 'off';
  if (on) saved = 'on';
  store.set('show-log-effects', saved);
  track('effects_change', {effects: saved});
}
$('#btnEffects').setAttribute('aria-pressed', String(effectsOn()));
$('#btnEffects').onclick = () => setEffects(!effectsOn());

// Goodnight: the footer's switch fades the house lights out, leaving a follow-spot at the mouse (or wherever you tap).
// Flip it again or press Esc to bring them back. Not remembered, so every visit starts with the lights up.
{
  const sw = $('#lightSwitch'), dark = $('#houseLights');
  let frame = 0, fx = 0, fy = 0;
  const follow = e => {
    fx = e.clientX; fy = e.clientY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      dark.style.setProperty('--fx', `${fx}px`);
      dark.style.setProperty('--fy', `${fy}px`);
    });
  };
  const setLights = out => {
    document.documentElement.classList.toggle('lights-out', out);
    sw.setAttribute('aria-pressed', String(out));
    let label = 'Lights out';
    if (out) label = 'Lights up';
    sw.setAttribute('aria-label', label);
    sw.title = label;
    let lights = 'up';
    if (out) lights = 'out';
    track('house_lights', {lights});
    if (out) {
      document.addEventListener('pointermove', follow, {passive: true});
      document.addEventListener('pointerdown', follow, {passive: true});
    } else {
      document.removeEventListener('pointermove', follow);
      document.removeEventListener('pointerdown', follow);
    }
  };
  sw.addEventListener('click', e => {
    // From the keyboard there's no pointer, so the follow-spot starts on the switch itself
    let at = e;
    if (e.detail === 0) { const r = sw.getBoundingClientRect(); at = {clientX: r.left + r.width / 2, clientY: r.top + r.height / 2}; }
    follow(at);
    setLights(sw.getAttribute('aria-pressed') !== 'true');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sw.getAttribute('aria-pressed') === 'true') setLights(false); });
  lightsUp = () => { if (sw.getAttribute('aria-pressed') === 'true') setLights(false); };
}

// A soft light follows the mouse around the whole page: on while the pointer is in the window, off when it leaves
if (motionOK() && matchMedia('(hover:hover)').matches) {
  const spot = $('#spotlight');
  let frame = 0, x = 0, y = 0;
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !effectsOn()) return;
    x = e.clientX; y = e.clientY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      spot.style.setProperty('--sx', `${x}px`);
      spot.style.setProperty('--sy', `${y}px`);
      spot.classList.add('on');
    });
  }, {passive: true});
  document.documentElement.addEventListener('pointerleave', () => spot.classList.remove('on'));
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
  // The log only needs the shows, so deal it out now rather than after sign-in and the extras.
  // Signed-out first, so editor buttons don't flash up before sign-in is known.
  // A link into stats keeps the hand on screen until stats can be drawn, then goes straight there.
  const toStats = opensStats();
  applyAuth();
  if (!toStats) dealIn(render);
  if (state.mode==='netlify') await initIdentity();
  // Sign-in is known now, so analytics can tell your visits from everyone else's
  analyticsReady();
  await Promise.all([loadInfo(), loadSetlists(), loadListening(), loadPhotos()]);
  if (toStats) render();
  // Photos arrive after the log is dealt: paint them onto the tickets and into the mosaic
  else photosChanged();
  applyAuth();
  startAutoInfo();
  followStatsLink();
  const reviewYear = /^#review-(\d{4})$/.exec(location.hash);
  if (reviewYear) { setView('stats', 'overview'); openReview(reviewYear[1]); }
  if (state.mode!=='netlify') setState('Saved in this browser');
});
