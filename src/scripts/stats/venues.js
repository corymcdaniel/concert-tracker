import { nights } from '../log.js';
import { MONTHS, state } from '../state.js';
import { plural } from './panels.js';
import { $, esc, happened, place } from '../util.js';
// The map's stylesheets as plain URLs, added to the page only when Places opens. Imported as CSS, the build would
// put them in the page head, where they hold up the first paint of every page.
import leafletCss from 'leaflet/dist/leaflet.css?url';
import clusterCss from 'leaflet.markercluster/dist/MarkerCluster.css?url';

function addStylesheet(href){
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    link.onload = resolve; link.onerror = reject;
    document.head.append(link);
  });
}

/* Venue map: Leaflet with OpenStreetMap tiles, loaded only when the Places section opens.
   Coordinates come from each venue's info record (coord: [lat, lon]), then public/venue-coords.json for the rest. */
let L = null, FALLBACK = null, map = null, cluster = null, picked = null;
const markers = new Map();

// One shared load for every caller. The map is often drawn twice in quick succession (page load, then a redraw),
// and L must not count as ready until the cluster plugin has loaded too, or the second draw finds
// L.markerClusterGroup missing and stops halfway. A failed load is forgotten, so the next visit tries again.
let libLoading = null;
function loadLib(){
  if (!libLoading) libLoading = (async () => {
    const lib = (await import('leaflet')).default;
    // The cluster plugin extends the global L
    window.L = lib;
    await Promise.all([
      import('leaflet.markercluster'),
      addStylesheet(leafletCss),
      addStylesheet(clusterCss),
    ]);
    L = lib;
  })().catch(e => { libLoading = null; throw e; });
  return libLoading;
}
let fallbackLoading = null;
function loadFallback(){
  if (!fallbackLoading) fallbackLoading = (async () => {
    try {
      const r = await fetch('venue-coords.json');
      if (!r.ok) throw 0;
      FALLBACK = await r.json();
    } catch { FALLBACK = {}; }
  })();
  return fallbackLoading;
}

const day = d => { const [y, m, dd] = d.split('-'); return `${MONTHS[+m-1]} ${+dd}, ${y}`; };
// Pin size steps by nights at the venue
function sizeClass(n){
  if (n >= 6) return 's4';
  if (n >= 3) return 's3';
  if (n === 2) return 's2';
  return 's1';
}

function venueGroups(){
  const groups = new Map(), missing = new Set();
  nights(state.shows.filter(happened)).forEach(n => {
    if (!n.venue) return;
    const key = `${n.venue}|${n.city}`;
    if (!groups.has(key)) {
      const extra = FALLBACK[key];
      const coord = state.INFO.venues?.[key]?.coord || extra?.coord;
      if (!coord) { missing.add(key); return; }
      groups.set(key, {key, venue: n.venue, city: n.city, where: place(n), coord, approx: !!extra?.approx && !state.INFO.venues?.[key]?.coord, note: extra?.note, nights: []});
    }
    groups.get(key).nights.push(n);
  });
  const list = [...groups.values()].sort((a, b) => b.nights.length - a.nights.length || a.venue.localeCompare(b.venue));
  return {list, missing: missing.size};
}

// Quick-zoom buttons: everywhere, then the cities with the most nights
function cityButtons(list){
  const byCity = new Map();
  list.forEach(g => byCity.set(g.where, (byCity.get(g.where) || 0) + g.nights.length));
  const top = [...byCity].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
  return [['', 'All'], ...top.map(c => [c, c.split(',')[0]])];
}

export async function drawVenueMap(){
  const box = $('#venueMapPanel'); if (!box) return;
  if (map) { map.remove(); map = null; markers.clear(); }
  try {
    await Promise.all([loadLib(), loadFallback()]);
  } catch {
    // No map library (offline, blocked): drop the panel rather than leave an empty card
    box.remove();
    return;
  }
  // The section may have changed while the library loaded
  if (!box.isConnected) return;
  const {list, missing} = venueGroups();
  if (!list.length) { box.remove(); return; }
  let count = plural(list.length, 'venue');
  if (missing) count += `, ${missing} not mapped`;
  const buttons = cityButtons(list).map(([k, label], i) =>
    `<button type="button" data-vcity="${esc(k)}" aria-pressed="${i === 0}">${esc(label)}</button>`).join('');
  box.innerHTML = `<h3>Venues on the map <span>${count}</span></h3>
    <div class="venuemap" id="venueMap" role="region" aria-label="Map of the venues you've been to"></div>
    <div class="maprow"><div class="seg" role="group" aria-label="Zoom to">${buttons}</div><span class="maphint">Bigger pins, more nights</span></div>
    <div class="venueinfo" id="venueInfo"></div>`;

  map = L.map($('#venueMap'), {scrollWheelZoom: false, zoomSnap: 0.5, worldCopyJump: true});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  // Turn on wheel zoom once the map is clicked, so scrolling the page doesn't get caught
  map.once('click', () => map.scrollWheelZoom.enable());

  cluster = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 40, spiderfyDistanceMultiplier: 1.6,
    iconCreateFunction: c => {
      const n = c.getAllChildMarkers().reduce((t, m) => t + m.options.nights, 0);
      return L.divIcon({className: 'vcluster', iconSize: null, html: `<span><b>${c.getChildCount()}</b><i>${plural(n, 'night')}</i></span>`});
    },
  });
  list.forEach((g, i) => {
    const n = g.nights.length;
    let label = '';
    if (n > 1) label = n;
    const icon = L.divIcon({className: 'vpin-wrap', iconSize: null, html: `<span class="vpin ${sizeClass(n)} d${Math.min(i, 20)}">${label}</span>`});
    const m = L.marker(g.coord, {icon, nights: n, title: `${g.venue}: ${plural(n, 'night')}`, riseOnHover: true});
    m.on('click', () => showVenue(g.key));
    // Clusters add and remove pins as you zoom, so the selection is put back each time
    m.on('add', () => m.getElement()?.classList.toggle('on', picked === g.key));
    markers.set(g.key, m);
    cluster.addLayer(m);
  });
  map.addLayer(cluster);
  map.fitBounds(L.latLngBounds(list.map(g => g.coord)), {padding: [30, 30], maxZoom: 13});
  showVenue(picked || list[0].key);
}

export function fitTo(city){
  if (!map) return;
  let shown = [...markers.values()];
  if (city) {
    const keys = venueGroups().list.filter(g => g.where === city).map(g => g.key);
    shown = keys.map(k => markers.get(k));
  }
  const bounds = L.latLngBounds(shown.map(m => m.getLatLng()));
  map.flyToBounds(bounds, {padding: [30, 30], maxZoom: 13, duration: 0.8});
  document.querySelectorAll('[data-vcity]').forEach(b => b.setAttribute('aria-pressed', b.dataset.vcity === city));
}

export function showVenue(key){
  const g = venueGroups().list.find(v => v.key === key), info = $('#venueInfo');
  if (!g || !info) return;
  picked = key;
  markers.forEach((m, k) => m.getElement()?.classList.toggle('on', k === key));
  let note = '';
  if (g.approx) note = '<p class="vnote">Exact spot unknown, pinned to the city.</p>';
  else if (g.note) note = `<p class="vnote">${esc(g.note)}</p>`;
  const rows = g.nights.map(n => {
    let when = 'Undated';
    if (n.date) when = day(n.date);
    const acts = n.acts.map(a => `<button class="chip" type="button" data-artist="${esc(a.artist)}">${esc(a.artist)}</button>`).join('');
    return `<li><time>${when}</time><span>${acts}</span></li>`;
  }).join('');
  info.innerHTML = `<div class="vhead"><button type="button" class="vname" data-venue="${esc(key)}">${esc(g.venue)}</button>
      <span>${esc(g.where)} · ${plural(g.nights.length, 'night')}</span></div>
    ${note}<ol class="vnights">${rows}</ol>`;
}
