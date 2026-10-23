// GET  /api/changes                 -> editors: recent changes, newest first
//        ?table=shows&row=<id>         only that row's history
//        ?before=<change id>           older page
// POST /api/changes/:id/undo        -> editors: reverse one change. Refused (409) if the row
//                                      has changed again since, so newer edits are never lost.
import { requireEditor, json } from "../lib/auth.mjs";
import { read, write } from "../lib/db.mjs";

// Primary key and editable columns per tracked table (also the whitelist for undo's SQL)
const TABLES = {
  shows: { pk: "id", cols: ["artist", "venue", "city", "state", "country", "date", "type", "notes", "sort_order"] },
  artists: { pk: "name", cols: ["info"] },
  venues: { pk: "key", cols: ["info"] },
};
const PAGE = 50;

export default async (req, context) => {
  const { user, error } = await requireEditor(req);
  if (error) return error;
  const id = context.params?.id;

  if (req.method === "GET" && !id) {
    const q = new URL(req.url).searchParams;
    const where = [];
    const params = [];
    if (q.get("table")) { params.push(q.get("table")); where.push(`table_name = $${params.length}`); }
    if (q.get("row")) { params.push(q.get("row")); where.push(`row_id = $${params.length}`); }
    if (q.get("before")) { params.push(q.get("before")); where.push(`id < $${params.length}`); }
    let filter = "";
    if (where.length) filter = "WHERE " + where.join(" AND ");
    const rows = await read(
      `SELECT c.id, c.table_name AS table, c.row_id AS row, c.action, c.before, c.after, c.changed_by AS by,
              c.changed_at AS at, c.undo_of, EXISTS (SELECT 1 FROM changes u WHERE u.undo_of = c.id) AS undone
       FROM changes c ${filter}
       ORDER BY c.id DESC LIMIT ${PAGE}`, params);
    return json({ changes: rows, more: rows.length === PAGE });
  }

  if (req.method === "POST" && id) {
    const [ch] = await read("SELECT * FROM changes WHERE id = $1", [id]);
    if (!ch) return new Response("Not found", { status: 404 });
    const t = TABLES[ch.table_name];
    const result = await write(user, async (c) => {
      // The row must still look exactly like this change left it
      const { rows: [cur] } = await c.query(
        `SELECT to_jsonb(t) - 'created_at' - 'updated_at' AS row FROM ${ch.table_name} t WHERE ${t.pk} = $1 FOR UPDATE`, [ch.row_id]);
      if (JSON.stringify(sortKeys(cur?.row ?? null)) !== JSON.stringify(sortKeys(ch.after)))
        return "conflict";
      if (ch.action === "insert") {
        await c.query(`DELETE FROM ${ch.table_name} WHERE ${t.pk} = $1`, [ch.row_id]);
      } else if (ch.action === "delete") {
        const cols = [t.pk, ...t.cols].join(", ");
        await c.query(`INSERT INTO ${ch.table_name} (${cols}) SELECT ${cols} FROM jsonb_populate_record(NULL::${ch.table_name}, $1)`, [ch.before]);
      } else {
        const cols = t.cols.join(", ");
        await c.query(`UPDATE ${ch.table_name} SET (${cols}) = (SELECT ${cols} FROM jsonb_populate_record(NULL::${ch.table_name}, $1)) WHERE ${t.pk} = $2`,
          [ch.before, ch.row_id]);
      }
      return "ok";
    }, ch.id);
    if (result === "conflict")
      return new Response("This was changed again afterwards. Undo the newer change first.", { status: 409 });
    return json({ ok: true });
  }
  return new Response("Method not allowed", { status: 405 });
};

// jsonb comes back with keys in Postgres order; compare by content, not key order
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

export const config = { path: ["/api/changes", "/api/changes/:id/undo"] };
