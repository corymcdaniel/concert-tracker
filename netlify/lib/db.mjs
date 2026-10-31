// Database access shared by the functions.
//   read(text, params)      one-off query, returns rows
//   write(user, fn, batch)  runs fn(client) in a transaction tagged with the
//                           editor, so the change-log trigger records who did it.
//                           batch (from newBatch) groups its changes in History.
import { randomUUID } from "node:crypto";
import { getDatabase } from "@netlify/database";

let db;
const pool = () => (db ??= getDatabase()).pool;

export async function read(text, params = []) {
  return (await pool().query(text, params)).rows;
}

export async function write(user, fn, batch = null) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user', $1, true), set_config('app.batch', $2, true)",
      [user?.email || user?.name || "", batch ?? ""]);
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Columns a show can be saved with, in API order
export const SHOW_FIELDS = ["artist", "venue", "city", "state", "country", "date", "type", "notes", "rating", "price", "companions"];
// Saved as they are when a request leaves them out, so an edit can't blank them by accident
export const EXTRA_FIELDS = ["rating", "price", "companions"];
export const PUBLIC_SELECT = `id, artist, venue, city, state, country, to_char(date, 'YYYY-MM-DD') AS date, type, notes, rating`;
export const SHOW_SELECT = `${PUBLIC_SELECT}, price, companions`;

// Bad input from a request: the functions answer it with a 400
export class Invalid extends Error {}

// Normalize a show from a request body. Throws Invalid when it can't be saved.
export function cleanShow(s) {
  if (!s || typeof s !== "object") throw new Invalid("Expected a show object");
  const str = (v) => String(v ?? "").trim();
  const out = {
    artist: str(s.artist),
    venue: str(s.venue),
    city: str(s.city),
    state: str(s.state) || null,
    country: str(s.country) || null,
    date: s.date || null,
    type: s.type || "Music",
    notes: str(s.notes),
  };
  if (!out.artist) throw new Invalid("Artist is required");
  if (out.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) throw new Invalid("Date must be YYYY-MM-DD");
  if (!["Music", "Comedy"].includes(out.type)) throw new Invalid("Type must be Music or Comedy");
  const blank = (v) => v === null || v === "";
  if (s.rating !== undefined) {
    out.rating = null;
    if (!blank(s.rating)) out.rating = Number(s.rating);
    if (out.rating !== null && (!Number.isInteger(out.rating) || out.rating < 1 || out.rating > 5)) throw new Invalid("Rating must be 1 to 5");
  }
  if (s.price !== undefined) {
    out.price = null;
    if (!blank(s.price)) out.price = Number(s.price);
    if (out.price !== null && !(out.price >= 0)) throw new Invalid("Price must be a positive number");
  }
  if (s.companions !== undefined) out.companions = str(s.companions) || null;
  return out;
}

// Fill in the extras a request left out from what's saved, inside the write's transaction
export async function keepExtras(c, rows) {
  const { rows: saved } = await c.query(`SELECT id, ${EXTRA_FIELDS.join(", ")} FROM shows WHERE id = ANY($1)`, [rows.map((r) => r.id)]);
  const byId = new Map(saved.map((r) => [r.id, r]));
  for (const r of rows)
    for (const f of EXTRA_FIELDS)
      if (r[f] === undefined) r[f] = byId.get(r.id)?.[f] ?? null;
}

export const newId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const newBatch = () => randomUUID();
