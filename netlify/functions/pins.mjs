// GET /api/pins -> editors: { seen: ["opening-night", ...] }, the pins already celebrated
// PUT /api/pins -> editors: { ids: [...] } marks more of them celebrated
// Visitors never see the celebration, so neither call is public.
import { isEditor, json, requireEditor } from "../lib/auth.mjs";
import { read, write } from "../lib/db.mjs";

const ID = /^[a-z0-9-]{1,40}$/;

export default async (req) => {
  if (req.method === "GET") {
    if (!(await isEditor())) return new Response("Sign in required", { status: 401 });
    const rows = await read("SELECT id FROM pins_seen ORDER BY seen_at, id");
    return json({ seen: rows.map((r) => r.id) });
  }

  if (req.method === "PUT") {
    const { user, error } = await requireEditor(req);
    if (error) return error;
    let body;
    try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
    const ids = body?.ids;
    if (!Array.isArray(ids) || ids.length > 200 || !ids.every((id) => typeof id === "string" && ID.test(id)))
      return new Response("Expected { ids: [pin ids] }", { status: 400 });
    await write(user, (c) => c.query("INSERT INTO pins_seen (id) SELECT unnest($1::text[]) ON CONFLICT (id) DO NOTHING", [[...new Set(ids)]]));
    return json({ ok: true });
  }
  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/pins" };
