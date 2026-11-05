// Build-time data for the pre-rendered summary, the page description and the share image.
// Fetched once per build from the production API, so they match the live log. Falls back to the bundled
// public/shows.json (the data the database was seeded from) if the API can't be reached, so a build never fails on it.
// The counting rules match the header's (log.js renderStats): past shows only, nights grouped by date + venue + city.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Netlify sets URL to the site's main address during builds
const SITE = process.env.URL || "https://cory-concert-tracker.netlify.app";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function loadShows(){
  try {
    const r = await fetch(`${SITE}/api/shows`, { signal: AbortSignal.timeout(10000) });
    if (r.ok) return { shows: await r.json(), source: "api" };
  } catch {}
  // From the project root: this module is bundled before it runs
  const shows = JSON.parse(await readFile(resolve("public/shows.json"), "utf8"));
  return { shows, source: "seed" };
}

// "Phoenix, AZ", or "Saitama, Tokyo, Japan" outside the US
export function place(o){
  if (!o.city) return "";
  if (o.country && o.country !== "US") {
    let region = "";
    if (o.state && o.state !== o.city) region = `${o.state}, `;
    return `${o.city}, ${region}${o.country}`;
  }
  if (o.state) return `${o.city}, ${o.state}`;
  return o.city;
}

function nights(list){
  const map = new Map();
  list.forEach((s, i) => {
    const k = `${s.date || "undated"}|${s.venue.toLowerCase()}|${s.city.toLowerCase()}`;
    if (!map.has(k)) map.set(k, { date: s.date, venue: s.venue, city: s.city, state: s.state, country: s.country, acts: [], idx: i });
    map.get(k).acts.push(s);
  });
  return [...map.values()].sort((a, b) => {
    if (!a.date && !b.date) return a.idx - b.idx;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date) || a.idx - b.idx;
  });
}

export const longDate = d => `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}`;

let cached;
export async function siteData(){
  if (cached) return cached;
  const { shows, source } = await loadShows();
  const today = new Date().toISOString().slice(0, 10);
  const happened = s => !s.date || s.date < today;
  const past = shows.filter(happened);
  const all = nights(past);

  const artistCounts = new Map();
  past.forEach(s => { const k = s.artist.trim(); artistCounts.set(k, (artistCounts.get(k) || 0) + 1); });
  const venues = new Set(past.map(s => s.venue.toLowerCase()).filter(Boolean));
  const cities = new Set(past.filter(s => s.city).map(place));
  const years = all.filter(n => n.date).map(n => n.date.slice(0, 4)).sort();

  const upcoming = nights(shows.filter(s => !happened(s))).sort((a, b) => a.date.localeCompare(b.date));
  const repeats = [...artistCounts].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const totals = { nights: all.length, artists: artistCounts.size, venues: venues.size, cities: cities.size };
  let span = "";
  if (years.length) span = `${years[0]}–${years.at(-1)}`;
  const description = `${totals.nights} nights out since ${years[0] || "2002"}: ${totals.artists} artists at ${totals.venues} venues in ${totals.cities} cities. Cory's log of every concert and stand-up show.`;

  cached = {
    site: SITE, source, totals, span, description,
    recent: all.filter(n => n.date).slice(0, 12),
    upcoming,
    repeats: repeats.slice(0, 12),
  };
  return cached;
}
