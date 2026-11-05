import { track } from './analytics.js';
import { api } from './api.js';
import { dayLabel } from './festivals.js';
import { nights } from './log.js';
import { hide, isOpen, motionOK, show, toast } from './motion.js';
import { closeSheet, openSheet } from './sheets.js';
import { MONTHS, state } from './state.js';
import { fmt } from './stats/index.js';
import { artistSongs } from './stats/setlists.js';
import { fillSpotify, spotifySlot } from './stats/spotify.js';
import { nightPhotos, photoUrl } from './photos.js';
import { openViewer } from './viewer.js';
import { $, esc, happened, place, store } from './util.js';

/* ---------- artist & venue info ---------- */

const infoKey = (kind, name) => kind==='artists' ? name : name;
export async function loadInfo(){
  try { if (state.mode==='netlify'){ const r = await fetch('/api/info',{cache:'no-store'}); if (r.ok){ state.INFO = await r.json(); return; } } } catch {}
  try { const saved = JSON.parse(store.get('show-log-info-v2') || 'null'); if (saved) { state.INFO = saved; return; } } catch {}
  try { const r = await fetch('info.json', {cache:'no-store'}); if (r.ok) state.INFO = await r.json(); } catch {}
}
export async function saveInfo(kind, key){
  if (state.mode !== 'netlify'){ store.set('show-log-info-v2', JSON.stringify(state.INFO)); return true; }
  return await api('PUT', '/api/info', {kind, key, info: state.INFO[kind][key]}) !== null;
}
export const imgUrl = (img, w=800) => { if(!img) return ''; const [f,wiki] = img.split('|'); return `https://${wiki==='en'?'en.wikipedia.org':'commons.wikimedia.org'}/wiki/Special:FilePath/${encodeURIComponent(f)}?width=${w}`; };
const fileUrl = img => { const [f,wiki] = img.split('|'); return `https://${wiki==='en'?'en.wikipedia.org':'commons.wikimedia.org'}/wiki/File:${encodeURIComponent(f)}`; };
const wikiUrl = t => `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g,'_'))}`;
export const yr = d => d ? String(d).slice(0,4) : '';
const fmtFull = d => { if(!d) return ''; const p=String(d).split('-'); return p.length===3 ? fmt(d) : p.length===2 ? `${MONTHS[+p[1]-1]} ${p[0]}` : p[0]; };
let infoReq = 0;
// A sighting at a festival: its name (and day, for a run of several) ahead of the venue
function festTag(s){
  if (!s.festival) return '';
  let day = '';
  const label = dayLabel(state.shows, s.festival, s.date);
  if (label) day = ` · ${label}`;
  return `<b class="fest-tag">${esc(s.festival)}${day}</b> `;
}
export function openInfo(kind, key, actId){
  // Venue keys are "name|city"; GA gets the readable name
  let item = 'artist';
  if (kind !== 'artists') item = 'venue';
  track(`open_${item}`, {name: key.split('|')[0]});
  const isA = kind==='artists';
  // Bucket list artists aren't in the log, so their page and photo come from listening.json
  let rec = state.INFO[kind]?.[key] || null;
  if (!rec && isA) rec = state.LISTEN?.artists.find(a => a.name === key && a.wiki) || null;
  const [vName, vCity] = isA ? [key,''] : key.split('|');
  const title = isA ? key : vName;
  const facts = [];
  if (rec){
    const F = (l,v) => v && facts.push([l,v]);
    if (isA){
      F('Formed', [yr(rec.inception), rec.dissolved?`– ${yr(rec.dissolved)}`:''].join(' ').trim());
      F('From', [rec.formed_in, rec.country].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).join(', '));
      F('Born', rec.born ? `${fmtFull(rec.born)}${rec.birthplace?`, ${rec.birthplace}`:''}` : '');
      if (!rec.born && !rec.formed_in) F('From', rec.birthplace || rec.citizenship);
      F('Genres', (rec.genre||[]).join(', '));
    } else {
      F('Opened', fmtFull(rec.opened));
      F('Capacity', rec.capacity ? Number(rec.capacity).toLocaleString() : '');
      F('Also known as', (rec.aka||[]).join(', '));
    }
    F('Website', rec.website ? `<a href="https://${esc(rec.website)}" target="_blank" rel="noopener">${esc(rec.website)}</a>` : '');
  }
  // your history with them
  const mine = state.shows.filter(s => isA ? s.artist===key : (s.venue===vName && s.city===vCity))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const rows = (list, soonestFirst) => isA
    ? list.map(s=>`<li><span>${s.date?fmt(s.date):'No date'}</span><span>${festTag(s)}${esc(s.venue)}, ${esc(place(s))}</span></li>`)
    : (soonestFirst ? nights(list).reverse() : nights(list)).map(n=>`<li><span>${n.date?fmt(n.date):'No date'}</span><span>${n.acts.map(a=>esc(a.artist)).join(' / ')}</span></li>`);
  const seen = mine.filter(happened), coming = mine.filter(s=>!happened(s)).reverse();
  const seenN = isA ? seen.length : nights(seen).length, comingN = isA ? coming.length : nights(coming).length;
  const initials = title.replace(/^the\s+/i,'').split(/\s+/).map(w=>w[0]).join('').slice(0,2);
  const box = $('#info');
  box.innerHTML = `
    <div class="hero">${rec?.img?`<img src="${imgUrl(rec.img)}" alt="${esc(title)}" onload="this.parentNode.classList.add('loaded')" onerror="this.remove()">`:''}<div class="ph" aria-hidden="true">${esc(initials)}</div>
      ${rec?.img?`<div class="credit"><a href="${fileUrl(rec.img)}" target="_blank" rel="noopener" id="credit">Photo: Wikimedia Commons</a></div>`:''}
      <button type="button" class="x" data-close-info aria-label="Close">×</button></div>
    <div class="ib">
      <div><h2>${esc(title)}</h2><div class="desc">${rec ? esc(rec.desc||'') : (isA?'No Wikipedia match yet.':`${esc(vCity)} · No Wikipedia match yet.`)}</div></div>
      ${rec?.note?`<div class="note">${esc(rec.note)}</div>`:''}
      ${facts.length?`<dl class="facts">${facts.map(([l,v])=>`<div><dt>${l}</dt><dd>${l==='Website'?v:esc(v)}</dd></div>`).join('')}</dl>`:''}
      ${rec?.wiki?`<div class="sum loading" id="sum">Loading the Wikipedia summary…</div>`:''}
      ${comingN?`<div class="seen next"><h4>Coming up · ${comingN}</h4><ul>${rows(coming, true).join('')}</ul></div>`:''}
      ${seenN||!comingN?`<div class="seen"><h4>${isA?`You've seen them ${seenN} time${seenN===1?'':'s'}`:`${seenN} night${seenN===1?'':'s'} here`}</h4><ul>${rows(seen).join('')}</ul></div>`:''}
      ${photoGrid(seen)}
      ${isA?spotifySlot():''}
      ${isA?artistSongs(key):''}
      <div class="links">${rec?.wiki?`<a href="${wikiUrl(rec.wiki)}" target="_blank" rel="noopener">Read on Wikipedia ↗</a>`:''}
        <span class="spacer"></span>
        <button type="button" class="edit-only" data-info-edit="${esc(kind)}" data-key="${esc(key)}">Edit info</button>
        ${actId?`<button type="button" class="edit-only" data-edit="${actId}">Edit this show</button>`:''}
        <button type="button" data-q="${esc(title)}">Show in log</button></div>
    </div>`;
  show(box); show($('#scrim')); box.querySelector('.x').focus();
  if (rec?.wiki) loadSummary(rec, ++infoReq);
  if (isA) fillSpotify(title);
}
// Your photos from every night in this pop-up's history, newest night first
let infoPhotos = [];
function photoGrid(seen){
  const ids = new Set(seen.map(s => s.id));
  infoPhotos = nights(state.shows).filter(n => n.acts.some(a => ids.has(a.id)))
    .flatMap(n => nightPhotos(n).map(p => ({p, n})));
  if (!infoPhotos.length) return '';
  const thumbs = infoPhotos.map(({p}, i) => `<button type="button" data-info-photo="${i}" aria-label="Photo ${i + 1} of ${infoPhotos.length}"><img loading="lazy" src="${esc(photoUrl(p, 200))}" alt=""></button>`).join('');
  return `<div class="seen info-photos"><h4>Your photos · ${infoPhotos.length}</h4><div class="ip-grid">${thumbs}</div></div>`;
}
export function openInfoPhoto(i){ openViewer(infoPhotos, +i); }

async function loadSummary(rec, req){
  const el = () => req===infoReq ? $('#sum') : null;
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(rec.wiki.replace(/ /g,'_'))}`);
    const j = await r.json(); const e = el(); if (!e) return;
    e.classList.remove('loading'); e.textContent = j.extract || ''; if (!j.extract) e.remove();
  } catch { const e = el(); if (e) e.remove(); }
  if (rec.img) try {
    const [f,wiki] = rec.img.split('|');
    const u = `https://${wiki==='en'?'en.wikipedia.org':'commons.wikimedia.org'}/w/api.php?` + new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',prop:'imageinfo',iiprop:'extmetadata',iiextmetadatafilter:'Artist|LicenseShortName',titles:'File:'+f});
    const j = await fetch(u).then(r=>r.json()); const m = j.query.pages[0].imageinfo?.[0]?.extmetadata || {};
    const who = (m.Artist?.value||'').replace(/<[^>]+>/g,'').trim(); const lic = m.LicenseShortName?.value || '';
    const c = req===infoReq && $('#credit'); if (c && (who||lic)) c.textContent = `Photo: ${who||'Wikimedia Commons'}${lic?` · ${lic}`:''}`;
  } catch {}
}
export function closeInfo(){ hide($('#info')); if (!isOpen($('#sheet'))) hide($('#scrim')); }
// The name you clicked travels into the pop-up's title. Browsers without view transitions just open it.
export function morphOpen(from, open){
  if (!document.startViewTransition || !motionOK()) { open(); return; }
  from.classList.add('vt-name');
  const tr = document.startViewTransition(() => {
    from.classList.remove('vt-name');
    open();
    $('#info h2')?.classList.add('vt-name');
  });
  tr.finished.finally(() => $('#info h2')?.classList.remove('vt-name'));
}

/* editors can fix a match */
export function openInfoEdit(kind, key){
  const rec = state.INFO[kind]?.[key] || {};
  let historyBtn = '';
  if (state.mode === 'netlify') historyBtn = `<button type="button" data-history="${esc(kind)}" data-key="${esc(key)}">History</button>`;
  closeInfo();
  openSheet(`<h3>Edit info</h3><form id="frm">
    <p class="hint" style="font-size:14px">${esc(kind==='artists'?key:key.replace('|',', '))}</p>
    <label for="f-wiki">Wikipedia page<input id="f-wiki" value="${esc(rec.wiki||'')}" placeholder="e.g. Phoenix (French band)"><span class="hint">Paste a page title or a Wikipedia link, then Look up.</span></label>
    <div class="foot" style="margin-top:0"><button type="button" id="lookup">Look up</button><span id="lookMsg" class="hint"></span></div>
    <label for="f-desc">Short description<input id="f-desc" value="${esc(rec.desc||'')}"></label>
    <label for="f-img">Photo (Commons file name)<input id="f-img" value="${esc(rec.img||'')}" placeholder="File_name.jpg"></label>
    <label for="f-inote">Note<textarea id="f-inote" rows="2">${esc(rec.note||'')}</textarea></label>
    <div class="foot"><button class="primary" type="submit">Save</button><button type="button" data-close>Cancel</button><span class="spacer"></span>${historyBtn}<button type="button" class="danger" id="unmatch">Remove match</button></div></form>`);
  let fetched = null;
  $('#lookup').onclick = async () => {
    let t = $('#f-wiki').value.trim().replace(/^https?:\/\/en\.(m\.)?wikipedia\.org\/wiki\//,''); t = decodeURIComponent(t).replace(/_/g,' ');
    if (!t) return; $('#lookMsg').textContent = 'Looking up…';
    try {
      const j = await fetch('https://en.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',redirects:'1',prop:'description|pageprops|pageimages',ppprop:'wikibase_item|disambiguation',piprop:'name|thumbnail',pithumbsize:'100',titles:t})).then(r=>r.json());
      const p = j.query.pages[0];
      if (p.missing){ $('#lookMsg').textContent = 'No page with that title.'; return; }
      if (p.pageprops && 'disambiguation' in p.pageprops){ $('#lookMsg').textContent = 'That’s a disambiguation page. Pick the specific one.'; return; }
      fetched = {wiki:p.title, qid:p.pageprops?.wikibase_item, desc:p.description||'', img: p.pageimage ? p.pageimage.replace(/ /g,'_') + (p.thumbnail?.source?.includes('/wikipedia/en/')?'|en':'') : ''};
      $('#f-wiki').value = fetched.wiki; $('#f-desc').value = fetched.desc; $('#f-img').value = fetched.img;
      $('#lookMsg').textContent = `Found: ${fetched.wiki}`;
    } catch { $('#lookMsg').textContent = 'Wikipedia didn’t respond. Try again.'; }
  };
  $('#unmatch').onclick = async () => { state.INFO[kind][key] = null; if (await saveInfo(kind, key)){ closeSheet(); toast('Match removed'); } };
  $('#frm').addEventListener('submit', async e => { e.preventDefault();
    const wiki = $('#f-wiki').value.trim();
    let next = {...rec};
    if (fetched && fetched.qid !== rec.qid) next = {wiki:fetched.wiki, qid:fetched.qid};   // new page: drop old facts
    Object.assign(next, {wiki: wiki || undefined, desc: $('#f-desc').value.trim(), img: $('#f-img').value.trim() || undefined, note: $('#f-inote').value.trim() || undefined});
    state.INFO[kind] = state.INFO[kind] || {}; state.INFO[kind][key] = next.wiki || next.desc ? next : null;
    if (await saveInfo(kind, key)){ closeSheet(); toast('Info saved'); openInfo(kind, key); }
  });
}
