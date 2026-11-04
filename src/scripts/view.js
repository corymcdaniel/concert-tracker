import { renderList, renderStats } from './log.js';
import { state } from './state.js';
import { renderStatsView } from './stats/index.js';
import { $ } from './util.js';

const SECTIONS = ['overview', 'artists', 'places', 'listening'];
export const statsHash = () => { if (state.statsSection) return `#stats/${state.statsSection}`; return '#stats'; };
// undefined: not a stats link. null: the landing cards.
const sectionFromHash = hash => {
  const m = /^#stats(?:\/(\w+))?$/.exec(hash);
  if (!m) return undefined;
  if (SECTIONS.includes(m[1])) return m[1];
  return null;
};
export function setView(v, section = null){
  state.view = v === 'stats' ? 'stats' : 'log';
  state.statsSection = section;
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected', b.dataset.view===state.view));
  $('#logView').hidden = state.view!=='log'; $('#statsView').hidden = state.view!=='stats';
  if (state.view==='stats') renderStatsView();
  try { history.replaceState(null,'', state.view==='stats' ? statsHash() : location.pathname + location.search); } catch {}
}
export function render(){ renderStats(); renderList(); if (state.view==='stats') renderStatsView(); }

// Moving between the cards and a section is a real step, so the browser's back button undoes it
export function openStatsSection(section){
  state.statsSection = section || null;
  try { history.pushState(null, '', statsHash()); } catch {}
  renderStatsView();
  const tabs = $('.tabs');
  if (tabs.getBoundingClientRect().top < 0) tabs.scrollIntoView();
  $('#statsView .subnav [aria-current]')?.focus({preventScroll: true});
}
export function followHash(){
  const section = sectionFromHash(location.hash);
  if (section === undefined) setView('log');
  else setView('stats', section);
}
export function followStatsLink(){
  const section = sectionFromHash(location.hash);
  if (section !== undefined) setView('stats', section);
}
