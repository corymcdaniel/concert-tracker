import { nights } from '../log.js';
import { reviewPanel } from '../review.js';
import { MONTHS, state } from '../state.js';
import { aroundPanel } from './around.js';
import { sameDayPanel } from './sameday.js';
import { bucketPanel } from './bucket.js';
import { eraPanel } from './era.js';
import { companionPanel, extrasHint, ratingPanel, spendingPanel } from './extras.js';
import { drawMap } from './map.js';
import { drawVenueMap } from './venues.js';
import { agePanel, counter, dayPanel, gapPanel, genrePanel, heatPanel, newRepeatPanel, openerPanel, runCounters } from './panels.js';
import { byYearPanel, clockPanel, favoritesPanel, habitsPanel, summaryPanel, yearTopsPanel } from './listening.js';
import { knownPanel, setlistPanel } from './setlists.js';
import { arrangeWall, wallPanel } from './wall.js';
import { $, esc, happened, place } from '../util.js';

/* ---------- stats view ---------- */
export const fmt = d => { const [y,m,dd]=d.split('-'); return `${MONTHS[+m-1]} ${+dd}, ${y}`; };
export const yrs = (a,b) => ((new Date(b) - new Date(a)) / 31557600000);
export function renderStatsView(){
  const past = state.shows.filter(happened);
  const dated = past.filter(s => s.date);
  const ns = nights(past), nd = ns.filter(n=>n.date);
  const nightType = n => n.acts.some(a=>a.type==='Music') ? 'Music' : 'Comedy';

  // per artist sightings (by night)
  const art = new Map();
  dated.forEach(s => { const k=s.artist.trim().toLowerCase(); if(!art.has(k)) art.set(k,{name:s.artist.trim(),dates:[]}); art.get(k).dates.push(s.date); });
  past.filter(s=>!s.date).forEach(s => { const k=s.artist.trim().toLowerCase(); if(!art.has(k)) art.set(k,{name:s.artist.trim(),dates:[]}); (art.get(k).undated=(art.get(k).undated||0)+1); });
  const A = [...art.values()].map(a => { a.dates = [...new Set(a.dates)].sort(); a.times = a.dates.length + (a.undated||0);
    let gap=0, gf=null, gt=null; for(let i=1;i<a.dates.length;i++){ const g=yrs(a.dates[i-1],a.dates[i]); if(g>gap){gap=g;gf=a.dates[i-1];gt=a.dates[i];} }
    return {...a, gap, gf, gt, span: a.dates.length>1 ? yrs(a.dates[0], a.dates.at(-1)) : 0}; });

  // highlights
  const biggest = [...nd].sort((a,b)=>b.acts.length-a.acts.length)[0];
  const longGap = [...A].sort((a,b)=>b.gap-a.gap)[0];
  const longSpan = [...A].filter(a=>a.dates.length>2).sort((a,b)=>b.span-a.span)[0] || [...A].sort((a,b)=>b.span-a.span)[0];
  const byYear = {}; nd.forEach(n=>{ const y=+n.date.slice(0,4); byYear[y]=byYear[y]||{Music:0,Comedy:0}; byYear[y][nightType(n)]++; });
  const yearsList = Object.keys(byYear).map(Number);
  const y0 = Math.min(...yearsList), y1 = Math.max(...yearsList);
  const busiest = yearsList.sort((a,b)=>(byYear[b].Music+byYear[b].Comedy)-(byYear[a].Music+byYear[a].Comedy))[0];
  let streak=0, run=0, sEnd=0; for(let y=y0;y<=y1;y++){ if(byYear[y]){run++; if(run>streak){streak=run;sEnd=y;}} else run=0; }
  const first = nd.at(-1), sameDay = new Set(), solo = nd.filter(n=>n.acts.length===1).length;
  const comedyN = ns.filter(n=>nightType(n)==='Comedy').length;
  const repeatVenue = new Map(); ns.forEach(n=>{ const k=n.venue.toLowerCase(); if(k) repeatVenue.set(k,(repeatVenue.get(k)||0)+1); });
  const sets = past.length;

  const hl = [
    [counter('hl-sets', sets), 'Sets seen', `${(sets/ns.length).toFixed(1)} acts per night on average. ${solo} nights were a single act.`],
    [`${counter('hl-bill', biggest.acts.length)} acts`, 'Biggest bill', `${esc(biggest.venue)}, ${fmt(biggest.date)}`],
    [`${longGap.gap.toFixed(1)} yrs`, 'Longest wait to see again', `${esc(longGap.name)}: ${fmt(longGap.gf)} → ${fmt(longGap.gt)}`],
    [`${counter('hl-span', Math.round(longSpan.span))} yrs`, 'Longest-running (3+ times)', `${esc(longSpan.name)}, ${longSpan.dates[0].slice(0,4)}–${longSpan.dates.at(-1).slice(0,4)}`],
    [`${busiest}`, 'Busiest year', `${byYear[busiest].Music+byYear[busiest].Comedy} nights out`],
    [`${counter('hl-streak', streak)} yrs`, 'Longest yearly streak', `${sEnd-streak+1}–${sEnd}, at least one show every year`],
    [`${counter('hl-comedy', Math.round(comedyN/ns.length*100))}%`, 'Comedy nights', `${comedyN} of ${ns.length} nights were stand-up`],
    [fmt(first.date).split(', ')[1], 'First logged show', `${esc(first.acts.map(a=>a.artist).join(' + '))}, ${esc(place(first))}`],
  ];

  // year bars incl. empty years
  const maxY = Math.max(...Object.values(byYear).map(v=>v.Music+v.Comedy));
  let yb=''; for(let y=y0;y<=y1;y++){ const v=byYear[y]||{Music:0,Comedy:0}, t=v.Music+v.Comedy;
    yb += `<div class="col ${t?'':'zero'}" title="${y}: ${v.Music} music, ${v.Comedy} comedy"><span class="n">${t||''}</span><div class="stack">
      ${v.Comedy?`<div class="seg-c" style="height:${v.Comedy/maxY*100}%"></div>`:''}${v.Music?`<div class="seg-m" style="height:${v.Music/maxY*100}%"></div>`:''}</div>
      <span class="x">'${String(y).slice(2)}</span></div>`; }
  // months
  const byM = Array(12).fill(0); nd.forEach(n=>byM[+n.date.slice(5,7)-1]++); const maxM=Math.max(...byM);
  const mb = byM.map((c,i)=>`<div class="col" title="${MONTHS[i]}: ${c} nights"><span class="n">${c||''}</span><div class="stack"><div class="seg-m" style="height:${c/maxM*100}%"></div></div><span class="x">${MONTHS[i]}</span></div>`).join('');
  // rankings
  const rank = (m, n=10, attr) => { const arr=[...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,n); const mx=arr[0]?.[1]||1;
    return `<ol class="rank">${arr.map(([k,c])=>`<li><span class="lab" style="--w:${c/mx*100}%">${attr?`<button type="button" ${attr(k)}>${esc(k)}</button>`:esc(k)}</span><span class="c">${c}</span></li>`).join('')}</ol>`; };
  const multiCity = new Set(); { const seen = {}; ns.forEach(n => { if(!n.venue) return; (seen[n.venue] ??= new Set()).add(n.city); if (seen[n.venue].size>1) multiCity.add(n.venue); }); }
  const venueLabel = n => multiCity.has(n.venue) ? `${n.venue} (${n.city})` : n.venue, venueKeyOf = {};
  const venueNames = new Map(); ns.forEach(n=>{ if(n.venue){ const l=venueLabel(n); venueKeyOf[l]=n.venue+'|'+n.city; venueNames.set(l,(venueNames.get(l)||0)+1);} });
  const cityN = new Map(); ns.forEach(n=>{ if(n.city){ const k=place(n); cityN.set(k,(cityN.get(k)||0)+1);} });
  // repeat table
  const reps = A.filter(a=>a.times>1).sort((a,b)=>b.times-a.times||b.span-a.span||a.name.localeCompare(b.name));
  const tbl = `<table class="rep"><thead><tr><th>Artist</th><th class="num">Times</th><th>First</th><th>Latest</th><th class="num">Span</th></tr></thead><tbody>
    ${reps.map(a=>`<tr><td><button type="button" data-artist="${esc(a.name)}">${esc(a.name)}</button></td><td class="num">${a.times}</td>
      <td>${a.dates[0]?fmt(a.dates[0]):'—'}</td><td>${a.dates.length?fmt(a.dates.at(-1)):'—'}</td><td class="num">${a.span?a.span.toFixed(0)+' yr':'—'}</td></tr>`).join('')}</tbody></table>`;
  // Seen 2+ times: the most-seen acts as chips that open the artist pop-up, eight until you ask for all
  let most = '';
  if (reps.length) {
    const byCount = [...reps].sort((a, b) => b.times - a.times || a.name.localeCompare(b.name));
    let chips = byCount;
    if (!state.showAllMost) chips = byCount.slice(0, 8);
    let toggle = '';
    if (byCount.length > 8) {
      let label = `All ${byCount.length} →`;
      if (state.showAllMost) label = 'Show fewer';
      toggle = `<button type="button" class="more" id="moreBtn">${label}</button>`;
    }
    most = `<div class="panel"><h3>Seen 2+ times <span>${byCount.length} artists</span></h3><div class="most">${chips.map(a =>
      `<button class="chip" type="button" data-artist="${esc(a.name)}">${esc(a.name)}<em>×${a.times}</em></button>`).join('')}${toggle}</div></div>`;
  }

  const sections = {
    overview: `
      ${reviewPanel(nd)}
      <div class="panel"><h3>Highlights</h3><div class="hl">${hl.map(([b,l,p])=>`<div><span>${l}</span><b>${b}</b><p>${p}</p></div>`).join('')}</div></div>
      <div class="panel"><h3>Nights per year <span class="legend"><span><i style="background:var(--music)"></i>Music</span><span><i style="background:var(--comedy)"></i>Comedy</span></span></h3><div class="bars">${yb}</div></div>
      ${newRepeatPanel(past, y0, y1)}
      ${heatPanel(nd, y0, y1)}
      <div class="two">
        <div class="panel"><h3>By month</h3><div class="bars" style="height:120px">${mb}</div></div>
        ${dayPanel(nd)}
      </div>
      ${sameDayPanel(nd)}
      ${gapPanel(nd)}
      ${ratingPanel(nd)}
      ${spendingPanel(nd)}
      ${companionPanel(ns)}
      ${extrasHint(nd)}`,
    artists: `
      ${most}
      ${wallPanel(past)}
      <div class="panel"><h3>Seen more than once <span>${reps.length} artists</span></h3><div class="tbl-wrap">${tbl}</div></div>
      ${genrePanel(dated, rank)}
      ${agePanel(dated)}
      ${openerPanel(ns)}`,
    places: `
      <div class="two">
        <div class="panel"><h3>Top venues <span>nights</span></h3>${rank(venueNames, 10, k => `data-venue="${esc(venueKeyOf[k])}"`)}</div>
        <div class="panel"><h3>Cities <span>nights</span></h3>${rank(cityN)}</div>
      </div>
      <div class="panel" id="venueMapPanel"></div>
      <div class="panel" id="mapPanel"></div>
      ${eraPanel(ns)}`,
    listening: `
      ${summaryPanel()}
      ${bucketPanel(past)}
      ${aroundPanel(past)}
      ${knownPanel()}
      ${setlistPanel(rank)}
      ${byYearPanel(nd)}
      ${yearTopsPanel()}
      ${habitsPanel()}
      ${favoritesPanel()}
      ${clockPanel()}`,
  };
  const hasListening = sections.listening.trim();
  if (state.statsSection && !sections[state.statsSection]?.trim()) state.statsSection = null;
  // Counted as in the header: a venue name in two cities is one venue there, though the rankings split it
  const venueCount = new Set(past.map(s => s.venue.toLowerCase()).filter(Boolean)).size, cityCount = cityN.size;
  let listeningLine = 'Setlists from the shows you saw';
  let listeningBig = `${past.length} sets`;
  if (state.LISTEN?.summary) {
    listeningLine = 'Bucket list, the show bump, songs you knew, and when you press play';
    listeningBig = `${state.LISTEN.summary.hours.toLocaleString()} hours`;
  }
  const cards = [
    ['overview', 'Overview', `${ns.length} nights`, 'Year in review, highlights, streaks and every month out'],
    ['artists', 'Artists', `${A.length} acts`, 'Everyone you\'ve seen, repeat sightings, genres and openers'],
    ['places', 'Places', `${venueCount} venues`, `${cityCount} cities on a map, where the bands came from, and before and after the move`],
  ];
  if (hasListening) cards.push(['listening', 'Listening', listeningBig, listeningLine]);
  const landing = `<div class="stat-cards">${cards.map(([id, name, big, line]) => `<button type="button" class="stat-card" data-stats-section="${id}"><span class="k">${name}</span><b>${big}</b><span class="line">${esc(line)}</span></button>`).join('')}</div>`;
  // Section links: the same four as the cards, plus a way back to them
  const links = [['', 'All'], ...cards.map(([id, name]) => [id, name])].map(([id, name]) => {
    let current = '';
    if ((state.statsSection || '') === id) current = ' aria-current="page"';
    return `<button type="button" data-stats-section="${id}"${current}>${name}</button>`;
  }).join('');
  const subnav = `<nav class="subnav" aria-label="Stats sections">${links}</nav>`;
  let body = landing;
  if (state.statsSection) {
    const title = cards.find(c => c[0] === state.statsSection)[1];
    body = `<h2 class="sr-only">${title}</h2>${sections[state.statsSection]}`;
  }
  $('#statsView').innerHTML = subnav + body;
  runCounters($('#statsView'));
  arrangeWall();
  drawMap();
  drawVenueMap();
}
