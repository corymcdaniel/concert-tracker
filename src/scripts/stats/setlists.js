import { api } from '../api.js';
import { canEdit } from '../auth.js';
import { toast } from '../motion.js';
import { TODAY, state } from '../state.js';
import { fmt, renderStatsView } from './index.js';
import { matchKey, songKey } from '../match.js';
import { plural } from './panels.js';
import { esc } from '../util.js';

/* setlists: from setlist.fm through /api/setlists */
let SETS = {sets:[], checked:0};
let FIRST_PLAYS = null;
export async function loadSetlists(){
  if (state.mode !== 'netlify') return;
  try { const r = await fetch('/api/setlists', {cache:'no-store'}); if (r.ok) SETS = await r.json(); } catch {}
  if (!SETS.sets.length) return;
  await loadFirstPlays();
}
// When you first played each song, by artist: {matchKey: {songKey: date}}
let firstPlaysLoading = null;
export function loadFirstPlays(){
  if (!firstPlaysLoading) firstPlaysLoading = (async () => {
    try { const r = await fetch('listening-songs.json'); if (r.ok) FIRST_PLAYS = await r.json(); } catch {}
    return FIRST_PLAYS;
  })();
  return firstPlaysLoading;
}
export function setlistPanel(rank){
  const sync = `<button type="button" class="edit-only" id="syncSets">Check setlist.fm</button>`;
  if (state.mode !== 'netlify') return '';
  if (!SETS.sets.length) {
    if (!canEdit()) return '';
    return `<div class="panel"><h3>Songs you've heard</h3><p class="lede">No setlists loaded yet. This looks up each music act on setlist.fm, about one per second.</p>${sync}</div>`;
  }
  const songs = new Map(), covers = new Map();
  let heard = 0;
  SETS.sets.forEach(set => set.songs.forEach(song => {
    heard++;
    const k = `${song.name} · ${set.artist}`;
    songs.set(k, (songs.get(k) || 0) + 1);
    if (song.cover) covers.set(`${song.name} (${song.cover}) · ${set.artist}`, 1);
  }));
  const coverList = [...covers.keys()].slice(0, 8);
  let coverHtml = '';
  if (coverList.length) coverHtml = `<div><p class="sub">Covers you caught</p><ul class="mini">${coverList.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
  return `<div class="panel"><h3>Songs you've heard <span><a href="https://www.setlist.fm" target="_blank" rel="noopener">Data: setlist.fm</a></span></h3>
    <p class="lede"><b>${heard.toLocaleString()} songs</b> across ${plural(SETS.sets.length,'setlist')}, ${songs.size.toLocaleString()} of them different.</p>
    <div class="two"><div><p class="sub">Heard most</p>${rank(songs, 10)}</div>${coverHtml}</div>
    <div class="maprow">${sync}</div></div>`;
}
/* did you know the songs: listening-songs.json comes from scripts/build-listening.mjs */
export function knownPanel(){
  if (!FIRST_PLAYS || !state.LISTEN) return '';
  // Spotify history can't say what you knew before it began
  const since = `${+state.LISTEN.from + 1}-01-01`;
  const rows = SETS.sets.filter(s => s.date >= since && s.date < TODAY && s.songs.length).map(s => {
    const first = FIRST_PLAYS[matchKey(s.artist)] || {};
    const known = s.songs.filter(song => first[songKey(song.name)] < s.date).length;
    return {artist: s.artist, date: s.date, known, total: s.songs.length};
  });
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  if (!total) return '';
  const known = rows.reduce((sum, r) => sum + r.known, 0);
  const full = rows.filter(r => r.total >= 8);
  const score = r => r.known / r.total;
  const line = r => `<li><button type="button" data-artist="${esc(r.artist)}">${esc(r.artist)}</button><span>'${r.date.slice(2, 4)} · ${r.known}/${r.total}</span></li>`;
  const best = [...full].sort((a, b) => score(b) - score(a) || b.total - a.total).slice(0, 8);
  const least = [...full].sort((a, b) => score(a) - score(b) || b.total - a.total).slice(0, 8);
  return `<div class="panel"><h3>Did you know the songs? <span>Spotify + setlist.fm</span></h3>
    <p class="lede">You'd already played <b>${Math.round(known / total * 100)}%</b> of the ${total.toLocaleString()} songs in ${plural(rows.length,'setlist')} before the show.</p>
    <div class="two"><div><p class="sub">Knew every word</p><ul class="mini">${best.map(line).join('')}</ul></div>
    <div><p class="sub">Heard it there first</p><ul class="mini">${least.map(line).join('')}</ul></div></div></div>`;
}
export async function syncSetlists(btn){
  btn.disabled = true;
  let limited = 0;
  for (;;) {
    const r = await api('POST', '/api/setlists/sync', {});
    if (!r) break;
    // setlist.fm allows a couple of requests a second; the round trip itself spaces the retries out
    if (r.rateLimited) { limited++; if (limited > 5) { toast('setlist.fm is rate limiting. Try again in a minute.'); break; } continue; }
    limited = 0;
    if (!r.remaining) { toast('Setlists are up to date'); break; }
    btn.textContent = `Checking… ${r.remaining} left`;
  }
  await loadSetlists();
  if (state.view === 'stats') renderStatsView();
}
// The synced setlist for an act on a date, or null
export const setlistFor = (artist, date) => SETS.sets.find(s => s.artist === artist && s.date === date) || null;
export function artistSongs(name){
  const sets = SETS.sets.filter(s => s.artist === name && s.date < TODAY);
  if (!sets.length) return '';
  const songs = new Map();
  sets.forEach(set => set.songs.forEach(song => songs.set(song.name, (songs.get(song.name) || 0) + 1)));
  const top = [...songs].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
  const links = sets.filter(s => s.url).map(s => `<li><span>${fmt(s.date)}</span><span><a href="${esc(s.url)}" target="_blank" rel="noopener">Setlist on setlist.fm ↗</a></span></li>`).join('');
  return `<div class="seen"><h4>Songs you've heard · ${songs.size}</h4><ul>${top.map(([song, c]) => { let times = ''; if (c > 1) times = `×${c}`; return `<li><span>${times}</span><span>${esc(song)}</span></li>`; }).join('')}${links}</ul></div>`;
}
