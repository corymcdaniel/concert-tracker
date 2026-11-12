-- Pins that have had their "New pin!" celebration (src/scripts/pinsView.js), so each one is celebrated once,
-- on whichever device you're signed in on. The pins themselves are worked out from the shows; only this is stored.
CREATE TABLE pins_seen (
  id       text PRIMARY KEY,
  seen_at  timestamptz NOT NULL DEFAULT now()
);
