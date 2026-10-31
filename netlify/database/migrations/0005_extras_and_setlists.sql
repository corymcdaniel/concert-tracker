-- A night's rating, ticket price and companions. Like venue and date, they're
-- written to every act of the night. rating is public; price and companions are
-- only returned to signed-in editors (see netlify/functions/shows.mjs).
ALTER TABLE shows
  ADD COLUMN rating smallint CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN price double precision CHECK (price >= 0),
  ADD COLUMN companions text;

-- setlist.fm results, one row per act per date. A cache of outside data, so it
-- isn't in the change log. found = false means setlist.fm had nothing when asked.
CREATE TABLE setlists (
  key         text PRIMARY KEY,
  artist      text NOT NULL,
  date        date NOT NULL,
  found       boolean NOT NULL,
  url         text,
  songs       jsonb NOT NULL DEFAULT '[]',
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
