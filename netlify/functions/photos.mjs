// GET    /api/photos      -> public: every photo whose act still exists, [{ id, show_id, width, height, created_at }]
// GET    /api/photos/:id  -> public: the image itself, cached for a year (ids never change)
// POST   /api/photos?show=<act id>&w=<px>&h=<px>  -> editors: upload one photo to that act's night.
//                            The body is the image (WebP or JPEG). The page resizes it and strips its
//                            metadata, including location, before sending; this only checks type and size.
// DELETE /api/photos/:id  -> editors: delete one photo and its image
import { getStore } from "@netlify/blobs";
import { requireEditor, json } from "../lib/auth.mjs";
import { read, write, newId } from "../lib/db.mjs";

const PER_NIGHT = 6;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_SIDE = 4000;
const TYPES = ["image/webp", "image/jpeg"];
const store = () => getStore({ name: "photos", consistency: "strong" });
const bad = (msg) => new Response(msg, { status: 400 });

// The act ids of the night that `showId` is in (same grouping as the page: date + venue + city, any case)
const NIGHT_OF = `SELECT n.id FROM shows s JOIN shows n
  ON n.date IS NOT DISTINCT FROM s.date AND lower(n.venue) = lower(s.venue) AND lower(n.city) = lower(s.city)
  WHERE s.id = $1`;

export default async (req, context) => {
  const id = context.params?.id;

  if (req.method === "GET" && !id) {
    return json(await read(`SELECT p.id, p.show_id, p.width, p.height, p.created_at
      FROM photos p JOIN shows s ON s.id = p.show_id ORDER BY p.created_at`));
  }
  if (req.method === "GET" && id) {
    const hit = await store().getWithMetadata(id, { type: "stream" });
    if (!hit) return new Response("Not found", { status: 404 });
    return new Response(hit.data, { headers: {
      "content-type": hit.metadata?.type || "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
    } });
  }

  const { user, error } = await requireEditor(req);
  if (error) return error;

  if (req.method === "POST" && !id) {
    const url = new URL(req.url);
    const showId = url.searchParams.get("show");
    const width = Number(url.searchParams.get("w")), height = Number(url.searchParams.get("h"));
    const type = (req.headers.get("content-type") || "").split(";")[0].trim();
    if (!showId) return bad("Which night? Expected ?show=<act id>");
    if (!TYPES.includes(type)) return bad("Photos must be WebP or JPEG");
    const valid = (n) => Number.isInteger(n) && n > 0 && n <= MAX_SIDE;
    if (!valid(width) || !valid(height)) return bad("Expected the photo's size as ?w= and &h=");
    const body = await req.arrayBuffer();
    if (!body.byteLength) return bad("No photo in the request");
    if (body.byteLength > MAX_BYTES) return bad("That photo is too big. Try a smaller one.");

    const night = (await read(NIGHT_OF, [showId])).map((r) => r.id);
    if (!night.length) return bad("That night isn't in the log");
    const [{ count }] = await read("SELECT count(*)::int AS count FROM photos WHERE show_id = ANY($1)", [night]);
    if (count >= PER_NIGHT) return bad(`A night can have up to ${PER_NIGHT} photos`);

    const photoId = newId();
    // Image first: a row without an image would show a broken tile, an image without a row is just unused
    await store().set(photoId, body, { metadata: { type } });
    const [row] = await write(user, async (c) => (await c.query(
      `INSERT INTO photos (id, show_id, type, width, height, bytes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, show_id, width, height, created_at`,
      [photoId, showId, type, width, height, body.byteLength, user.email || null])).rows);
    return json(row, { status: 201 });
  }

  if (req.method === "DELETE" && id) {
    const n = await write(user, async (c) => (await c.query("DELETE FROM photos WHERE id = $1", [id])).rowCount);
    if (!n) return new Response("Not found", { status: 404 });
    await store().delete(id);
    return json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: ["/api/photos", "/api/photos/:id"] };
