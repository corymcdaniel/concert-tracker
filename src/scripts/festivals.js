import { esc } from './util.js';

/* ---------- festivals: a name on a night, set on Edit bill ----------
   Like rating, the name is written to every act of the night. A festival that runs several days is one night per
   day with the same name, so the days of one year's run are numbered from its dates. */

// A night's festival: the first act that has one
export const festivalOf = n => n.acts.find(a => a.festival)?.festival || '';

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Which day of that year's run a night was (1-based), and how many days the run had
export function festivalDay(shows, name, date){
  if (!name || !date) return {day: 0, of: 0};
  const year = date.slice(0, 4);
  const days = [...new Set(shows.filter(s => s.festival && s.date?.startsWith(year) && same(s.festival, name)).map(s => s.date))].sort();
  return {day: days.indexOf(date) + 1, of: days.length};
}

// "Day 2" when the run had more than one day, otherwise nothing
export function dayLabel(shows, name, date){
  const {day, of} = festivalDay(shows, name, date);
  if (of < 2 || !day) return '';
  return `Day ${day}`;
}

// The wristband across the top of a festival night's stub
export function wristband(shows, n){
  const name = festivalOf(n);
  if (!name) return '';
  let day = '';
  const label = dayLabel(shows, name, n.date);
  if (label) day = `<i><span class="sr-only">, </span>${label}</i>`;
  return `<p class="fest"><span class="sr-only">Festival: </span><b>${esc(name)}</b>${day}</p>`;
}
