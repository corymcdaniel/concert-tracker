import { trackView } from './analytics.js';
import { renderEnd } from './endcap.js';
import { renderList, renderStats } from './log.js';
import { checkNewPins, renderPinsView } from './pinsView.js';
import { state } from './state.js';
import { renderStatsView } from './stats/index.js';
import { $ } from './util.js';

const SECTIONS = ['recent', 'upcoming', 'overview', 'artists', 'places', 'listening'];
const VIEWS = ['log', 'stats', 'pins'];
export const statsHash = () => { if (state.statsSection) return `#stats/${state.statsSection}`; return '#stats'; };
// undefined: not a stats link. null: the landing cards.
const sectionFromHash = hash => {
  const m = /^#stats(?:\/(\w+))?$/.exec(hash);
  if (!m) return undefined;
  if (SECTIONS.includes(m[1])) return m[1];
  return null;
};
// The address for the view on screen: the log is the bare page
function viewHash(){
  if (state.view === 'stats') return statsHash();
  if (state.view === 'pins') return '#pins';
  return location.pathname + location.search;
}
export function setView(v, section = null){
  state.view = 'log';
  if (VIEWS.includes(v)) state.view = v;
  state.statsSection = section;
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected', b.dataset.view===state.view));
  $('#logView').hidden = state.view!=='log'; $('#statsView').hidden = state.view!=='stats'; $('#pinsView').hidden = state.view!=='pins';
  // The floating button offers the log from anywhere else, and stats from the log
  let other = 'Log';
  if (state.view === 'log') other = 'Stats';
  $('#toView').textContent = other;
  $('#toView').setAttribute('aria-label', `Go to ${other}`);
  if (state.view==='stats') renderStatsView();
  if (state.view==='pins') renderPinsView();
  try { history.replaceState(null,'', viewHash()); } catch {}
  trackView();
}
export function render(){
  renderStats(); renderList(); renderEnd();
  if (state.view==='stats') renderStatsView();
  if (state.view==='pins') renderPinsView();
  // An edit can earn a pin
  checkNewPins();
}

// Moving between the cards and a section is a real step, so the browser's back button undoes it
export function openStatsSection(section){
  state.statsSection = section || null;
  try { history.pushState(null, '', statsHash()); } catch {}
  renderStatsView();
  const tabs = $('.tabs');
  if (tabs.getBoundingClientRect().top < 0) tabs.scrollIntoView();
  $('#statsView .subnav [aria-current]')?.focus({preventScroll: true});
  trackView();
}
export function followHash(){
  if (location.hash === '#pins') { setView('pins'); return; }
  const section = sectionFromHash(location.hash);
  if (section === undefined) setView('log');
  else setView('stats', section);
}
// A link straight into stats, the pins or a Year in review, which need everything loaded first
export const opensStats = () => sectionFromHash(location.hash) !== undefined || location.hash === '#pins' || /^#review-d{4}$/.test(location.hash);
export function followStatsLink(){
  if (location.hash === '#pins') { setView('pins'); return; }
  const section = sectionFromHash(location.hash);
  if (section !== undefined) setView('stats', section);
}
