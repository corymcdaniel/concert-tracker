import { openLogin, setState } from './auth.js';
import { toast } from './motion.js';
import { API, KEY, state } from './state.js';
import { $, store, withPlace } from './util.js';
import { render } from './view.js';
import { fillMissingArtists } from './autoinfo.js';

export async function load(){ await loadRaw(); state.shows = state.shows.map(withPlace); }
export async function loadRaw(){
  try {
    const r = await fetch(API, {cache:'no-store'});
    if (r.ok && (r.headers.get('content-type')||'').includes('json')) { const d = await r.json(); if (Array.isArray(d)) { state.shows = d; state.mode='netlify'; return; } }
  } catch {}
  const local = store.get(KEY);
  if (local) { try { state.shows = JSON.parse(local); state.mode='local';
    return; } catch {} }
  try { const r = await fetch('shows.json', {cache:'no-store'}); if (r.ok) { const d = await r.json(); if (Array.isArray(d)) { state.shows = d; return; } } } catch {}
  state.shows = []; state.mode='local';
}

// Send one change to the database. Returns the response JSON, or null if it wasn't saved.
export async function api(method, url, body){
  if (!state.user) { setState('Not saved: sign in to edit'); openLogin('Sign in to save your changes.'); return null; }
  setState('Saving…');
  try {
    const init = {method, credentials:'same-origin', headers:{'content-type':'application/json'}};
    if (body !== undefined) init.body = JSON.stringify(body);
    const r = await fetch(url, init);
    if (r.status === 401) { setState('Not saved: session expired'); openLogin('Your session expired. Sign in again to save.'); return null; }
    if (r.status === 403) { setState('Not saved: this account can’t edit'); toast('This account doesn’t have edit access.'); return null; }
    if (r.status === 400 || r.status === 409) { setState('Not saved'); toast(await r.text()); return null; }
    if (!r.ok) throw new Error(r.status);
    setState('Saved');
    return await r.json();
  } catch(e){ setState('Save failed. Check your connection and try again.'); return null; }
}
// op = {method, url, body} for the database; local mode saves the whole list in this browser.
// If the database refuses a change, reload so the page shows what's really saved.
export async function persist(op){
  if (state.mode !== 'netlify') { store.set(KEY, JSON.stringify(state.shows)); setState('Saved in this browser'); fillMissingArtists(); return; }
  if (await api(op.method, op.url, op.body) === null) { await loadRaw(); state.shows = state.shows.map(withPlace); render(); return; }
  // A new artist on this save gets looked up on Wikipedia
  fillMissingArtists();
}
