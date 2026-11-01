import { canEdit } from '../auth.js';
import { imgUrl } from '../info.js';
import { state } from '../state.js';
import { fmt } from './index.js';
import { esc, happened } from '../util.js';

/* bucket list: listening.json comes from scripts/build-listening.mjs */

export async function loadListening(){
  try { const r = await fetch('listening.json'); if (r.ok) state.LISTEN = await r.json(); } catch {}
}
// Spotify and the log can spell a name differently: "The Cure" / "Cure", "Bjork" / "Björk", "A & B" / "A and B"
const matchKey = name => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/^the\s+/, '').replace(/[&+]/g, 'and').replace(/[^\p{L}\p{N}]/gu, '');
const hoursLabel = h => { if (h >= 10) return `${Math.round(h).toLocaleString()} hrs`; return `${h} hrs`; };
export function bucketPanel(past){
  if (!state.LISTEN) {
    if (!canEdit()) return '';
    return `<div class="panel"><h3>Bucket list</h3><p class="hint">Your most-played artists you've never seen live appear here once <b>listening.json</b> is built from your Spotify export. See the README.</p></div>`;
  }
  const seen = new Set(past.map(s => matchKey(s.artist)));
  const soon = new Map(state.shows.filter(s => !happened(s)).map(s => [matchKey(s.artist), s.date]));
  const list = state.LISTEN.artists.filter(a => !seen.has(matchKey(a.name)));
  if (!list.length) return '';
  const note = a => {
    if (soon.has(matchKey(a.name))) return `seeing them ${fmt(soon.get(matchKey(a.name)))}`;
    return `${hoursLabel(a.hours)} since ${a.first}`;
  };
  const tiles = list.slice(0, 12).map((a, i) => {
    let img = '';
    if (a.img) img = `<img loading="lazy" src="${imgUrl(a.img, 400)}" alt="" onerror="this.remove()">`;
    return `<button type="button" data-artist="${esc(a.name)}">${img}<span class="rk">${i + 1}</span><span class="cap"><b>${esc(a.name)}</b><small>${esc(note(a))}</small></span></button>`;
  }).join('');
  const rest = list.slice(12, 30);
  let more = '';
  if (rest.length) more = `<div class="bucket-more"><p class="sub">Next on the list</p><ul class="mini">${rest.map(a =>
    `<li><button type="button" data-artist="${esc(a.name)}">${esc(a.name)}</button><span>${esc(note(a))}</span></li>`).join('')}</ul></div>`;
  return `<div class="panel"><h3>Bucket list <span>listening: Spotify · photos: Wikimedia Commons</span></h3>
    <p class="lede">You've never seen <b>${list.length}</b> of your ${state.LISTEN.artists.length} most-played artists since ${esc(state.LISTEN.from)}.</p>
    <div class="bucket">${tiles}</div>${more}</div>`;
}
