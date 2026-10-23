// GET    /api/shows      -> public: every show, in billing order
// POST   /api/shows      -> editors: add acts { rows: [show, ...], after?: id }
//                           after = add them to that act's night, right after it; otherwise they go first
// PUT    /api/shows      -> editors: replace the whole list (Data panel import). Only real differences are logged.
// PATCH  /api/shows/:id  -> editors: update one show
// DELETE /api/shows/:id  -> editors: delete one show
import { requireEditor, json } from "../lib/auth.mjs";
import { read, write, cleanShow, newId, Invalid, SHOW_FIELDS, SHOW_SELECT } from "../lib/db.mjs";

const bad = (msg) => new Response(msg, { status: 400 });
const COLS = SHOW_FIELDS.join(", ");
const PARAMS = SHOW_FIELDS.map((_, i) => `$${i + 2}`).join(", ");
const values = (s) => SHOW_FIELDS.map((f) => s[f]);

export default async (req, context) => {
  const id = context.params?.id;

  if (req.method === "GET" && !id) {
    return json(await read(`SELECT ${SHOW_SELECT} FROM shows ORDER BY sort_order, id`));
  }

  const { user, error } = await requireEditor(req);
  if (error) return error;
  let body;
  if (req.method !== "DELETE") {
    try { body = await req.json(); } catch { return bad("Bad JSON"); }
  }

  try {
    if (req.method === "POST" && !id) {
      if (!Array.isArray(body?.rows) || !body.rows.length) return bad("Expected { rows: [...] }");
      const rows = body.rows.map((r) => ({ id: String(r.id || newId()), ...cleanShow(r) }));
      const added = await write(user, async (c) => {
        const order = await slots(c, body.after, rows.length);
        const out = [];
        for (const [i, r] of rows.entries()) {
          const { rows: [row] } = await c.query(
            `INSERT INTO shows (id, ${COLS}, sort_order) VALUES ($1, ${PARAMS}, $${SHOW_FIELDS.length + 2})
             RETURNING ${SHOW_SELECT}`, [r.id, ...values(r), order[i]]);
          out.push(row);
        }
        return out;
      });
      return json(added, { status: 201 });
    }

    if (req.method === "PUT" && !id) {
      if (!Array.isArray(body)) return bad("Expected an array of shows");
      const rows = body.map((r) => ({ id: String(r.id || newId()), ...cleanShow(r) }));
      await write(user, async (c) => {
        const order = sortOrders(rows, (await c.query("SELECT id, sort_order FROM shows ORDER BY sort_order, id")).rows);
        await c.query("DELETE FROM shows WHERE NOT (id = ANY($1))", [rows.map((r) => r.id)]);
        for (const [i, r] of rows.entries()) {
          await c.query(
            `INSERT INTO shows (id, ${COLS}, sort_order) VALUES ($1, ${PARAMS}, $${SHOW_FIELDS.length + 2})
             ON CONFLICT (id) DO UPDATE SET ${SHOW_FIELDS.map((f) => `${f} = EXCLUDED.${f}`).join(", ")}, sort_order = EXCLUDED.sort_order
             WHERE (${SHOW_FIELDS.map((f) => `shows.${f}`).join(", ")}, shows.sort_order)
                   IS DISTINCT FROM (${SHOW_FIELDS.map((f) => `EXCLUDED.${f}`).join(", ")}, EXCLUDED.sort_order)`,
            [r.id, ...values(r), order[i]]);
        }
      });
      return json({ ok: true, count: rows.length });
    }

    if (req.method === "PATCH" && id) {
      const s = cleanShow(body);
      const [row] = await write(user, async (c) => (await c.query(
        `UPDATE shows SET ${SHOW_FIELDS.map((f, i) => `${f} = $${i + 2}`).join(", ")} WHERE id = $1 RETURNING ${SHOW_SELECT}`,
        [id, ...values(s)])).rows);
      if (!row) return new Response("Not found", { status: 404 });
      return json(row);
    }

    if (req.method === "DELETE" && id) {
      const n = await write(user, async (c) => (await c.query("DELETE FROM shows WHERE id = $1", [id])).rowCount);
      if (!n) return new Response("Not found", { status: 404 });
      return json({ ok: true });
    }
  } catch (e) {
    if (e.code === "23505") return new Response("A show with that id already exists", { status: 409 });
    if (e instanceof Invalid) return bad(e.message);
    throw e;
  }
  return new Response("Method not allowed", { status: 405 });
};

// sort_order values for n new rows: right after `after` (before the next row), or ahead of everything
async function slots(c, after, n) {
  if (after) {
    const { rows: [r] } = await c.query(
      `SELECT sort_order AS lo, (SELECT min(sort_order) FROM shows WHERE sort_order > s.sort_order) AS hi
       FROM shows s WHERE id = $1`, [after]);
    if (r) {
      const hi = r.hi ?? r.lo + n + 1;
      return Array.from({ length: n }, (_, i) => r.lo + ((hi - r.lo) * (i + 1)) / (n + 1));
    }
  }
  const { rows: [{ min }] } = await c.query("SELECT COALESCE(min(sort_order), 1) AS min FROM shows");
  return Array.from({ length: n }, (_, i) => min - n + i);
}

// sort_order for a full replacement list. If the shows already saved are still in the
// same order, they keep their values and new ones slot in between, so only real
// changes are logged. If the order changed, everything is renumbered.
function sortOrders(rows, current) {
  const saved = new Map(current.map((r) => [r.id, r.sort_order]));
  const incoming = rows.filter((r) => saved.has(r.id)).map((r) => r.id);
  const kept = new Set(incoming);
  const sameOrder = incoming.join("\n") === current.map((r) => r.id).filter((id) => kept.has(id)).join("\n");
  if (!sameOrder) return rows.map((_, i) => i + 1);

  const out = [];
  for (const [i, r] of rows.entries()) {
    if (saved.has(r.id)) { out.push(saved.get(r.id)); continue; }
    const prev = out[i - 1];
    const next = rows.slice(i + 1).find((x) => saved.has(x.id));
    let val = i + 1;
    if (prev !== undefined && next) val = (prev + saved.get(next.id)) / 2;
    else if (prev !== undefined) val = prev + 1;
    else if (next) val = saved.get(next.id) - 1;
    out.push(val);
  }
  return out;
}

export const config ={ path: ["/api/shows", "/api/shows/:id"] };
