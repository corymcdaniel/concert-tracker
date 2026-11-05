import { track } from './analytics.js';
import { imgUrl } from './info.js';
import { nightVal, nights, statShown } from './log.js';
import { MONTHS, state } from './state.js';
import { artistKey, counter, plural, runCounters } from './stats/panels.js';
import { $, esc, happened, place } from './util.js';

/* ---------- year in review ---------- */
export function reviewPanel(nd){
  const years = [...new Set(nd.map(n => n.date.slice(0,4)))].sort().reverse();
  if (!years.length) return '';
  return `<div class="panel"><h3>Year in review</h3><div class="rv-cta">${years.map(y => `<button type="button" data-review="${y}">${y}</button>`).join('')}</div></div>`;
}
const topOf = counts => [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
function reviewStats(year){
  const past = state.shows.filter(happened);
  const ns = nights(past).filter(n => n.date && n.date.startsWith(year));
  const acts = ns.flatMap(n => n.acts);
  const tally = (list, keyOf) => { const m = new Map(); list.forEach(x => { const k = keyOf(x); if (k) m.set(k, (m.get(k) || 0) + 1); }); return m; };
  const before = new Set(past.filter(s => !s.date || s.date.slice(0,4) < year).map(s => artistKey(s.artist)));
  const fresh = [...new Set(acts.map(a => a.artist.trim()))].filter(a => !before.has(artistKey(a)));
  const genres = tally(acts.flatMap(a => state.INFO.artists?.[a.artist]?.genre || []), g => g);
  const months = tally(ns, n => n.date.slice(5,7));
  const rated = ns.filter(n => nightVal(n, 'rating')).sort((a, b) => nightVal(b, 'rating') - nightVal(a, 'rating'));
  const biggest = [...ns].sort((a, b) => b.acts.length - a.acts.length)[0];
  return {year, ns, acts, fresh, biggest,
    artist: topOf(tally(acts, a => a.artist.trim())),
    venue: topOf(tally(ns, n => n.venue)),
    city: topOf(tally(ns, n => place(n))),
    month: topOf(months),
    genre: topOf(genres),
    best: rated[0],
    comedy: ns.filter(n => !n.acts.some(a => a.type === 'Music')).length};
}
function reviewSlides(s){
  const out = [];
  const nightsWord = plural(s.ns.length, 'night');
  out.push(`<div class="rv-k">Your year in shows</div><div class="rv-big">${s.year}</div><p class="rv-p">Tap to step through it.</p>`);
  out.push(`<div class="rv-k">You went out</div><div class="rv-big">${counter('rv-nights', s.ns.length)}</div><p class="rv-p">${nightsWord.replace(/^d+ /, '')}, ${plural(s.acts.length,'set')} from ${plural(new Set(s.acts.map(a => artistKey(a.artist))).size,'artist')}.</p>`);
  const [name, times] = s.artist;
  const rec = state.INFO.artists?.[name];
  let photo = '';
  if (rec?.img) photo = `<img class="rv-photo" src="${imgUrl(rec.img, 500)}" alt="" onerror="this.remove()">`;
  let artistLine = `You saw them ${plural(times,'time')} this year.`;
  let artistLabel = 'Your most-seen act';
  if (times === 1) { artistLabel = 'Starring'; artistLine = esc(rec?.desc || ''); }
  out.push(`${photo}<div class="rv-k">${artistLabel}</div><div class="rv-name">${esc(name)}</div><p class="rv-p">${artistLine}</p>`);
  if (s.venue) out.push(`<div class="rv-k">Your room</div><div class="rv-name">${esc(s.venue[0])}</div><p class="rv-p">${plural(s.venue[1],'night')} there. ${esc(s.city?.[0] || '')} was home base for ${plural(s.city?.[1] || 0,'night')}.</p>`);
  const monthName = MONTHS[+s.month[0] - 1];
  out.push(`<div class="rv-k">Your busiest month</div><div class="rv-big">${monthName}</div><p class="rv-p">${plural(s.month[1],'night')} out.</p>`);
  let moreFresh = '';
  if (s.fresh.length > 18) moreFresh = `<li>+ ${s.fresh.length - 18} more</li>`;
  if (s.fresh.length) out.push(`<div class="rv-k">First time seeing</div><div class="rv-big">${counter('rv-new', s.fresh.length)}</div><ul class="rv-list">${s.fresh.slice(0, 18).map(a => `<li>${esc(a)}</li>`).join('')}${moreFresh}</ul>`);
  if (s.genre) out.push(`<div class="rv-k">Your sound</div><div class="rv-name">${esc(s.genre[0])}</div><p class="rv-p">${plural(s.genre[1],'set')} leaned that way.</p>`);
  const played = state.LISTEN?.years?.[s.year] || [];
  if (played.length) {
    const [lead, ...rest] = played;
    const pic = state.LISTEN.artists.find(a => a.name === lead.name)?.img;
    let photoTop = '';
    if (pic) photoTop = `<img class="rv-photo" src="${imgUrl(pic, 500)}" alt="" onerror="this.remove()">`;
    let then = '';
    if (rest.length > 1) then = ` Then ${esc(rest[0].name)} and ${esc(rest[1].name)}.`;
    out.push(`${photoTop}<div class="rv-k">On repeat</div><div class="rv-name">${esc(lead.name)}</div><p class="rv-p">${Math.round(lead.hours)} hours on Spotify.${then}</p>`);
  }
  if (s.biggest.acts.length > 1) out.push(`<div class="rv-k">Biggest bill</div><div class="rv-big">${counter('rv-bill', s.biggest.acts.length)}</div><p class="rv-p">acts at ${esc(s.biggest.venue)}, led by ${esc(s.biggest.acts[0].artist)}.</p>`);
  if (s.best) out.push(`<div class="rv-k">Your top-rated night</div><div class="rv-name">${esc(s.best.acts[0].artist)}</div><p class="rv-p">${'★'.repeat(nightVal(s.best, 'rating'))} at ${esc(s.best.venue)}.</p>`);
  const cards = [[nightsWord, 'Out'], [name, 'Most seen'], [s.venue?.[0] || '—', 'Top room'], [monthName, 'Busiest month'], [plural(s.fresh.length,'new act'), 'Discovered']];
  if (s.comedy) cards.push([plural(s.comedy,'night'), 'Of stand-up']);
  out.push(`<div class="rv-k">${s.year} in one ticket</div><div class="rv-grid">${cards.map(([b, l]) => `<div><span>${esc(l)}</span><b>${esc(b)}</b></div>`).join('')}</div><button type="button" class="rv-share" id="rvShare">Share</button>`);
  return out;
}
let rv = null;
export function openReview(year){
  const d = $('#review');
  const s = reviewStats(year);
  if (!s.ns.length) return;
  track('open_review', {year});
  rv = {year, slides:reviewSlides(s), i:0, s};
  ['rv-nights','rv-new','rv-bill'].forEach(k => delete statShown[k]);
  if (!d.open) d.showModal();
  drawReview();
  try { history.replaceState(null, '', `#review-${year}`); } catch {}
}
function drawReview(){
  const d = $('#review');
  const pips = rv.slides.map((_, i) => { let on = ''; if (i <= rv.i) on = 'on'; return `<i class="${on}"></i>`; }).join('');
  let hint = '';
  if (rv.i === 0) hint = '<div class="rv-hint">Tap or use the arrow keys · Esc to close</div>';
  d.innerHTML = `<div class="rv-pips" aria-hidden="true">${pips}</div>
    <button type="button" class="x" id="rvClose" aria-label="Close">×</button>
    <div class="rv-slide rv-${rv.i % 5}" aria-live="polite">${rv.slides[rv.i]}</div>${hint}`;
  runCounters(d);
}
export function stepReview(by){
  const next = rv.i + by;
  if (next < 0 || next >= rv.slides.length) return;
  rv.i = next;
  drawReview();
}
export async function shareReview(btn){
  track('share', {content_type: 'year_review', item_id: String(rv.year)});
  const s = rv.s;
  const text = `My ${s.year} in shows: ${plural(s.ns.length,'night')} out, ${plural(s.fresh.length,'new act')}, and ${s.artist[0]} most of all.`;
  const url = `${location.origin}${location.pathname}#review-${s.year}`;
  try {
    if (navigator.share) { await navigator.share({title:`${s.year} in shows`, text, url}); return; }
    await navigator.clipboard.writeText(`${text} ${url}`);
    btn.textContent = 'Copied';
  } catch { /* cancelling the share sheet is fine */ }
}
