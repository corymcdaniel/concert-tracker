// Database access shared by the functions.
//   read(text, params)       one-off query, returns rows
//   write(user, fn, undoOf)  runs fn(client) in a transaction tagged with the
//                            editor, so the change-log trigger records who did it
import { getDatabase } from "@netlify/database";

let db;
const pool = () => (db ??= getDatabase()).pool;

export async function read(text, params = []) {
  return (await pool().query(text, params)).rows;
}

export async function write(user, fn, undoOf = null) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user', $1, true), set_config('app.undo_of', $2, true)",
      [user?.email || user?.name || "", String(undoOf ?? "")]);
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
export const SHOW_FIELDS = ["artist", "venue", "city", "state", "country", "date", "type", "notes"];
export const SHOW_SELECT = `id, artist, venue, city, state, country, to_char(date, 'YYYY-MM-DD') AS date, type, notes`;

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
  return out;
}

export const newId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
