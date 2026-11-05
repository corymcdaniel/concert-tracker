-- Name the festival nights already in the log, and give the ones that used the festival's name as their venue
-- the real venue. Each night is picked out by its date and venue, never by venue alone: a stadium or park hosts
-- plenty of nights that aren't festivals. The change triggers record these in History like any other edit.

-- Día de los Deftones at Petco Park, every year including the one coming up
UPDATE shows SET festival = 'Dia de los Deftones'
  WHERE venue = 'Petco Park' AND city = 'San Diego'
    AND date IN ('2019-11-02', '2022-11-05', '2023-11-04', '2024-11-02', '2025-11-01', '2026-11-07');

-- Kilby Block Party 2025, four days at the Utah State Fairpark
UPDATE shows SET festival = 'Kilby Block Party'
  WHERE venue = 'Utah State Fairpark' AND city = 'Salt Lake City' AND date BETWEEN '2025-05-15' AND '2025-05-18';

-- New Year's Eve 2007 at Intex Osaka
UPDATE shows SET festival = 'Countdown Japan' WHERE venue = 'Intex Osaka' AND date = '2007-12-31';

-- Festival names standing in for venues: the name moves to festival, and the night gets its real venue
UPDATE shows SET festival = 'Music Midtown', venue = 'Piedmont Park'
  WHERE venue = 'Music Midtown' AND city = 'Atlanta';
UPDATE shows SET festival = 'Project Pabst', venue = 'East Atlanta Village'
  WHERE venue = 'Project Pabst' AND city = 'Atlanta';
UPDATE shows SET festival = 'Virgin Music Festival', venue = 'Toronto Island Park'
  WHERE venue = 'Virgin Music Festival' AND city = 'Toronto';
UPDATE shows SET festival = 'Shaky Knees', venue = 'Centennial Olympic Park'
  WHERE venue = 'Shaky Knees Festival' AND city = 'Atlanta';
UPDATE shows SET festival = 'Party in the Park', venue = 'Centennial Olympic Park'
  WHERE venue = 'Party In The Park (Centennial Park)' AND city = 'Atlanta';

-- Details for the real venues (keyed "venue|city"), so their pop-ups and map pins carry on. The old keys
-- described the festivals, not a place, and nothing points at them now.
INSERT INTO venues (key, info) VALUES
  ('Piedmont Park|Atlanta', '{"qid":"Q3363884","desc":"Urban park in Atlanta, Georgia, home of Music Midtown","wiki":"Piedmont Park","coord":[33.7861,-84.3733]}'),
  ('East Atlanta Village|Atlanta', '{"qid":"Q5327753","desc":"Neighborhood in Atlanta, Georgia","wiki":"East Atlanta","coord":[33.74,-84.3455]}'),
  ('Toronto Island Park|Toronto', '{"img":"Toronto_Islands_2025-05-08.jpg","qid":"Q248110","desc":"Islands in Lake Ontario, home of the 2007 Virgin Festival","wiki":"Toronto Islands","coord":[43.6208,-79.3786]}'),
  ('Centennial Olympic Park|Atlanta', '{"img":"Centenial_olympic_park_downtown_Atlanta.jpg","qid":"Q3364342","desc":"Public park in downtown Atlanta, Georgia","wiki":"Centennial Olympic Park","coord":[33.76,-84.3932],"opened":"1996","website":"centennialpark.com"}')
ON CONFLICT (key) DO NOTHING;
DELETE FROM venues WHERE key IN ('Music Midtown|Atlanta', 'Project Pabst|Atlanta', 'Virgin Music Festival|Toronto',
  'Shaky Knees Festival|Atlanta', 'Party In The Park (Centennial Park)|Atlanta');
