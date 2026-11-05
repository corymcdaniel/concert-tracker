import { nightKey, nights } from './log.js';
import { motionOK } from './motion.js';
import { mosaicPhotos, photoUrl } from './photos.js';
import { MONTHS, state } from './state.js';
import { $, esc, happened } from './util.js';

/* ---------- the end of the log: a year rail to jump around, then a mosaic of your own photos ----------
   Only photos uploaded to a night appear in the mosaic; until there are some, it's just the heading and the rail. */
// Tiles come in blocks of 8 that fill a 6 x 2 grid exactly: one big (2 x 2), one wide (2 x 1), six single.
// Every other block is mirrored so the big tiles alternate sides.
const BLOCK = 8, MAX_BLOCKS = 2;
const BLOCK_SIZES = [['big', 'wide'], ['', '', 'wide', 'big']];

const longDate = d => `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}`;
const isMusic = n => n.acts.some(a => a.type === 'Music');

function rail(dated){
  const byYear = new Map();
  dated.forEach(n => {
    const y = +n.date.slice(0, 4);
    const v = byYear.get(y) || {music: 0, comedy: 0};
    if (isMusic(n)) v.music++;
    else v.comedy++;
    byYear.set(y, v);
  });
  const years = [...byYear.keys()];
  const y0 = Math.min(...years), y1 = Math.max(...years);
  const max = Math.max(...[...byYear.values()].map(v => v.music + v.comedy));
  const cols = [];
  for (let y = y0; y <= y1; y++) {
    const v = byYear.get(y) || {music: 0, comedy: 0}, total = v.music + v.comedy;
    let label = '';
    if (y === y0 || y === y1 || y % 5 === 0) label = `'${String(y).slice(2)}`;
    let tip = `${y}: no shows`;
    if (total === 1) tip = `${y}: 1 night`;
    else if (total) tip = `${y}: ${total} nights`;
    // Bar heights are steps of a tenth, set by class, so there are no inline styles
    const step = n => Math.round(n / max * 10);
    let bar = '<span class="none"></span>';
    if (total) bar = `<span class="stack h${step(total)}"><i class="m g${Math.min(v.music, 40)}"></i><i class="c g${Math.min(v.comedy, 40)}"></i></span>`;
    let attrs = 'disabled';
    if (total) attrs = `data-year="${y}"`;
    cols.push(`<button type="button" class="ry" ${attrs} title="${tip}" aria-label="${tip}">${bar}<span class="yl">${label}</span></button>`);
  }
  return `<div class="rail" role="group" aria-label="Jump to a year">${cols.join('')}</div>`;
}

// Uploaded photos, each tile a link to its night, in whole blocks so the grid has no holes.
// photos: [{n: night, p: photo}], one per night in a random order (photos.js mosaicPhotos)
// Photo widths for the tiles, about twice their size on screen: big and wide tiles span two columns
function tileWidth(size){
  if (size === 'big' || size === 'wide') return 720;
  return 360;
}
function mosaic(photos){
  const tiles = photos.slice(0, BLOCK * MAX_BLOCKS);
  if (!tiles.length) return '';
  // Fewer than one block: plain singles. Otherwise drop the leftovers.
  const blocks = Math.floor(tiles.length / BLOCK);
  if (blocks) tiles.length = blocks * BLOCK;
  return `<div class="mosaic">${tiles.map(({n, p}, i) => {
    let size = '';
    if (blocks) size = BLOCK_SIZES[Math.floor(i / BLOCK) % 2][i % BLOCK] || '';
    return `<button type="button" class="tile ${size}" data-night="${esc(nightKey(n))}" data-i="${Math.min(i, 16)}">
      <img loading="lazy" src="${esc(photoUrl(p, tileWidth(size)))}" alt="" onerror="this.closest('.tile').remove()">
      <span class="cap"><b>${esc(n.acts[0].artist)}</b><small>${esc(n.venue)} · ${longDate(n.date)}</small></span></button>`;
  }).join('')}</div>`;
}

export function renderEnd(){
  const box = $('#endcap'); if (!box) return;
  // Every past night counts, dated or not, the same as the header
  const all = nights(state.shows.filter(happened));
  const dated = all.filter(n => n.date);
  if (!dated.length) { box.innerHTML = ''; return; }
  const first = dated.at(-1);
  const span = +dated[0].date.slice(0, 4) - +first.date.slice(0, 4) + 1;
  box.innerHTML = `<div class="end-head">
      <p class="end-k">End of the log</p>
      <h2>${span} years, ${all.length} nights</h2>
      <p class="end-sub">It started with <b>${esc(first.acts[0].artist)}</b> at ${esc(first.venue)}, ${longDate(first.date)}.</p>
    </div>${rail(dated)}<div class="mosaic-slot"></div>`;
  fillMosaic(box.querySelector('.mosaic-slot'), all);
}

/* The mosaic is built straight away, so the page is its full height from the start: building it late made the page
   suddenly grow near the bottom, which moved everything measured against the page's height (the year scroller).
   Its photos still only download as they near the screen (loading="lazy"), and they're small resized copies.
   The tiles play in when the mosaic actually scrolls into view. */
let mosaicSeen = false, inObs = null;
function fillMosaic(slot, all){
  inObs?.disconnect();
  slot.innerHTML = mosaic(mosaicPhotos(all));
  const grid = slot.firstElementChild; if (!grid) return;
  // Rebuilt after an upload or edit: it's already been seen, so show it straight away
  if (mosaicSeen || !('IntersectionObserver' in window)) { grid.classList.add('in'); return; }
  inObs = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    grid.classList.add('in'); mosaicSeen = true; inObs.disconnect();
  }, {threshold: .15});
  inObs.observe(grid);
}

// Scroll so the year's first ticket sits just under its pinned header
export function jumpToYear(y){
  const head = document.getElementById(`y-${y}`); if (!head) return;
  const first = head.nextElementSibling || head;
  let behavior = 'auto';
  if (motionOK()) behavior = 'smooth';
  window.scrollTo({top: first.getBoundingClientRect().top + scrollY - head.offsetHeight - 8, behavior});
}

// Bring a night's ticket to the middle of the screen and flash it
export function jumpToNight(k){
  const el = [...document.querySelectorAll('#list .stub')].find(s => s.dataset.k === k); if (!el) return;
  let behavior = 'auto';
  if (motionOK()) behavior = 'smooth';
  el.scrollIntoView({block: 'center', behavior});
  el.classList.remove('flash');
  // Restart the flash if it's already running
  void el.offsetWidth;
  el.classList.add('flash');
  el.addEventListener('animationend', () => el.classList.remove('flash'), {once: true});
}
