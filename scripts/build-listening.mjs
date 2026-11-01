// Turns a Spotify data export into the public listening files:
//   public/listening.json        artist totals, yearly and all-time summaries, and plays around each show in the log
//   public/listening-songs.json  the first time you played each song by an act you've seen
// Run by hand with the folder you unzipped. It reads the log from the live site unless you pass another /api/shows URL:
//   node scripts/build-listening.mjs spotify [shows url]
// Tracks, timestamps, IP addresses and devices otherwise never leave the export.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { matchKey, songKey } from "../src/scripts/match.js";

const TOP_ARTISTS = 300;
const TOP_PER_YEAR = 5;
const MIN_PLAY_MS = 30000; // Spotify's own line for what counts as a stream
const WIKI_BATCH = 50;
const BROAD_SEARCH = 3; // suffixes everyone gets; the rest are only tried for the top artists, to go easy on Wikipedia
const TOP_FOR_ALL_SUFFIXES = 100;
const WINDOW_DAYS = 30; // how far either side of a show counts as "around" it
const SETTLED_DAYS = 365; // a first show this soon after the history begins can't be called cold
const LIST_SIZE = 8;
const TOP_SONGS = 15;
const OBSESSION_MIN_HOURS = 10;
const COMEBACK_MIN_YEARS = 2;
const COMEBACK_MIN_PLAYS = 20; // on each side of the gap, so a stray play doesn't count as a comeback
// Where you were, for the clock stats. Plays outside the US are left out, and travel inside it isn't known.
const MOVE_DATE = "2021-06-01";
const ZONE_BEFORE_MOVE = "America/New_York";
const ZONE_AFTER_MOVE = "America/Phoenix";
const MUSICAL = /\b(band|(super)?group|musician|singer|rapper|songwriter|dj|producer|composer|(super)?duo|trio|quartet|orchestra|ensemble|guitarist|drummer|pianist|comedian|music|artist)\b/i;
const PAGE_SUFFIXES = ["", " (band)", " (musician)", " (American band)", " (English band)", " (British band)", " (French band)", " (Canadian band)", " (Australian band)", " (rapper)", " (singer)"];

const folder = process.argv[2];
const showsUrl = process.argv[3] || "https://cory-concert-tracker.netlify.app/api/shows";
if (!folder) {
  console.error('Usage: node scripts/build-listening.mjs "<unzipped export folder>" [shows url]');
  process.exit(1);
}

const hours = (ms) => Math.round(ms / 360000) / 10;
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

// Extended history is the whole account. The basic export repeats its last year, so don't count both.
async function exportFiles() {
  const names = (await readdir(folder, { recursive: true })).filter((f) => f.toLowerCase().endsWith(".json"));
  const extended = names.filter((f) => /streaming_history_/i.test(f));
  if (extended.length) return extended;
  return names.filter((f) => /streaminghistory_?music/i.test(f));
}

// Extended rows and basic rows name the same things differently
function toPlay(row) {
  return {
    artist: row.master_metadata_album_artist_name ?? row.artistName,
    track: row.master_metadata_track_name ?? row.trackName,
    album: row.master_metadata_album_album_name,
    ts: row.ts,
    country: row.conn_country,
    shuffle: !!row.shuffle,
    skipped: !!row.skipped,
    ms: row.ms_played ?? row.msPlayed ?? 0,
    date: String(row.ts ?? row.endTime ?? "").slice(0, 10),
    hidden: !!row.incognito_mode,
  };
}

async function readPlays(files) {
  const plays = [];
  for (const file of files) {
    for (const row of JSON.parse(await readFile(join(folder, file), "utf8"))) {
      const p = toPlay(row);
      // No artist means a podcast or audiobook. Private sessions stay private on a public site.
      if (!p.artist || p.hidden || p.ms < MIN_PLAY_MS) continue;
      plays.push(p);
    }
  }
  return plays;
}

function totals(plays) {
  const byArtist = new Map();
  for (const p of plays) {
    const year = p.date.slice(0, 4);
    const a = byArtist.get(p.artist) || { name: p.artist, ms: 0, plays: 0, first: year, last: year };
    a.ms += p.ms;
    a.plays++;
    if (year < a.first) a.first = year;
    if (year > a.last) a.last = year;
    byArtist.set(p.artist, a);
  }
  return [...byArtist.values()].sort((a, b) => b.ms - a.ms);
}

function topByYear(plays) {
  const years = new Map();
  for (const p of plays) {
    const year = p.date.slice(0, 4);
    if (!years.has(year)) years.set(year, new Map());
    const artists = years.get(year);
    artists.set(p.artist, (artists.get(p.artist) || 0) + p.ms);
  }
  const out = {};
  for (const [year, artists] of years) {
    out[year] = [...artists].sort((a, b) => b[1] - a[1]).slice(0, TOP_PER_YEAR).map(([name, ms]) => ({ name, hours: hours(ms) }));
  }
  return out;
}

// Whole-history totals, and what each year added
function summary(plays, shows) {
  const seen = new Set(shows.map((s) => matchKey(s.artist)));
  const artists = new Set(plays.map((p) => matchKey(p.artist)));
  const songs = new Set(plays.filter((p) => p.track).map((p) => `${matchKey(p.artist)}|${songKey(p.track)}`));
  const totalMs = plays.reduce((sum, p) => sum + p.ms, 0);
  const seenMs = plays.filter((p) => seen.has(matchKey(p.artist))).reduce((sum, p) => sum + p.ms, 0);
  const share = (test) => Math.round(plays.filter(test).length / plays.length * 100);
  return {
    hours: Math.round(totalMs / 36e5),
    plays: plays.length,
    artists: artists.size,
    songs: songs.size,
    seenShare: Math.round(seenMs / totalMs * 100),
    shuffled: share((p) => p.shuffle),
    skipped: share((p) => p.skipped),
  };
}

function yearly(plays) {
  const years = new Map();
  const known = new Set();
  for (const p of [...plays].sort((a, b) => a.date.localeCompare(b.date))) {
    const year = p.date.slice(0, 4);
    if (!years.has(year)) years.set(year, { year, ms: 0, newArtists: 0 });
    const y = years.get(year);
    y.ms += p.ms;
    const k = matchKey(p.artist);
    if (!known.has(k)) { known.add(k); y.newArtists++; }
  }
  return [...years.values()].map(({ year, ms, newArtists }) => ({ year, hours: Math.round(ms / 36e5), newArtists }));
}

function habits(plays) {
  const byArtist = new Map();
  for (const p of plays) {
    const k = matchKey(p.artist);
    if (!byArtist.has(k)) byArtist.set(k, { name: p.artist, ms: 0, years: new Map(), dates: [] });
    const a = byArtist.get(k);
    const year = p.date.slice(0, 4);
    a.ms += p.ms;
    a.years.set(year, (a.years.get(year) || 0) + p.ms);
    a.dates.push(p.date);
  }
  const list = [...byArtist.values()];
  const obsessions = list.filter((a) => a.ms >= OBSESSION_MIN_HOURS * 36e5).map((a) => {
    const [year, ms] = [...a.years].sort((x, y) => y[1] - x[1])[0];
    return { name: a.name, year, share: Math.round(ms / a.ms * 100), hours: Math.round(ms / 36e5) };
  }).sort((a, b) => b.share - a.share).slice(0, LIST_SIZE);
  const loyal = list.map((a) => ({ name: a.name, years: [...a.years.values()].filter((ms) => ms >= 36e5).length, hours: Math.round(a.ms / 36e5) }))
    .sort((a, b) => b.years - a.years || b.hours - a.hours).slice(0, LIST_SIZE);
  const comebacks = [];
  for (const a of list) {
    const dates = a.dates.sort();
    let best = null;
    for (let i = COMEBACK_MIN_PLAYS; i <= dates.length - COMEBACK_MIN_PLAYS; i++) {
      const gap = (Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 864e5 / 365.25;
      if (gap >= COMEBACK_MIN_YEARS && (!best || gap > best.gap)) best = { gap, back: dates[i].slice(0, 4), plays: dates.length - i };
    }
    if (best) comebacks.push({ name: a.name, years: Math.round(best.gap * 10) / 10, back: best.back, plays: best.plays });
  }
  comebacks.sort((a, b) => b.years - a.years);
  const days = new Map();
  for (const p of plays) {
    if (!days.has(p.date)) days.set(p.date, { ms: 0, artists: new Map() });
    const d = days.get(p.date);
    d.ms += p.ms;
    d.artists.set(p.artist, (d.artists.get(p.artist) || 0) + p.ms);
  }
  const bigDays = [...days].sort((a, b) => b[1].ms - a[1].ms).slice(0, LIST_SIZE).map(([date, d]) => ({
    date, hours: hours(d.ms), artist: [...d.artists].sort((x, y) => y[1] - x[1])[0][0],
  }));
  return { yearCount: new Set(plays.map((p) => p.date.slice(0, 4))).size, obsessions, loyal, comebacks: comebacks.slice(0, LIST_SIZE), bigDays };
}

function favorites(plays) {
  const songs = new Map();
  const albums = new Map();
  const onADay = new Map();
  for (const p of plays) {
    if (!p.track) continue;
    const song = `${matchKey(p.artist)}|${songKey(p.track)}`;
    if (!songs.has(song)) songs.set(song, { name: p.track, artist: p.artist, plays: 0 });
    songs.get(song).plays++;
    const day = `${song}|${p.date}`;
    if (!onADay.has(day)) onADay.set(day, { song, name: p.track, artist: p.artist, date: p.date, plays: 0 });
    onADay.get(day).plays++;
    if (!p.album) continue;
    const album = `${matchKey(p.artist)}|${p.album}`;
    if (!albums.has(album)) albums.set(album, { name: p.album, artist: p.artist, ms: 0 });
    albums.get(album).ms += p.ms;
  }
  // A song once only: its biggest day
  const repeated = new Set();
  const repeats = [];
  for (const d of [...onADay.values()].sort((a, b) => b.plays - a.plays)) {
    if (repeated.has(d.song)) continue;
    repeated.add(d.song);
    repeats.push({ name: d.name, artist: d.artist, date: d.date, plays: d.plays });
    if (repeats.length === TOP_SONGS) break;
  }
  return {
    songs: [...songs.values()].sort((a, b) => b.plays - a.plays).slice(0, TOP_SONGS),
    albums: [...albums.values()].sort((a, b) => b.ms - a.ms).slice(0, TOP_SONGS).map(({ name, artist, ms }) => ({ name, artist, hours: Math.round(ms / 36e5) })),
    repeats,
  };
}

// Hours by local hour, weekday and month. Only rows that say when and where count.
function clock(plays) {
  const parts = (zone) => new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", hourCycle: "h23", weekday: "short", month: "numeric" });
  const before = parts(ZONE_BEFORE_MOVE);
  const after = parts(ZONE_AFTER_MOVE);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ms = { hours: Array(24).fill(0), weekdays: Array(7).fill(0), months: Array(12).fill(0) };
  let counted = 0;
  for (const p of plays) {
    if (!p.ts || p.country !== "US") continue;
    let zone = after;
    if (p.date < MOVE_DATE) zone = before;
    const at = Object.fromEntries(zone.formatToParts(new Date(p.ts)).map((x) => [x.type, x.value]));
    ms.hours[+at.hour] += p.ms;
    ms.weekdays[weekdays.indexOf(at.weekday)] += p.ms;
    ms.months[+at.month - 1] += p.ms;
    counted++;
  }
  if (!counted) return null;
  const round = (list) => list.map((v) => Math.round(v / 36e5));
  return { hours: round(ms.hours), weekdays: round(ms.weekdays), months: round(ms.months), share: Math.round(counted / plays.length * 100) };
}

// One row per music act per show since the history began: how much you played them around it
function sightings(plays, shows, since, until) {
  const datesByArtist = new Map();
  for (const p of plays) {
    const k = matchKey(p.artist);
    if (!datesByArtist.has(k)) datesByArtist.set(k, []);
    datesByArtist.get(k).push(p.date);
  }
  const past = shows.filter((s) => !s.date || s.date <= until);
  const firstSeen = new Map();
  for (const s of past) {
    const k = matchKey(s.artist);
    // An undated show could be any time, so it may be the real first
    if (!s.date) firstSeen.set(k, "");
    else if (!firstSeen.has(k) || s.date < firstSeen.get(k)) firstSeen.set(k, s.date);
  }
  const rows = [];
  for (const s of past) {
    if (!s.date || s.type === "Comedy" || s.date < addDays(since, WINDOW_DAYS)) continue;
    const k = matchKey(s.artist);
    const dates = datesByArtist.get(k) || [];
    const count = (test) => dates.filter(test).length;
    const windowEnd = addDays(s.date, WINDOW_DAYS);
    const windowStart = addDays(s.date, -WINDOW_DAYS);
    let after = null;
    if (windowEnd <= until) after = count((d) => d > s.date && d <= windowEnd);
    rows.push({
      artist: s.artist,
      date: s.date,
      before: count((d) => d >= windowStart && d < s.date),
      after,
      prior: count((d) => d < s.date),
      later: count((d) => d > s.date),
      first: firstSeen.get(k) === s.date && s.date >= addDays(since, SETTLED_DAYS),
    });
  }
  return rows;
}

function firstPlays(plays, shows) {
  const seen = new Set(shows.map((s) => matchKey(s.artist)));
  const out = {};
  for (const p of plays) {
    const k = matchKey(p.artist);
    if (!seen.has(k) || !p.track) continue;
    const song = songKey(p.track);
    if (!song) continue;
    out[k] = out[k] || {};
    if (!out[k][song] || p.date < out[k][song]) out[k][song] = p.date;
  }
  return out;
}

async function wikiPages(titles) {
  const q = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", redirects: "1",
    prop: "description|pageimages", piprop: "name", pilicense: "free", pilimit: String(WIKI_BATCH),
    titles: titles.join("|"),
  });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${q}`, { headers: { "user-agent": "show-log-listening-builder/1.0 (https://cory-concert-tracker.netlify.app)" } });
  if (!res.ok) throw new Error(`wikipedia: ${res.status}`);
  const { query } = await res.json();
  const pages = new Map((query.pages || []).map((p) => [p.title, p]));
  // Follow each title through Wikipedia's renames back to the page it landed on
  const moves = new Map([...(query.normalized || []), ...(query.redirects || [])].map((m) => [m.from, m.to]));
  const out = new Map();
  for (const title of titles) {
    let at = title;
    while (moves.has(at)) at = moves.get(at);
    if (pages.has(at)) out.set(title, pages.get(at));
  }
  return out;
}

// Page titles are case-sensitive after the first letter, so "TOOL (band)" has to be asked for as "Tool (band)"
const pageName = (name) => {
  if (name.length > 1 && name === name.toUpperCase()) return name[0] + name.slice(1).toLowerCase();
  return name;
};

// Finds each artist's page and free photo: their name first, then "Name (band)" and the like for the misses
async function addWikipedia(artists) {
  let todo = artists;
  const leaders = new Set(artists.slice(0, TOP_FOR_ALL_SUFFIXES));
  for (const [pass, suffix] of PAGE_SUFFIXES.entries()) {
    if (pass >= BROAD_SEARCH) todo = todo.filter((a) => leaders.has(a));
    const missed = [];
    for (let i = 0; i < todo.length; i += WIKI_BATCH) {
      const chunk = todo.slice(i, i + WIKI_BATCH);
      const pages = await wikiPages(chunk.map((a) => pageName(a.name) + suffix));
      for (const a of chunk) {
        const page = pages.get(pageName(a.name) + suffix);
        if (!page || page.missing || !MUSICAL.test(page.description || "")) { missed.push(a); continue; }
        a.wiki = page.title;
        a.desc = page.description;
        if (page.pageimage) a.img = page.pageimage;
      }
    }
    todo = missed;
  }
}

const files = await exportFiles();
if (!files.length) {
  console.error(`No streaming history files found in ${folder}. Expected Streaming_History_*.json or StreamingHistory_music_*.json.`);
  process.exit(1);
}
const plays = await readPlays(files);
if (!plays.length) {
  console.error(`Read ${files.length} file(s) but found no plays. Check the field names against the export's "Read Me First" file.`);
  process.exit(1);
}
const res = await fetch(showsUrl);
if (!res.ok) {
  console.error(`Couldn't read the log from ${showsUrl}: ${res.status}`);
  process.exit(1);
}
const shows = await res.json();

const artists = totals(plays);
const top = artists.slice(0, TOP_ARTISTS);
try {
  await addWikipedia(top);
} catch (e) {
  console.warn(`Stopped looking up photos partway, so some are missing. Run it again later. (${e.message})`);
}

const dates = plays.map((p) => p.date).sort();
const since = dates[0];
const until = dates.at(-1);
const rows = sightings(plays, shows, since, until);
const songs = firstPlays(plays, shows);
await writeFile("public/listening.json", JSON.stringify({
  from: since.slice(0, 4),
  to: until.slice(0, 4),
  artists: top.map(({ name, ms, plays: count, first, wiki, desc, img }) => ({
    name, hours: hours(ms), plays: count, first, wiki, desc, img,
  })),
  years: topByYear(plays),
  summary: summary(plays, shows),
  yearly: yearly(plays),
  habits: habits(plays),
  favorites: favorites(plays),
  clock: clock(plays),
  sightings: rows,
}));
await writeFile("public/listening-songs.json", JSON.stringify(songs));
console.log(`${files.length} file(s), ${plays.length.toLocaleString()} plays, ${artists.length.toLocaleString()} artists, ${since} to ${until}.`);
console.log(`Wrote the top ${top.length} to public/listening.json, ${top.filter((a) => a.img).length} with photos, and ${rows.length} show rows.`);
console.log(`Wrote first plays for ${Object.keys(songs).length} seen acts to public/listening-songs.json.`);
