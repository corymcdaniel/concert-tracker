import { renderList, renderStats } from './log.js';
import { state } from './state.js';
import { renderStatsView } from './stats/index.js';
import { $ } from './util.js';

export function setView(v){
  state.view = v === 'stats' ? 'stats' : 'log';
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected', b.dataset.view===state.view));
  $('#logView').hidden = state.view!=='log'; $('#statsView').hidden = state.view!=='stats';
  if (state.view==='stats') renderStatsView();
  try { history.replaceState(null,'', state.view==='stats' ? '#stats' : location.pathname + location.search); } catch {}
}
export function render(){ renderStats(); renderList(); if (state.view==='stats') renderStatsView(); }
