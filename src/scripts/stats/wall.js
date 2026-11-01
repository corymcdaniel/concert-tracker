import { imgUrl } from '../info.js';
import { motionOK } from '../motion.js';
import { state } from '../state.js';
import { fmt } from './index.js';
import { plural } from './panels.js';
import { $, esc } from '../util.js';

// Sized by how often you've seen them. Photos load as they scroll into view, and sorting
// or filtering moves the existing tiles (see arrangeWall) so they don't load again.
let WALL = [];
export const wallOpts = {sort:'seen', genre:'', decade:''};
const decadeOf = a => { if (!a.first) return ''; return `${a.first.slice(0,3)}0s`; };
export function wallPanel(past){
  const byName = new Map();
  past.forEach(s => {
    const a = byName.get(s.artist) || {name:s.artist, times:0, first:'', comedy:false, genres:state.INFO.artists?.[s.artist]?.genre || []};
    a.times++;
    if (s.date && (!a.first || s.date < a.first)) a.first = s.date;
    if (s.type === 'Comedy') a.comedy = true;
    byName.set(s.artist, a);
  });
  WALL = [...byName.values()];
  if (!WALL.length) return '';
  const genreCount = new Map();
  WALL.forEach(a => a.genres.forEach(g => genreCount.set(g, (genreCount.get(g) || 0) + 1)));
  const genres = [...genreCount].filter(g => g[1] >= 3).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const decades = [...new Set(WALL.map(decadeOf).filter(Boolean))].sort().reverse();
  if (!genreCount.has(wallOpts.genre)) wallOpts.genre = '';
  if (!decades.includes(wallOpts.decade)) wallOpts.decade = '';
  const option = (value, label, on) => `<option value="${esc(value)}"${value === on ? ' selected' : ''}>${esc(label)}</option>`;
  const tiles = WALL.map(a => {
    let img = '', times = '', cls = '';
    const rec = state.INFO.artists?.[a.name];
    if (rec?.img) img = `<img loading="lazy" src="${imgUrl(rec.img, 240)}" alt="" onerror="this.remove()">`;
    if (a.times >= 2) times = ` ×${a.times}`;
    if (a.comedy) cls = 'c';
    // Keeps a long word on one line in a small tile
    let nameCls = 'nm';
    if (a.name.split(/\s+/).some(w => w.length >= 11)) nameCls = 'nm long';
    return `<button type="button" class="${cls}" data-artist="${esc(a.name)}" title="${esc(a.name)}: ${plural(a.times,'time')}"><i class="${nameCls}">${esc(a.name)}</i>${img}<span>${esc(a.name)}${times}</span></button>`;
  }).join('');
  return `<div class="panel"><h3>Everyone you've seen <span><span id="wallCount"></span> · photos: Wikimedia Commons</span></h3>
    <div class="wallbar">
      <div class="seg" role="group" aria-label="Order the wall">
        <button type="button" data-wall-sort="seen">Most seen</button><button type="button" data-wall-sort="timeline">Timeline</button>
      </div>
      <select id="wallGenre" aria-label="Filter by genre">${option('', 'All genres', wallOpts.genre)}${genres.map(([g, n]) => option(g, `${g} (${n})`, wallOpts.genre)).join('')}</select>
      <select id="wallDecade" aria-label="Filter by the decade you first saw them">${option('', 'First seen: any time', wallOpts.decade)}${decades.map(d => option(d, `First seen: ${d}`, wallOpts.decade)).join('')}</select>
      <button type="button" data-wall-clear hidden>Clear</button>
    </div>
    <p class="wallinfo" id="wallInfo" aria-live="polite"></p>
    <div class="wall" id="wall">${tiles}</div></div>`;
}
export function arrangeWall(){
  const box = $('#wall'); if (!box) return;
  const {sort, genre, decade} = wallOpts;
  const timeline = sort === 'timeline';
  const list = WALL.filter(a => (!genre || a.genres.includes(genre)) && (!decade || decadeOf(a) === decade));
  if (timeline) list.sort((a, b) => b.first.localeCompare(a.first) || a.name.localeCompare(b.name));
  else list.sort((a, b) => b.times - a.times || a.name.localeCompare(b.name));
  const tiles = new Map([...box.querySelectorAll('button')].map(b => [b.dataset.artist, b]));
  const out = [];
  let year = null;
  list.forEach(a => {
    const tile = tiles.get(a.name);
    if (timeline) {
      const y = a.first.slice(0,4) || '?';
      if (y !== year) { const mark = document.createElement('div'); mark.className = 'wall-yr'; mark.textContent = y; out.push(mark); year = y; }
    }
    tile.hidden = false;
    tile.classList.toggle('t2', !timeline && a.times >= 2 && a.times < 4);
    tile.classList.toggle('t3', !timeline && a.times >= 4);
    out.push(tile);
    tiles.delete(a.name);
  });
  tiles.forEach(tile => { tile.hidden = true; out.push(tile); });
  box.classList.toggle('timeline', timeline);
  box.replaceChildren(...out);
  $('#wallCount').textContent = plural(list.length, 'artist');
  document.querySelectorAll('[data-wall-sort]').forEach(b => b.setAttribute('aria-pressed', b.dataset.wallSort === sort));
  document.querySelector('[data-wall-clear]').hidden = !genre && !decade;
  let info = 'Hover or tab to a tile for the details.';
  if (!list.length) info = 'Nobody matches both of those. Try clearing a filter.';
  $('#wallInfo').textContent = info;
}
// Tiles glide to their new spots where the browser supports view transitions
export function updateWall(){
  if (!document.startViewTransition || !motionOK()) { arrangeWall(); return; }
  const tiles = document.querySelectorAll('#wall button');
  tiles.forEach((b, i) => { b.style.viewTransitionName = `wall-${i}`; });
  const tr = document.startViewTransition(arrangeWall);
  tr.finished.finally(() => tiles.forEach(b => { b.style.viewTransitionName = ''; }));
}
export function showWallTile(tile){
  const a = WALL.find(x => x.name === tile.dataset.artist); if (!a) return;
  const parts = [plural(a.times,'time')];
  if (a.first) parts.push(`first seen ${fmt(a.first)}`);
  if (a.genres.length) parts.push(a.genres.slice(0,3).join(', '));
  $('#wallInfo').innerHTML = `<b>${esc(a.name)}</b> · ${esc(parts.join(' · '))}`;
}
