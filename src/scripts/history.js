import { api, loadRaw } from './api.js';
import { setState } from './auth.js';
import { loadInfo } from './info.js';
import { toast } from './motion.js';
import { closeSheet, openSheet } from './sheets.js';
import { state } from './state.js';
import { $, esc, place, withPlace } from './util.js';
import { render } from './view.js';

/* ---------- change history (database mode, editors) ---------- */
const SHOW_LABELS = {artist:'Artist', venue:'Venue', city:'City', state:'State', country:'Country', date:'Date', type:'Type', notes:'Notes', rating:'Rating', price:'Paid', companions:'Went with', festival:'Festival'};
const INFO_LABELS = {wiki:'Wikipedia page', desc:'Description', img:'Photo', note:'Note'};
const fmtVal = v => { if (v === null || v === undefined || v === '') return '—'; if (Array.isArray(v)) return v.join(', '); return String(v); };
function changeTitle(c){
  const r = c.after || c.before;
  if (c.table === 'shows') return `${r.artist} · ${r.venue || place(r) || 'No venue'} · ${r.date || 'Undated'}`;
  if (c.table === 'venues') return `Venue info: ${c.row.replace('|', ', ')}`;
  return `Artist info: ${c.row}`;
}
function changeVerb(c){
  if (c.undo_of) return `Undid change #${c.undo_of}`;
  if (c.action === 'insert') return 'Added';
  if (c.action === 'delete') return 'Deleted';
  return 'Edited';
}
// What changed, field by field, for an update
function changeDiff(c){
  if (c.action !== 'update') return [];
  if (c.table === 'shows') {
    const out = Object.keys(SHOW_LABELS).filter(k => fmtVal(c.before[k]) !== fmtVal(c.after[k]))
      .map(k => [SHOW_LABELS[k], fmtVal(c.before[k]), fmtVal(c.after[k])]);
    if (!out.length && c.after.sort_order < c.before.sort_order) out.push(['Billing order', 'moved up', '']);
    if (!out.length && c.after.sort_order > c.before.sort_order) out.push(['Billing order', 'moved down', '']);
    return out;
  }
  const b = c.before.info, a = c.after.info;
  if (!b && a) return [['Matched to', '—', a.wiki || a.desc || 'info']];
  if (b && !a) return [['Match removed', b.wiki || '', '']];
  return Object.keys(INFO_LABELS).filter(k => fmtVal(b?.[k]) !== fmtVal(a?.[k])).map(k => [INFO_LABELS[k], fmtVal(b?.[k]), fmtVal(a?.[k])]);
}
// Changes saved together become one history entry
function groupChanges(list){
  const groups = new Map();
  for (const c of list) {
    const k = c.batch || c.id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  return [...groups.values()];
}
function batchVerb(cs){
  if (cs[0].undo_of) return 'Undid bill change';
  if (cs.every(c => c.action === 'delete')) return 'Deleted bill';
  return 'Edited bill';
}
function batchTitle(cs){
  let changed = cs.filter(c => c.after);
  if (!changed.length) changed = cs;
  const acts = changed.map(c => c.after || c.before).sort((a, b) => a.sort_order - b.sort_order);
  return `${changeTitle({table:'shows', after:acts[0]})} + others`;
}
// What changed across the bill. A venue change touches every act but reads once.
function batchDiff(cs){
  const out = new Map();
  for (const c of cs) {
    let rows = changeDiff(c);
    if (c.action === 'insert') rows = [['Added', c.after.artist, '']];
    if (c.action === 'delete') rows = [['Removed', c.before.artist, '']];
    for (const r of rows) {
      let row = r;
      if (r[0] === 'Billing order') row = [r[0], `${c.after.artist} ${r[1]}`, ''];
      out.set(row.join('|'), row);
    }
  }
  return [...out.values()];
}
function changeItem(cs){
  const c = cs[0];
  let verb = changeVerb(c), what = changeTitle(c), rows = changeDiff(c), kind = c.action;
  if (cs.length > 1) {
    verb = batchVerb(cs); what = batchTitle(cs); rows = batchDiff(cs);
    if (!cs.every(x => x.action === c.action)) kind = 'update';
  }
  const when = new Date(c.at).toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'});
  const diff = rows.map(([f, from, to]) => {
    let val = esc(from);
    if (to) val = `<del>${esc(from)}</del> <span class="arrow">→</span> <ins>${esc(to)}</ins>`;
    return `<li><span class="f">${esc(f)}</span><span>${val}</span></li>`;
  }).join('');
  // A single act's history shows only its part of a bill change, but undo reverses all of it
  let undoLabel = 'Undo';
  if (c.batch_size > cs.length) undoLabel = 'Undo whole bill';
  let action = `<button type="button" data-undo="${c.id}">${undoLabel}</button>`;
  if (cs.some(x => x.undone)) action = '<span class="tag">Undone</span>';
  let diffList = '';
  if (diff) diffList = `<ul class="diff">${diff}</ul>`;
  return `<li class="change ${kind}">
    <div class="head"><span class="verb">${esc(verb)}</span><span class="what">${esc(what)}</span>${action}</div>
    ${diffList}
    <div class="meta">#${c.id} · ${esc(when)} · ${esc(c.by || 'unknown')}</div></li>`;
}
export async function openHistory(table, key, before){
  state.historyFor = {table, key};
  let title = 'All recent changes';
  if (table === 'shows') title = changeTitle({table, after: state.shows.find(s => s.id === key) || {artist:key}});
  else if (table) title = changeTitle({table, row: key, after: {}});
  if (!before) openSheet(`<h3>History</h3><p class="hint history-for">${esc(title)}</p><ol class="history" id="historyList"><li class="hint">Loading…</li></ol><div class="foot" id="historyMore"></div><div class="foot"><button type="button" data-close>Close</button></div>`);
  const q = new URLSearchParams();
  if (table) q.set('table', table);
  if (key) q.set('row', key);
  if (before) q.set('before', before);
  const res = await api('GET', '/api/changes?' + q);
  if (!res) { closeSheet(); return; }
  const list = $('#historyList'); if (!list) return;
  if (!before) list.innerHTML = '';
  list.insertAdjacentHTML('beforeend', groupChanges(res.changes).map(changeItem).join(''));
  if (!list.children.length) list.innerHTML = '<li class="hint">No changes yet.</li>';
  const last = res.changes[res.changes.length - 1];
  $('#historyMore').innerHTML = '';
  if (res.more) $('#historyMore').innerHTML = `<button type="button" data-history-more="${last.id}">Older changes</button>`;
  setState(state.user.name || state.user.email || 'Signed in');
}
export async function undoChange(id){
  if (await api('POST', `/api/changes/${id}/undo`) === null) return;
  toast('Change undone');
  await loadRaw(); state.shows = state.shows.map(withPlace); await loadInfo(); render();
  openHistory(state.historyFor.table, state.historyFor.key);
}
