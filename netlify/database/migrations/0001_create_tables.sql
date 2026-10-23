-- One row per act per night. Acts sharing date + venue + city are one night,
-- billed in sort_order (headliner first).
CREATE TABLE shows (
  id          text PRIMARY KEY,
  artist      text NOT NULL,
  venue       text NOT NULL DEFAULT '',
  city        text NOT NULL DEFAULT '',
  state       text,
  country     text,
  date        date,
  type        text NOT NULL DEFAULT 'Music' CHECK (type IN ('Music', 'Comedy')),
  notes       text NOT NULL DEFAULT '',
  sort_order  double precision NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shows_sort_order_idx ON shows (sort_order);
CREATE INDEX shows_artist_idx ON shows (artist);

-- Wikipedia/Wikidata details. info is NULL when no match was found.
CREATE TABLE artists (
  name        text PRIMARY KEY,
  info        jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Keyed by "venue|city".
CREATE TABLE venues (
  key         text PRIMARY KEY,
  info        jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER shows_touch BEFORE UPDATE ON shows FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER artists_touch BEFORE UPDATE ON artists FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER venues_touch BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
