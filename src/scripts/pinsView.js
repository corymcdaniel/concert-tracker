// Pins on the page: the enamel pin itself, the Pins tab (the lanyard), a panel in Stats → Overview, and the
// "New pin!" pop-up the first time one is earned. Which pins are earned is worked out in pins.js.
// The pop-up is only for whoever can edit the log: visitors see the lanyard but never get celebrated at.
import { nights } from './log.js';
import { pinStatus } from './pins.js';
import { TODAY, state } from './state.js';
import { $, esc, store } from './util.js';

export const currentPins = () => pinStatus(nights(state.shows), state.PHOTOS || [], TODAY);
// Closest to done first, so the next one to chase leads
const byProgress = (a, b) => b.have / b.goal - a.have / a.goal;

/* ---------- one pin ----------
   A gold rim around navy enamel with the glyph stamped in, and a shine that sweeps across on hover (_pins.scss).
   Unearned pins are dull pewter. celebrate adds the drop-in, a ring and sparks; delay staggers several. */
export function pinHtml(pin, {earned = true, size = 'medium', celebrate = false, delay = 0} = {}){
  let burst = '';
  if (celebrate) burst = `<span class="pin-burst">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<i class="pin-spark" data-i="${i}"></i>`).join('')}</span>`;
  let glyph = 'pin-glyph';
  if (pin.glyph.length > 2) glyph += ' long';
  return `<span class="pin" data-shape="${pin.shape}" data-earned="${earned}" data-size="${size}" data-celebrate="${celebrate}" data-delay="${delay}" aria-hidden="true">`
    + `${burst}<span class="pin-rim"><span class="pin-enamel"><span class="${glyph}">${esc(pin.glyph)}</span></span></span></span>`;
}

/* ---------- the Pins tab ---------- */
function pinCard(p, i){
  let order = 'late';
  if (i < 12) order = String(i);
  let progress = '';
  if (!p.earned && p.goal > 1) progress = `<span class="pin-progress"><progress value="${p.have}" max="${p.goal}" aria-label="${p.have} of ${p.goal}"></progress><span>${p.have}/${p.goal}</span></span>`;
  let status = 'Not yet';
  if (p.earned) status = 'Earned';
  return `<li class="pin-card" data-earned="${p.earned}" data-order="${order}">${pinHtml(p, {earned: p.earned})}
    <div class="pin-text"><h3>${esc(p.name)}<span class="sr-only"> (${status})</span></h3><p>${esc(p.blurb)}</p>${progress}</div></li>`;
}
export function renderPinsView(){
  const pins = currentPins();
  const earned = pins.filter(p => p.earned);
  const locked = pins.filter(p => !p.earned).sort(byProgress);
  // Earned pins sit on a felt board
  let board = '';
  if (earned.length) board = `<section class="pin-board" aria-label="Earned pins"><ul class="pin-grid">${earned.map(pinCard).join('')}</ul></section>`;
  let rest = '';
  if (locked.length) rest = `<section class="pin-rest"><h2>Still to get</h2><ul class="pin-grid">${locked.map((p, i) => pinCard(p, i + earned.length)).join('')}</ul></section>`;
  $('#pinsView').innerHTML = `<header class="pins-head"><span class="pins-k">Pins</span><h2>The lanyard</h2>
    <p>${earned.length} of ${pins.length} earned</p></header>${board}${rest}`;
}

/* ---------- Stats → Overview: the pins so far and the next one ---------- */
export function pinsPanel(){
  const pins = currentPins();
  const earned = pins.filter(p => p.earned);
  const next = pins.filter(p => !p.earned).sort(byProgress)[0];
  let nextLine = '';
  if (next) nextLine = `<p class="pp-next">Next up: <b>${esc(next.name)}</b>, ${esc(next.blurb.toLowerCase())} <span>${next.have}/${next.goal}</span></p>`;
  const row = earned.map(p => `<li title="${esc(p.name)}">${pinHtml(p, {size: 'small'})}<span class="sr-only">${esc(p.name)}</span></li>`).join('');
  return `<div class="panel pins-panel"><h3>Pins <span>${earned.length} of ${pins.length} earned</span></h3>
    <ul class="pp-row">${row}</ul>${nextLine}<button type="button" class="pp-all" data-view="pins">See the lanyard <span aria-hidden="true">→</span></button></div>`;
}

/* ---------- the "New pin!" pop-up ----------
   Celebrated pins are kept in the database (pins_seen, netlify/functions/pins.mjs), so a pin pops once, not once
   per device. Local mode keeps them in this browser. */
const SEEN_KEY = 'show-log-pins-seen';
// More than this at once (the first visit after release) shows these and a count of the rest
const SHOW_AT_MOST = 6;
const owner = () => state.mode !== 'netlify' || !!state.user;
const who = () => state.user?.email || state.user?.name || 'local';

let seen = null, seenFor = '', pending = null;
// Celebrated in this page load, so a slow save can't bring them back
const shown = new Set();
let fresh = [];

async function loadSeen(){
  if (state.mode !== 'netlify') return new Set(JSON.parse(store.get(SEEN_KEY) || '[]'));
  const r = await fetch('/api/pins', {cache: 'no-store', credentials: 'same-origin'});
  if (!r.ok) throw new Error(r.status);
  return new Set((await r.json()).seen);
}
// The celebrated set for whoever is signed in, loaded once. null when it can't be had (then nothing pops).
async function seenSet(){
  if (seenFor !== who()) { seenFor = who(); seen = null; pending = null; }
  if (seen) return seen;
  const mine = seenFor;
  pending ??= loadSeen().then(s => { if (seenFor === mine) seen = s; return s; }).catch(() => { pending = null; return null; });
  const s = await pending;
  if (seenFor !== mine) return null;
  return s;
}

function drawUnlock(list){
  const first = list.slice(0, SHOW_AT_MOST), more = list.length - first.length;
  // One pin gets the big treatment; several share the space
  let size = 'large';
  if (first.length > 1) size = 'medium';
  let title = 'New pin!';
  if (list.length > 1) title = `${list.length} new pins!`;
  let moreLine = '';
  if (more > 0) moreLine = `<p class="pu-more">and ${more} more</p>`;
  const dlg = $('#pinUnlock');
  dlg.setAttribute('aria-label', title);
  dlg.innerHTML = `<h2 class="pu-title">${title}</h2>
    <ul class="pu-pins" data-count="${first.length}">${first.map((p, i) => `<li>${pinHtml(p, {size, celebrate: true, delay: i})}<strong>${esc(p.name)}</strong><span>${esc(p.blurb)}</span></li>`).join('')}</ul>
    ${moreLine}<div class="pu-actions"><button type="button" data-view="pins" data-pin-close>See all pins</button><button type="button" class="primary" data-pin-close autofocus>Nice</button></div>`;
}

// After every redraw: anything newly earned that hasn't been celebrated pops up
export async function checkNewPins(){
  if (!owner() || document.querySelector('dialog[open]')) return;
  const s = await seenSet();
  if (!s || !owner() || document.querySelector('dialog[open]')) return;
  const news = currentPins().filter(p => p.earned && !s.has(p.id) && !shown.has(p.id));
  if (!news.length) return;
  news.forEach(p => shown.add(p.id));
  fresh = news;
  drawUnlock(news);
  $('#pinUnlock').showModal();
}

async function saveSeen(){
  const ids = fresh.map(p => p.id);
  fresh = [];
  if (!ids.length) return;
  ids.forEach(id => seen?.add(id));
  if (state.mode !== 'netlify') { store.set(SEEN_KEY, JSON.stringify([...(seen || ids)])); return; }
  // Not saved means they're celebrated again next visit, which is a fine way to fail
  try {
    await fetch('/api/pins', {method: 'PUT', credentials: 'same-origin', headers: {'content-type': 'application/json'}, body: JSON.stringify({ids})});
  } catch {}
}
export function initPinUnlock(){
  const dlg = $('#pinUnlock');
  dlg.addEventListener('close', saveSeen);
  // Its buttons and the backdrop close it; See all pins also switches to the Pins tab (main.js handles data-view)
  dlg.addEventListener('click', e => {
    if (e.target.closest('[data-pin-close]')) { dlg.close(); return; }
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dlg.close();
  });
}
