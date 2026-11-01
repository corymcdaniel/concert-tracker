import { canEdit } from '../auth.js';
import { money, nightVal } from '../log.js';
import { panelBars, plural } from './panels.js';
import { esc } from '../util.js';

/* ratings, spending and companions: entered per night on Edit bill */
export function ratingPanel(nd){
  const rated = nd.map(n => ({n, r:nightVal(n, 'rating')})).filter(x => x.r);
  if (!rated.length) return '';
  const avg = rated.reduce((t, x) => t + x.r, 0) / rated.length;
  const best = [...rated].sort((a, b) => b.r - a.r || b.n.date.localeCompare(a.n.date)).slice(0, 5);
  const venues = new Map();
  rated.forEach(({n, r}) => {
    if (!n.venue) return;
    const v = venues.get(n.venue) || {sum:0, c:0};
    v.sum += r; v.c++; venues.set(n.venue, v);
  });
  const favVenues = [...venues].filter(([, v]) => v.c > 1).sort((a, b) => b[1].sum / b[1].c - a[1].sum / a[1].c).slice(0, 5);
  let venueHtml = '<p class="hint">Rate two nights at a venue to rank it here.</p>';
  if (favVenues.length) venueHtml = `<ul class="mini">${favVenues.map(([k, v]) => `<li>${esc(k)}<span>★ ${(v.sum / v.c).toFixed(1)} · ${plural(v.c,'night')}</span></li>`).join('')}</ul>`;
  return `<div class="panel"><h3>Your ratings <span>${plural(rated.length,'night')}</span></h3>
    <p class="lede">Your average night is <b>★ ${avg.toFixed(1)}</b>.</p>
    <div class="two"><div><p class="sub">Best nights</p><ul class="mini">${best.map(({n, r}) =>
      `<li><button type="button" data-artist="${esc(n.acts[0].artist)}">${esc(n.acts[0].artist)}</button><span>${'★'.repeat(r)} · ${n.date.slice(0,4)}</span></li>`).join('')}</ul></div>
    <div><p class="sub">Favorite venues</p>${venueHtml}</div></div></div>`;
}
export function spendingPanel(nd){
  const paid = nd.map(n => ({n, p:nightVal(n, 'price')})).filter(x => x.p !== undefined);
  if (!paid.length) return '';
  const total = paid.reduce((t, x) => t + x.p, 0);
  const acts = paid.reduce((t, x) => t + x.n.acts.length, 0);
  const priciest = [...paid].sort((a, b) => b.p - a.p)[0];
  const value = paid.filter(x => x.p > 0).sort((a, b) => a.p / a.n.acts.length - b.p / b.n.acts.length)[0];
  const years = {};
  paid.forEach(x => { const y = x.n.date.slice(0,4); years[y] = (years[y] || 0) + x.p; });
  const rows = Object.keys(years).sort().map(y => ({label:`'${y.slice(2)}`, title:`${y}: ${money(years[y])}`, parts:[['seg-m', Math.round(years[y])]]}));
  const cards = [
    [money(total), 'Spent', `Across ${plural(paid.length,'night')} with a price`],
    [money(total / paid.length), 'Per night', ''],
    [money(total / acts), 'Per act', `${plural(acts,'act')} seen`],
    [money(priciest.p), 'Priciest night', esc(priciest.n.acts[0].artist)],
  ];
  if (value) cards.push([money(value.p / value.n.acts.length), 'Best value per act', esc(value.n.acts[0].artist)]);
  return `<div class="panel"><h3>Spending <span>signed-in only</span></h3>
    <div class="hl">${cards.map(([b, l, p]) => `<div><span>${l}</span><b>${b}</b><p>${p}</p></div>`).join('')}</div>${panelBars(rows, 120)}</div>`;
}
export function companionPanel(ns){
  const people = new Map();
  ns.forEach(n => {
    const who = nightVal(n, 'companions'); if (!who) return;
    who.split(/,|;|&|\band\b/i).map(x => x.trim()).filter(Boolean).forEach(p => people.set(p, (people.get(p) || 0) + 1));
  });
  if (!people.size) return '';
  const top = [...people].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
  return `<div class="panel"><h3>Who you went with <span>signed-in only</span></h3><ul class="mini">${top.map(([p, c]) => `<li>${esc(p)}<span>${plural(c,'night')}</span></li>`).join('')}</ul></div>`;
}
export function extrasHint(nd){
  if (!canEdit() || nd.some(n => nightVal(n, 'rating') || nightVal(n, 'price') !== undefined)) return '';
  return `<div class="panel"><p class="hint">Add a rating, ticket price or who you went with from <b>Edit bill</b> on any stub, and your stats for them appear here.</p></div>`;
}
