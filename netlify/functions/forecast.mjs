// GET /api/forecast?artist=Name -> public: what an upcoming act has played at their recent shows
//   { artist, found, shows, from, to, length, url, opener, closer, songs: [{ name, count, cover? }] }
// Only acts on an upcoming music show can be asked about, and each answer is kept for a week,
// so page visits rarely reach setlist.fm. Its rate limit comes back as { rateLimited: true }.
import { json } from "../lib/auth.mjs";
import { read } from "../lib/db.mjs";
import { norm, songsOf } from "../lib/setlistfm.mjs";

const API = "https://api.setlist.fm/rest/1.0";
// Enough recent shows to see a pattern, few enough to stay on the current tour
const RECENT = 10;
// Most acts fill RECENT from the first page; one with many announced (empty) dates needs a few more
const MAX_PAGES = 3;

// setlist.fm dates are dd-MM-yyyy
const isoDate = (d) => d.split("-").reverse().join("-");

// The latest RECENT full setlists, tallied song by song. A setlist with under half the songs of the
// longest one is someone's partial entry, so it's left out.
export function tally(results) {
  const all = (results || []).map((r) => ({ date: isoDate(r.eventDate), songs: songsOf(r) })).filter((r) => r.songs.length);
  const longest = Math.max(0, ...all.map((r) => r.songs.length));
  const sets = all.filter((r) => r.songs.length >= longest / 2)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT);
  if (!sets.length) return { found: false };

  const songs = new Map(), opens = new Map(), closes = new Map();
  const bump = (map, name) => map.set(name, (map.get(name) || 0) + 1);
  for (const set of sets) {
    // A song played twice in one show counts once
    const once = new Map(set.songs.map((song) => [song.name.toLowerCase(), song]));
    for (const [key, song] of once) {
      if (!songs.has(key)) songs.set(key, { ...song, count: 0 });
      songs.get(key).count++;
    }
    bump(opens, set.songs[0].name);
    bump(closes, set.songs.at(-1).name);
  }
  const most = (map) => {
    const [name, count] = [...map].sort((a, b) => b[1] - a[1])[0];
    return { name, count };
  };
  return {
    found: true,
    shows: sets.length,
    from: sets.at(-1).date,
    to: sets[0].date,
    length: Math.round(sets.reduce((t, s) => t + s.songs.length, 0) / sets.length),
    opener: most(opens),
    closer: most(closes),
    songs: [...songs.values()].sort((a, b) => b.count - a.count),
  };
}

// Searching setlists by name also finds tribute acts ("An Evening With Radiohead"), so the artist is
// found first and their own setlists are read by MusicBrainz id. null means rate limited.
async function lookUp(artist, apiKey) {
  const get = (path, params) => fetch(`${API}/${path}?${new URLSearchParams(params)}`,
    { headers: { "x-api-key": apiKey, accept: "application/json" } });
  const res = await get("search/artists", { artistName: artist, sort: "relevance" });
  if (res.status === 429) return null;
  if (res.status === 404) return { found: false };
  if (!res.ok) throw new Error(`setlist.fm answered ${res.status}.`);
  const match = ((await res.json()).artist || []).find((a) => norm(a.name) === norm(artist));
  if (!match) return { found: false };

  const results = [];
  for (let p = 1; p <= MAX_PAGES; p++) {
    const page = await get(`artist/${match.mbid}/setlists`, { p: String(p) });
    // Rate limited partway: what's in hand will do, unless that's nothing
    if (page.status === 429) {
      if (!results.length) return null;
      break;
    }
    if (!page.ok) break;
    const body = await page.json();
    results.push(...(body.setlist || []));
    const full = results.filter((r) => songsOf(r).length).length;
    if (full >= RECENT || p * body.itemsPerPage >= body.total) break;
  }
  return { ...tally(results), url: match.url || null };
}

export default async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const artist = new URL(req.url).searchParams.get("artist")?.trim();
  if (!artist) return new Response("Which artist?", { status: 400 });

  const [act] = await read(
    "SELECT artist FROM shows WHERE lower(artist) = lower($1) AND date >= CURRENT_DATE AND type = 'Music' LIMIT 1", [artist]);
  if (!act) return new Response("Only upcoming music acts have a forecast.", { status: 404 });

  const key = act.artist.toLowerCase();
  const [kept] = await read("SELECT found, data FROM forecasts WHERE key = $1 AND fetched_at > now() - interval '7 days'", [key]);
  if (kept) return json({ artist: act.artist, found: kept.found, ...kept.data });

  const apiKey = Netlify.env.get("SETLISTFM_API_KEY");
  if (!apiKey) return new Response("SETLISTFM_API_KEY isn't set on this site.", { status: 400 });
  let answer;
  try { answer = await lookUp(act.artist, apiKey); }
  catch (e) { return new Response(e.message, { status: 502 }); }
  if (!answer) return json({ artist: act.artist, rateLimited: true });

  const { found, ...data } = answer;
  await read(
    `INSERT INTO forecasts (key, artist, found, data) VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) DO UPDATE SET artist = EXCLUDED.artist, found = EXCLUDED.found, data = EXCLUDED.data, fetched_at = now()`,
    [key, act.artist, found, JSON.stringify(data)]);
  return json({ artist: act.artist, found, ...data });
};

export const config = { path: "/api/forecast" };
