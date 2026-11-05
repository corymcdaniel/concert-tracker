import { jumpToYear } from './endcap.js';
import { $ } from './util.js';

/* ---------- the year scroller: a Google Photos-style timeline down the right edge of the log, on desktop ----------
   Each year sits where it falls in the log, so busy years take more room. Drag the handle to scrub through the log
   (a bubble shows the year) or click a year to jump there. It stays quietly visible and brightens on hover or drag;
   nothing about it changes while you scroll except the handle's place.
   Positions are fractions of the scroll from the list's top to the end of the page (past the end-of-log section, so
   the oldest years, which all fit on the last screen of the list, still get their own places). Labels and the handle use the same scale, so the handle is on a year when that year is at the top. */
const MIN_GAP = 18;   // px between year labels on the track; years closer than this show as dots
let rail = null, track = null, years = [], frame = 0, dragging = false;

// Wide enough that the scroller sits in the empty space beside the 980px log, and something to point with
const desktop = () => matchMedia('(min-width: 1180px) and (any-hover: hover)').matches;
const list = () => $('#list');
// The list's top on the page, and how far the page can scroll from there to its end
function listBox(){
  const top = list().getBoundingClientRect().top + scrollY;
  return {top, range: Math.max(document.documentElement.scrollHeight - innerHeight - top, 1)};
}
const clamp01 = f => Math.min(Math.max(f, 0), 1);

// Where each year's header sits, on the scroll scale
function measure(){
  const box = listBox();
  years = [...list().querySelectorAll('.year[id^="y-"]')].map(head => ({
    year: head.id.slice(2),
    at: clamp01((head.getBoundingClientRect().top + scrollY - box.top) / box.range),
  }));
}

// Year labels at their places on the track (positions are 0-100% classes, so there are no inline styles).
// Labels too close to the one above become dots, so a crowded stretch stays readable.
function drawLabels(){
  const h = track.clientHeight;
  let lastPx = -Infinity;
  const marks = years.map(({year, at}) => {
    const px = at * h, pct = Math.round(at * 100);
    if (px - lastPx < MIN_GAP) return `<i class="yr-dot p${pct}" aria-hidden="true"></i>`;
    lastPx = px;
    return `<button type="button" class="yr-label p${pct}" data-rail-year="${year}" aria-label="Jump to ${year}">${year}</button>`;
  });
  $('#yearMarks').innerHTML = marks.join('');
}

// The handle follows the page: the fraction of the list that has scrolled past the top of the screen
function placeThumb(){
  const box = listBox();
  const f = clamp01((scrollY - box.top) / box.range);
  rail.style.setProperty('--pos', f.toFixed(4));
  $('#yearThumb').dataset.year = yearAt(f);
}

// The year at a fraction of the track: the last year whose header is at or above it
function yearAt(f){
  let y = years[0]?.year || '';
  for (const r of years) { if (r.at <= f + 0.001) y = r.year; }
  return y;
}

// Dragging: the pointer's place on the track becomes the page's place in the list
let grip = 0;   // where on the pill it was grabbed, so taking hold of it doesn't move the page
function scrubTo(clientY){
  clientY -= grip;
  const r = track.getBoundingClientRect();
  const f = clamp01((clientY - r.top) / r.height);
  const box = listBox();
  window.scrollTo({top: box.top + f * box.range, behavior: 'auto'});
}

function onScroll(){
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; placeThumb(); });
}

export function refreshYearRail(){
  if (!rail) return;
  measure();
  // No years to move between (a filter, or nothing logged yet): nothing to show
  rail.hidden = years.length < 2;
  if (rail.hidden) return;
  drawLabels();
  placeThumb();
}

export function initYearRail(){
  rail = $('#yearRail');
  if (!rail || !desktop()) return;
  track = $('#yearTrack');
  addEventListener('scroll', onScroll, {passive: true});
  // The page changes height as the log draws, filters and the end-of-log mosaic builds: re-measure whenever it does
  new ResizeObserver(refreshYearRail).observe(document.body);
  addEventListener('resize', refreshYearRail);

  // Keyboard only: a focused year label pressed with Enter or Space. Mouse presses are handled below, since the
  // track captures the pointer and a mouse click wouldn't reach the label.
  rail.addEventListener('click', e => {
    const b = e.target.closest('[data-rail-year]');
    if (b && e.detail === 0) jumpToYear(b.dataset.railYear);
  });
  // A press anywhere on the track, labels included, never starts a text selection. Pressing between the labels
  // scrubs straight away; pressing on a label scrubs once the pointer moves a few pixels, and otherwise jumps to
  // that year when released.
  let pressedYear = null, startY = 0;
  track.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    startY = e.clientY;
    pressedYear = e.target.closest('[data-rail-year]')?.dataset.railYear || null;
    if (pressedYear) return;
    // Grabbing the pill holds it where it is; pressing elsewhere on the track jumps the pill there
    const pill = $('#yearThumb').getBoundingClientRect();
    grip = 0;
    if (e.clientY >= pill.top - 4 && e.clientY <= pill.bottom + 4) grip = e.clientY - (pill.top + pill.height / 2);
    dragging = true;
    rail.classList.add('dragging');
    if (!grip) scrubTo(e.clientY);
  });
  track.addEventListener('pointermove', e => {
    if (!track.hasPointerCapture(e.pointerId)) return;
    if (pressedYear && Math.abs(e.clientY - startY) > 4) {
      pressedYear = null;
      grip = 0;
      dragging = true;
      rail.classList.add('dragging');
    }
    if (dragging) scrubTo(e.clientY);
  });
  const stop = () => {
    if (pressedYear) jumpToYear(pressedYear);
    pressedYear = null;
    dragging = false;
    rail.classList.remove('dragging');
  };
  track.addEventListener('pointerup', stop);
  track.addEventListener('pointercancel', () => { pressedYear = null; dragging = false; rail.classList.remove('dragging'); });
  refreshYearRail();
}
