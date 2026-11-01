import { matchKey } from '../match.js';
import { state } from '../state.js';
import { esc } from '../util.js';

/* before & after the show: the sightings in listening.json come from scripts/build-listening.mjs */
const shortYear = date => `'${date.slice(2, 4)}`;
const entry = (r, value) => `<li><button type="button" data-artist="${esc(r.artist)}">${esc(r.artist)}</button><span>${esc(value)}</span></li>`;

export function aroundPanel(past){
  const rows = state.LISTEN?.sightings;
  if (!rows?.length) return '';
  const inLog = new Set(past.map(s => `${matchKey(s.artist)}|${s.date}`));
  const list = rows.filter(r => inLog.has(`${matchKey(r.artist)}|${r.date}`));
  const windows = list.filter(r => r.after !== null);
  const firsts = list.filter(r => r.first);
  if (!windows.length || !firsts.length) return '';

  const rose = windows.filter(r => r.after > r.before).length;
  const cold = firsts.filter(r => r.prior === 0);
  const bumps = [...windows].sort((a, b) => (b.after - b.before) - (a.after - a.before)).slice(0, 8);
  const found = cold.filter(r => r.later >= 10).sort((a, b) => b.later - a.later).slice(0, 8);
  const homework = [...firsts].sort((a, b) => b.prior - a.prior).slice(0, 8);

  let foundList = '';
  if (found.length) foundList = `<div><p class="sub">Discovered live</p><ul class="mini">${found.map(r => entry(r, `${r.later} plays since`)).join('')}</ul></div>`;
  return `<div class="panel"><h3>Before &amp; after the show <span>listening: Spotify</span></h3>
    <p class="lede">You played an act more in the month after seeing them at <b>${rose} of ${windows.length}</b> shows. Of ${firsts.length} acts you saw for the first time, you went in cold to <b>${cold.length}</b>.</p>
    <div class="three">
      <div><p class="sub">Biggest bumps, month before → after</p><ul class="mini">${bumps.map(r => entry(r, `${shortYear(r.date)} · ${r.before} → ${r.after}`)).join('')}</ul></div>
      ${foundList}
      <div><p class="sub">Did the homework, plays before first show</p><ul class="mini">${homework.map(r => entry(r, r.prior.toLocaleString())).join('')}</ul></div>
    </div></div>`;
}
