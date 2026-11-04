import { persist } from './api.js';
import { renderEnd } from './endcap.js';
import { commitDelete, fullNight, nightVal, nights, paintStubPhotos } from './log.js';
import { hide, isOpen, motionOK, show, toast } from './motion.js';
import { PER_NIGHT, deletePhoto, nightPhotos, photosOn, photoUrl, uploadPhotos } from './photos.js';
import { API, TODAY, state } from './state.js';
import { $, esc, newId, withPlace } from './util.js';
import { render } from './view.js';

/* ---------- sheet ---------- */
export function openSheet(html){ $('#sheet').innerHTML = html; show($('#sheet')); show($('#scrim')); const f=$('#sheet input,#sheet textarea'); f && f.focus(); wireAutofill(); }
function wireAutofill(){
  const v=$('#f-venue'), c=$('#f-city'); if(!v||!c) return;
  const fill = known => { if(!known) return; if(!c.value) c.value = known.city; if(c.value===known.city){ $('#f-state').value = known.state||''; $('#f-country').value = known.country||'US'; } };
  v.addEventListener('change', () => fill(state.shows.find(x=>x.venue.toLowerCase()===v.value.trim().toLowerCase())));
  c.addEventListener('change', () => fill(state.shows.find(x=>x.city.toLowerCase()===c.value.trim().toLowerCase())));
}
export function closeSheet(){ hide($('#sheet')); if (!isOpen($('#info'))) hide($('#scrim')); }
function datalists(){
  const uniq = k => [...new Set(state.shows.map(s=>s[k]).filter(Boolean))].sort();
  return ['artist','venue','city','state','country'].map(k=>`<datalist id="dl-${k}">${uniq(k).map(v=>`<option value="${esc(v)}">`).join('')}</datalist>`).join('');
}
function fields(s, multi){
  return `${datalists()}
    ${multi
      ? `<label for="f-artists">Artists<textarea id="f-artists" rows="4" required placeholder="One per line, headliner first">${esc(s.artist||'')}</textarea><span class="hint">Festival or multi-act bill? Put each act on its own line.</span></label>`
      : `<label for="f-artist">Artist<input id="f-artist" list="dl-artist" required value="${esc(s.artist)}"></label>`}
    ${nightFields(s)}
    <label for="f-notes">Notes<textarea id="f-notes" rows="3" placeholder="Who you went with, opener, setlist highlight…">${esc(s.notes||'')}</textarea></label>`;
}
// The details every act of a night shares. A blank type means the acts differ.
function nightFields(s){
  let mixed = '';
  if (!s.type) mixed = `<option value="" selected>Mixed (keep as is)</option>`;
  return `<label for="f-venue">Venue<input id="f-venue" list="dl-venue" value="${esc(s.venue)}"></label>
    <div class="row2">
      <label for="f-city">City<input id="f-city" list="dl-city" value="${esc(s.city)}"></label>
      <label for="f-state">State / region<input id="f-state" list="dl-state" value="${esc(s.state||'')}"></label>
    </div>
    <div class="row2">
      <label for="f-country">Country<input id="f-country" list="dl-country" value="${esc(s.country||'US')}"></label>
      <label for="f-type">Type<select id="f-type">${mixed}${['Music','Comedy'].map(t=>`<option ${t===s.type?'selected':''}>${t}</option>`).join('')}</select></label>
    </div>
    <label for="f-date">Date<input id="f-date" type="date" value="${s.date||''}"><span class="hint">Leave blank if you don't remember. Pick a future date to add it under Up next; it counts toward stats the day after.</span></label>`;
}
// Per-night extras, on the sheets that handle a whole night
function extraFields(s){
  let stars = '';
  for (let v = 5; v >= 1; v--) {
    let on = '';
    if (+s.rating === v) on = 'checked';
    stars += `<input type="radio" name="f-rating" id="f-r${v}" value="${v}" ${on}><label for="f-r${v}" title="${v} of 5" aria-label="${v} of 5">★</label>`;
  }
  return `<fieldset class="stars"><legend>Your rating</legend><div>${stars}<button type="button" id="f-noRate">Clear</button></div></fieldset>
    <div class="row2">
      <label for="f-price">Ticket price<input id="f-price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Signed-in only" value="${esc(s.price ?? '')}"></label>
      <label for="f-with">Went with<input id="f-with" placeholder="Signed-in only" value="${esc(s.companions || '')}"></label>
    </div>`;
}
function wireExtras(){
  $('#f-noRate').onclick = () => { const on = $('input[name="f-rating"]:checked'); if (on) on.checked = false; };
}
function readExtras(){
  let rating = null;
  const on = $('input[name="f-rating"]:checked');
  if (on) rating = +on.value;
  let price = null;
  if ($('#f-price').value !== '') price = +$('#f-price').value;
  return { rating, price, companions: $('#f-with').value.trim() || null };
}
function readNight(){
  return { venue:$('#f-venue').value.trim(), city:$('#f-city').value.trim(), state:$('#f-state').value.trim(), country:$('#f-country').value.trim()||'US', type:$('#f-type').value, date:$('#f-date').value||null };
}
function readForm(){
  return { ...readNight(), notes:$('#f-notes').value.trim() };
}
function undoNote(){
  if (state.mode === 'netlify') return 'You can undo this from History.';
  return "This can't be undone.";
}
export function openEdit(id){
  const s = state.shows.find(x=>x.id===id); if(!s) return;
  let historyBtn = '';
  if (state.mode === 'netlify') {
    historyBtn =`<button type="button" data-history="shows" data-key="${esc(id)}">History</button>`;
  }
  openSheet(`<h3>Edit act</h3><form id="frm">${fields(s,false)}
    <div class="foot"><button class="primary" type="submit">Save</button><button type="button" data-close>Cancel</button><span class="spacer"></span>${historyBtn}<button type="button" class="danger" id="del">Delete</button></div>
    <div id="confirmBox"></div></form>`);
  $('#frm').addEventListener('submit', e => { e.preventDefault();
    Object.assign(s, readForm(), {artist:$('#f-artist').value.trim()});
    commit('Saved '+s.artist, {method:'PATCH', url:`${API}/${encodeURIComponent(id)}`, body:s}); });
  $('#del').addEventListener('click', () => {
    $('#confirmBox').innerHTML = `<div class="confirm">Delete ${esc(s.artist)}? ${undoNote()} <button type="button" class="danger" id="delYes">Delete</button><button type="button" id="delNo">Keep</button></div>`;
    $('#delYes').onclick = () => {
      // The ticket only tears when this was the night's last act
      const alone = nights(state.shows).find(n => n.acts.some(a => a.id === id)).acts.length === 1;
      state.shows = state.shows.filter(x=>x.id!==id);
      const op = {method:'DELETE', url:`${API}/${encodeURIComponent(id)}`};
      if (alone) commitDelete('Deleted '+s.artist, id, op);
      else commit('Deleted '+s.artist, op);
    };
    $('#delNo').onclick = () => $('#confirmBox').innerHTML='';
  });
}
export function openAdd(base){
  const s = base ? {...base, artist:'', notes:''} : {artist:'',venue:'',city:'',state:'',country:'US',type:'Music',date:TODAY,notes:''};
  openSheet(`<h3>${base?'Add to bill':'Add show'}</h3><form id="frm">${fields(s,true)}${extraFields(s)}
    <div class="foot"><button class="primary" type="submit">Add</button><button type="button" data-close>Cancel</button></div></form>`);
  wireExtras();
  $('#frm').addEventListener('submit', e => { e.preventDefault();
    const f = {...readForm(), ...readExtras()}; const names = $('#f-artists').value.split('\n').map(x=>x.trim()).filter(Boolean);
    if (!names.length) return;
    // insert after existing acts of the same night so billing order holds
    const rows = names.map(artist => ({id:newId(), artist, ...f}));
    let after = null;
    if (base){ const last = state.shows.map(x=>x.date===base.date&&x.venue===base.venue).lastIndexOf(true); after = state.shows[last].id; state.shows.splice(last+1,0,...rows); }
    else { state.shows.unshift(...rows); state.stampId = rows[0].id; }
    commit(`Added ${names.length} act${names.length>1?'s':''}`, {method:'POST', url:API, body:{rows, after}});
    if (state.stampId) {
      let behavior = 'auto';
      if (motionOK()) behavior = 'smooth';
      $('.stub.stamped')?.scrollIntoView({block:'center', behavior});
      state.stampId = null;
    }
  });
}
// Edit a whole night in one step: its shared details and its acts (first = headliner)
/* The night's photos in Edit bill. They upload and delete straight away, separately from Save. */
function photoBox(){
  if (!photosOn()) return '';
  return `<fieldset class="bill-photos"><legend>Photos <span id="billPhotoCount"></span></legend>
    <div class="bp-grid" id="billPhotos"></div>
    <label class="bp-drop" id="billDrop"><input type="file" id="billPick" accept="image/*,.heic,.heif" multiple>
      <b>Add photos</b><span>Drop them here or pick files. Up to ${PER_NIGHT} a night; they save as soon as they upload.</span></label>
  </fieldset>`;
}
function wirePhotos(actId){
  const grid = $('#billPhotos'); if (!grid) return;
  const draw = () => {
    const n = fullNight(actId); if (!n) return;
    const mine = nightPhotos(n);
    $('#billPhotoCount').textContent = `${mine.length} / ${PER_NIGHT}`;
    grid.innerHTML = mine.map(p => `<figure><img src="${esc(photoUrl(p))}" alt="" loading="lazy">
      <button type="button" class="bp-del" data-photo-del="${esc(p.id)}" aria-label="Delete this photo">✕</button></figure>`).join('');
    $('#billDrop').hidden = mine.length >= PER_NIGHT;
  };
  const after = () => { draw(); paintStubPhotos(); renderEnd(); };
  draw();
  const send = files => uploadPhotos(actId, files, after);
  $('#billPick').addEventListener('change', e => { send(e.target.files); e.target.value = ''; });
  const drop = $('#billDrop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); send(e.dataTransfer.files); });
  grid.addEventListener('click', async e => {
    const b = e.target.closest('[data-photo-del]'); if (!b) return;
    b.disabled = true;
    if (await deletePhoto(b.dataset.photoDel)) after();
    else b.disabled = false;
  });
}

export function openBill(id){
  const night = nights(state.shows).find(n => n.acts.some(a => a.id === id)); if (!night) return;
  const was = night.acts.map(a => a.id);
  // A working copy, so Cancel leaves the real list alone
  let order = night.acts.map(a => ({...a})), moved = null;
  const rows = () => order.map((a, i) => {
    let ctl = '<span class="star">★ Headliner</span>';
    if (i > 0) {
      let down = '';
      if (i < order.length - 1) down = `<button type="button" data-move="${i}" data-by="1" aria-label="Move ${esc(a.artist)} down">↓</button>`;
      ctl = `<button type="button" data-move="${i}" data-by="-1" aria-label="Move ${esc(a.artist)} up">↑</button>${down}<button type="button" data-top="${i}">Make headliner</button>`;
    }
    if (order.length > 1) ctl += `<button type="button" class="rm" data-rm="${i}" aria-label="Remove ${esc(a.artist)}">✕</button>`;
    let cls = '';
    if (a.id === moved) cls = 'moved';
    return `<li class="${cls}"><span class="act">
        <input class="name" list="dl-artist" required pattern=".*\\S.*" aria-label="Artist" placeholder="Artist" data-i="${i}" data-f="artist" value="${esc(a.artist)}">
        <input class="note" aria-label="Notes" placeholder="Notes" data-i="${i}" data-f="notes" value="${esc(a.notes||'')}">
      </span><span class="ctl">${ctl}</span></li>`;
  }).join('');
  const draw = () => {
    $('#billList').innerHTML = rows();
    $('#billReverse').hidden = order.length < 2;
  };
  const types = [...new Set(order.map(a => a.type))];
  let type = '';
  if (types.length === 1) type = types[0];
  openSheet(`<h3>Edit bill</h3><form id="frm">${datalists()}
    <ol class="bill" id="billList">${rows()}</ol>
    <div class="foot"><button type="button" id="billAdd">+ Add act</button><button type="button" id="billReverse">Reverse order</button></div>
    ${nightFields({...night, type})}
    ${extraFields({rating:nightVal(night,'rating'), price:nightVal(night,'price'), companions:nightVal(night,'companions')})}
    ${photoBox()}
    <div class="foot"><button class="primary" type="submit">Save</button><button type="button" data-close>Cancel</button><span class="spacer"></span><button type="button" class="danger" id="del">Delete bill</button></div>
    <div id="confirmBox"></div></form>`);
  $('#billReverse').hidden = order.length < 2;
  wireExtras();
  wirePhotos(was[0]);
  // Typing doesn't redraw, so the cursor stays put
  $('#billList').addEventListener('input', e => { order[+e.target.dataset.i][e.target.dataset.f] = e.target.value; });
  $('#billList').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.rm !== undefined) { order.splice(+b.dataset.rm, 1); moved = null; draw(); return; }
    const i = +(b.dataset.move ?? b.dataset.top);
    moved = order[i].id;
    if (b.dataset.top !== undefined) order = [order[i], ...order.filter((_, j) => j !== i)];
    else { const j = i + +b.dataset.by; [order[i], order[j]] = [order[j], order[i]]; }
    draw();
  });
  $('#billAdd').onclick = () => {
    const a = {id:newId(), artist:'', notes:'', type:order[0].type};
    order.push(a); moved = a.id; draw();
    $('#billList li:last-child .name').focus();
  };
  $('#billReverse').onclick = () => { order.reverse(); moved = order[0].id; draw(); };
  // The night keeps its place in the list: its acts go back where the first one was
  const putBack = acts => {
    const at = state.shows.findIndex(s => was.includes(s.id));
    state.shows = state.shows.filter(s => !was.includes(s.id));
    state.shows.splice(at, 0, ...acts);
  };
  $('#del').addEventListener('click', () => {
    let count = `${was.length} acts`;
    if (was.length === 1) count = '1 act';
    $('#confirmBox').innerHTML = `<div class="confirm">Delete this bill (${count})? ${undoNote()} <button type="button" class="danger" id="delYes">Delete</button><button type="button" id="delNo">Keep</button></div>`;
    $('#delYes').onclick = () => { putBack([]); commitDelete('Deleted bill', was[0], {method:'POST', url:`${API}/bill`, body:{was, acts:[]}}); };
    $('#delNo').onclick = () => $('#confirmBox').innerHTML='';
  });
  $('#frm').addEventListener('submit', e => { e.preventDefault();
    const f = readNight(), x = readExtras();
    const acts = order.map(a => ({...a, ...f, ...x, type:f.type || a.type, artist:a.artist.trim(), notes:(a.notes||'').trim()}));
    putBack(acts);
    commit('Saved bill', {method:'POST', url:`${API}/bill`, body:{was, acts}});
  });
}
export function openData(){
  const json = JSON.stringify(state.shows, null, 1);
  // With the database, History replaces "reset" (which would drop everything added since the seed)
  let resetBtn = '';
  if (state.mode !== 'netlify') resetBtn = '<div class="foot edit-only"><button type="button" class="danger" id="reset">Reset to original list</button></div>';
  openSheet(`<h3>Data</h3><form id="frm">
    <p class="hint" style="font-size:14px">${state.mode==='netlify'?(state.user?'Edits save to your Netlify site.':'Sign in to edit. You can still copy the data.'):'Edits are kept in this browser. Copy the JSON to back it up or move it to shows.json.'}</p>
    <textarea id="f-json" class="json" spellcheck="false">${esc(json)}</textarea>
    <div class="foot"><button type="button" class="primary" id="copy">Copy JSON</button><button type="button" id="copyCsv">Copy CSV</button><button type="submit" class="edit-only">Replace with pasted JSON</button><span class="spacer"></span><button type="button" data-close>Close</button></div>
    <div id="confirmBox"></div>
    ${resetBtn}</form>`);
  const copy = (txt,label) => { navigator.clipboard?.writeText(txt).then(()=>toast(label+' copied'), ()=>{ $('#f-json').value=txt; $('#f-json').select(); toast('Selected. Press Ctrl/⌘+C'); }) ?? ($('#f-json').select()); };
  $('#copy').onclick = () => copy(JSON.stringify(state.shows,null,1),'JSON');
  $('#copyCsv').onclick = () => { const q=v=>/[",\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v;
    copy(['Artist,Venue,City,State,Country,Date,Type,Notes',...state.shows.map(s=>[s.artist,s.venue,s.city,s.state||'',s.country||'',s.date||'',s.type,s.notes||''].map(x=>q(String(x))).join(','))].join('\n'),'CSV'); };
  $('#frm').addEventListener('submit', e => { e.preventDefault();
    try { const d = JSON.parse($('#f-json').value); if(!Array.isArray(d)) throw 0;
      state.shows = d.map(s=>withPlace({id:s.id||newId(),artist:s.artist||'',venue:s.venue||'',city:s.city||'',state:s.state,country:s.country,date:s.date||null,type:s.type||'Music',notes:s.notes||'',rating:s.rating,price:s.price,companions:s.companions}));
      commit(`Loaded ${state.shows.length} entries`, {method:'PUT', url:API, body:state.shows});
    } catch { toast('That isn’t a valid list of shows. Check the JSON and try again.'); } });
  if ($('#reset')) $('#reset').onclick = () => {
    $('#confirmBox').innerHTML = `<div class="confirm">Replace everything with the original imported list? <button type="button" class="danger" id="rYes">Reset</button><button type="button" id="rNo">Cancel</button></div>`;
    $('#rYes').onclick = () => { state.shows = JSON.parse($('#seed').textContent).map(withPlace); commit('Reset to original list', {method:'PUT', url:API, body:state.shows}); };
    $('#rNo').onclick = () => $('#confirmBox').innerHTML='';
  };
}
function commit(msg, op){ closeSheet(); render(); persist(op); toast(msg); }
