-- Festival dates checked against the published lineups:
--   Music Midtown (Wikipedia's day-by-day lineups): every night was logged a month early, in August, and 2016
--   was two days rather than one.
--   Countdown Japan 07/08 West (countdownjapan.jp history): Intex Osaka ran Dec 29-31, 2007; Quruli and
--   Boom Boom Satellites played the 31st, Ryu Kyu Disko and The Cornelius Group the 30th.
-- Moving an act's date moves it to that day's bill, since a night is its date, venue and city.

UPDATE shows SET date = '2012-09-22'
  WHERE festival = 'Music Midtown' AND date = '2012-08-22';
UPDATE shows SET date = '2013-09-20'
  WHERE festival = 'Music Midtown' AND date = '2013-08-20';
UPDATE shows SET date = '2013-09-21'
  WHERE festival = 'Music Midtown' AND date = '2013-08-21';
-- 2016: Saturday's acts, then Sunday's
UPDATE shows SET date = '2016-09-18'
  WHERE festival = 'Music Midtown' AND date = '2016-08-17' AND artist IN ('Deadmau5', 'Peter Bjorn & John');
UPDATE shows SET date = '2016-09-17'
  WHERE festival = 'Music Midtown' AND date = '2016-08-17';

UPDATE shows SET date = '2007-12-30'
  WHERE festival = 'Countdown Japan' AND date = '2007-12-31' AND artist IN ('Ryu Kyu Disko', 'Cornelius');
