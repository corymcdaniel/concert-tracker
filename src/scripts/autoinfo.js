import { canEdit } from './auth.js';
import { toast } from './motion.js';
import { state } from './state.js';
import { saveInfo } from './info.js';
import { render } from './view.js';
import { MUSICAL, PAGE_SUFFIXES, pageName } from './wikimatch.js';

/* New artists get a Wikipedia match and Wikidata facts on their own, in the same shape as the seeded ones.
   Runs for editors once the info has loaded, on sign-in and after each save. An artist with no record is
   looked up; one saved as null was looked up already and had no match, so it's left for Edit info. */
let ready = false, running = false, again = false;

const WIKI = 'https://en.wikipedia.org/w/api.php?';
const WIKIDATA = 'https://www.wikidata.org/w/api.php?';
const MAX_GENRES = 3;

// The first title, in PAGE_SUFFIXES order, that's a real page describing a performer
async function findPage(name){
  const titles = PAGE_SUFFIXES.map(suffix => pageName(name) + suffix);
  const j = await fetch(WIKI + new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', origin: '*', redirects: '1',
    prop: 'description|pageprops|pageimages', ppprop: 'wikibase_item|disambiguation',
    piprop: 'name|thumbnail', pithumbsize: '100', titles: titles.join('|'),
  })).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const pages = new Map((j.query.pages || []).map(p => [p.title, p]));
  // Follow each title through Wikipedia's renames to the page it lands on
  const moves = new Map([...(j.query.normalized || []), ...(j.query.redirects || [])].map(m => [m.from, m.to]));
  for (const title of titles) {
    let at = title;
    while (moves.has(at)) at = moves.get(at);
    const p = pages.get(at);
    if (!p || p.missing || 'disambiguation' in (p.pageprops || {})) continue;
    if (!MUSICAL.test(p.description || '')) continue;
    let img = '';
    if (p.pageimage) {
      img = p.pageimage.replace(/ /g, '_');
      // Non-free photos live on English Wikipedia rather than Commons
      if (p.thumbnail?.source?.includes('/wikipedia/en/')) img += '|en';
    }
    return {wiki: p.title, qid: p.pageprops?.wikibase_item, desc: p.description, img};
  }
  return null;
}

const claimsOf = (entity, prop) => (entity.claims?.[prop] || []).filter(c => c.rank !== 'deprecated').map(c => c.mainsnak?.datavalue?.value).filter(Boolean);
// Wikidata times look like "+1988-00-00T00:00:00Z"; precision 9 is a year, 11 a day
function when(value, full){
  const m = /^\+?(\d{4})-(\d{2})-(\d{2})/.exec(value?.time || '');
  if (!m) return '';
  if (full && value.precision >= 11) return `${m[1]}-${m[2]}-${m[3]}`;
  return m[1];
}

// Formed, from, born, genres and website, as in info.json
async function facts(qid){
  const get = params => fetch(WIKIDATA + new URLSearchParams({action: 'wbgetentities', format: 'json', origin: '*', ...params}))
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const entity = (await get({ids: qid, props: 'claims'})).entities?.[qid];
  if (!entity) return {};
  const ids = prop => claimsOf(entity, prop).map(v => v.id).filter(Boolean);
  const placeIds = {formed_in: ids('P740')[0], country: ids('P495')[0], citizenship: ids('P27')[0], birthplace: ids('P19')[0]};
  const genreIds = ids('P136').slice(0, MAX_GENRES);
  const want = [...new Set([...Object.values(placeIds), ...genreIds].filter(Boolean))];
  const labels = {};
  if (want.length) {
    const named = await get({ids: want.join('|'), props: 'labels', languages: 'en'});
    Object.entries(named.entities || {}).forEach(([id, e]) => { if (e.labels?.en) labels[id] = e.labels.en.value; });
  }
  const out = {};
  const set = (key, value) => { if (value && (!Array.isArray(value) || value.length)) out[key] = value; };
  set('inception', when(claimsOf(entity, 'P571')[0]));
  set('dissolved', when(claimsOf(entity, 'P576')[0]));
  set('born', when(claimsOf(entity, 'P569')[0], true));
  Object.entries(placeIds).forEach(([key, id]) => set(key, labels[id]));
  set('genre', genreIds.map(id => labels[id]).filter(Boolean));
  const site = claimsOf(entity, 'P856')[0];
  if (typeof site === 'string') set('website', site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''));
  return out;
}

// Returns the record to save, null when Wikipedia has no match, and throws when it couldn't be asked
export async function lookUp(name){
  const page = await findPage(name);
  if (!page) return null;
  const rec = {wiki: page.wiki, qid: page.qid, desc: page.desc};
  if (page.img) rec.img = page.img;
  // The page alone is still worth saving if Wikidata is having a bad day
  if (page.qid) try { Object.assign(rec, await facts(page.qid)); } catch {}
  return rec;
}

const missing = () => [...new Set(state.shows.map(s => s.artist.trim()).filter(Boolean))].filter(a => state.INFO.artists?.[a] === undefined);

export function startAutoInfo(){
  ready = true;
  fillMissingArtists();
}

export async function fillMissingArtists(){
  if (!ready || !canEdit()) return;
  // A save while a run is going gets picked up by that run's next pass
  if (running) { again = true; return; }
  running = true;
  let matched = 0, unmatched = 0;
  try {
    do {
      again = false;
      for (const name of missing()) {
        let rec;
        try { rec = await lookUp(name); } catch { continue; } // couldn't reach Wikipedia: try again next time
        state.INFO.artists[name] = rec;
        // Not saved (signed out, session expired): stop, rather than ask to sign in once per artist
        if (!await saveInfo('artists', name)) { delete state.INFO.artists[name]; again = false; break; }
        if (rec) matched++;
        else unmatched++;
      }
    } while (again && canEdit());
  } finally { running = false; }
  if (!matched && !unmatched) return;
  let artists = 'artists';
  if (matched === 1) artists = 'artist';
  let msg = `Matched ${matched} ${artists} on Wikipedia`;
  if (unmatched) msg += `, ${unmatched} with no page`;
  toast(msg);
  render();
}
