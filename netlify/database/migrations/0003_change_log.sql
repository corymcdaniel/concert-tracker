-- Every insert, update and delete on shows, artists and venues, with the row
-- before and after. Written by trigger, so no code path can skip it.
-- changed_by comes from the transaction setting app.user (see netlify/lib/db.mjs);
-- undo_of from app.undo_of when the change is an undo of an earlier one.
CREATE TABLE changes (
  id          bigserial PRIMARY KEY,
  table_name  text NOT NULL,
  row_id      text NOT NULL,
  action      text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  before      jsonb,
  after       jsonb,
  changed_by  text,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  undo_of     bigint REFERENCES changes (id)
);
CREATE INDEX changes_row_idx ON changes (table_name, row_id, id DESC);
CREATE INDEX changes_recent_idx ON changes (id DESC);

-- TG_ARGV[0] is the table's primary key column.
CREATE FUNCTION log_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  b jsonb;
  a jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN b := to_jsonb(OLD) - 'created_at' - 'updated_at'; END IF;
  IF TG_OP <> 'DELETE' THEN a := to_jsonb(NEW) - 'created_at' - 'updated_at'; END IF;
  -- Saving a row without changing anything is not a change
  IF TG_OP = 'UPDATE' AND a = b THEN RETURN NEW; END IF;
  INSERT INTO changes (table_name, row_id, action, before, after, changed_by, undo_of)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(a, b) ->> TG_ARGV[0],
    lower(TG_OP),
    b,
    a,
    NULLIF(current_setting('app.user', true), ''),
    NULLIF(current_setting('app.undo_of', true), '')::bigint
  );
  RETURN NULL;
END $$;

CREATE TRIGGER shows_log AFTER INSERT OR UPDATE OR DELETE ON shows FOR EACH ROW EXECUTE FUNCTION log_change('id');
CREATE TRIGGER artists_log AFTER INSERT OR UPDATE OR DELETE ON artists FOR EACH ROW EXECUTE FUNCTION log_change('name');
CREATE TRIGGER venues_log AFTER INSERT OR UPDATE OR DELETE ON venues FOR EACH ROW EXECUTE FUNCTION log_change('key');
