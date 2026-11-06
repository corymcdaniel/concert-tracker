// GET  /api/setlists      -> public: the setlists found so far, { sets: [{ artist, date, url, songs }], checked }
// POST /api/setlists/sync -> editors: check setlist.fm for the next act that needs it, { remaining }
//                            One lookup per call: the page calls again until remaining is 0, and
//                            setlist.fm's rate limit comes back as { rateLimited: true }.
// The API key stays here on the server. Comedy isn't looked up: setlist.fm is music only.
import { requireEditor, json } from "../lib/auth.mjs";
import { read, write } from "../lib/db.mjs";
import { SEARCH, norm, songsOf } from "../lib/setlistfm.mjs";

const ACT_KEY = "lower(s.artist) || '|' || to_char(s.date, 'YYYY-MM-DD')";
// Acts with no row yet, or that setlist.fm didn't have a month ago (they do get added later)
const TODO = `FROM shows s LEFT JOIN setlists l ON l.key = ${ACT_KEY}
  WHERE s.date < CURRENT_DATE AND s.type = 'Music'
    AND (l.key IS NULL OR (NOT l.found AND l.fetched_at < now() - interval '30 days'))`;

// The search is fuzzy, so only accept the same artist. Prefers a result that has songs.
export function pickSetlist(results, artist) {
  const same = (results || []).filter((r) => norm(r.artist?.name) === norm(artist));
  const best = same.find((r) => songsOf(r).length);
  if (!best) return { found: false, url: null, songs: [] };
  return { found: true, url: best.url || null, songs: songsOf(best) };
}

export default async (req) => {
  if (req.method === "GET") {
    const [sets, [{ checked }]] = await Promise.all([
      read("SELECT artist, to_char(date, 'YYYY-MM-DD') AS date, url, songs FROM setlists WHERE found"),
      read("SELECT count(*)::int AS checked FROM setlists"),
    ]);
    return json({ sets, checked });
  }

  if (req.method === "POST") {
    const { user, error } = await requireEditor(req);
    if (error) return error;
    const key = Netlify.env.get("SETLISTFM_API_KEY");
    if (!key) return new Response("SETLISTFM_API_KEY isn't set on this site.", { status: 400 });

    const [{ remaining }] = await read(`SELECT count(*)::int AS remaining FROM (SELECT DISTINCT ${ACT_KEY} ${TODO}) t`);
    if (!remaining) return json({ remaining: 0 });
    const [next] = await read(
      `SELECT DISTINCT s.artist, to_char(s.date, 'YYYY-MM-DD') AS date ${TODO} ORDER BY date DESC, s.artist LIMIT 1`);

    const [y, m, d] = next.date.split("-");
    const q = new URLSearchParams({ artistName: next.artist, date: `${d}-${m}-${y}` });
    const res = await fetch(`${SEARCH}?${q}`, { headers: { "x-api-key": key, accept: "application/json" } });
    if (res.status === 429) return json({ rateLimited: true, remaining });
    if (!res.ok && res.status !== 404) return new Response(`setlist.fm answered ${res.status}.`, { status: 400 });

    let results = [];
    if (res.ok) results = (await res.json()).setlist;
    const set = pickSetlist(results, next.artist);
    await write(user, (c) => c.query(
      `INSERT INTO setlists (key, artist, date, found, url, songs) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO UPDATE SET artist = EXCLUDED.artist, found = EXCLUDED.found, url = EXCLUDED.url,
         songs = EXCLUDED.songs, fetched_at = now()`,
      [`${next.artist.toLowerCase()}|${next.date}`, next.artist, next.date, set.found, set.url, JSON.stringify(set.songs)]));
    return json({ remaining: remaining - 1, artist: next.artist, date: next.date, found: set.found });
  }
  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: ["/api/setlists", "/api/setlists/sync"] };
