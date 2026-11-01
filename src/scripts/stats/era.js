import { TODAY } from '../state.js';
import { fmt, yrs } from './index.js';
import { esc, place, store } from '../util.js';

/* ---------- before / after the move ---------- */
const METRO = {Tempe:'Phoenix',Scottsdale:'Phoenix',Mesa:'Phoenix',Chandler:'Phoenix',Glendale:'Phoenix',Gilbert:'Phoenix'};
const metro = n => n.state==='AZ' && METRO[n.city] ? 'Phoenix, AZ' : place(n);
export function eraPanel(ns){
  const move = store.get('show-log-move') || '2021-06-01';
  const nd = ns.filter(n=>n.date);
  const side = list => {
    if (!list.length) return null;
    const d0 = list.at(-1).date, d1 = list[0].date;
    const end = list === afterL ? TODAY : move;
    const spanY = Math.max(yrs(list === afterL ? move : d0, end), 0.5);
    const acts = list.reduce((t,n)=>t+n.acts.length,0);
    const comedy = list.filter(n=>!n.acts.some(a=>a.type==='Music')).length;
    const cityC = new Map(); list.forEach(n=>{ const c=metro(n); cityC.set(c,(cityC.get(c)||0)+1); });
    const home = [...cityC].sort((a,b)=>b[1]-a[1])[0];
    const venC = new Map(); list.forEach(n=>venC.set(n.venue,(venC.get(n.venue)||0)+1));
    const topVen = [...venC].sort((a,b)=>b[1]-a[1])[0];
    const artC = new Map(); list.forEach(n=>n.acts.forEach(a=>{ const k=a.artist.trim(); artC.set(k,(artC.get(k)||0)+1); }));
    const topArt = [...artC].filter(([,c])=>c>1).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const fest = list.filter(n=>n.acts.length>=3).length;
    return { n:list.length, d0, d1, rate:list.length/spanY, perNight:acts/list.length, comedyPct:comedy/list.length*100,
      home, away:list.length-home[1], cities:cityC.size, topVen, topArt, fest, artists:new Set(artC.keys()) };
  };
  const beforeL = nd.filter(n=>n.date < move), afterL = nd.filter(n=>n.date >= move);
  const B = side(beforeL), Af = side(afterL);
  const cmp = (a,b,fmtv,higherIs='') => { if(!a||!b) return ''; const diff=b-a; if(Math.abs(diff)<0.05) return ''; return ` <span class="${diff>0?'up':'dn'}">${diff>0?'▲':'▼'} ${fmtv(Math.abs(diff))}</span>`; };
  const col = (title, X, other, isAfter) => !X ? `<div><h4>${title}</h4><p class="rng">No dated shows yet.</p></div>` : `<div>
    <div><h4>${title}</h4><span class="rng">${fmt(X.d0)} – ${fmt(X.d1)}</span></div>
    <dl>
      <dt>Nights</dt><dd><b>${X.n}</b></dd>
      <dt>Per year</dt><dd><b>${X.rate.toFixed(1)}</b>${isAfter?cmp(other?.rate,X.rate,v=>v.toFixed(1)):''}</dd>
      <dt>Acts / night</dt><dd>${X.perNight.toFixed(1)}${isAfter?cmp(other?.perNight,X.perNight,v=>v.toFixed(1)):''}</dd>
      <dt>Comedy</dt><dd>${Math.round(X.comedyPct)}%${isAfter?cmp(other?.comedyPct,X.comedyPct,v=>Math.round(v)+' pts'):''}</dd>
      <dt>Home scene</dt><dd>${esc(X.home[0])} · ${Math.round(X.home[1]/X.n*100)}% of nights</dd>
      <dt>Road trips</dt><dd>${X.away} night${X.away===1?'':'s'} in ${X.cities-1} other cit${X.cities-1===1?'y':'ies'}</dd>
      <dt>Festivals / 3+ acts</dt><dd>${X.fest}</dd>
      <dt>Go-to venue</dt><dd>${esc(X.topVen[0])} (${X.topVen[1]})</dd>
      <dt>Most seen</dt><dd>${X.topArt.length ? X.topArt.map(([a,c])=>`${esc(a)} ×${c}`).join(', ') : 'No repeats'}</dd>
    </dl></div>`;
  const both = B && Af ? [...Af.artists].filter(a=>B.artists.has(a)).sort() : [];
  return `<div class="panel"><h3>Before & after the move
      <label class="movectl" for="f-move">Moved <input type="date" id="f-move" value="${move}"></label></h3>
    <div class="era">${col('Before', B, null, false)}${col('After', Af, B, true)}</div>
    ${both.length?`<div class="both"><span class="lbl">Followed you west</span>${both.map(a=>`<button class="chip" type="button" data-q="${esc(a)}">${esc(a)}</button>`).join('')}</div>`:''}
  </div>`;
}
