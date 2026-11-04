-- Fix two misspelled artist names: every show for each artist, plus the artist's
-- Wikipedia details (keyed by name), so the counts and pop-ups stay together.
-- The change triggers record these in History like any other edit.
UPDATE shows SET artist = 'Queens of the Stone Age' WHERE artist = 'Queen''s Of The Stone Age';
UPDATE shows SET artist = 'Dave Attell' WHERE artist = 'Dave Attel';

-- Move the details to the new name, unless the new name already has some
UPDATE artists SET name = 'Queens of the Stone Age'
  WHERE name = 'Queen''s Of The Stone Age'
    AND NOT EXISTS (SELECT 1 FROM artists WHERE name = 'Queens of the Stone Age');
UPDATE artists SET name = 'Dave Attell'
  WHERE name = 'Dave Attel'
    AND NOT EXISTS (SELECT 1 FROM artists WHERE name = 'Dave Attell');
DELETE FROM artists WHERE name IN ('Queen''s Of The Stone Age', 'Dave Attel');

-- The setlist.fm cache is keyed by lower(artist) || '|' || date, so carry its rows over too
UPDATE setlists SET artist = 'Queens of the Stone Age', key = 'queens of the stone age|' || to_char(date, 'YYYY-MM-DD')
  WHERE artist = 'Queen''s Of The Stone Age'
    AND NOT EXISTS (SELECT 1 FROM setlists n WHERE n.key = 'queens of the stone age|' || to_char(setlists.date, 'YYYY-MM-DD'));
UPDATE setlists SET artist = 'Dave Attell', key = 'dave attell|' || to_char(date, 'YYYY-MM-DD')
  WHERE artist = 'Dave Attel'
    AND NOT EXISTS (SELECT 1 FROM setlists n WHERE n.key = 'dave attell|' || to_char(setlists.date, 'YYYY-MM-DD'));
DELETE FROM setlists WHERE artist IN ('Queen''s Of The Stone Age', 'Dave Attel');
