// GET  /api/changes                 -> editors: recent changes, newest first
//        ?table=shows&row=<id>         only that row's history
//        ?before=<change id>           older page
// POST /api/changes/:id/undo        -> editors: reverse one change, along with the rest of its batch.
//                                      Refused (409) if any row has changed again since, so newer
//                                      edits are never lost.
import { requireEditor, json } from "../lib/auth.mjs";
import { read, write, newBatch } from "../lib/db.mjs";

// Primary key and editable columns per tracked table (also the whitelist for undo's SQL)
const TABLES = {
  shows: { pk: "id", cols: ["artist", "venue", "city", "state", "country", "date", "type", "notes", "sort_order"] },
  artists: { pk: "name", cols: ["info"] },
  venues: { pk: "key", cols: ["info"] },
};
const PAGE = 50;
const SELECT = `SELECT c.id, c.table_name AS table, c.row_id AS row, c.action, c.before, c.after, c.changed_by AS by,
              c.changed_at AS at, c.undo_of, c.batch,
              (SELECT count(*)::int FROM changes b WHERE b.batch = c.batch) AS batch_size,
              EXISTS (SELECT 1 FROM changes u WHERE u.undo_of = c.id) AS undone
       FROM changes c`;

// Thrown inside the transaction, so anything already undone in the batch rolls back
class Conflict extends Error {}

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
    const rows = await read(`${SELECT} ${filter} ORDER BY c.id DESC LIMIT ${PAGE}`, params);
    const more = rows.length === PAGE;
    // A batch is one entry on the page, so a page never ends partway through one
    const last = rows[rows.length - 1];
    if (last?.batch && !q.get("row"))
      rows.push(...await read(`${SELECT} WHERE c.batch = $1 AND c.id < $2 ORDER BY c.id DESC`, [last.batch, last.id]));
    return json({ changes: rows, more });
  }

  if (req.method === "POST" && id) {
    const [ch] = await read("SELECT * FROM changes WHERE id = $1", [id]);
    if (!ch) return new Response("Not found", { status: 404 });
    // Newest first, so a row touched twice in a batch unwinds in order
    let group = [ch];
    let batch = null;
    if (ch.batch) {
      group = await read("SELECT * FROM changes WHERE batch = $1 ORDER BY id DESC", [ch.batch]);
      batch = newBatch();
    }
    try {
      await write(user, async (c) => {
        for (const g of group) {
          const t = TABLES[g.table_name];
          await c.query("SELECT set_config('app.undo_of', $1, true)", [String(g.id)]);
          // The row must still look exactly like this change left it
          const { rows: [cur] } = await c.query(
            `SELECT to_jsonb(t) - 'created_at' - 'updated_at' AS row FROM ${g.table_name} t WHERE ${t.pk} = $1 FOR UPDATE`, [g.row_id]);
          if (JSON.stringify(sortKeys(cur?.row ?? null)) !== JSON.stringify(sortKeys(g.after))) throw new Conflict();
          if (g.action === "insert") {
            await c.query(`DELETE FROM ${g.table_name} WHERE ${t.pk} = $1`, [g.row_id]);
          } else if (g.action === "delete") {
            const cols = [t.pk, ...t.cols].join(", ");
            await c.query(`INSERT INTO ${g.table_name} (${cols}) SELECT ${cols} FROM jsonb_populate_record(NULL::${g.table_name}, $1)`, [g.before]);
          } else {
            const cols = t.cols.join(", ");
            await c.query(`UPDATE ${g.table_name} SET (${cols}) = (SELECT ${cols} FROM jsonb_populate_record(NULL::${g.table_name}, $1)) WHERE ${t.pk} = $2`,
              [g.before, g.row_id]);
          }
        }
      }, batch);
    } catch (e) {
      if (e instanceof Conflict)
        return new Response("This was changed again afterwards. Undo the newer change first.", { status: 409 });
      throw e;
    }
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
