import { persist } from './api.js';
import { nightPhotos, photosOn, photoUrl } from './photos.js';
import { flip, motionOK, toast } from './motion.js';
import { closeSheet } from './sheets.js';
import { MONTHS, TODAY, filt, state } from './state.js';
import { $, cityKey, esc, happened, place } from './util.js';
import { render } from './view.js';

/* ---------- grouping & render ---------- */
export function nights(list){
  const map = new Map();
  list.forEach((s,i) => {
    const k = (s.date||'undated') + '|' + s.venue.toLowerCase() + '|' + s.city.toLowerCase();
    if (!map.has(k)) map.set(k, {date:s.date, venue:s.venue, city:s.city, state:s.state, country:s.country, acts:[], idx:i});
    map.get(k).acts.push(s);
  });
  return [...map.values()].sort((a,b) => {
    if (!a.date && !b.date) return a.idx-b.idx;
    if (!a.date) return 1; if (!b.date) return -1;
    return b.date.localeCompare(a.date) || a.idx-b.idx;
  });
}
function matches(s){
  if (filt.type && s.type !== filt.type) return false;
  if (filt.city && cityKey(s) !== filt.city) return false;
  if (filt.q){ const q=filt.q.toLowerCase(); return [s.artist,s.venue,place(s),s.notes].some(v=>(v||'').toLowerCase().includes(q)); }
  return true;
}

// Header totals count from what was last shown (0 on load) to the new value
export const statShown = {};
export function countTo(el, label, to){
  const from = statShown[label] ?? 0;
  statShown[label] = to;
  if (from === to || !motionOK()) { el.textContent = to; return; }
  const ms = 700, t0 = performance.now();
  const step = now => {
    if (!el.isConnected) return;
    const p = Math.min((now - t0) / ms, 1);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
export function renderStats(){
  const past = state.shows.filter(happened);
  const n = nights(past);
  const artists = new Map(); past.forEach(s => { const k=s.artist.trim(); artists.set(k,(artists.get(k)||0)+1); });
  const venues = new Set(past.map(s=>s.venue.toLowerCase()).filter(Boolean));
  const cities = new Set(past.filter(s=>s.city).map(cityKey));
  const totals = [[n.length,'Nights out'],[artists.size,'Artists'],[venues.size,'Venues'],[cities.size,'Cities']];
  // Nights go on the ticket's stub, the rest in its main part
  countTo($('#tNights'), totals[0][1], totals[0][0]);
  // The stamp on the ticket: first to latest year out
  const years = n.filter(x => x.date).map(x => x.date.slice(0, 4)).sort();
  let span = '';
  if (years.length) span = `${years[0]}–${years.at(-1)}`;
  $('#tStamp').textContent = span;
  const rest = totals.slice(1);
  $('#stats').innerHTML = rest.map(([v,l])=>`<div class="stat"><b>${statShown[l] ?? 0}</b><span>${l}</span></div>`).join('');
  $('#stats').querySelectorAll('b').forEach((b, i) => countTo(b, rest[i][1], rest[i][0]));
  const reps = [...artists].filter(([,c])=>c>1).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const top = state.showAllMost ? reps : reps.slice(0,8);
  $('#most').innerHTML = reps.length ? `<span class="lbl">Seen 2+ times</span>` + top.map(([a,c])=>`<button class="chip" data-q="${esc(a)}" type="button">${esc(a)}<em>×${c}</em></button>`).join('')
    + (reps.length>8 ? `<button type="button" class="more" id="moreBtn">${state.showAllMost?'Show fewer':`All ${reps.length} →`}</button>` : '') : '';
  const sel = $('#city'), cur = sel.value;
  const allCities = [...new Set(state.shows.filter(s=>s.city).map(cityKey))].sort();
  sel.innerHTML = '<option value="">All cities</option>' + allCities.map(c=>`<option ${c===cur?'selected':''}>${esc(c)}</option>`).join('');
}

function stub(n){
  const up = !happened(n), isToday = n.date === TODAY;
  const [Y,M,D] = n.date ? n.date.split('-') : [];
  const types = [...new Set(n.acts.map(a=>a.type))];
  const notes = n.acts.map(a=>a.notes).filter(Boolean);
  const k = nightKey(n);
  let seen = 'reveal';
  if (revealed.has(k)) seen = 'in';
  // Repeat sightings: the stub glows by its most-seen act; each repeat act gets a ×N badge
  const best = Math.max(...n.acts.map(a => nthSeen.get(a.id) || 1));
  let glow = '';
  if (best > 1) glow = `rep rep-${Math.min(best, 5)}`;
  const act = a => {
    const nth = nthSeen.get(a.id) || 1;
    if (nth < 2) return '';
    return `<span class="nth" title="${ordinal(nth)} time seeing ${esc(a.artist)}">×${nth}</span>`;
  };
  let stamped = '';
  if (n.acts.some(a => a.id === state.stampId)) stamped = 'stamped';
  return `<article class="stub ${up?'is-up':''} ${seen} ${glow} ${stamped}" data-k="${esc(k)}">
      <div class="date">${n.date ? `<span class="m">${MONTHS[+M-1]}</span><span class="d">${+D}</span><span class="y">${Y}</span>` : `<span class="m">Date</span><span class="d">?</span>`}</div>
      <div class="body">
        <div class="where"><strong>${n.venue?`<button type="button" class="vbtn" data-venue="${esc(n.venue+'|'+n.city)}">${esc(n.venue)}</button>`:'Unknown venue'}</strong><span>${esc(place(n))}</span>
          ${types.map(t=>`<span class="tag ${t.toLowerCase()}">${esc(t)}</span>`).join('')}
          ${isToday?'<span class="tag up">Tonight</span>':up?'<span class="tag up">Upcoming</span>':''}</div>
        <ul class="acts">${n.acts.map((a,i)=>`<li class="${i===0?'first':''}"><button type="button" data-artist="${esc(a.artist)}" data-id="${a.id}" title="About ${esc(a.artist)}">${esc(a.artist)}</button>${act(a)}</li>`).join('')}</ul>
        ${notes.length?`<div class="notes">${notes.map(esc).join(' · ')}</div>`:''}
        ${stubExtra(n)}
        <div class="tools edit-only"><button class="add-act" type="button" data-addto="${n.acts[0].id}">+ act on this bill</button><button class="add-act" type="button" data-bill="${n.acts[0].id}">Edit bill</button>${snapButton(n)}</div>
      </div></article>`;
}
// Stubs fade up the first time they scroll into view; ones already seen render in place,
// so re-rendering after an edit only animates nights that are new or changed.
export const nightKey = n => [n.date||'undated', n.venue, n.city, n.acts.map(a=>a.id).join(',')].join('|').toLowerCase();
const revealed = new Set();
let revealer = null;
if ('IntersectionObserver' in window) revealer = new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.replace('reveal', 'in'); revealed.add(e.target.dataset.k); revealer.unobserve(e.target);
}), {rootMargin:'0px 0px -24px 0px'});
function watchReveals(){
  revealer?.disconnect();
  document.querySelectorAll('.stub.reveal').forEach(el => {
    if (revealer && motionOK()) revealer.observe(el);
    else { el.classList.replace('reveal', 'in'); revealed.add(el.dataset.k); }
  });
}
/* ---------- the loading hand deals out ----------
   Each blank ticket flies from its place in the hand to one of the first tickets on screen and turns into it,
   a beat apart, top of the hand first. Everything else on screen fades up behind them. */
const DEAL_ORDER = [2, 3, 4, 1, 0]; // the deck's cards from the top of the pile down (see .g1-.g5 z-index)
const DEAL_GAP = 80, DEAL_MS = 700, EASE = 'cubic-bezier(.2,.7,.3,1)';
function markRevealed(el){
  if (!el.classList.contains('stub')) return;
  el.classList.replace('reveal', 'in'); revealed.add(el.dataset.k); revealer?.unobserve(el);
}
export function dealIn(draw){
  const list = $('#list');
  const ghosts = [...document.querySelectorAll('#deck .ghost')];
  if (!ghosts.length || !motionOK() || $('#logView').hidden) { draw(); return; }
  // Where each card is right now, mid-sway: its centre, size and tilt
  const from = ghosts.map(g => {
    const r = g.getBoundingClientRect(), m = new DOMMatrixReadOnly(getComputedStyle(g).transform);
    return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: g.offsetWidth, h: g.offsetHeight, turn: Math.atan2(m.b, m.a) * 180 / Math.PI};
  });
  draw();
  const onScreen = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  const dealt = [...list.querySelectorAll('.stub')].filter(onScreen).slice(0, DEAL_ORDER.length);
  dealt.forEach((el, i) => {
    const card = from[DEAL_ORDER[i]], r = el.getBoundingClientRect(), delay = i * DEAL_GAP;
    markRevealed(el);
    // Above the pinned year header while it flies
    el.classList.add('dealing');
    const flight = el.animate([
      {transform: `translate(${card.x - (r.left + r.width / 2)}px, ${card.y - (r.top + r.height / 2)}px) rotate(${card.turn}deg) scale(${card.w / r.width}, ${card.h / r.height})`},
      {transform: 'none'},
    ], {duration: DEAL_MS, delay, easing: EASE, fill: 'backwards'});
    flight.finished.finally(() => el.classList.remove('dealing'));
    // Blank until it lands, then its writing comes through
    el.querySelectorAll('.date>*, .body>*').forEach(part => part.animate([{opacity: 0}, {opacity: 1}],
      {duration: 300, delay: delay + DEAL_MS * .55, easing: 'ease-out', fill: 'backwards'}));
  });
  const after = dealt.length * DEAL_GAP + DEAL_MS * .4;
  [...list.children].filter(el => !dealt.includes(el) && onScreen(el)).forEach((el, i) => {
    markRevealed(el);
    el.animate([{opacity: 0, transform: 'translateY(10px)'}, {opacity: 1, transform: 'none'}],
      {duration: 400, delay: after + i * 40, easing: EASE, fill: 'backwards'});
  });
}

// Filtering slides stubs to their new places instead of every stub fading up
export function filterList(){ flip(renderList); }
// A deleted ticket rips apart before the list closes up. Off-screen, it just goes.
function tearStub(actId, done){
  const el = document.querySelector(`.stub [data-id="${CSS.escape(actId)}"]`)?.closest('.stub');
  let visible = false;
  if (el) { const r = el.getBoundingClientRect(); visible = r.bottom > 0 && r.top < innerHeight; }
  if (!visible || !motionOK()) { done(); return; }
  let finished = false;
  const finish = () => { if (finished) return; finished = true; done(); };
  const part = el.querySelector('.body');
  part.addEventListener('animationend', finish, {once:true});
  part.addEventListener('animationcancel', finish, {once:true});
  el.classList.add('tearing');
}
export function commitDelete(msg, actId, op){
  closeSheet(); persist(op); toast(msg);
  tearStub(actId, () => flip(render));
}
// The next redraw stamps this act's stub

function stubExtra(n){
  const bits = [];
  const rating = nightVal(n, 'rating');
  if (rating) bits.push(`<span class="rated" aria-label="${rating} out of 5">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>`);
  const price = nightVal(n, 'price');
  if (price !== undefined) bits.push(`<span>${money(price)}</span>`);
  const withWho = nightVal(n, 'companions');
  if (withWho) bits.push(`<span>With ${esc(withWho)}</span>`);
  if (!bits.length) return '';
  return `<div class="stub-extra">${bits.join('')}</div>`;
}
// A night's rating, price or companions: written to every act, so the first act that has one will do
export const nightVal = (n, f) => n.acts.find(a => a[f] !== null && a[f] !== undefined && a[f] !== '')?.[f];
export const money = v => {
  let digits = 2;
  if (Number.isInteger(+v)) digits = 0;
  return '$' + Number(v).toLocaleString(undefined, {minimumFractionDigits:digits, maximumFractionDigits:2});
};

// act id -> which time you saw that artist (1 = first). Time order: undated shows first
// (they're the oldest), then by date, then list order. Upcoming shows continue the count,
// so an upcoming stub shows the sighting it will be.
let nthSeen = new Map();
const ordinal = n => { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
function countSightings(){
  const byTime = state.shows.map((s, i) => ({s, i})).sort((a, b) => (a.s.date || '').localeCompare(b.s.date || '') || a.i - b.i);
  const tally = new Map();
  nthSeen = new Map();
  for (const {s} of byTime) {
    const k = s.artist.trim().toLowerCase();
    tally.set(k, (tally.get(k) || 0) + 1);
    nthSeen.set(s.id, tally.get(k));
  }
}

export function renderList(){
  // Drawing the list replaces the loading hand
  $('#list').removeAttribute('aria-busy');
  countSightings();
  const all = nights(state.shows.filter(matches));
  if (!all.length){ $('#list').innerHTML = `<div class="empty">No shows match. Clear the search or add one with “+ Add show”.</div>`; return; }
  // upcoming nights are pinned on top, soonest first; the year groups only hold shows that have happened
  const next = all.filter(n=>!happened(n)).sort((a,b)=>a.date.localeCompare(b.date) || a.idx-b.idx);
  const list = all.filter(happened);
  let html=onThisDay(), yr=null;
  if (next.length) html +=`<div class="year next"><h2>Up next</h2><span>${next.length} show${next.length>1?'s':''}</span></div>` + next.map(stub).join('');
  const counts = {}; list.forEach(n => { const y=n.date?n.date.slice(0,4):'Undated'; counts[y]=(counts[y]||0)+1; });
  for (const n of list){
    const y = n.date ? n.date.slice(0,4) : 'Undated';
    if (y !== yr){ yr=y; html += `<div class="year" id="y-${y}"><h2>${y}</h2><span>${counts[y]} night${counts[y]>1?'s':''}</span></div>`; }
    html += stub(n);
  }
  $('#list').innerHTML = html;
  paintStubPhotos();
  watchReveals();
}

/* ---------- photos on tickets ----------
   Painted onto the tickets already on the page, so photos arriving after the log was dealt don't redraw it.
   A filter can hide some of a night's acts, so photos are found through the whole night. */
const STRIP = 3;
const snapButton = n => {
  if (!photosOn()) return '';
  return `<button class="add-act snap" type="button" data-snap="${n.acts[0].id}">+ Photos</button>`;
};
export function fullNight(actId){
  return nights(state.shows).find(n => n.acts.some(a => a.id === actId));
}
export function paintStubPhotos(){
  const byAct = new Map();
  nights(state.shows).forEach(n => n.acts.forEach(a => byAct.set(a.id, n)));
  document.querySelectorAll('#list .stub').forEach(el => {
    el.querySelector('.stub-photos')?.remove();
    const actId = el.querySelector('[data-id]')?.dataset.id;
    const n = byAct.get(actId); if (!n) return;
    const mine = nightPhotos(n); if (!mine.length) return;
    const thumbs = mine.slice(0, STRIP).map((p, i) =>
      `<button type="button" class="sp" data-photos-of="${esc(actId)}" data-at="${i}" aria-label="Photo ${i + 1} of ${mine.length}"><img loading="lazy" src="${esc(photoUrl(p))}" alt=""></button>`).join('');
    let more = '';
    if (mine.length > STRIP) more = `<button type="button" class="sp more" data-photos-of="${esc(actId)}" data-at="${STRIP}">+${mine.length - STRIP}</button>`;
    el.querySelector('.body .acts').insertAdjacentHTML('afterend', `<div class="stub-photos">${thumbs}${more}</div>`);
  });
}
// Past shows on today's date, above the log when it isn't filtered
function onThisDay(){
  if (filt.q || filt.type || filt.city) return '';
  const day = TODAY.slice(5);
  const then = nights(state.shows.filter(s => s.date && s.date < TODAY && s.date.slice(5) === day));
  if (!then.length) return '';
  const items = then.map(n => {
    const ago = +TODAY.slice(0,4) - +n.date.slice(0,4);
    let years = `${ago} years ago`;
    if (ago === 1) years = 'A year ago';
    return `<span>${years}: <button class="chip" type="button" data-artist="${esc(n.acts[0].artist)}">${esc(n.acts[0].artist)}</button> at ${esc(n.venue || 'an unknown venue')}</span>`;
  });
  return `<div class="otd"><span class="lbl">On this day</span>${items.join('')}</div>`;
}
