import { state } from '../state.js';
import { plural } from './panels.js';
import { $, esc, happened } from '../util.js';

/* hometowns: map-land.json and hometowns.json come from scripts/build-map.mjs */
const REGIONS = {world:{k:1, x:0, y:0}, na:{k:4.3, x:110, y:72}, eu:{k:8.3, x:470, y:75}};
let MAP = null, mapRegion = 'world', mapPlace = null;
async function loadMap(){
  try {
    const [land, homes] = await Promise.all(['map-land.json', 'hometowns.json'].map(f => fetch(f).then(r => { if (!r.ok) throw 0; return r.json(); })));
    MAP = {land, homes};
  } catch { MAP = false; }
}
function hometownGroups(){
  const groups = new Map();
  const counted = new Set();
  state.shows.filter(happened).forEach(s => {
    const rec = state.INFO.artists?.[s.artist];
    const where = rec?.formed_in || rec?.birthplace;
    if (!where || !MAP.homes[where] || counted.has(s.artist)) return;
    counted.add(s.artist);
    if (!groups.has(where)) groups.set(where, []);
    groups.get(where).push(s.artist);
  });
  return [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}
export async function drawMap(){
  const box = $('#mapPanel'); if (!box) return;
  if (MAP === null) await loadMap();
  if (!MAP || !$('#mapPanel')) { box.remove(); return; }
  const groups = hometownGroups();
  if (!groups.length) { box.remove(); return; }
  const r = REGIONS[mapRegion];
  // Biggest pins first, so small ones sit on top and stay clickable
  const pins = groups.map(([where, list], i) => {
    const [x, y] = MAP.homes[where];
    return `<circle class="pin" tabindex="0" role="button" aria-label="${esc(where)}: ${list.length}" data-pin="${esc(where)}" cx="${x}" cy="${y}" r="${(2.2 + Math.sqrt(list.length) * 1.5).toFixed(1)}" style="--i:${i}"><title>${esc(where)}: ${list.length}</title></circle>`;
  }).join('');
  const buttons = [['world','World'], ['na','North America'], ['eu','Europe']].map(([k, label]) =>
    `<button type="button" data-region="${k}" aria-pressed="${k === mapRegion}">${label}</button>`).join('');
  box.innerHTML = `<h3>Where they came from <span>${plural(groups.length,'place')}</span></h3>
    <div class="mapwrap"><svg viewBox="0 0 ${MAP.land.width} ${MAP.land.height}" role="img" aria-label="Map of the places your artists formed">
      <g class="mapg" style="--k:${r.k};transform:scale(${r.k}) translate(${-r.x}px,${-r.y}px)"><path d="${MAP.land.path}"></path>${pins}</g></svg></div>
    <div class="maprow"><div class="seg" role="group" aria-label="Map region">${buttons}</div></div>
    <div class="pininfo" id="pinInfo"></div>`;
  showPin(mapPlace || groups[0][0]);
}
export function showPin(where){
  const hit = hometownGroups().find(g => g[0] === where); if (!hit) return;
  mapPlace = where;
  document.querySelectorAll('.pin').forEach(p => p.classList.toggle('on', p.dataset.pin === where));
  $('#pinInfo').innerHTML = `<b>${esc(where)}</b>${hit[1].map(a => `<button class="chip" type="button" data-artist="${esc(a)}">${esc(a)}</button>`).join('')}`;
}
export function setRegion(k){
  mapRegion = k;
  const r = REGIONS[k], g = $('.mapg'); if (!g) return;
  g.style.setProperty('--k', r.k);
  g.style.transform = `scale(${r.k}) translate(${-r.x}px,${-r.y}px)`;
  document.querySelectorAll('[data-region]').forEach(b => b.setAttribute('aria-pressed', b.dataset.region === k));
}
