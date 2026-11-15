// The tally: headline numbers on the log, between Up next and Stamped.
// A row of lifetime totals that count up when they scroll into view, over a grid of records.
// Each one is a button: totals open the matching Stats section, records open a pop-up or jump to a ticket.
import { countTo, nightKey, nights, statShown } from './log.js';
import { TODAY } from './state.js';
import { cityKey, esc, place } from './util.js';

const YEAR_MS = 31557600000;
const yearsBetween = (a, b) => (new Date(b) - new Date(a)) / YEAR_MS;
const plural = (n, word) => { if (n === 1) return `1 ${word}`; return `${n} ${word}s`; };
const yearOf = date => +date.slice(0, 4);

/* ---------- the numbers ----------
   Pure: everything the strip shows, from the shows and today's date (YYYY-MM-DD).
   Counts the way the header does: a show counts from the day after it happens, undated shows are in the past.
   A record that doesn't apply yet (nobody seen twice, no bill of two) is left out. */
export function headlineStats(shows, today = TODAY){
  const past = shows.filter(s => !s.date || s.date < today);
  const ns = nights(past), nd = ns.filter(n => n.date);
  if (!ns.length) return null;

  const totals = {
    nights: ns.length,
    sets: past.length,
    artists: new Set(past.map(s => s.artist.trim())).size,
    venues: new Set(past.map(s => s.venue.toLowerCase()).filter(Boolean)).size,
    cities: new Set(past.filter(s => s.city).map(cityKey)).size,
  };
  const out = {totals};
  if (!nd.length) return out;

  // Years: this one against the same point last year, the busiest, and the longest unbroken run
  const byYear = new Map();
  nd.forEach(n => byYear.set(yearOf(n.date), (byYear.get(yearOf(n.date)) || 0) + 1));
  const year = yearOf(today);
  const byNowLastYear = nd.filter(n => n.date >= `${year - 1}-01-01` && n.date < `${year - 1}${today.slice(4)}`).length;
  out.thisYear = {year, nights: byYear.get(year) || 0, ahead: (byYear.get(year) || 0) - byNowLastYear};
  // A tie goes to the later year
  let busiest = null;
  for (const [y, count] of byYear) {
    if (!busiest || count > busiest.nights || (count === busiest.nights && y > busiest.year)) busiest = {year: y, nights: count};
  }
  out.busiest = busiest;
  const years = [...byYear.keys()].sort((a, b) => a - b);
  let run = 0, streak = {years: 0, to: 0};
  for (let y = years[0]; y <= years.at(-1); y++) {
    if (byYear.has(y)) run++;
    else run = 0;
    if (run > streak.years) streak = {years: run, to: y};
  }
  out.streak = {...streak, from: streak.to - streak.years + 1};

  // nights() puts the newest first, so the first show is the last dated one
  const first = nd.at(-1);
  out.first = {night: first, artist: first.acts[0].artist, year: yearOf(first.date), years: Math.floor(yearsBetween(first.date, today))};

  // Artists: a sighting is a night, so two sets on one date count once
  const artists = new Map();
  past.forEach(s => {
    const k = s.artist.trim().toLowerCase();
    if (!artists.has(k)) artists.set(k, {name: s.artist.trim(), dates: new Set(), undated: 0});
    if (s.date) artists.get(k).dates.add(s.date);
    else artists.get(k).undated++;
  });
  let mostSeen = null, wait = null;
  for (const a of artists.values()) {
    const dates = [...a.dates].sort();
    const times = dates.length + a.undated, latest = dates.at(-1) || '';
    // A tie goes to whoever was seen most recently
    if (times > 1 && (!mostSeen || times > mostSeen.times || (times === mostSeen.times && latest > mostSeen.latest))) {
      mostSeen = {name: a.name, times, latest};
    }
    for (let i = 1; i < dates.length; i++) {
      const gap = yearsBetween(dates[i - 1], dates[i]);
      if (!wait || gap > wait.years) wait = {name: a.name, years: gap, from: dates[i - 1], to: dates[i]};
    }
  }
  if (mostSeen) out.mostSeen = mostSeen;
  if (wait) out.wait = wait;

  // The venue with the most nights; the same name in another city is a different venue
  const venues = new Map();
  ns.forEach(n => {
    if (!n.venue) return;
    const k = `${n.venue}|${n.city}`.toLowerCase();
    if (!venues.has(k)) venues.set(k, {venue: n.venue, key: `${n.venue}|${n.city}`, place: place(n), nights: 0});
    venues.get(k).nights++;
  });
  const topVenue = [...venues.values()].sort((a, b) => b.nights - a.nights)[0];
  if (topVenue) out.topVenue = topVenue;

  const bill = [...nd].sort((a, b) => b.acts.length - a.acts.length)[0];
  if (bill.acts.length > 1) out.bill = {night: bill, acts: bill.acts.length, artist: bill.acts[0].artist, year: yearOf(bill.date)};
  return out;
}

/* ---------- the strip ---------- */
// The arrow in a record's corner says where a click goes
const TO_STATS = '→', TO_TICKET = '↓', TO_POPUP = '↗';
const total = (key, to, label, section) => {
  const k = `tally-${key}`;
  return `<li><button type="button" class="tally-n" data-stats-go="${section}"><b data-to="${to}" data-key="${k}">${statShown[k] ?? 0}</b><span>${label}</span></button></li>`;
};
// value and note are plain text; attr is the data attribute main.js acts on
const record = (label, value, note, attr, arrow) =>
  `<li><button type="button" class="tally-f" ${attr}>
    <span class="tf-k">${esc(label)}<i aria-hidden="true">${arrow}</i></span>
    <b title="${esc(value)}">${esc(value)}</b>
    <span class="tf-note" title="${esc(note)}">${esc(note)}</span>
  </button></li>`;

export function tally(shows){
  const s = headlineStats(shows);
  if (!s) return '';
  const t = s.totals;
  const totals = [
    total('nights', t.nights, 'Nights', 'overview'),
    total('sets', t.sets, 'Sets', 'overview'),
    total('artists', t.artists, 'Artists', 'artists'),
    total('venues', t.venues, 'Venues', 'places'),
    total('cities', t.cities, 'Cities', 'places'),
  ].join('');

  const records = [];
  if (s.thisYear) {
    let note = 'Level with this time last year';
    if (s.thisYear.ahead > 0) note = `${s.thisYear.ahead} ahead of this time last year`;
    if (s.thisYear.ahead < 0) note = `${-s.thisYear.ahead} behind this time last year`;
    records.push(record(`${s.thisYear.year} so far`, plural(s.thisYear.nights, 'night'), note, 'data-stats-go="overview"', TO_STATS));
  }
  if (s.mostSeen) {
    let note = `Seen ${s.mostSeen.times} times`;
    if (s.mostSeen.latest) note += `, last in ${yearOf(s.mostSeen.latest)}`;
    records.push(record('Most seen', s.mostSeen.name, note, `data-artist="${esc(s.mostSeen.name)}"`, TO_POPUP));
  }
  if (s.topVenue) {
    const note = [plural(s.topVenue.nights, 'night'), s.topVenue.place].filter(Boolean).join(' · ');
    records.push(record('Top venue', s.topVenue.venue, note, `data-venue="${esc(s.topVenue.key)}"`, TO_POPUP));
  }
  if (s.busiest) {
    records.push(record('Busiest year', String(s.busiest.year), `${plural(s.busiest.nights, 'night')} out`, `data-year="${s.busiest.year}"`, TO_TICKET));
  }
  if (s.bill) {
    records.push(record('Biggest bill', `${s.bill.acts} acts`, `${s.bill.artist}, ${s.bill.year}`, `data-night="${esc(nightKey(s.bill.night))}"`, TO_TICKET));
  }
  if (s.streak) {
    let span = `${s.streak.from}–${s.streak.to}`;
    if (s.streak.years === 1) span = String(s.streak.to);
    records.push(record('Longest streak', plural(s.streak.years, 'year'), `${span}, a show every year`, 'data-stats-go="overview"', TO_STATS));
  }
  if (s.first) {
    let ago = `${s.first.years} years ago`;
    if (s.first.years === 1) ago = 'a year ago';
    if (s.first.years < 1) ago = 'this past year';
    records.push(record('First show', String(s.first.year), `${s.first.artist}, ${ago}`, `data-night="${esc(nightKey(s.first.night))}"`, TO_TICKET));
  }
  if (s.wait) {
    const note = `${s.wait.name}, ${yearOf(s.wait.from)} → ${yearOf(s.wait.to)}`;
    records.push(record('Longest wait', `${s.wait.years.toFixed(1)} yrs`, note, `data-artist="${esc(s.wait.name)}"`, TO_POPUP));
  }

  return `<section class="tally" aria-labelledby="tallyHead">
    <h2 class="tally-k" id="tallyHead">The tally so far</h2>
    <div class="tally-board">
      <ul class="tally-totals">${totals}</ul>
      <ul class="tally-records">${records.join('')}</ul>
    </div>
  </section>`;
}

// The totals count up once the strip is on screen. Safe to call after every redraw:
// numbers that have already counted are drawn at their value.
let watcher = null;
export function paintTally(){
  watcher?.disconnect();
  const el = document.querySelector('#list .tally');
  if (!el) return;
  watcher = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    watcher.disconnect();
    el.querySelectorAll('[data-to]').forEach(b => countTo(b, b.dataset.key, +b.dataset.to));
  }, {threshold: .25});
  watcher.observe(el);
}
