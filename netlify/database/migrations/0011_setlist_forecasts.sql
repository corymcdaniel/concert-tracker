-- What an upcoming act has been playing lately, from their recent setlist.fm setlists.
-- One row per artist (keyed lower-case), refreshed when a week old. A cache of outside
-- data, like setlists, so it isn't in the change log. found = false: setlist.fm had nothing.
CREATE TABLE forecasts (
  key         text PRIMARY KEY,
  artist      text NOT NULL,
  found       boolean NOT NULL,
  data        jsonb NOT NULL DEFAULT '{}',
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
