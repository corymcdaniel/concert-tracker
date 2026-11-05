import { festivalDay, festivalOf } from '../festivals.js';
import { esc } from '../util.js';
import { plural } from './panels.js';

/* ---------- festivals: each one you've been to, and every year you went ---------- */
export function festivalPanel(nd, shows){
  const byName = new Map();
  nd.forEach(n => {
    const name = festivalOf(n);
    if (!name) return;
    const k = name.trim().toLowerCase();
    if (!byName.has(k)) byName.set(k, {name, nights: []});
    byName.get(k).nights.push(n);
  });
  if (!byName.size) return '';
  // Most years first, then most days
  const fests = [...byName.values()].map(f => {
    const years = new Map();
    f.nights.forEach(n => {
      const y = n.date.slice(0, 4);
      if (!years.has(y)) years.set(y, []);
      years.get(y).push(n);
    });
    return {...f, years: [...years.entries()].sort((a, b) => b[0].localeCompare(a[0]))};
  }).sort((a, b) => b.years.length - a.years.length || b.nights.length - a.nights.length || a.name.localeCompare(b.name));
  const days = fests.reduce((t, f) => t + f.nights.length, 0);

  const card = f => {
    const acts = f.nights.reduce((t, n) => t + n.acts.length, 0);
    const rows = f.years.map(([y, list]) => {
      list.sort((a, b) => a.date.localeCompare(b.date));
      // The day's headliner, labelled with its day when the run had more than one
      const heads = list.map(n => {
        let day = '';
        const {day: d, of} = festivalDay(shows, f.name, n.date);
        if (of > 1 && d) day = `<i>Day ${d}</i>`;
        return `<span>${day}<button type="button" data-artist="${esc(n.acts[0].artist)}">${esc(n.acts[0].artist)}</button></span>`;
      }).join('');
      const yearActs = list.reduce((t, n) => t + n.acts.length, 0);
      let where = '';
      const venues = [...new Set(list.map(n => n.venue).filter(Boolean))].join(', ');
      if (venues) where = ` · ${esc(venues)}`;
      return `<li><span class="fc-yr">${y}</span>
        <span class="fc-what"><span class="fc-heads">${heads}</span><small>${plural(yearActs, 'act')}${where}</small></span></li>`;
    }).join('');
    return `<div class="fest-card"><p class="fc-name"><b>${esc(f.name)}</b><span>${plural(f.years.length, 'year')} · ${plural(f.nights.length, 'day')} · ${plural(acts, 'act')}</span></p><ol>${rows}</ol></div>`;
  };
  return `<div class="panel"><h3>Festivals <span>${plural(fests.length, 'festival')} · ${plural(days, 'day')}</span></h3>
    <div class="fests">${fests.map(card).join('')}</div></div>`;
}
