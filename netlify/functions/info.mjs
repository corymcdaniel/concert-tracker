// GET /api/info -> public: { artists: { "<artist name>": {...} | null }, venues: { "<venue>|<city>": {...} | null } }
// PUT /api/info -> editors: save one record { kind: "artists" | "venues", key, info: {...} | null }
//                  info null means "no match" (the pop-up stops offering the Wikipedia lookup)
import { requireEditor, json } from "../lib/auth.mjs";
import { read, write } from "../lib/db.mjs";

const TABLES = { artists: "artists (name, info) VALUES ($1, $2) ON CONFLICT (name)", venues: "venues (key, info) VALUES ($1, $2) ON CONFLICT (key)" };

export default async (req) => {
  if (req.method === "GET") {
    const [artists, venues] = await Promise.all([
      read("SELECT name, info FROM artists"),
      read("SELECT key, info FROM venues"),
    ]);
    return json({
      artists: Object.fromEntries(artists.map((r) => [r.name, r.info])),
      venues: Object.fromEntries(venues.map((r) => [r.key, r.info])),
    });
  }

  if (req.method === "PUT") {
    const { user, error } = await requireEditor(req);
    if (error) return error;
    let body;
    try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
    const { kind, key, info } = body || {};
    if (!TABLES[kind] || typeof key !== "string" || !key.trim() || (info !== null && typeof info !== "object"))
      return new Response("Expected { kind, key, info }", { status: 400 });
    await write(user, (c) => c.query(`INSERT INTO ${TABLES[kind]} DO UPDATE SET info = EXCLUDED.info`, [key, info]));
    return json({ ok: true });
  }
  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/info" };
