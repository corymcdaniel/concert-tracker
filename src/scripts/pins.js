// Pins: badges earned from the log. Only the counting lives here (no page drawing; that's pinsView.js), and the
// list and ids match show-log-app's src/lib/pins.js, so both sites award the same pins for the same log.
//   pinStatus(nights, photos, today) -> [{ ...pin, have, earned }] in PINS order
// nights is every night, grouped as log.js's nights() does, upcoming included. Upcoming nights only count
// toward Got Tickets. A pin's `id` must never change once released: it's what pins_seen remembers.
import { place } from './util.js';

// shape: round | shield | hex. glyph: what's stamped on the enamel. count: which fact below it reads.
export const PINS = [
  { id: 'opening-night', name: 'Opening Night', blurb: 'Log your first show', goal: 1, count: 'nights', glyph: '1', shape: 'round' },
  { id: 'regular', name: 'Regular', blurb: '10 nights out', goal: 10, count: 'nights', glyph: '10', shape: 'round' },
  { id: 'devotee', name: 'Devotee', blurb: '25 nights out', goal: 25, count: 'nights', glyph: '25', shape: 'shield' },
  { id: 'lifer', name: 'Lifer', blurb: '50 nights out', goal: 50, count: 'nights', glyph: '50', shape: 'shield' },
  { id: 'century', name: 'Century Club', blurb: '100 nights out', goal: 100, count: 'nights', glyph: '100', shape: 'hex' },
  { id: 'got-tickets', name: 'Got Tickets', blurb: 'Log a show that hasn’t happened yet', goal: 1, count: 'upcoming', glyph: '✓', shape: 'round' },
  { id: 'venue-hopper', name: 'Venue Hopper', blurb: '5 different venues', goal: 5, count: 'venues', glyph: '⌂', shape: 'hex' },
  { id: 'home-turf', name: 'Home Turf', blurb: 'The same venue 5 times', goal: 5, count: 'sameVenue', glyph: '♥', shape: 'shield' },
  { id: 'road-trip', name: 'Road Trip', blurb: 'Shows in 3 cities', goal: 3, count: 'cities', glyph: '➜', shape: 'round' },
  { id: 'passport', name: 'Passport Stamp', blurb: 'Shows in 2 countries', goal: 2, count: 'countries', glyph: '✈', shape: 'hex' },
  { id: 'superfan', name: 'Superfan', blurb: 'See the same artist 3 times', goal: 3, count: 'sameArtist', glyph: '★', shape: 'shield' },
  { id: 'hot-streak', name: 'Hot Streak', blurb: '3 nights out in one month', goal: 3, count: 'bestMonth', glyph: '3×', shape: 'round' },
  { id: 'back-to-back', name: 'Back to Back', blurb: 'Shows on two nights in a row', goal: 1, count: 'backToBack', glyph: '»', shape: 'hex' },
  { id: 'full-bill', name: 'Full Bill', blurb: '3 or more acts in one night', goal: 3, count: 'biggestBill', glyph: '≡', shape: 'round' },
  { id: 'laugh-track', name: 'Laugh Track', blurb: 'Go to a comedy show', goal: 1, count: 'comedy', glyph: '☺', shape: 'round' },
  { id: 'five-stars', name: 'Five Stars', blurb: 'Rate a night 5 stars', goal: 1, count: 'fiveStars', glyph: '✦', shape: 'shield' },
  { id: 'shutterbug', name: 'Shutterbug', blurb: 'Photos on 5 nights', goal: 5, count: 'photoNights', glyph: '◉', shape: 'hex' },
  { id: 'five-years', name: 'Five Years In', blurb: 'Shows in 5 different years', goal: 5, count: 'years', glyph: 'V', shape: 'shield' },
];

const artistKey = name => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
// A blank country, US, USA and United States are all the one country
const US = new Set(['', 'us', 'usa', 'u.s.', 'u.s.a.', 'united states', 'united states of america']);
const countryKey = c => {
  const k = String(c || '').trim().toLowerCase();
  if (US.has(k)) return 'US';
  return k;
};
const max = map => Math.max(0, ...map.values());
function tally(list, keyOf){
  const m = new Map();
  for (const x of list) {
    const k = keyOf(x);
    if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

// Every number the pins count, from the log
function facts(all, photos, today){
  const past = all.filter(n => !n.date || n.date < today);
  const dated = past.filter(n => n.date);
  const photoActs = new Set(photos.map(p => p.show_id));
  const days = [...new Set(dated.map(n => n.date))].sort();
  let backToBack = 0;
  for (let i = 1; i < days.length; i++) {
    if ((new Date(days[i]) - new Date(days[i - 1])) / 86400000 === 1) backToBack = 1;
  }
  // Each artist counts once a night, even if they're on the bill twice
  const artistNights = new Map();
  for (const n of past) {
    for (const k of new Set(n.acts.map(a => artistKey(a.artist)))) artistNights.set(k, (artistNights.get(k) || 0) + 1);
  }
  const venueOf = n => n.venue && `${n.venue}|${n.city}`.toLowerCase();
  return {
    nights: past.length,
    upcoming: all.length - past.length,
    venues: tally(past, venueOf).size,
    sameVenue: max(tally(past, venueOf)),
    cities: tally(past, n => place(n).toLowerCase()).size,
    countries: tally(past, n => countryKey(n.country)).size,
    sameArtist: max(artistNights),
    bestMonth: max(tally(dated, n => n.date.slice(0, 7))),
    backToBack,
    biggestBill: Math.max(0, ...past.map(n => n.acts.length)),
    comedy: past.filter(n => n.acts.some(a => a.type === 'Comedy')).length,
    fiveStars: past.filter(n => n.acts.some(a => Number(a.rating) === 5)).length,
    photoNights: past.filter(n => n.acts.some(a => photoActs.has(a.id))).length,
    years: tally(dated, n => n.date.slice(0, 4)).size,
  };
}

export function pinStatus(nights, photos, today){
  const f = facts(nights, photos, today);
  return PINS.map(pin => {
    const have = Math.min(f[pin.count], pin.goal);
    return { ...pin, have, earned: have >= pin.goal };
  });
}
