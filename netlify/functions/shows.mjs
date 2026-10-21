// GET /api/shows -> public: the show list (falls back to shows.json until the first save)
// PUT /api/shows -> editors only: replace the list
import { getStore } from "@netlify/blobs";
import seed from "../../shows.json";
import { requireEditor, json, backupAndSet } from "../lib/auth.mjs";

const str = (v) => String(v ?? "").trim();

export default async (req) => {
  const store = getStore({ name: "show-log", consistency: "strong" });

  if (req.method === "GET") return json((await store.get("shows", { type: "json" })) ?? seed);

  if (req.method === "PUT") {
    const { user, error } = await requireEditor(req);
    if (error) return error;
    let body;
    try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
    if (!Array.isArray(body)) return new Response("Expected an array", { status: 400 });
    const clean = body.map((s) => ({
      id: str(s.id), artist: str(s.artist), venue: str(s.venue),
      city: str(s.city), state: str(s.state), country: str(s.country) || "US",
      date: /^\d{4}-\d{2}-\d{2}$/.test(s.date || "") ? s.date : null,
      type: s.type === "Comedy" ? "Comedy" : "Music", notes: str(s.notes),
    }));
    await backupAndSet(store, "shows", clean);
    return json({ ok: true, count: clean.length, by: user.email });
  }
  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/shows" };
