import { yr } from '../info.js';
import { countTo, statShown } from '../log.js';
import { MONTHS, TODAY, state } from '../state.js';
import { fmt } from './index.js';
import { esc } from '../util.js';

/* ---------- more stats ---------- */
export const counter = (key, to) => `<span data-to="${to}" data-key="${key}">${statShown[key] ?? 0}</span>`;
export const runCounters = root => root.querySelectorAll('[data-to]').forEach(el => countTo(el, el.dataset.key, +el.dataset.to));
export const plural = (n, word) => { if (n === 1) return `1 ${word}`; return `${n} ${word}s`; };
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dayGap = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
export const artistKey = name => name.trim().toLowerCase();
export const panelBars = (rows, height) => {
  const max = Math.max(...rows.map(r => r.parts.reduce((t, p) => t + p[1], 0)), 1);
  return `<div class="bars" style="height:${height}px">${rows.map(r => {
    const total = r.parts.reduce((t, p) => t + p[1], 0);
    const segs = r.parts.filter(p => p[1]).map(p => `<div class="${p[0]}" style="height:${p[1] / max * 100}%"></div>`).join('');
    return `<div class="col" title="${esc(r.title)}"><span class="n">${total || ''}</span><div class="stack">${segs}</div><span class="x">${esc(r.label)}</span></div>`;
  }).join('')}</div>`;
};
export function dayPanel(nd){
  const c = Array(7).fill(0);
  nd.forEach(n => c[new Date(n.date + 'T12:00').getDay()]++);
  const top = c.indexOf(Math.max(...c));
  return `<div class="panel"><h3>By day of week <span>${DAYS[top]} wins</span></h3>${panelBars(c.map((v, i) => ({label:DAYS[i], title:`${DAYS[i]}: ${plural(v,'night')}`, parts:[['seg-m', v]]})), 120)}</div>`;
}
export function heatPanel(nd, y0, y1){
  const cells = {};
  nd.forEach(n => { const k = n.date.slice(0,7); cells[k] = (cells[k] || 0) + 1; });
  let html = '<span></span>' + MONTHS.map(m => `<span>${m[0]}</span>`).join('');
  for (let y = y1; y >= y0; y--) {
    html += `<span class="yl">'${String(y).slice(2)}</span>`;
    for (let m = 1; m <= 12; m++) {
      const v = cells[`${y}-${String(m).padStart(2,'0')}`] || 0;
      html += `<i class="h${Math.min(v, 4)}" style="--m:${m}" title="${MONTHS[m-1]} ${y}: ${plural(v,'night')}"></i>`;
    }
  }
  return `<div class="panel"><h3>Every month out</h3><div class="heat">${html}</div></div>`;
}
export function gapPanel(nd){
  const dates = [...new Set(nd.map(n => n.date))].sort();
  if (dates.length < 2) return '';
  const gaps = dates.slice(1).map((d, i) => ({from:dates[i], to:d, days:dayGap(dates[i], d)}));
  const line = g => `<li>${fmt(g.from)} → ${fmt(g.to)}<span>${plural(g.days,'day')}</span></li>`;
  const close = [...gaps].sort((a, b) => a.days - b.days || b.to.localeCompare(a.to)).slice(0, 5);
  const far = [...gaps].sort((a, b) => b.days - a.days).slice(0, 5);
  const back = gaps.filter(g => g.days === 1).length;
  const since = dayGap(dates.at(-1), TODAY);
  return `<div class="panel"><h3>Streaks and droughts</h3>
    <p class="lede"><b>${plural(back,'back-to-back night')}</b> so far, and <b>${plural(since,'day')}</b> since your last show.</p>
    <div class="two"><div><p class="sub">Closest together</p><ul class="mini">${close.map(line).join('')}</ul></div>
    <div><p class="sub">Longest droughts</p><ul class="mini">${far.map(line).join('')}</ul></div></div></div>`;
}
export function newRepeatPanel(past, y0, y1){
  const seen = new Set(past.filter(s => !s.date).map(s => artistKey(s.artist)));
  const years = {};
  [...past].filter(s => s.date).sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
    const y = s.date.slice(0,4), k = artistKey(s.artist);
    years[y] = years[y] || {fresh:0, again:0};
    if (seen.has(k)) years[y].again++;
    else { years[y].fresh++; seen.add(k); }
  });
  const rows = [];
  for (let y = y0; y <= y1; y++) {
    const v = years[y] || {fresh:0, again:0};
    rows.push({label:`'${String(y).slice(2)}`, title:`${y}: ${v.fresh} new, ${v.again} repeat`, parts:[['seg-c', v.again], ['seg-m', v.fresh]]});
  }
  return `<div class="panel"><h3>New vs. repeat sets <span class="legend"><span><i style="background:var(--music)"></i>First time</span><span><i style="background:var(--comedy)"></i>Seen before</span></span></h3>${panelBars(rows, 130)}</div>`;
}
// Saw them lower on a bill, then later at the top of one
export function openerPanel(ns){
  const byArtist = new Map();
  ns.filter(n => n.date).forEach(n => n.acts.forEach((a, i) => {
    const k = artistKey(a.artist);
    if (!byArtist.has(k)) byArtist.set(k, {name:a.artist.trim(), opened:null, headlined:null});
    const r = byArtist.get(k);
    if (i > 0 && (!r.opened || n.date < r.opened)) r.opened = n.date;
    if (i === 0 && (!r.headlined || n.date > r.headlined)) r.headlined = n.date;
  }));
  const up = [...byArtist.values()].filter(r => r.opened && r.headlined && r.headlined > r.opened)
    .sort((a, b) => b.headlined.localeCompare(a.headlined));
  if (!up.length) return '';
  return `<div class="panel"><h3>Openers who came back to headline <span>${up.length}</span></h3><ul class="mini">${up.map(r =>
    `<li><button type="button" data-artist="${esc(r.name)}">${esc(r.name)}</button><span>opened ${r.opened.slice(0,4)} → headlined ${r.headlined.slice(0,4)}</span></li>`).join('')}</ul></div>`;
}
export function genrePanel(dated, rank){
  const all = new Map(), eras = {};
  dated.forEach(s => {
    const genres = state.INFO.artists?.[s.artist]?.genre || [];
    const era = Math.floor(+s.date.slice(0,4) / 5) * 5;
    genres.forEach(g => {
      all.set(g, (all.get(g) || 0) + 1);
      eras[era] = eras[era] || new Map();
      eras[era].set(g, (eras[era].get(g) || 0) + 1);
    });
  });
  if (!all.size) return '';
  const rows = Object.keys(eras).sort().reverse().map(e => {
    const top = [...eras[e]].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4);
    return `<div><b>${e}–${String(+e + 4).slice(2)}</b><p>${top.map(([g]) => `<em>${esc(g)}</em>`).join('')}</p></div>`;
  }).join('');
  return `<div class="two"><div class="panel"><h3>Top genres <span>sets</span></h3>${rank(all, 10)}</div>
    <div class="panel"><h3>How your taste moved</h3><div class="eras">${rows}</div></div></div>`;
}
export function agePanel(dated){
  const byArtist = new Map();
  dated.forEach(s => {
    const started = +yr(state.INFO.artists?.[s.artist]?.inception);
    if (!started) return;
    const age = Math.max(+s.date.slice(0,4) - started, 0);
    const r = byArtist.get(s.artist) || {name:s.artist, oldest:age, newest:age, ages:[], oldYear:s.date.slice(0,4), newYear:s.date.slice(0,4)};
    r.ages.push(age);
    if (age > r.oldest) { r.oldest = age; r.oldYear = s.date.slice(0,4); }
    if (age < r.newest) { r.newest = age; r.newYear = s.date.slice(0,4); }
    byArtist.set(s.artist, r);
  });
  const rows = [...byArtist.values()];
  if (!rows.length) return '';
  const every = rows.flatMap(r => r.ages);
  const avg = every.reduce((t, a) => t + a, 0) / every.length;
  const line = (r, n, y) => `<li><button type="button" data-artist="${esc(r.name)}">${esc(r.name)}</button><span>${plural(n,'yr')} in · ${y}</span></li>`;
  const veterans = [...rows].sort((a, b) => b.oldest - a.oldest).slice(0, 5).map(r => line(r, r.oldest, r.oldYear));
  const rookies = [...rows].sort((a, b) => a.newest - b.newest).slice(0, 5).map(r => line(r, r.newest, r.newYear));
  return `<div class="panel"><h3>How long the band had been going</h3>
    <p class="lede">On average, a band was <b>${avg.toFixed(1)} years</b> old when you saw them.</p>
    <div class="two"><div><p class="sub">Longest in the game</p><ul class="mini">${veterans.join('')}</ul></div>
    <div><p class="sub">Caught them early</p><ul class="mini">${rookies.join('')}</ul></div></div></div>`;
}
