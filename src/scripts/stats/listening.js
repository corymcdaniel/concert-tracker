import { imgUrl } from '../info.js';
import { MONTHS, state } from '../state.js';
import { fmt } from './index.js';
import { panelBars } from './panels.js';
import { esc } from '../util.js';

/* listening stats: everything here comes from listening.json, built by scripts/build-listening.mjs */
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SOURCE = '<span>listening: Spotify</span>';
const artistButton = name => `<button type="button" data-artist="${esc(name)}">${esc(name)}</button>`;
const list = (title, rows) => `<div><p class="sub">${title}</p><ul class="mini">${rows.join('')}</ul></div>`;
const bars = (values, labelOf, titleOf, height) => panelBars(values.map((v, i) => ({label: labelOf(i), title: titleOf(i), parts: [['seg-m', v]]})), height);

export function summaryPanel(){
  const s = state.LISTEN?.summary;
  if (!s) return '';
  const days = Math.round(s.hours / 24);
  const cards = [
    [s.hours.toLocaleString(), 'Hours played', `About ${days} days of music since ${state.LISTEN.from}.`],
    [s.plays.toLocaleString(), 'Plays', `Plays over 30 seconds. ${s.shuffled}% were on shuffle and ${s.skipped}% got skipped.`],
    [s.artists.toLocaleString(), 'Artists', `Across ${s.songs.toLocaleString()} different songs.`],
    [`${s.seenShare}%`, 'Seen live', `Of your listening is artists you've also seen live.`],
  ];
  return `<div class="panel"><h3>Your listening ${SOURCE}</h3><div class="hl">${cards.map(([b, l, p]) => `<div><span>${l}</span><b>${b}</b><p>${p}</p></div>`).join('')}</div></div>`;
}

// Small multiples rather than one chart with two scales: hours and nights aren't comparable numbers
export function byYearPanel(nd){
  const rows = state.LISTEN?.yearly;
  if (!rows?.length) return '';
  const nightsIn = {};
  nd.forEach(n => { const y = n.date.slice(0, 4); nightsIn[y] = (nightsIn[y] || 0) + 1; });
  const label = i => `'${rows[i].year.slice(2)}`;
  const top = [...rows].sort((a, b) => b.hours - a.hours)[0];
  return `<div class="panel"><h3>Listening by year ${SOURCE}</h3>
    <p class="lede">Your biggest year was <b>${top.year}</b> at <b>${top.hours} hours</b>, with ${nightsIn[top.year] || 0} nights out. The first and last years are partial.</p>
    <p class="sub">Hours played</p>${bars(rows.map(r => r.hours), label, i => `${rows[i].year}: ${rows[i].hours} hours`, 110)}
    <p class="sub bars-gap">New artists</p>${bars(rows.map(r => r.newArtists), label, i => `${rows[i].year}: ${rows[i].newArtists} new artists`, 90)}
    <p class="sub bars-gap">Nights out</p>${bars(rows.map(r => nightsIn[r.year] || 0), label, i => `${rows[i].year}: ${nightsIn[rows[i].year] || 0} nights`, 90)}
  </div>`;
}

export function yearTopsPanel(){
  const years = state.LISTEN?.years;
  if (!years) return '';
  const photo = name => state.LISTEN.artists.find(a => a.name === name)?.img;
  const tiles = Object.keys(years).sort().reverse().map(y => {
    const lead = years[y][0];
    let img = '';
    if (photo(lead.name)) img = `<img loading="lazy" src="${imgUrl(photo(lead.name), 400)}" alt="" onerror="this.remove()">`;
    return `<button type="button" data-artist="${esc(lead.name)}">${img}<span class="rk">${y}</span><span class="cap"><b>${esc(lead.name)}</b><small>${Math.round(lead.hours)} hrs</small></span></button>`;
  }).join('');
  return `<div class="panel"><h3>Top artist each year <span>listening: Spotify · photos: Wikimedia Commons</span></h3><div class="bucket">${tiles}</div></div>`;
}

export function habitsPanel(){
  const h = state.LISTEN?.habits;
  if (!h) return '';
  const blocks = [
    list('One-year obsessions, share of their hours', h.obsessions.map(a => `<li>${artistButton(a.name)}<span>${a.share}% in ${a.year}</span></li>`)),
    list(`Stuck with you, years of ${h.yearCount} with 1h+`, h.loyal.map(a => `<li>${artistButton(a.name)}<span>${a.years} yrs · ${a.hours}h</span></li>`)),
  ];
  if (h.comebacks.length) blocks.push(list('Comebacks, longest time away', h.comebacks.map(a => `<li>${artistButton(a.name)}<span>${a.years} yrs · back '${a.back.slice(2)}</span></li>`)));
  blocks.push(list('Biggest listening days', h.bigDays.map(d => `<li><span class="day">${fmt(d.date)}</span><span>${d.hours}h · ${esc(d.artist)}</span></li>`)));
  return `<div class="panel"><h3>Obsessions and loyalty ${SOURCE}</h3><div class="two">${blocks.join('')}</div></div>`;
}

export function favoritesPanel(){
  const f = state.LISTEN?.favorites;
  if (!f) return '';
  const song = s => `<button type="button" data-artist="${esc(s.artist)}">${esc(s.name)}</button>`;
  return `<div class="panel"><h3>Songs and albums ${SOURCE}</h3><div class="three">
    ${list('Most-played songs', f.songs.map(s => `<li>${song(s)}<span>${s.plays}× · ${esc(s.artist)}</span></li>`))}
    ${list('Most-played albums', f.albums.map(a => `<li>${song(a)}<span>${a.hours}h · ${esc(a.artist)}</span></li>`))}
    ${list('On repeat, most in one day', f.repeats.map(s => `<li>${song(s)}<span>${s.plays}× · ${esc(fmt(s.date))}</span></li>`))}
  </div></div>`;
}

export function clockPanel(){
  const c = state.LISTEN?.clock;
  if (!c) return '';
  const hourName = i => {
    if (i === 0) return '12a';
    if (i === 12) return '12p';
    if (i < 12) return `${i}a`;
    return `${i - 12}p`;
  };
  const most = values => values.indexOf(Math.max(...values));
  return `<div class="panel"><h3>When you listen ${SOURCE}</h3>
    <p class="lede">You listen most around <b>${hourName(most(c.hours))}</b>, on <b>${DAYS[most(c.weekdays)]}</b>, and in <b>${MONTHS[most(c.months)]}</b>. Approximate: it assumes you were home, and covers the ${c.share}% of plays made in the US.</p>
    <p class="sub">Hours played, by hour of day</p>${bars(c.hours, hourName, i => `${hourName(i)}: ${c.hours[i]} hours`, 120)}
    <div class="two bars-gap">
      <div><p class="sub">By day of week</p>${bars(c.weekdays, i => DAYS[i], i => `${DAYS[i]}: ${c.weekdays[i]} hours`, 100)}</div>
      <div><p class="sub">By month</p>${bars(c.months, i => MONTHS[i], i => `${MONTHS[i]}: ${c.months[i]} hours`, 100)}</div>
    </div></div>`;
}
