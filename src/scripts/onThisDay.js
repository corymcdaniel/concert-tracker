// On this day: a strip of cards above the log for nights on this date (or this week) in earlier years.
// Each card shows your photo from that night, or the headliner's Wikipedia photo, or their initials.
// Which nights is worked out in memories.js.
import { imgUrl } from './info.js';
import { nightKey } from './log.js';
import { memories } from './memories.js';
import { nightPhotos, photoUrl } from './photos.js';
import { TODAY, state } from './state.js';
import { esc, place } from './util.js';

function ago(m){
  let years = `${m.yearsAgo} years`;
  if (m.yearsAgo === 1) years = 'A year';
  if (m.daysOff === 0) return `${years} ago today`;
  return `${years} ago this week`;
}
const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// past: the nights that have happened, grouped as the log groups them
export function onThisDay(past){
  const found = memories(past, TODAY);
  if (!found) return '';
  let heading = 'On this day';
  if (found.when === 'week') heading = 'This week, years ago';
  const cards = found.items.map((m, i) => {
    const n = m.night, head = n.acts[0];
    const photo = nightPhotos(n)[0];
    // Your own photo goes in now; an artist photo is painted in by paintOnThisDay once artist info has loaded
    let pic = `<span class="otd-pic" data-otd-artist="${esc(head.artist)}"><span class="otd-ph" aria-hidden="true">${esc(initials(head.artist))}</span></span>`;
    if (photo) pic = `<span class="otd-pic mine"><img src="${esc(photoUrl(photo, 200))}" alt="" loading="lazy"></span>`;
    let more = '';
    if (n.acts.length > 1) {
      let acts = `${n.acts.length - 1} more acts`;
      if (n.acts.length === 2) acts = '1 more act';
      more = `<span class="otd-more">+ ${acts}</span>`;
    }
    const where = [n.venue, place(n)].filter(Boolean).join(' · ');
    return `<li class="otd-card" data-order="${i}">${pic}<div class="otd-body">
      <span class="otd-ago">${ago(m)}</span>
      <button type="button" class="otd-artist" data-artist="${esc(head.artist)}" data-id="${esc(head.id)}">${esc(head.artist)}</button>
      ${more}<span class="otd-where">${esc(where)}</span>
      <button type="button" class="otd-jump" data-night="${esc(nightKey(n))}">See the ticket <span aria-hidden="true">↓</span></button>
    </div></li>`;
  }).join('');
  return `<section class="otd" aria-label="${heading}"><h2 class="otd-head"><span class="otd-star" aria-hidden="true">★</span>${heading}</h2><ul class="otd-list">${cards}</ul></section>`;
}

// Fills in artist photos once state.INFO has them. Safe to call again: cards that have one are skipped.
export function paintOnThisDay(){
  document.querySelectorAll('.otd-pic[data-otd-artist]').forEach(el => {
    if (el.querySelector('img')) return;
    const rec = state.INFO.artists?.[el.dataset.otdArtist];
    if (!rec?.img) return;
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('load', () => el.classList.add('loaded'));
    img.addEventListener('error', () => img.remove());
    img.src = imgUrl(rec.img, 240);
    el.append(img);
  });
}
