import { imgUrl } from '../info.js';
import { nightPhotos, photoUrl } from '../photos.js';
import { MONTHS, state } from '../state.js';
import { esc } from '../util.js';

/* ---------- same day, different year: calendar dates you've been out on in more than one year ---------- */
const CARDS = 12;

const dayLabel = md => `${MONTHS[+md.slice(0, 2) - 1]} ${+md.slice(3, 5)}`;

// Your own photo from the night if there is one, else the headliner's Wikimedia photo, else their initials
function thumb(n){
  const own = nightPhotos(n)[0];
  let src = '';
  if (own) src = photoUrl(own);
  else {
    const img = state.INFO.artists?.[n.acts[0].artist]?.img;
    if (img) src = imgUrl(img, 160);
  }
  const initials = n.acts[0].artist.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  let pic = '';
  if (src) pic = `<img loading="lazy" src="${esc(src)}" alt="" onerror="this.remove()">`;
  return `<span class="sd-pic" aria-hidden="true"><span>${esc(initials)}</span>${pic}</span>`;
}

function card({md, list}){
  const rows = list.map(n => {
    let more = '';
    if (n.acts.length > 1) more = ` <i class="sd-plus">+${n.acts.length - 1}</i>`;
    return `<li>${thumb(n)}
      <span class="sd-yr">${n.date.slice(0, 4)}</span>
      <span class="sd-what"><span><button type="button" data-artist="${esc(n.acts[0].artist)}">${esc(n.acts[0].artist)}</button>${more}</span><small>${esc(n.venue || 'Unknown venue')}</small></span></li>`;
  }).join('');
  return `<div class="sd-card"><p class="sd-day"><b>${dayLabel(md)}</b><span>${list.length} years</span></p><ol>${rows}</ol></div>`;
}

export function sameDayPanel(nd){
  const byDay = new Map();
  nd.forEach(n => {
    const md = n.date.slice(5, 10);
    if (!byDay.has(md)) byDay.set(md, new Map());
    // One night per year on a date is enough to count it
    const years = byDay.get(md), y = n.date.slice(0, 4);
    if (!years.has(y)) years.set(y, n);
  });
  const days = [...byDay].filter(([, years]) => years.size > 1)
    .map(([md, years]) => ({md, list: [...years.values()].sort((a, b) => a.date.localeCompare(b.date))}))
    .sort((a, b) => b.list.length - a.list.length || a.md.localeCompare(b.md));
  if (!days.length) return '';
  const top = days.slice(0, CARDS), rest = days.slice(CARDS);
  let more = '';
  if (rest.length) more = `<div class="bucket-more"><p class="sub">More dates</p><ul class="mini">${rest.map(({md, list}) =>
    `<li><span>${dayLabel(md)}</span><span>${list.map(n => `'${n.date.slice(2, 4)}`).join(' · ')}</span></li>`).join('')}</ul></div>`;
  const best = days[0];
  return `<div class="panel"><h3>Same day, different year <span>${days.length} dates</span></h3>
    <p class="lede"><b>${days.length}</b> dates on the calendar have a show in more than one year. <b>${dayLabel(best.md)}</b> leads with ${best.list.length}.</p>
    <div class="sd-grid">${top.map(card).join('')}</div>${more}</div>`;
}
