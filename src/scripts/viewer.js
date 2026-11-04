import { MONTHS } from './state.js';
import { $, esc } from './util.js';
import { photoUrl } from './photos.js';

/* ---------- photo viewer: one photo at a time, with the night it's from ----------
   items: [{p: photo, n: night}]. Arrow keys and the side buttons step through them. */
let items = [], at = 0;

const when = d => {
  if (!d) return 'No date';
  return `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}`;
};

function draw(){
  const {p, n} = items[at];
  let steps = '';
  if (items.length > 1) steps = `<button type="button" class="vw-step prev" data-vw-step="-1" aria-label="Previous photo">‹</button>
    <button type="button" class="vw-step next" data-vw-step="1" aria-label="Next photo">›</button>
    <span class="vw-count">${at + 1} / ${items.length}</span>`;
  $('#viewer').innerHTML = `<figure>
      <img src="${esc(photoUrl(p))}" width="${p.width}" height="${p.height}" alt="Photo from ${esc(n.acts.map(a => a.artist).join(', '))}">
      <figcaption><b>${esc(n.acts.map(a => a.artist).join(' / '))}</b><span>${esc(n.venue)} · ${when(n.date)}</span></figcaption>
    </figure>${steps}
    <button type="button" class="vw-close" data-vw-close aria-label="Close">×</button>`;
}

export function openViewer(list, start = 0){
  if (!list.length) return;
  items = list; at = start;
  draw();
  const d = $('#viewer');
  if (!d.open) d.showModal();
}
export function stepViewer(by){
  if (items.length < 2) return;
  at = (at + by + items.length) % items.length;
  draw();
}
