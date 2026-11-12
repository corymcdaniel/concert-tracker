// "On this day": past nights from the same date in earlier years, or failing that, from this week.
// Pure counting, the same as show-log-app's src/lib/memories.js.
//   memories(nights, today) -> { when: 'today' | 'week', items: [{ night, yearsAgo, daysOff }] } or null
const WEEK = 3;
const DAY = 86400000;

// Days between two month-days, across the new year (Dec 30 and Jan 2 are 3 apart). 2000 is a leap year,
// so Feb 29 has a place.
function apart(a, b){
  const at = iso => Date.UTC(2000, +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const d = Math.abs(at(a) - at(b)) / DAY;
  return Math.min(d, 366 - d);
}

export function memories(list, today){
  const year = +today.slice(0, 4);
  const near = list
    .filter(n => n.date && +n.date.slice(0, 4) < year)
    .map(n => ({ night: n, yearsAgo: year - +n.date.slice(0, 4), daysOff: apart(n.date, today) }))
    .filter(m => m.daysOff <= WEEK);
  if (!near.length) return null;
  const exact = near.filter(m => m.daysOff === 0);
  if (exact.length) return { when: 'today', items: exact.sort((a, b) => a.yearsAgo - b.yearsAgo) };
  return { when: 'week', items: near.sort((a, b) => a.daysOff - b.daysOff || a.yearsAgo - b.yearsAgo).slice(0, 4) };
}
