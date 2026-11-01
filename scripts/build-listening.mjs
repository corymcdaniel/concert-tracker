// Turns a Spotify data export into public/listening.json, the public per-artist totals used by the Bucket list panel.
// Run by hand with the folder you unzipped (keep it outside this repo):
//   node scripts/build-listening.mjs "C:/path/to/Spotify Extended Streaming History"
// Only artist totals are written. Tracks, timestamps, IP addresses and devices never leave the export.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const TOP_ARTISTS = 300;
const MIN_PLAY_MS = 30000; // Spotify's own line for what counts as a stream
const WIKI_BATCH = 50;
const MUSICAL = /\b(band|group|musician|singer|rapper|songwriter|dj|producer|composer|duo|trio|quartet|orchestra|ensemble|guitarist|drummer|pianist|comedian|music|artist)\b/i;

const folder = process.argv[2];
if (!folder) {
  console.error('Usage: node scripts/build-listening.mjs "<unzipped export folder>"');
  process.exit(1);
}

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
    ms: row.ms_played ?? row.msPlayed ?? 0,
    year: String(row.ts ?? row.endTime ?? "").slice(0, 4),
    hidden: !!row.incognito_mode,
  };
}

async function totals(files) {
  const byArtist = new Map();
  let plays = 0;
  for (const file of files) {
    for (const row of JSON.parse(await readFile(join(folder, file), "utf8"))) {
      const p = toPlay(row);
      // No artist means a podcast or audiobook. Private sessions stay private on a public site.
      if (!p.artist || p.hidden || p.ms < MIN_PLAY_MS) continue;
      const a = byArtist.get(p.artist) || { name: p.artist, ms: 0, plays: 0, first: p.year, last: p.year };
      a.ms += p.ms;
      a.plays++;
      if (p.year < a.first) a.first = p.year;
      if (p.year > a.last) a.last = p.year;
      byArtist.set(p.artist, a);
      plays++;
    }
  }
  return { artists: [...byArtist.values()].sort((a, b) => b.ms - a.ms), plays };
}

async function wikiPages(titles) {
  const q = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", redirects: "1",
    prop: "description|pageimages", piprop: "name", pilicense: "free", pilimit: String(WIKI_BATCH),
    titles: titles.join("|"),
  });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${q}`, { headers: { "user-agent": "show-log-listening-builder/1.0" } });
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

// Finds each artist's page and free photo: their name first, then "Name (band)" and "Name (musician)" for the misses
async function addWikipedia(artists) {
  let todo = artists;
  for (const suffix of ["", " (band)", " (musician)"]) {
    const missed = [];
    for (let i = 0; i < todo.length; i += WIKI_BATCH) {
      const chunk = todo.slice(i, i + WIKI_BATCH);
      const pages = await wikiPages(chunk.map((a) => a.name + suffix));
      for (const a of chunk) {
        const page = pages.get(a.name + suffix);
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
const { artists, plays } = await totals(files);
if (!plays) {
  console.error(`Read ${files.length} file(s) but found no plays. Check the field names against the export's "Read Me First" file.`);
  process.exit(1);
}

const top = artists.slice(0, TOP_ARTISTS);
try {
  await addWikipedia(top);
} catch (e) {
  console.warn(`Skipping photos: ${e.message}`);
}

const years = top.flatMap((a) => [a.first, a.last]).filter(Boolean).sort();
await writeFile("public/listening.json", JSON.stringify({
  from: years[0],
  to: years.at(-1),
  artists: top.map(({ name, ms, plays, first, wiki, desc, img }) => ({
    name, hours: Math.round(ms / 360000) / 10, plays, first, wiki, desc, img,
  })),
}));
console.log(`${files.length} file(s), ${plays.toLocaleString()} plays, ${artists.length.toLocaleString()} artists.`);
console.log(`Wrote the top ${top.length} to public/listening.json, ${top.filter((a) => a.img).length} with photos.`);
