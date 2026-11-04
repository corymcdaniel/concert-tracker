import { matchKey } from '../match.js';
import { MONTHS, state } from '../state.js';
import { esc, happened } from '../util.js';

/* Spotify section of the artist pop-up. listening-artists.json comes from scripts/build-listening.mjs:
   every artist with 5+ plays, keyed by matchKey, with daily play counts so shows logged later still get "around the show". */
let loading = null;

function loadArtists(){
  if (!loading) loading = fetch('listening-artists.json').then(r => { if (!r.ok) throw 0; return r.json(); }).catch(() => null);
  return loading;
}

const DAY = 864e5;
const dayOf = date => Date.parse(`${date}T00:00:00Z`) / DAY;
const monthYear = d => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const longDate = d => `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}`;
const timesLabel = n => { if (n === 1) return 'once'; return `${n.toLocaleString()} times`; };
function hoursLabel(h){
  if (h >= 10) return Math.round(h).toLocaleString();
  return String(h);
}

// d: base-36 gaps between days, each optionally *count
function decodeDays(d){
  const days = [];
  let day = 0;
  d.split(',').forEach(entry => {
    const [gap, n] = entry.split('*');
    day += parseInt(gap, 36);
    let count = 1;
    if (n) count = parseInt(n, 36);
    days.push([day, count]);
  });
  return days;
}

function tiles(rec, total){
  return `<div class="spot-tiles">
    <div><b>${hoursLabel(rec.h)}</b><span>hours played</span></div>
    <div><b>${rec.p.toLocaleString()}</b><span>plays</span></div>
    <div><b>#${rec.r.toLocaleString()}</b><span>of ${total.toLocaleString()} artists</span></div>
    <div><b>${monthYear(rec.f)}</b><span>first played · last ${monthYear(rec.l)}</span></div>
  </div>`;
}

// Hours per year as SVG bars, with a marker under each year you saw them
function yearChart(rec, data, seenYears){
  const y0 = +data.since.slice(0, 4), y1 = +data.until.slice(0, 4);
  const years = [];
  for (let y = y0; y <= y1; y++) years.push(y);
  const max = Math.max(...years.map(y => rec.y[y] || 0));
  const W = 20, H = 60, gap = 4;
  const bars = years.map((y, i) => {
    const h = rec.y[y] || 0;
    // A year with any listening keeps a sliver of bar, so it doesn't look like none
    let bh = 0;
    if (h) bh = Math.max(h / max * H, 2);
    let cls = 'bar', mark = '', note = '';
    if (seenYears.has(String(y))) {
      cls += ' seen';
      note = ' · saw them live';
      mark = `<path class="mark" d="M${i * W + W / 2 - 4} ${H + 12}l4 -6l4 6z"></path>`;
    }
    let label = '';
    if (i === 0 || i === years.length - 1 || y % 5 === 0) label = `<text x="${i * W + W / 2}" y="${H + 24}">'${String(y).slice(2)}</text>`;
    return `<g class="yr" data-i="${Math.min(i, 20)}"><title>${y}: ${h} hours${note}</title>
      <rect class="${cls}" x="${i * W + gap / 2}" y="${H - bh}" width="${W - gap}" height="${bh}" rx="2"></rect>${mark}${label}</g>`;
  }).join('');
  let legend = '';
  if (seenYears.size) legend = '<span><i></i>saw them live</span>';
  return `<div class="spot-chart"><h5>Hours per year ${legend}</h5>
    <svg viewBox="0 0 ${years.length * W} ${H + 28}" role="img" aria-label="Hours played per year, ${y0} to ${y1}">${bars}</svg></div>`;
}

function topSongs(rec){
  if (!rec.s.length) return '';
  const max = rec.s[0][1];
  const rows = rec.s.map(([song, n]) => `<li><span class="n">${n}</span><span class="song" data-w="${Math.round(n / max * 10)}">${esc(song)}</span></li>`).join('');
  return `<div class="spot-songs"><h5>Most-played songs</h5><ol>${rows}</ol></div>`;
}

// Plays in the window before and after each past music show, worked out from the daily counts
function aroundShows(rec, data, shows){
  const days = decodeDays(rec.d);
  const since = dayOf(data.since), until = dayOf(data.until), win = data.window;
  const sum = (from, to) => days.reduce((t, [day, n]) => { if (day >= from && day <= to) return t + n; return t; }, 0);
  const dated = shows.filter(s => s.date && s.type !== 'Comedy').sort((a, b) => a.date.localeCompare(b.date));
  const firstShow = dated[0]?.date;
  let discovered = '';
  if (firstShow && !shows.some(s => !s.date)) {
    const first = dayOf(firstShow);
    const prior = sum(-Infinity, first - 1);
    if (first >= since + data.settled && first <= until && prior === 0) discovered = `<p class="spot-badge">Discovered live: no plays before you first saw them on ${longDate(firstShow)}</p>`;
    else if (first > since + win && first <= until) discovered = `<p class="spot-lede">You'd played them <b>${timesLabel(prior)}</b> before first seeing them.</p>`;
  }
  const rows = dated.filter(s => dayOf(s.date) > since + win && dayOf(s.date) <= until).map(s => {
    const d = dayOf(s.date);
    const before = sum(d - win, d - 1);
    let after = '<span class="tbd">not yet</span>';
    let trend = '';
    if (d + win <= until) {
      const n = sum(d + 1, d + win);
      after = `<b>${n}</b>`;
      if (n > before) trend = ' up';
      else if (n < before) trend = ' down';
    }
    return `<li class="${trend.trim()}"><time>${longDate(s.date)}</time><span><b>${before}</b> before</span><span class="arrow" aria-hidden="true">→</span><span>${after} after</span></li>`;
  }).join('');
  if (!rows && !discovered) return '';
  let list = '';
  if (rows) list = `<ul class="spot-around">${rows}</ul>`;
  return `<div class="spot-show"><h5>Around each show <span>plays, ${win} days either side</span></h5>${discovered}${list}</div>`;
}

export function spotifySlot(){
  return '<div class="spot" id="spot" aria-live="polite"></div>';
}

export async function fillSpotify(name){
  const data = await loadArtists();
  const box = document.getElementById('spot');
  // The pop-up may have closed or moved on to someone else
  if (!box || box.closest('#info')?.querySelector('h2')?.textContent !== name) return;
  if (!data) { box.remove(); return; }
  const rec = data.artists[matchKey(name)];
  const mine = state.shows.filter(s => s.artist === name);
  if (!rec) {
    if (mine.some(s => s.type === 'Comedy')) { box.remove(); return; }
    box.innerHTML = `<h4>On Spotify</h4><p class="spot-lede">Fewer than 5 plays since ${data.since.slice(0, 4)}.</p>`;
    return;
  }
  const past = mine.filter(happened);
  const seenYears = new Set(past.filter(s => s.date).map(s => s.date.slice(0, 4)));
  box.innerHTML = `<h4>On Spotify</h4>${tiles(rec, data.total)}${yearChart(rec, data, seenYears)}
    <div class="spot-cols">${topSongs(rec)}${aroundShows(rec, data, past)}</div>`;
  box.classList.add('ready');
}
