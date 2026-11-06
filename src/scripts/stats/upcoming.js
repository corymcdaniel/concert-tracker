import { countdown, daysUntil, nights, ordinal, weekday } from '../log.js';
import { matchKey, songKey } from '../match.js';
import { TODAY, state } from '../state.js';
import { fmt, yrs } from './index.js';
import { counter, plural } from './panels.js';
import { loadFirstPlays } from './setlists.js';
import { loadArtists } from './spotify.js';
import { loadFallback } from './venues.js';
import { artistBtn, drawTripMap, gather, lineupPanel, milestonesPanel, monthYear, nightName, noun, placesPanel, songRows, tilesHtml, timeline } from './window.js';
import { $, esc, happened, place } from '../util.js';

/* ---------- upcoming: stats about the shows you have tickets for ----------
   The panels that only need the log are drawn with the section. Distances and the map wait for venue
   coordinates, "How ready are you" for listening-artists.json and the likely setlists for /api/forecast,
   so drawUpcoming() fills those in after. The panels shared with Recent are in window.js. */

function data(){
  const past = state.shows.filter(happened);
  const ahead = nights(state.shows.filter(s => !happened(s))).sort((a, b) => a.date.localeCompare(b.date) || a.idx - b.idx);
  return gather(past, ahead);
}

/* the next show, and every show ahead on one line from today */
function heroPanel(ahead){
  const next = ahead[0];
  let more = '';
  if (next.acts.length > 1) more = ` <span class="uh-more">+ ${plural(next.acts.length - 1, 'more act')}</span>`;
  let fest = '';
  const festival = next.acts.find(a => a.festival)?.festival;
  if (festival) fest = `${esc(festival)} · `;
  let line = '';
  const end = ahead.at(-1).date;
  if (ahead.length > 1) line = timeline(ahead, TODAY, end, [[TODAY, 'Today']], `Upcoming shows from today to ${fmt(end)}`);
  return `<div class="panel up-hero">
    <div class="uh-top">
      <div class="uh-count"><span class="k">Next show</span><b>${countdown(daysUntil(next.date))}</b><span>${esc(weekday(next.date))}</span></div>
      <div class="uh-what"><p class="uh-acts">${artistBtn(next.acts[0].artist)}${more}</p>
        <p class="uh-where">${fest}<button type="button" data-venue="${esc(next.venue + '|' + next.city)}">${esc(next.venue)}</button>, ${esc(place(next))}</p></div>
    </div>${line}</div>`;
}

/* highlights */
function highlightsPanel({before, list, acts}){
  const fresh = acts.filter(x => x.nth === 1);
  const cities = new Set(list.map(place)).size;
  const tiles = [
    [counter('up-nights', list.length), `${noun(list.length, 'night')} booked`, `${plural(acts.length, 'act')} in ${cities} ${noun(cities, 'city')}`],
    [`${counter('up-fresh', fresh.length)} of ${acts.length}`, 'First time seeing', 'acts you\'ve never seen live'],
  ];
  const most = [...acts].sort((a, b) => b.nth - a.nth)[0];
  if (most.last) tiles.push([`×${most.nth}`, 'Most-seen act ahead', `${esc(most.a.artist)}, last seen ${fmt(most.last)}`]);
  const back = [...acts].filter(x => x.last).sort((a, b) => b.gap - a.gap)[0];
  if (back && back.gap >= 2 && back !== most) tiles.push([`${back.gap.toFixed(1)} yrs`, 'Longest wait to see again', `${esc(back.a.artist)}, last seen ${fmt(back.last)}`]);

  // Each year with shows booked: seen so far plus booked, against your best year
  const byYear = {};
  nights(before).filter(n => n.date).forEach(n => { const y = n.date.slice(0, 4); byYear[y] = (byYear[y] || 0) + 1; });
  const booked = {};
  list.forEach(n => { const y = n.date.slice(0, 4); booked[y] = (booked[y] || 0) + 1; });
  Object.keys(booked).sort().forEach(y => {
    const seen = byYear[y] || 0, total = seen + booked[y];
    const others = Object.entries(byYear).filter(([yy]) => yy !== y).map(([, c]) => c);
    const rank = others.filter(c => c > total).length + 1;
    let line = `${plural(booked[y], 'night')} booked so far`;
    if (seen) line = `${seen} seen + ${booked[y]} booked`;
    if (rank === 1) line += ', your busiest year yet';
    else if (rank <= 3) line += `, your ${ordinal(rank)}-busiest year`;
    tiles.push([`${total} nights`, y, line]);
  });
  const last = list.at(-1);
  if (list.length > 1) tiles.push([fmt(last.date), 'Furthest out', `${esc(nightName(last))}, ${countdown(daysUntil(last.date)).toLowerCase()}`]);
  return `<div class="panel"><h3>Coming up</h3>${tilesHtml(tiles)}</div>`;
}

export function upcomingSection(){
  const d = data();
  if (!d.list.length) return '';
  let setlists = '';
  if (state.mode === 'netlify' && d.acts.some(x => x.a.type === 'Music')) setlists = '<div class="panel" id="upSetlist"></div>';
  return `${heroPanel(d.list)}${highlightsPanel(d)}${milestonesPanel(d, {title: 'Milestones ahead', future: true})}
    <div class="panel" id="upReady" hidden></div>
    ${setlists}
    ${lineupPanel(d)}
    <div class="panel" id="upPlaces" hidden></div>`;
}
// The landing page's ticket for the section, or null with nothing booked
export function upcomingCard(){
  const ahead = data().list;
  if (!ahead.length) return null;
  const next = ahead[0];
  return ['upcoming', 'Upcoming', countdown(daysUntil(next.date)), `Next: ${nightName(next)} · ${next.venue}. ${plural(ahead.length, 'night')} booked, with milestones, likely setlists and where you're headed`];
}

/* ---------- filled in after the section is drawn ---------- */
let drawing = 0;
export async function drawUpcoming(){
  if (!$('#upReady')) return;
  const run = ++drawing;
  const d = data();
  const [listening, firstPlays] = await Promise.all([loadArtists(), loadFirstPlays(), loadFallback()]);
  // Another draw started, or the section closed, while the files loaded
  if (run !== drawing || !$('#upReady')) return;
  readyPanel(d, listening);
  placesPanel($('#upPlaces'), d, {title: 'Where you\'re headed', mapId: 'upMap', future: true});
  setlistPanel(d, listening, firstPlays);
  await drawTripMap('upMap', d, () => run !== drawing);
}

/* how ready are you: Spotify hours with each act before the show */
function readyPanel({acts}, listening){
  const box = $('#upReady');
  if (!listening) return;
  const music = acts.filter(x => x.a.type === 'Music');
  if (!music.length) return;
  const byName = new Map();
  music.forEach(x => { if (!byName.has(x.a.artist)) byName.set(x.a.artist, x); });
  const rows = [...byName.values()].map(x => ({...x, rec: listening.artists[matchKey(x.a.artist)]}));
  const played = rows.filter(r => r.rec).sort((a, b) => b.rec.h - a.rec.h);
  const cold = rows.filter(r => !r.rec);
  const hours = played.reduce((t, r) => t + r.rec.h, 0);
  const max = Math.max(...played.map(r => r.rec.h), 1);
  // Not played for six months before the export ends: time for a refresher
  const until = listening.until;
  const bars = played.map(r => {
    let due = '';
    if (yrs(r.rec.l, until) >= 0.5) due = '<span class="tag again">Due a refresher</span>';
    let hrs = `${Math.round(r.rec.h).toLocaleString()} hrs`;
    if (r.rec.h < 10) hrs = `${r.rec.h} hrs`;
    return `<li><span class="lab" style="--w:${(r.rec.h / max * 100).toFixed(1)}%">${artistBtn(r.a.artist)}${due}</span>
      <span class="c">${hrs}</span><span class="up-meta">#${r.rec.r.toLocaleString()} · last played ${monthYear(r.rec.l)}</span></li>`;
  }).join('');
  let lede = `You've played <b>${played.length}</b> of the ${plural(rows.length, 'act')} on Spotify, <b>${Math.round(hours).toLocaleString()}</b> hours between them.`;
  if (cold.length) lede += ` ${plural(cold.length, 'act')} you'll be hearing cold.`;
  let coldList = '';
  if (cold.length) coldList = `<p class="sub">Going in cold</p><p class="up-cold">${cold.map(r => `<button class="chip" type="button" data-artist="${esc(r.a.artist)}">${esc(r.a.artist)}</button>`).join('')}</p>`;
  let list = '';
  if (bars) list = `<ol class="rank up-ready">${bars}</ol>`;
  box.innerHTML = `<h3>How ready are you? <span>listening: Spotify, to ${monthYear(until)}</span></h3><p class="lede">${lede}</p>${list}${coldList}`;
  box.hidden = false;
}

/* likely setlists: what each act has played at their recent shows, from setlist.fm via /api/forecast */
const forecasts = new Map();
let picked = null;
function forecast(artist){
  if (!forecasts.has(artist)) forecasts.set(artist, (async () => {
    // setlist.fm's rate limit: ask again, a few times, with the round trip as the wait
    for (let tries = 0; tries < 4; tries++) {
      const r = await fetch(`/api/forecast?${new URLSearchParams({artist})}`);
      if (!r.ok) return null;
      const body = await r.json();
      if (!body.rateLimited) return body;
    }
    // Still limited: forget it, so the next visit asks again
    forecasts.delete(artist);
    return {rateLimited: true};
  })().catch(() => { forecasts.delete(artist); return null; }));
  return forecasts.get(artist);
}
let setlistData = null;
function setlistPanel(d, listening, firstPlays){
  const box = $('#upSetlist');
  if (!box) return;
  setlistData = {listening, firstPlays};
  const music = [...new Set(d.acts.filter(x => x.a.type === 'Music').map(x => x.a.artist))];
  if (!music.includes(picked)) picked = music[0];
  const chips = music.map(name => `<button type="button" class="chip" data-forecast="${esc(name)}" aria-pressed="${name === picked}">${esc(name)}</button>`).join('');
  box.innerHTML = `<h3>Likely setlist <span>setlists: setlist.fm</span></h3>
    <div class="up-acts" role="group" aria-label="Act">${chips}</div><div id="upForecast" aria-live="polite"></div>`;
  showForecast();
}
export function pickForecast(name){
  picked = name;
  document.querySelectorAll('[data-forecast]').forEach(b => b.setAttribute('aria-pressed', b.dataset.forecast === name));
  showForecast();
}
async function showForecast(){
  const out = $('#upForecast');
  if (!out || !setlistData) return;
  const name = picked;
  out.innerHTML = '<p class="lede up-wait">Checking setlist.fm…</p>';
  const f = await forecast(name);
  // A different act was picked while this one loaded
  if (name !== picked || !out.isConnected) return;
  if (!f) { out.innerHTML = '<p class="lede">Couldn\'t reach setlist.fm.</p>'; return; }
  if (f.rateLimited) { out.innerHTML = '<p class="lede">setlist.fm is busy. Pick the act again in a minute.</p>'; return; }
  if (!f.found) { out.innerHTML = `<p class="lede">setlist.fm has no recent setlists for ${esc(name)}.</p>`; return; }
  out.innerHTML = forecastHtml(name, f, setlistData);
}
function forecastHtml(name, f, {listening, firstPlays}){
  // When you first played each of their songs, if you have
  const known = firstPlays?.[matchKey(name)];
  const top = f.songs.slice(0, f.length), rest = f.songs.slice(f.length);
  const isKnown = song => known && known[songKey(song.name)] && known[songKey(song.name)] < TODAY;
  const knownN = top.filter(isKnown).length;
  let range = `${fmt(f.from)} – ${fmt(f.to)}`;
  if (f.from === f.to) range = fmt(f.to);
  let lede = `From their last <b>${f.shows}</b> ${noun(f.shows, 'show')} (${range}), about <b>${f.length}</b> songs a night.`;
  if (known) lede += ` You've played <b>${knownN}</b> of the ${top.length} they play most.`;
  else lede += ' You haven\'t played them on Spotify, so it\'ll all be new.';
  const rows = songRows(top, {
    bar: song => ({pct: (song.count / f.shows * 100).toFixed(0), text: `${song.count}/${f.shows}`}),
    mark: song => { if (isKnown(song)) return ['on', 'You\'ve played it']; return null; },
  });
  let more = '';
  if (rest.length) more = `<details class="sl-more"><summary>${plural(rest.length, 'more song')} now and then</summary><ul class="mini">${rest.map(s => `<li><span class="day">${esc(s.name)}</span><span>${s.count}/${f.shows}</span></li>`).join('')}</ul></details>`;
  // Your most-played songs by them that haven't come up lately
  const rec = listening?.artists[matchKey(name)];
  let hoping = '';
  if (rec) {
    const played = new Set(f.songs.map(s => songKey(s.name)));
    const missing = rec.s.filter(([song]) => !played.has(songKey(song)));
    if (missing.length) hoping = `<p class="sub">Your favorites they haven't played lately</p><p class="up-cold">${missing.map(([song, n]) => `<span class="chip">${esc(song)}<em>${n} plays</em></span>`).join('')}</p>`;
  }
  let link = '';
  if (f.url) link = `<a class="sl-link" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(name)} on setlist.fm ↗</a>`;
  return `<p class="lede">${lede}</p>
    <div class="sl-ends"><div><span>Usually opens</span><b>${esc(f.opener.name)}</b><small>${f.opener.count} of ${f.shows}</small></div>
      <div><span>Usually closes</span><b>${esc(f.closer.name)}</b><small>${f.closer.count} of ${f.shows}</small></div></div>
    <ol class="sl-songs">${rows}</ol>${more}${hoping}${link}`;
}
