import { openLogin, setState } from './auth.js';
import { nights } from './log.js';
import { toast } from './motion.js';
import { state } from './state.js';
import { happened } from './util.js';

/* ---------- your photos, tied to nights (netlify/functions/photos.mjs) ----------
   A photo hangs off one act; it belongs to whichever night that act is in.
   Before upload each photo is redrawn on a canvas: that resizes it and drops all its metadata, location included. */
export const PER_NIGHT = 6;
const MAX_SIDE = 1600;
const QUALITY = .82;

// The photos list, newest last. Local mode has no server to keep them, so none.
export async function loadPhotos(){
  state.PHOTOS = [];
  if (state.mode !== 'netlify') return;
  try {
    const r = await fetch('/api/photos', {cache: 'no-store'});
    if (r.ok) state.PHOTOS = await r.json();
  } catch {}
}
export const photosOn = () => state.mode === 'netlify';
export const photoUrl = p => `/api/photos/${encodeURIComponent(p.id)}`;
export function nightPhotos(n){
  const ids = new Set(n.acts.map(a => a.id));
  return (state.PHOTOS || []).filter(p => ids.has(p.show_id));
}

// Random each visit, but steady while you're on the page: every photo draws one number the first time it's seen
const draw = new Map();
const rand = id => { if (!draw.has(id)) draw.set(id, Math.random()); return draw.get(id); };
// One photo per night, nights in a random order: [{n, url}]
export function mosaicPhotos(all){
  const picks = [];
  all.filter(happened).forEach(n => {
    const mine = nightPhotos(n);
    if (!mine.length) return;
    const p = [...mine].sort((a, b) => rand(a.id) - rand(b.id))[0];
    picks.push({n, p, url: photoUrl(p)});
  });
  return picks.sort((a, b) => rand(a.p.id) - rand(b.p.id));
}

// Resize to fit MAX_SIDE and re-encode. WebP where the browser can make it, JPEG otherwise (older Safari).
async function prepare(file){
  let bitmap;
  try { bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'}); }
  catch { throw new Error(`${file.name} isn't a photo this browser can open. HEIC from an iPhone opens in Safari, or export it as JPEG.`); }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const encode = type => new Promise(res => canvas.toBlob(res, type, QUALITY));
  let blob = await encode('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg');
  if (!blob) throw new Error(`Couldn't read ${file.name}.`);
  return {blob, w, h};
}

// Upload files to the night of act `showId`, one at a time. Calls onEach after each one lands.
export async function uploadPhotos(showId, files, onEach = () => {}){
  const night = nights(state.shows).find(n => n.acts.some(a => a.id === showId));
  if (!night) return;
  const room = PER_NIGHT - nightPhotos(night).length;
  const list = [...files].filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  if (!list.length) { toast('Pick a photo to upload.'); return; }
  if (room <= 0) { toast(`This night already has ${PER_NIGHT} photos.`); return; }
  if (list.length > room) toast(`Only ${room} more fit on this night, so the rest were skipped.`);
  let done = 0;
  for (const file of list.slice(0, room)) {
    setState(`Uploading photo ${done + 1} of ${Math.min(list.length, room)}…`);
    let ready;
    try { ready = await prepare(file); } catch (e) { toast(e.message); continue; }
    const q = new URLSearchParams({show: showId, w: ready.w, h: ready.h});
    let r;
    try { r = await fetch(`/api/photos?${q}`, {method: 'POST', credentials: 'same-origin', headers: {'content-type': ready.blob.type}, body: ready.blob}); }
    catch { toast('Upload failed. Check your connection and try again.'); break; }
    if (r.status === 401) { openLogin('Sign in to upload photos.'); break; }
    if (!r.ok) { toast(await r.text()); break; }
    state.PHOTOS.push(await r.json());
    done++;
    onEach();
  }
  setState('Saved');
  if (done === 1) toast('Photo added');
  else if (done > 1) toast(`${done} photos added`);
}

export async function deletePhoto(id){
  let r;
  try { r = await fetch(`/api/photos/${encodeURIComponent(id)}`, {method: 'DELETE', credentials: 'same-origin'}); }
  catch { toast('Couldn’t delete it. Check your connection.'); return false; }
  if (r.status === 401) { openLogin('Sign in to delete photos.'); return false; }
  if (!r.ok && r.status !== 404) { toast(await r.text()); return false; }
  state.PHOTOS = state.PHOTOS.filter(p => p.id !== id);
  toast('Photo deleted');
  return true;
}
