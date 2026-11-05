// Replace the local database with production's public data, and copy the photo images into the local blob store.
// Run with: node scripts/pull-prod.mjs, while npm run dev is running
// Price and companions are editor-only in the API, so local shows come over without them.
// The local change history is cleared too, since it described data that's no longer there.
import { readFileSync } from "node:fs";
import { getStore } from "@netlify/blobs";
import { BlobsServer } from "@netlify/blobs/server";
import { getDatabase } from "@netlify/database";

const PROD = process.env.PROD_URL || "https://cory-concert-tracker.netlify.app";

async function get(path) {
  const r = await fetch(PROD + path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r;
}

const shows = await (await get("/api/shows")).json();
const info = await (await get("/api/info")).json();
const photos = await (await get("/api/photos")).json();
console.log(`Production: ${shows.length} shows, ${Object.keys(info.artists).length} artists, ${Object.keys(info.venues).length} venues, ${photos.length} photos`);

// Images first, so a failed download leaves the database untouched.
// dev:exec doesn't set up Blobs, so serve netlify dev's own local blob folder ourselves and write into it.
const state = JSON.parse(readFileSync(".netlify/state.json", "utf8"));
const blobs = new BlobsServer({ directory: ".netlify/blobs-serve", token: "pull-prod" });
const { port } = await blobs.start();
const store = getStore({ name: "photos", siteID: state.siteId, token: "pull-prod", apiURL: `http://localhost:${port}` });
const images = [];
for (const p of photos) {
  const r = await get(`/api/photos/${encodeURIComponent(p.id)}`);
  const type = r.headers.get("content-type").split(";")[0];
  const body = await r.arrayBuffer();
  images.push({ ...p, type, bytes: body.byteLength });
  await store.set(p.id, body, { metadata: { type } });
}
await blobs.stop();
console.log(`Copied ${images.length} images`);

// The running netlify dev session saves its local database address in .netlify/state.json
const db = getDatabase({ connectionString: process.env.NETLIFY_DB_URL || state.dbConnectionString });
const client = await db.pool.connect();
try {
  await client.query("BEGIN");
  await client.query("TRUNCATE photos, shows, artists, venues, changes RESTART IDENTITY");
  // Keep the change log quiet while loading. Not every local Postgres lets us, and that's fine:
  // the history is cleared again below.
  await client.query("SAVEPOINT quiet");
  try { await client.query("SET LOCAL session_replication_role = replica"); }
  catch { await client.query("ROLLBACK TO SAVEPOINT quiet"); }
  for (const [i, s] of shows.entries()) {
    await client.query(
      `INSERT INTO shows (id, artist, venue, city, state, country, date, type, notes, rating, festival, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [s.id, s.artist, s.venue, s.city, s.state, s.country, s.date, s.type, s.notes, s.rating, s.festival ?? null, i + 1]);
  }
  for (const [name, rec] of Object.entries(info.artists)) await client.query("INSERT INTO artists (name, info) VALUES ($1, $2)", [name, rec]);
  for (const [key, rec] of Object.entries(info.venues)) await client.query("INSERT INTO venues (key, info) VALUES ($1, $2)", [key, rec]);
  for (const p of images) {
    await client.query("INSERT INTO photos (id, show_id, type, width, height, bytes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [p.id, p.show_id, p.type, p.width, p.height, p.bytes, p.created_at]);
  }
  await client.query("TRUNCATE changes RESTART IDENTITY");
  await client.query("COMMIT");
  console.log("Local database now matches production");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
  await db.pool.end?.();
}
