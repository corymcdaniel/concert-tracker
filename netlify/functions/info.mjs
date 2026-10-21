// GET /api/info -> public: artist and venue details (falls back to info.json until the first save)
// PUT /api/info -> editors only: replace the details
//   Shape: { artists: { "<artist name>": {...} | null }, venues: { "<venue>|<city>": {...} | null } }
import { getStore } from "@netlify/blobs";
import seed from "../../info.json";
import { requireEditor, json, backupAndSet } from "../lib/auth.mjs";

export default async (req) => {
  const store = getStore({ name: "show-log", consistency: "strong" });

  if (req.method === "GET") return json((await store.get("info", { type: "json" })) ?? seed);

  if (req.method === "PUT") {
    const { error } = await requireEditor(req);
    if (error) return error;
    let body;
    try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
    if (!body || typeof body.artists !== "object" || typeof body.venues !== "object")
      return new Response("Expected { artists, venues }", { status: 400 });
    await backupAndSet(store, "info", { artists: body.artists, venues: body.venues });
    return json({ ok: true });
  }
  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/info" };
