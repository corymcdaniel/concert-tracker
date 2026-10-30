-- Changes saved together (a whole bill edited or removed) share a batch id, so
-- History can show them as one entry and undo them as one.
-- batch comes from the transaction setting app.batch (see netlify/lib/db.mjs).
ALTER TABLE changes ADD COLUMN batch uuid;
CREATE INDEX changes_batch_idx ON changes (batch) WHERE batch IS NOT NULL;

CREATE OR REPLACE FUNCTION log_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  b jsonb;
  a jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN b := to_jsonb(OLD) - 'created_at' - 'updated_at'; END IF;
  IF TG_OP <> 'DELETE' THEN a := to_jsonb(NEW) - 'created_at' - 'updated_at'; END IF;
  -- Saving a row without changing anything is not a change
  IF TG_OP = 'UPDATE' AND a = b THEN RETURN NEW; END IF;
  INSERT INTO changes (table_name, row_id, action, before, after, changed_by, undo_of, batch)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(a, b) ->> TG_ARGV[0],
    lower(TG_OP),
    b,
    a,
    NULLIF(current_setting('app.user', true), ''),
    NULLIF(current_setting('app.undo_of', true), '')::bigint,
    NULLIF(current_setting('app.batch', true), '')::uuid
  );
  RETURN NULL;
END $$;
