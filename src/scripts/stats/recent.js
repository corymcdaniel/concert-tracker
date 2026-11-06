import { canEdit } from '../auth.js';
import { nightVal, nights } from '../log.js';
import { matchKey, songKey } from '../match.js';
import { TODAY, state } from '../state.js';
import { moveDate } from './era.js';
import { fmt } from './index.js';
import { counter, plural } from './panels.js';
import { loadFirstPlays, setlistFor } from './setlists.js';
import { dayOf, decodeDays, loadArtists } from './spotify.js';
import { loadFallback } from './venues.js';
import { artistBtn, days, drawTripMap, gather, lineupPanel, milestonesPanel, monthYear, monthsAgo, nightName, noun, placesPanel, shortDate, songRows, tilesHtml, timeline } from './window.js';
import { $, esc, happened, place } from '../util.js';

/* ---------- recent: the last 3 months, up to yesterday ----------
   The same idea as Upcoming, looking back: a recap and your pace, milestones reached, the lineup, the setlists
   you heard and the Spotify bump after each show, and where you went. The shared panels are in window.js. */

const MONTHS_BACK = 3;

function data(){
  const from = monthsAgo(MONTHS_BACK);
  const before = state.shows.filter(s => !s.date || s.date < from);
  const list = nights(state.shows.filter(s => s.date && s.date >= from && happened(s))).sort((a, b) => a.date.localeCompare(b.date) || a.idx - b.idx);
  return {...gather(before, list), from};
}
function since(date){
  const n = days(date, TODAY);
  if (n <= 1) return 'yesterday';
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.round(n / 7)} weeks ago`;
  return `${plural(Math.round(n / 30.44), 'month')} ago`;
}

/* the last show out, and the 3 months on one line */
function heroPanel({list, from}){
  const last = list.at(-1);
  let fest = '';
  const festival = last.acts.find(a => a.festival)?.festival;
  if (festival) fest = `${esc(festival)} · `;
  let more = '';
  if (last.acts.length > 1) more = ` <span class="uh-more">+ ${plural(last.acts.length - 1, 'more act')}</span>`;
  const line = timeline(list, from, TODAY, [[from, shortDate(from)], [TODAY, 'Today']], `Shows from ${fmt(from)} to today`);
  return `<div class="panel up-hero">
    <div class="uh-top">
      <div class="uh-count"><span class="k">Last ${MONTHS_BACK} months</span><b>${counter('rc-nights', list.length)} ${noun(list.length, 'night')}</b><span>${fmt(from)} – today</span></div>
      <div class="uh-what"><p class="uh-more">Last out, ${since(last.date)}</p><p class="uh-acts">${artistBtn(last.acts[0].artist)}${more}</p>
        <p class="uh-where">${fest}<button type="button" data-venue="${esc(last.venue + '|' + last.city)}">${esc(last.venue)}</button>, ${esc(place(last))}</p></div>
    </div>${line}</div>`;
}

/* recap: what the 3 months held, and how that compares to your usual */
function recapPanel({list, acts, from}){
  const n = list.length, span = days(from, TODAY);
  const fresh = acts.filter(x => x.nth === 1).length;
  const venues = new Set(list.map(x => `${x.venue}|${x.city}`.toLowerCase())).size;
  const tiles = [
    [counter('rc-sets', acts.length), `${noun(acts.length, 'set')} seen`, `${plural(n, 'night')} at ${venues} ${noun(venues, 'venue')}`],
    [`${counter('rc-fresh', fresh)} of ${acts.length}`, 'First time seeing', 'acts you\'d never seen live before'],
  ];

  // Your usual 3 months: the average since the move, or across the whole log if the move is recent
  const all = nights(state.shows.filter(happened)).filter(x => x.date).sort((a, b) => a.date.localeCompare(b.date));
  let start = moveDate(), base = `since the move (${monthYear(moveDate())})`;
  if (days(start, from) < span * 2) { start = all[0].date; base = 'across your log'; }
  const earlier = all.filter(x => x.date >= start && x.date < from);
  if (earlier.length) {
    const usual = earlier.length / (days(start, from) / span);
    let pace = `the average ${base}`;
    if (n >= usual * 1.25) pace = `${(n / usual).toFixed(1)}× your usual pace, the average ${base}`;
    else if (n <= usual * 0.75) pace = `below your usual pace, the average ${base}`;
    tiles.push([`${n} vs ${usual.toFixed(1)}`, `Your usual ${MONTHS_BACK} months`, pace]);
  }
  // The last stretch as long as this one, ending before it, with at least as many nights
  const ends = all.filter(x => x.date < from).map(x => x.date).reverse();
  let match = null;
  for (const end of ends) {
    if (all.filter(x => x.date <= end && days(x.date, end) < span).length >= n) { match = end; break; }
  }
  if (!match && ends.length) tiles.push(['Ever', `Busiest ${MONTHS_BACK} months`, `no ${MONTHS_BACK} months in your log had more nights out`]);
  else if (match && days(match, from) > 365) tiles.push([monthYear(match), `Busiest ${MONTHS_BACK} months since`, `the ${MONTHS_BACK} months to ${fmt(match)} had as many nights out`]);

  const most = [...acts].sort((a, b) => b.nth - a.nth)[0];
  if (most.last) tiles.push([`×${most.nth}`, 'Most-seen act', `${esc(most.a.artist)}, seen before on ${fmt(most.last)}`]);
  const biggest = [...list].sort((a, b) => b.acts.length - a.acts.length)[0];
  if (biggest.acts.length > 1) tiles.push([`${biggest.acts.length} acts`, 'Biggest bill', `${esc(nightName(biggest))}, ${fmt(biggest.date)}`]);
  const rated = list.map(x => ({x, r: nightVal(x, 'rating')})).filter(r => r.r);
  if (rated.length) {
    const avg = rated.reduce((t, r) => t + r.r, 0) / rated.length;
    const top = [...rated].sort((a, b) => b.r - a.r)[0];
    tiles.push([`${avg.toFixed(1)} ★`, 'Average rating', `${rated.length} of ${plural(n, 'night')} rated. Top: ${esc(nightName(top.x))}`]);
  }
  return `<div class="panel"><h3>The recap <span>${fmt(from)} – today</span></h3>${tilesHtml(tiles)}</div>`;
}

export function recentSection(){
  const d = data();
  if (!d.list.length) return '';
  let heard = '';
  if (state.mode === 'netlify' && d.acts.some(x => x.a.type === 'Music')) heard = '<div class="panel" id="rcHeard" hidden></div>';
  return `${heroPanel(d)}${recapPanel(d)}${milestonesPanel(d, {title: 'Milestones reached', future: false})}
    ${heard}
    <div class="panel" id="rcBump" hidden></div>
    ${lineupPanel(d)}
    <div class="panel" id="rcPlaces" hidden></div>`;
}
// The landing page's ticket for the section, or null with no shows in the last 3 months
export function recentCard(){
  const d = data();
  if (!d.list.length) return null;
  return ['recent', 'Recent', `${d.list.length} ${noun(d.list.length, 'night')}`, `Since ${fmt(d.from)}: your pace, milestones, the setlists you heard and the show bump`];
}

/* ---------- filled in after the section is drawn ---------- */
let drawing = 0;
export async function drawRecent(){
  if (!$('#rcPlaces')) return;
  const run = ++drawing;
  const d = data();
  const [listening, firstPlays] = await Promise.all([loadArtists(), loadFirstPlays(), loadFallback()]);
  if (run !== drawing || !$('#rcPlaces')) return;
  heardPanel(d, listening, firstPlays);
  bumpPanel(d, listening);
  placesPanel($('#rcPlaces'), d, {title: 'Where you went', mapId: 'rcMap', future: false});
  await drawTripMap('rcMap', d, () => run !== drawing);
}

/* the setlists you heard, from the setlist.fm sync, and how many of the songs you knew going in */
let heardPick = null, heardData = null;
const heardKey = (artist, date) => `${artist}|${date}`;
function heardPanel(d, listening, firstPlays){
  const box = $('#rcHeard');
  if (!box) return;
  const music = d.acts.filter(x => x.a.type === 'Music');
  const sets = [...music].reverse().map(x => ({x, set: setlistFor(x.a.artist, x.n.date)})).filter(s => s.set?.songs.length);
  const missing = music.filter(x => !setlistFor(x.a.artist, x.n.date)?.songs.length).map(x => x.a.artist);
  let sync = '';
  if (missing.length) sync = '<button type="button" class="edit-only" id="syncSets">Check setlist.fm</button>';
  if (!sets.length) {
    // Nothing to show anyone but an editor, who can go and look
    if (!canEdit()) return;
    box.innerHTML = `<h3>Setlists you heard</h3><p class="lede">No setlists for these shows yet.</p>${sync}`;
    box.hidden = false;
    return;
  }
  heardData = {sets, firstPlays, until: listening?.until};
  // Across every setlist: how many of the songs you'd played before that show
  let total = 0, knew = 0;
  sets.forEach(({x, set}) => {
    const first = firstPlays?.[matchKey(x.a.artist)] || {};
    total += set.songs.length;
    knew += set.songs.filter(song => first[songKey(song.name)] < x.n.date).length;
  });
  let lede = `You heard <b>${total}</b> songs across ${plural(sets.length, 'setlist')}`;
  if (firstPlays) lede += ` and had played <b>${Math.round(knew / total * 100)}%</b> of them beforehand.`;
  else lede += '.';
  let gaps = '';
  if (missing.length) gaps = `<p class="sub">No setlist on setlist.fm yet</p><p class="up-cold">${missing.map(name => `<button class="chip" type="button" data-artist="${esc(name)}">${esc(name)}</button>`).join('')}</p>${sync}`;
  const keys = sets.map(s => heardKey(s.x.a.artist, s.x.n.date));
  if (!keys.includes(heardPick)) heardPick = keys[0];
  const chips = sets.map(({x}) => {
    const k = heardKey(x.a.artist, x.n.date);
    return `<button type="button" class="chip" data-heard="${esc(k)}" aria-pressed="${k === heardPick}">${esc(x.a.artist)} <em>${shortDate(x.n.date)}</em></button>`;
  }).join('');
  box.innerHTML = `<h3>Setlists you heard <span>setlists: setlist.fm · listening: Spotify</span></h3><p class="lede">${lede}</p>
    <div class="up-acts" role="group" aria-label="Setlist">${chips}</div><div id="rcSet"></div>${gaps}`;
  box.hidden = false;
  showHeard();
}
export function pickHeard(k){
  heardPick = k;
  document.querySelectorAll('[data-heard]').forEach(b => b.setAttribute('aria-pressed', b.dataset.heard === k));
  showHeard();
}
function showHeard(){
  const out = $('#rcSet');
  if (!out || !heardData) return;
  const pick = heardData.sets.find(s => heardKey(s.x.a.artist, s.x.n.date) === heardPick);
  if (!pick) return;
  const {x, set} = pick, date = x.n.date;
  const first = heardData.firstPlays?.[matchKey(x.a.artist)];
  const when = song => first?.[songKey(song.name)];
  const before = set.songs.filter(song => when(song) < date).length;
  const after = set.songs.filter(song => when(song) > date).length;
  let lede = `${artistBtn(x.a.artist)} played <b>${set.songs.length}</b> songs on ${fmt(date)}.`;
  if (first) {
    lede += ` You'd played <b>${before}</b> of them before the show`;
    if (after) lede += `, and started playing <b>${after}</b> more after it`;
    lede += '.';
  } else if (heardData.firstPlays) {
    lede += ' You hadn\'t played them on Spotify before.';
  }
  const rows = songRows(set.songs, {mark: song => {
    if (when(song) < date) return ['on', 'You\'d played it before the show'];
    if (when(song) > date) return ['new', 'You first played it after the show'];
    return null;
  }});
  let legend = '';
  if (first) legend = '<p class="sl-legend"><span><i class="sl-k on"></i>played before</span><span><i class="sl-k new"></i>first played after</span></p>';
  let link = '';
  if (set.url) link = `<a class="sl-link" href="${esc(set.url)}" target="_blank" rel="noopener">This setlist on setlist.fm ↗</a>`;
  out.innerHTML = `<p class="lede">${lede}</p>
    <div class="sl-ends"><div><span>Opened with</span><b>${esc(set.songs[0].name)}</b></div><div><span>Closed with</span><b>${esc(set.songs.at(-1).name)}</b></div></div>
    ${legend}<ol class="sl-songs heard">${rows}</ol>${link}`;
}

/* the show bump: plays in the month before each show against the days after it */
function bumpPanel({acts}, listening){
  const box = $('#rcBump');
  if (!listening) return;
  const win = listening.window, until = dayOf(listening.until);
  const sum = (list, from, to) => list.reduce((t, [day, c]) => { if (day >= from && day <= to) return t + c; return t; }, 0);
  const music = acts.filter(x => x.a.type === 'Music');
  if (!music.length) return;
  const rows = [], silent = [];
  music.forEach(x => {
    const rec = listening.artists[matchKey(x.a.artist)];
    const day = dayOf(x.n.date);
    if (!rec || day > until) { silent.push(x); return; }
    const list = decodeDays(rec.d);
    const before = sum(list, day - win, day - 1);
    const span = Math.min(win, until - day);
    const after = sum(list, day + 1, day + span);
    if (!before && !after) { silent.push(x); return; }
    rows.push({x, before, after, span, rate: before / win, afterRate: after / Math.max(span, 1)});
  });
  if (!rows.length) return;
  const max = Math.max(...rows.flatMap(r => [r.rate, r.afterRate]), 0.001);
  const up = rows.filter(r => r.span > 0 && r.afterRate > r.rate).length;
  const short = rows.some(r => r.span < win);
  const items = rows.map(r => {
    let trend = '';
    if (r.span > 0 && r.afterRate > r.rate) {
      let times = 'new';
      if (r.rate) times = `${(r.afterRate / r.rate).toFixed(1)}×`;
      trend = `<span class="tag acc">▲ ${times}</span>`;
    } else if (r.span > 0 && r.afterRate < r.rate) {
      trend = '<span class="tag again">▼ cooled</span>';
    }
    let afterText = `${r.after} after`;
    if (r.span < win) afterText += ` <small>(${plural(r.span, 'day')})</small>`;
    return `<li><span class="bp-name">${artistBtn(r.x.a.artist)}<small>${shortDate(r.x.n.date)}</small></span>
      <span class="bp-bars" aria-hidden="true"><i class="b" style="--w:${(r.rate / max * 100).toFixed(1)}%"></i><i class="a" style="--w:${(r.afterRate / max * 100).toFixed(1)}%"></i></span>
      <span class="bp-n">${r.before} before · ${afterText}</span><span class="bp-t">${trend}</span></li>`;
  }).join('');
  let lede = `You played <b>${up}</b> of ${plural(rows.length, 'act')} more after the show than in the ${win} days before, per day.`;
  if (short) lede += ` Your Spotify export ends ${fmt(listening.until)}, so the latest shows only have a few days after.`;
  let quiet = '';
  if (silent.length) quiet = `<p class="sub">No plays either side</p><p class="up-cold">${silent.map(x => `<button class="chip" type="button" data-artist="${esc(x.a.artist)}">${esc(x.a.artist)}</button>`).join('')}</p>`;
  box.innerHTML = `<h3>The show bump <span>listening: Spotify</span></h3><p class="lede">${lede}</p>
    <p class="sl-legend"><span><i class="bp-key b"></i>${win} days before, per day</span><span><i class="bp-key a"></i>after, per day</span></p>
    <ol class="rc-bump">${items}</ol>${quiet}`;
  box.hidden = false;
}
