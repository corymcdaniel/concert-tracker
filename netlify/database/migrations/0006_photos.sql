-- Photos uploaded to a night. The image itself is in Netlify Blobs (store "photos", key = id);
-- this row says which night it belongs to.
--
-- show_id is one act of the night: the photo belongs to whatever night that act is in, so it
-- follows the bill when its date or venue changes. There's deliberately no foreign key: when a
-- night is deleted its photos are kept (and hidden), so undoing the delete in History brings
-- them back. When a bill edit removes the act a photo hangs off, shows.mjs moves the photo to
-- another act of the same night.
CREATE TABLE photos (
  id          text PRIMARY KEY,
  show_id     text NOT NULL,
  type        text NOT NULL CHECK (type IN ('image/webp', 'image/jpeg')),
  width       integer NOT NULL CHECK (width > 0),
  height      integer NOT NULL CHECK (height > 0),
  bytes       integer NOT NULL CHECK (bytes > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text
);
CREATE INDEX photos_show_id ON photos (show_id);
