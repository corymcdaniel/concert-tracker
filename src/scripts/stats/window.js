import { nights, ordinal } from '../log.js';
import { matchKey } from '../match.js';
import { MONTHS, TODAY, state } from '../state.js';
import { metro, moveDate } from './era.js';
import { fmt, yrs } from './index.js';
import { plural } from './panels.js';
import { loadLib, venueCoord } from './venues.js';
import { $, esc, happened, place } from '../util.js';

/* ---------- a stretch of nights: shared by Stats → Recent and Stats → Upcoming ----------
   Each section picks its nights (the last 3 months, or everything booked) and the shows before them, and these
   panels work out each act's history, the milestones reached, the lineup and the trips. */

export const key = name => name.trim().toLowerCase();
export const shortDate = d => `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}`;
export const monthYear = d => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
export const artistBtn = name => `<button type="button" data-artist="${esc(name)}">${esc(name)}</button>`;
export const miles = m => `${Math.round(m).toLocaleString()} mi`;
// Plural without the number: "night" / "nights", "city" / "cities"
export const noun = (n, word) => {
  if (n === 1) return word;
  if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
  return word + 's';
};
export const days = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);
export function ago(years){
  if (years < 1) return `${plural(Math.max(Math.round(years * 12), 1), 'month')} ago`;
  return `${plural(Math.round(years), 'year')} ago`;
}
// What a night is called: its festival, or its headliner
export function nightName(n){
  const fest = n.acts.find(a => a.festival)?.festival;
  if (fest) return fest;
  return n.acts[0].artist;
}
// The tiles of a highlights panel: [big, label, line]
export const tilesHtml = tiles => `<div class="hl">${tiles.map(([b, l, p]) => `<div><span>${l}</span><b>${b}</b><p>${p}</p></div>`).join('')}</div>`;

// Each act in the window with its history: which time it is (counting on through the window, as the log's
// stubs do), when you last saw them before, and the longest wait between sightings before the window.
export function gather(before, list){
  const seenOn = new Map();
  [...before, ...list.flatMap(n => n.acts)].filter(s => s.date).forEach(s => {
    const k = key(s.artist);
    if (!seenOn.has(k)) seenOn.set(k, []);
    seenOn.get(k).push(s.date);
  });
  seenOn.forEach(d => d.sort());
  let longestGap = 0;
  const beforeOn = new Map();
  before.filter(s => s.date).forEach(s => { const k = key(s.artist); if (!beforeOn.has(k)) beforeOn.set(k, []); beforeOn.get(k).push(s.date); });
  beforeOn.forEach(d => { d.sort(); for (let i = 1; i < d.length; i++) longestGap = Math.max(longestGap, yrs(d[i - 1], d[i])); });

  const tally = new Map();
  before.forEach(s => tally.set(key(s.artist), (tally.get(key(s.artist)) || 0) + 1));
  const acts = [];
  list.forEach(n => n.acts.forEach(a => {
    const k = key(a.artist);
    tally.set(k, (tally.get(k) || 0) + 1);
    const last = (seenOn.get(k) || []).filter(d => d < n.date).at(-1) || null;
    let gap = 0;
    if (last) gap = yrs(last, n.date);
    acts.push({a, n, nth: tally.get(k), last, gap});
  }));
  return {before, list, acts, longestGap};
}

/* The window on one line, a stop for each night. ends: [[date, label]] for the marks at either end. */
export function timeline(list, from, to, ends, label){
  const span = Math.max(days(from, to), 1);
  const at = d => (days(from, d) / span * 100).toFixed(2);
  // A tick on the first of each month, thinned out over long stretches
  const ticks = [];
  const [y0, m0] = from.split('-').map(Number);
  const months = (+to.slice(0, 4) - y0) * 12 + (+to.slice(5, 7) - m0);
  const step = Math.max(Math.ceil(months / 10), 1);
  for (let i = 1; i <= months; i += step) {
    const y = y0 + Math.floor((m0 - 1 + i) / 12), m = (m0 - 1 + i) % 12 + 1;
    const d = `${y}-${String(m).padStart(2, '0')}-01`;
    let tick = MONTHS[m - 1];
    if (m === 1) tick += ` '${String(y).slice(2)}`;
    ticks.push(`<li class="ut-tick" style="--x:${at(d)}"><span>${tick}</span></li>`);
  }
  const marks = ends.map(([d, text]) => `<li class="ut-end" style="--x:${at(d)}"><span>${text}</span></li>`).join('');
  // Each label takes the lowest of three rows above the line that's clear of the last label in that row.
  // When all three are taken, the row whose last label is farthest back.
  const GAP = 16, rowEnds = [-Infinity, -Infinity, -Infinity];
  let top = 0;
  const stops = list.map((n, i) => {
    const x = +at(n.date);
    let row = rowEnds.findIndex(end => x - end >= GAP);
    if (row < 0) row = rowEnds.indexOf(Math.min(...rowEnds));
    rowEnds[row] = x;
    top = Math.max(top, row);
    let cls = ` r${row}`;
    if (i === 0) cls += ' first';
    return `<li class="ut-stop${cls}" style="--x:${x}"><button type="button" data-artist="${esc(n.acts[0].artist)}">
      <i></i><b>${esc(nightName(n))}</b><small>${shortDate(n.date)} · ${esc(n.city)}</small></button></li>`;
  }).join('');
  return `<ol class="up-line rows${top + 1}" aria-label="${esc(label)}">${marks}${ticks.join('')}${stops}</ol>`;
}

/* milestones the window's nights reach, in order. future: worded for shows still to come. */
export function milestonesPanel({before, list, acts, longestGap}, {title, future}){
  let nightsN = nights(before).length, sets = before.length;
  const artists = new Set(before.map(s => key(s.artist)));
  const states = new Set(before.filter(s => (s.country || 'US') === 'US' && s.state).map(s => s.state));
  const countries = new Set(before.map(s => s.country || 'US'));
  const neverSeen = new Map();
  (state.LISTEN?.artists || []).forEach((a, i) => neverSeen.set(matchKey(a.name), i + 1));
  before.forEach(s => neverSeen.delete(matchKey(s.artist)));
  let differentAct = 'was the', seen = 'you\'d seen';
  if (future) { differentAct = 'will be the'; seen = 'you\'ve seen'; }
  const rows = [];
  const add = (n, text, big = false) => rows.push({n, text, big});
  list.forEach(n => {
    nightsN++;
    if (nightsN % 25 === 0) add(n, `Your <b>${ordinal(nightsN)}</b> night out`, nightsN % 100 === 0);
    const country = n.country || 'US';
    if (!countries.has(country)) { countries.add(country); add(n, `Your first show in <b>${esc(country)}</b>`); }
    if (country === 'US' && n.state && !states.has(n.state)) { states.add(n.state); add(n, `Your first show in <b>${esc(n.state)}</b>`); }
    acts.filter(x => x.n === n).forEach(x => {
      const name = artistBtn(x.a.artist);
      sets++;
      if (sets % 50 === 0) add(n, `Your <b>${ordinal(sets)}</b> set: ${name}`);
      const k = key(x.a.artist);
      if (!artists.has(k)) {
        artists.add(k);
        if (artists.size % 25 === 0) add(n, `${name} ${differentAct} <b>${ordinal(artists.size)}</b> different act ${seen}`);
      }
      const rank = neverSeen.get(matchKey(x.a.artist));
      if (rank && x.nth === 1) add(n, `Off the bucket list: ${name}, your <b>#${rank}</b> most-played artist on Spotify`, rank <= 25);
      if (x.nth > 1 && x.gap > longestGap) add(n, `${name} again after <b>${x.gap.toFixed(1)} years</b>, the longest wait in your log`, true);
      else if (x.nth > 1 && x.gap >= 5) add(n, `${name} again, <b>${Math.round(x.gap)} years</b> after last time`);
      if (x.nth >= 3) add(n, `Your <b>${ordinal(x.nth)}</b> time seeing ${name}`, x.nth >= 5);
    });
  });
  if (!rows.length) return '';
  const items = rows.map(m => {
    let cls = '';
    if (m.big) cls = ' class="big"';
    return `<li${cls}><time datetime="${m.n.date}">${shortDate(m.n.date)} '${m.n.date.slice(2, 4)}</time><span>${m.text}</span></li>`;
  }).join('');
  return `<div class="panel"><h3>${title} <span>${plural(rows.length, 'milestone')}</span></h3><ol class="up-miles">${items}</ol></div>`;
}

/* every act on the window's bills: first time, or which time, and when you'd last seen them */
export function lineupPanel({list, acts}){
  const groups = list.map(n => {
    const rows = acts.filter(x => x.n === n).map(x => {
      let seen = '<span class="tag acc">First time</span>';
      if (x.nth > 1) seen = `<span class="tag again">${ordinal(x.nth)} time</span>`;
      let last = '—';
      if (x.last) last = `${fmt(x.last)} <small>${ago(x.gap)}</small>`;
      return `<tr><td>${artistBtn(x.a.artist)}</td><td>${seen}</td><td>${last}</td></tr>`;
    }).join('');
    return `<tbody><tr class="night"><th colspan="3">${fmt(n.date)} · ${esc(nightName(n))} · ${esc(n.venue)}</th></tr>${rows}</tbody>`;
  }).join('');
  return `<div class="panel"><h3>The lineup <span>new or again</span></h3><div class="tbl-wrap"><table class="rep up-lineup">
    <thead><tr><th>Act</th><th>Sighting</th><th>Last seen</th></tr></thead>${groups}</table></div></div>`;
}

/* trips: distance from home and the new places. Load venue coordinates first (venues.js loadFallback). */
const R = 3958.8;
function distance([la1, lo1], [la2, lo2]){
  const rad = Math.PI / 180, dLa = (la2 - la1) * rad, dLo = (lo2 - lo1) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const mean = coords => [coords.reduce((t, c) => t + c[0], 0) / coords.length, coords.reduce((t, c) => t + c[1], 0) / coords.length];
// A night's spot: its venue, or failing that the middle of the venues you've been to in that city
function nightCoord(n, pastNights){
  const own = venueCoord(`${n.venue}|${n.city}`);
  if (own) return own;
  const near = pastNights.filter(p => p.city === n.city && p.state === n.state).map(p => venueCoord(`${p.venue}|${p.city}`)).filter(Boolean);
  if (near.length) return mean(near);
  return null;
}
// Home is the city you've been to the most shows in since the move
function findHome(pastNights){
  const move = moveDate();
  let list = pastNights.filter(n => n.date && n.date >= move);
  if (!list.length) list = pastNights;
  const counts = new Map();
  list.forEach(n => counts.set(metro(n), (counts.get(metro(n)) || 0) + 1));
  const name = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!name) return null;
  const coords = pastNights.filter(n => metro(n) === name).map(n => venueCoord(`${n.venue}|${n.city}`)).filter(Boolean);
  if (!coords.length) return {name, coord: null};
  return {name, coord: mean(coords)};
}
export function trips({before, list}){
  const pastNights = nights(state.shows.filter(happened));
  const home = findHome(pastNights);
  const venueNights = new Map(), cities = new Set();
  nights(before).forEach(n => {
    const k = `${n.venue}|${n.city}`.toLowerCase();
    venueNights.set(k, (venueNights.get(k) || 0) + 1);
    cities.add(place(n));
  });
  const rows = list.map(n => {
    const k = `${n.venue}|${n.city}`.toLowerCase();
    venueNights.set(k, (venueNights.get(k) || 0) + 1);
    const visit = venueNights.get(k);
    const newCity = !cities.has(place(n));
    cities.add(place(n));
    const coord = nightCoord(n, pastNights);
    let dist = null;
    if (coord && home?.coord) dist = distance(home.coord, coord);
    return {n, visit, newCity, coord, miles: dist, local: !!home && metro(n) === home.name};
  });
  return {home, list: rows};
}
// The panel's content; box is its (hidden) panel, mapId the id for its map. future: worded for shows to come.
export function placesPanel(box, data, {title, mapId, future}){
  const {home, list} = trips(data);
  const newVenues = list.filter(t => t.visit === 1).length, newCities = list.filter(t => t.newCity).length;
  const away = list.filter(t => !t.local && t.miles !== null);
  const far = [...away].sort((a, b) => b.miles - a.miles)[0];
  const parts = [];
  if (newVenues) parts.push(`<b>${newVenues}</b> new ${noun(newVenues, 'venue')}`);
  if (newCities) parts.push(`<b>${newCities}</b> new ${noun(newCities, 'city')}`);
  let lede = '';
  if (parts.length && future) lede = `${parts.join(' and ')} ahead.`;
  else if (parts.length) lede = `${parts.join(' and ')}.`;
  let is = 'was', add = 'added';
  if (future) { is = 'is'; add = 'add'; }
  if (far && home) {
    const round = away.reduce((t, x) => t + x.miles * 2, 0);
    lede += ` The farthest trip ${is} <b>${miles(far.miles)}</b> from ${esc(home.name)} to ${esc(far.n.city)}, and the round trips ${add} up to <b>${miles(round)}</b>.`;
  } else if (home && list.every(t => t.local)) {
    lede += ` Every night ${is} close to home in ${esc(home.name)}.`;
  }
  const rows = list.map(t => {
    const tags = [];
    if (t.visit === 1) tags.push('<span class="tag acc">New venue</span>');
    else tags.push(`<span class="tag again">${ordinal(t.visit)} night here</span>`);
    if (t.newCity) tags.push('<span class="tag acc">New city</span>');
    let dist = '';
    if (t.local) dist = 'Home';
    else if (t.miles !== null) dist = miles(t.miles);
    return `<li><time datetime="${t.n.date}">${shortDate(t.n.date)} '${t.n.date.slice(2, 4)}</time>
      <span class="ut-where"><button type="button" data-venue="${esc(t.n.venue + '|' + t.n.city)}">${esc(t.n.venue)}</button><small>${esc(place(t.n))}</small></span>
      <span class="ut-tags">${tags.join('')}</span><span class="ut-mi">${dist}</span></li>`;
  }).join('');
  let map = '';
  if (list.some(t => t.coord)) map = `<div class="venuemap up-map" id="${mapId}" role="region" aria-label="Map of ${esc(title.toLowerCase())}"></div>`;
  let homeNote = '';
  if (home) homeNote = `from ${esc(home.name)}`;
  box.innerHTML = `<h3>${title} <span>${homeNote}</span></h3><p class="lede">${lede.trim()}</p><ol class="up-trips">${rows}</ol>${map}`;
  box.hidden = false;
}

// One Leaflet map per id, replaced on each draw. stale(): true once a newer draw has started.
const maps = new Map();
export async function drawTripMap(mapId, data, stale){
  maps.get(mapId)?.remove();
  maps.delete(mapId);
  const el = $(`#${mapId}`);
  if (!el) return;
  let L;
  try { L = await loadLib(); } catch { el.remove(); return; }
  if (stale() || !el.isConnected) return;
  const {home, list} = trips(data);
  // Keep every point on the same side of the date line as home, so a trip across the Pacific goes across it
  const near = c => {
    if (!home?.coord) return c;
    let lon = c[1];
    while (lon - home.coord[1] > 180) lon -= 360;
    while (home.coord[1] - lon > 180) lon += 360;
    return [c[0], lon];
  };
  const map = L.map(el, {scrollWheelZoom: false, zoomSnap: 0.5, worldCopyJump: false});
  maps.set(mapId, map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  map.once('click', () => map.scrollWheelZoom.enable());
  const points = [];
  if (home?.coord) {
    points.push(home.coord);
    L.marker(home.coord, {title: `Home: ${home.name}`, icon: L.divIcon({className: 'vpin-wrap', iconSize: null, html: '<span class="vpin s2 up-home" aria-hidden="true"></span>'})}).addTo(map);
  }
  list.filter(t => t.coord).forEach((t, i) => {
    const c = near(t.coord);
    points.push(c);
    if (home?.coord && !t.local) L.polyline([home.coord, c], {className: 'up-route', interactive: false}).addTo(map);
    const icon = L.divIcon({className: 'vpin-wrap', iconSize: null, html: `<span class="vpin s3 up-pin d${Math.min(i, 20)}">${i + 1}</span>`});
    L.marker(c, {icon, title: `${fmt(t.n.date)}: ${nightName(t.n)}, ${t.n.venue}`, riseOnHover: true}).addTo(map);
  });
  map.fitBounds(L.latLngBounds(points), {padding: [36, 36], maxZoom: 12});
}

// A song list like a setlist: number, name (and who it's a cover of), an optional bar and count, and a mark.
// mark(song) gives [class, label] for the dot at the end, or null for none.
export function songRows(songs, {bar, mark}){
  return songs.map(song => {
    let cover = '';
    if (song.cover) cover = `<small>${esc(song.cover)} cover</small>`;
    let barHtml = '<span></span><span></span>';
    if (bar) barHtml = `<span class="sl-bar" style="--w:${bar(song).pct}%"></span><span class="sl-n">${bar(song).text}</span>`;
    let markHtml = '<span class="sl-k" aria-hidden="true"></span>';
    const m = mark(song);
    if (m) markHtml = `<span class="sl-k ${m[0]}" title="${esc(m[1])}"><span class="sr-only">${esc(m[1])}</span></span>`;
    return `<li><span class="sl-name">${esc(song.name)}${cover}</span>${barHtml}${markHtml}</li>`;
  }).join('');
}

// Today minus n months, as YYYY-MM-DD
export function monthsAgo(n){
  const d = new Date(TODAY + 'T12:00');
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
