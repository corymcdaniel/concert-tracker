# Show Log

Every concert and stand-up show, as a browsable ticket-stub log with stats.
Anyone with the link can view; signed-in editors can add, edit and delete, and every change is recorded
in a history they can browse and undo.

## What's here
| Path | What it is |
|---|---|
| `src/pages/index.astro`, `src/layouts/`, `src/components/` | The page shell: head, header, tabs, filters and empty overlays. |
| `src/scripts/` | The app, as plain JS modules. `main.js` wires up events and starts it; `state.js` holds what modules share. Nearly all markup is built here at runtime from the API's data. |
| `src/styles/` | Global SCSS partials, loaded in order by `global.scss`. Global rather than CSS modules because the markup comes from JS template strings, which scoped styles can't reach. |
| `netlify/database/migrations/` | Database schema and seed data, applied automatically on deploy. |
| `netlify/functions/shows.mjs` | `GET /api/shows` (public); add, edit, delete, save a whole bill and bulk replace (editors). |
| `netlify/functions/info.mjs` | `GET /api/info` (public); save one artist or venue record (editors). |
| `netlify/functions/changes.mjs` | Change history and undo (editors). |
| `netlify/functions/setlists.mjs` | `GET /api/setlists` (public); look up the next act on setlist.fm (editors). |
| `public/map-land.json`, `public/hometowns.json` | Static data for the Hometowns map. Rebuild with `node scripts/build-map.mjs`. |
| `public/listening.json` | Public per-artist Spotify totals for the Bucket list. Rebuild with `node scripts/build-listening.mjs "<export folder>"`. |
| `netlify/lib/db.mjs` | Database connection, transactions tagged with the editor, show validation. |
| `netlify/lib/auth.mjs` | Shared editor check. |
| `public/shows.json`, `public/info.json` | The data the database was seeded from. Also used in local mode, when there's no API. |
| `scripts/build-seed.mjs` | Regenerates the seed migration from `shows.json` and `info.json`. |

## Data
The data lives in Netlify Database (Postgres). Five tables:

| Table | Holds |
|---|---|
| `shows` | One row per act per night: `id, artist, venue, city, state, country, date, type, notes, rating, price, companions, sort_order`, plus `created_at` / `updated_at`. |
| `setlists` | setlist.fm results per act and date. A cache of outside data, so it isn't in the change log. |
| `artists` | `name` → `info` (jsonb Wikipedia/Wikidata details, or `NULL` when no match was found). |
| `venues` | `key` (`venue|city`) → `info`, same as artists. |
| `changes` | Every insert, update and delete on the three tables above. |

Acts sharing a date + venue + city are shown as one night, billed in `sort_order` (headliner first). Adding an act to a
night places it after the night's last act; a new show goes to the top.

**Edit bill** on a stub edits the whole night in one sheet: venue, date and the other shared details, plus each act's
name and notes, billing order, and adding or removing acts. **Delete bill** removes every act of the night. Changing a
night's date or venue to match another night merges the two, since that's what makes acts one night.

**Upcoming shows:** add a show with a future date and it's pinned under **Up next** at the top of the log, soonest first.
Upcoming shows (including tonight's) are left out of every count: header totals, the Stats tab, the year headers and
the "seen N times" counts in the artist and venue pop-ups. The day after the show, it moves into its year in the log and
starts counting. There is no separate flag; the date alone decides, so nothing needs updating after the show.

Artist and venue `info` looks like this:

```json
{ "wiki": "Deftones", "qid": "Q485039", "desc": "American alternative metal band",
  "img": "Deftones2011.jpg", "inception": "1988", "formed_in": "Sacramento",
  "genre": ["alternative metal", "nu metal"], "website": "deftones.com" }
```

`img` is a Wikimedia Commons file name (suffix `|en` for files hosted on English Wikipedia). The pop-up loads the
photo, its credit and the Wikipedia summary live from Wikipedia. Editors can fix any match from the pop-up with
**Edit info → Look up**.

### Ratings, prices and companions
Set per night from **Edit bill** or when adding a show. Only editors can set them, and the API refuses anyone else.
Ratings are public. Price and companions are left out of `GET /api/shows` unless the request comes from an editor, and
their panels only appear when there's data to show. They're also in `changes`, which only editors can read.
If a save leaves these fields out, the saved values are kept, so a page loaded before signing in can't blank them.

### Setlists
**Check setlist.fm** in the Stats tab (editors) looks up each past music act, one request at a time. Comedy is skipped.
Acts with no result are checked again after 30 days. The key stays on the server.
Set `SETLISTFM_API_KEY` in Netlify, and in a git-ignored `.env.dev` locally (see `.env.example`).

### Bucket list
The Stats tab lists your most-played Spotify artists you've never seen live. Which ones you've seen is worked out in the
browser from the log, so an artist drops off as soon as their show has happened. It comes from a Spotify data export, not
the API, so there's no login or token.

1. On [Spotify's privacy page](https://www.spotify.com/account/privacy/), request **Extended streaming history**. It can
   take up to 30 days. The basic **Account data** export also works, but only covers about a year.
2. Unzip it **outside this repo**. The raw files can include IP addresses.
3. Run `node scripts/build-listening.mjs "<export folder>"`, then commit `public/listening.json` and deploy.

`public/listening.json` is public and holds only the top 300 artists: name, hours, plays, first year played and a Wikipedia page
and free photo. Plays under 30 seconds, podcasts and private sessions aren't counted. Photos are matched by name, so an
artist with a common name can occasionally get the wrong page. Run the script again with a new export to refresh it.

### Change history
A database trigger writes a row to `changes` for every insert, update and delete, with the row as it was
(`before`) and as it became (`after`), when, and which editor (`changed_by`). Because it's a trigger, nothing can
change the data without being recorded, including edits made straight in SQL (those show `changed_by` empty).
Saving a row without changing anything isn't recorded.

On the site, signed-in editors get:
- **History** in the header: every recent change, newest first, with what changed field by field.
- **History** in a show's edit sheet, or an artist/venue's **Edit info**: just that record's changes.
- **Undo** on each change. An undo is itself a change (marked "Undid change #N"), so it can be undone too.
  If the record has been changed again since, the undo is refused, so newer edits are never overwritten.
- **One entry per bill:** everything saved by **Edit bill** or **Delete bill** shares a `batch` id, so it shows as one
  change and one **Undo** reverses all of it, or none of it if any act has changed since. In a single act's history,
  the button reads **Undo whole bill**.

To look at history in SQL:

```sql
SELECT id, table_name, row_id, action, changed_by, changed_at, before, after
FROM changes WHERE table_name = 'shows' AND row_id = 's036' ORDER BY id DESC;
```

### Changing the schema
Add a new numbered file to `netlify/database/migrations/` (e.g. `0006_add_tour.sql`). Applied migrations can't be
edited. Netlify applies new migrations right before a deploy is published; a failing migration blocks the deploy.
Deploy previews get their own copy of the production database, so testing there never touches real data.

## Deploy
1. Push this folder to a Git repo and import it in Netlify. `netlify.toml` sets the build command (`npm run build`) and
   publish directory (`dist`).
2. **Database:** nothing to set up. The first deploy provisions it and runs the migrations, which also load the
   shows and artist/venue details. (Netlify Database needs a credit-based Netlify plan.)
3. **Enable Identity:** Project configuration → Identity → Enable.
4. **Lock down sign-ups:** Identity → Registration → **Invite only**.
5. **Single sign-on (optional):** Identity → External providers → add Google and/or GitHub.
   The sign-in sheet only shows the providers you enable.
6. **Say who can edit**, either way:
   - Environment variable `EDITOR_EMAILS=you@example.com` (comma-separated), or
   - Identity → Users → your user → add role `editor` (or `admin`).
7. **Invite yourself** from Identity → Users → Invite. The email link opens the site and asks you to set a password.
   If you use Google/GitHub, sign in with the same email you invited.

## Local development
```
npm install
npm run dev
```
`npm run dev` runs `netlify dev` with the variables from `.env.dev`, which starts the Astro dev server, the functions and
a local Postgres database, all at http://localhost:8888. Useful commands:

```
npx netlify database migrations apply   # apply new migrations locally
npx netlify database status             # what's applied and pending
npx netlify database reset              # wipe the local database (then apply again)
```

`npm run build` then `npm run preview` serves the built site without the functions. With no API it runs in "local" mode
and saves edits to the browser only. Opening a file straight from disk no longer works, since the site needs a server.

## Packages
| Package | Why |
|---|---|
| `@netlify/database` | Connects functions to Netlify Database; picks the right driver for local dev vs. production. |
| `@netlify/identity` | Sign-in for editors, and the server-side check that a request comes from one. |
| `astro` | Builds the static site: splits the page into components and bundles the scripts and styles. No adapter, since the API is plain Netlify Functions. Held at version 6 because version 7 needs Node 22.23.4 or newer. |
| `sass` | Compiles the SCSS partials. |

No charting, map or animation libraries: the charts and map are plain HTML and SVG, and the motion is CSS plus browser
features (view transitions and scroll timelines, where supported). All of it respects `prefers-reduced-motion`.

External data: map outlines from Natural Earth (public domain, via `world-atlas`), hometown coordinates from Wikidata,
setlists from [setlist.fm](https://www.setlist.fm), listening totals from your own Spotify data export, Bucket list
photos from Wikipedia and Wikimedia Commons.
