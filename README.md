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
| `docs/tracking-guide.md`, `docs/show-log-template.csv` | A guide for people who want to start tracking their own shows in a spreadsheet, in a shape Show Log can import later, and a template to start from. |
| `netlify/database/migrations/` | Database schema and seed data, applied automatically on deploy. |
| `netlify/functions/shows.mjs` | `GET /api/shows` (public); add, edit, delete, save a whole bill and bulk replace (editors). |
| `netlify/functions/info.mjs` | `GET /api/info` (public); save one artist or venue record (editors). |
| `netlify/functions/changes.mjs` | Change history and undo (editors). |
| `netlify/functions/photos.mjs` | `GET /api/photos` and `/api/photos/:id` (public); upload and delete photos (editors). |
| `netlify/functions/setlists.mjs` | `GET /api/setlists` (public); look up the next act on setlist.fm (editors). |
| `public/map-land.json`, `public/hometowns.json` | Static data for the Hometowns map. Rebuild with `node scripts/build-map.mjs`. |
| `public/venue-coords.json` | Coordinates for venues whose info record has no `coord` (no Wikidata match, or a festival). Add a `"Venue|City"` entry when a new venue doesn't show on the map. |
| `public/listening.json`, `public/listening-songs.json`, `public/listening-artists.json` | Public Spotify summaries for the listening stats and the artist pop-up. Rebuild with `node scripts/build-listening.mjs spotify`. |
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
| `photos` | Your photos: which act (and so which night) each belongs to, its size and type. The images are in Netlify Blobs. |

Acts sharing a date + venue + city are shown as one night, billed in `sort_order` (headliner first). Adding an act to a
night places it after the night's last act; a new show goes to the top.

**Edit bill** on a stub edits the whole night in one sheet: venue, date and the other shared details, plus each act's
name and notes, billing order, and adding or removing acts. **Delete bill** removes every act of the night. Changing a
night's date or venue to match another night merges the two, since that's what makes acts one night.

**Loading:** the log is drawn as soon as the shows arrive, without waiting for sign-in, artist info, setlists or
listening data. Until then a fanned hand of blank tickets fills the space, and when the shows land each card flies to one of
the first tickets on screen and becomes it (`dealIn` in `src/scripts/log.js`, styles in `_deck.scss`). A link straight
into Stats keeps the hand up until Stats can be drawn. With reduced motion on, the log just appears.

**End of the log:** below the last ticket, a year rail (one bar per year, music and comedy stacked; click to jump to
that year), then a mosaic of photos you've uploaded to nights. Click a tile to jump to that night's ticket. The mosaic
only appears once there are uploaded photos (`src/scripts/endcap.js`).

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

**New artists are matched automatically.** When an editor saves a show with an artist that has no record, the page looks them
up on Wikipedia: the name, then `Name (band)`, `(musician)`, `(rapper)` and the other suffixes in `src/scripts/wikimatch.js`. A page
only counts if its description says band, musician, comedian or similar, and it's never a disambiguation page. The facts above
(formed, from, born, genres, website) then come from Wikidata. Signing in does the same for any artist still missing a record. An
artist with no page is saved as `null` so it isn't retried; fix those, or a wrong match, with **Edit info → Look up**.

`img` is a Wikimedia Commons file name (suffix `|en` for files hosted on English Wikipedia). The pop-up loads the
photo, its credit and the Wikipedia summary live from Wikipedia. Editors can fix any match from the pop-up with
**Edit info → Look up**.

### Ratings, prices and companions
Set per night from **Edit bill** or when adding a show. Only editors can set them, and the API refuses anyone else.
Ratings are public. Price and companions are left out of `GET /api/shows` unless the request comes from an editor, and
their panels only appear when there's data to show. They're also in `changes`, which only editors can read.
If a save leaves these fields out, the saved values are kept, so a page loaded before signing in can't blank them.

### Festivals
A night can be part of a festival ("Dia de los Deftones", "Kilby Block Party"). Set it per night from **Edit bill**;
the field suggests names already used, so each festival is spelled the same every year. It's never guessed from the
venue, since a stadium or park hosts plenty of nights that aren't festivals. A festival that runs several days is one
night per day with the same name, and the days of each year's run are numbered from their dates.
- **Log:** a gold wristband across the top of the stub, with "Day 2" on a multi-day run. Search finds festivals by name.
- **Stats → Overview:** a Festivals panel with every festival, the years you went, and each day's headliner.
- **Artist pop-up:** sightings at a festival are tagged with its name.

### Photos
Editors add photos to a night from **Edit bill** (drop them in or pick files) or the ticket's **+ Photos** button, up to 6 a
night. Before upload the page redraws each photo on a canvas: it's resized to at most 1600px and saved as WebP (JPEG where the
browser can't make WebP), which also drops all its metadata, location included. HEIC from an iPhone opens in Safari; other
browsers need it as JPEG. Photos upload straight away, separately from **Save**.

They show as a strip on the night's ticket, in the artist and venue pop-ups, in a viewer (arrow keys step through), and in the
mosaic at the end of the log, one per night in a random order each visit.

A photo hangs off one act and belongs to whatever night that act is in, so it follows the bill when the date or venue changes.
Removing that act from the bill moves its photos to another act of the night. Deleting a whole night keeps its photos, hidden, so
undoing the delete in History brings them back. There's deliberately no foreign key for that reason.
The images live in the Netlify Blobs store `photos`, keyed by photo id; `netlify dev` keeps a local copy for development.

### Setlists
**Check setlist.fm** in the Stats tab (editors) looks up each past music act, one request at a time. Comedy is skipped.
Acts with no result are checked again after 30 days. The key stays on the server.
Set `SETLISTFM_API_KEY` in Netlify, and in a git-ignored `.env.dev` locally (see `.env.example`).

### Stats sections
The Stats tab opens on four cards: **Overview**, **Artists**, **Places** and **Listening**. A row of section links under the Log/Stats switch jumps straight to any of them, or back to the cards with **All**. Each section has its own link, like
`#stats/listening`, and the browser's back button returns to the cards. Older `#stats` and `#review-YYYY` links still work.

### Venue map
Under **Stats → Places**, every venue you've been to sits on a street map. Pins grow with the number of nights there,
nearby venues group into clusters showing venue and night counts, and the buttons zoom to your top cities. Clicking a pin lists
every night there; the venue name opens its pop-up. Scroll-wheel zoom turns on after you first click the map, so scrolling the page
doesn't get caught. Coordinates come from each venue's `info.coord` (Wikidata), then `public/venue-coords.json`.
Venues with neither are counted as "not mapped" in the panel heading. Leaflet loads only when the Places section opens.

### Listening stats
These come from a Spotify data export, not the API, so there's no login or token.

- **Bucket list:** your most-played artists you've never seen live. Worked out in the browser from the log, so an artist
  drops off as soon as their show has happened.
- **Before & after the show:** plays in the 30 days either side of each show, acts you discovered live, and how much you'd
  played an act before first seeing them. Shows in the first year of the history don't count as a first sighting, since
  earlier listening isn't in the export.
- **Did you know the songs?:** how many songs in each setlist you'd played beforehand. Needs setlists synced from
  setlist.fm, and matches on song titles, so a song renamed live can count as unknown.
- **On repeat:** your top artists of the year, in Year in Review.
- **Your listening:** totals, listening by year next to nights out, the top artist each year, one-year obsessions, longest
  loyalty, comebacks, biggest days, and most-played songs and albums.
- **In the artist pop-up:** an **On Spotify** section for any artist you've played 5+ times: hours, plays, rank among
  every artist you've played, first and last play, hours per year (years you saw them marked), your 5 most-played songs,
  and plays in the 30 days before and after each show you saw, with a badge when you discovered them live. The
  before/after numbers are worked out in the browser from daily play counts, so shows logged after the script runs get
  them too. New listening needs a new export and another run.
- **When you listen:** hours by time of day, weekday and month. Approximate: it assumes Eastern time before `MOVE_DATE` and
  Arizona time after (set in `scripts/build-listening.mjs`), and leaves out plays made outside the US.

1. On [Spotify's privacy page](https://www.spotify.com/account/privacy/), request **Extended streaming history**. It can
   take up to 30 days. The basic **Account data** export also works, but only covers about a year.
2. Unzip it into `spotify/`, which git ignores. **Never commit the raw files:** every row has an IP address.
3. Run `node scripts/build-listening.mjs spotify`, then commit the three `public/listening*.json` files and deploy.

The files are public. `listening.json` holds the top 300 artists (name, hours, plays, first year played, a Wikipedia page
and free photo), each year's top 5, play counts around each show, the summaries above, and your 8 biggest listening days. `listening-songs.json` holds the date you first played
each song by an act you've seen. `listening-artists.json` holds, for every artist with 5+ plays, totals, hours per year, top 5
songs and plays per day (no times of day, devices or IPs), and is only fetched when an artist pop-up opens. Plays under 30 seconds, podcasts and private sessions aren't counted. Photos are matched by
name, so an artist with a common name can occasionally get the wrong page. The per-show numbers use the log at the time the
script runs, so run it again after a new export. If the log and Spotify spell a name too differently to match, add it to
`ALIASES` in `src/scripts/match.js`.

### Look and feel

- **Two schemes:** navy by default, and the original light scheme from the sun/moon button next to Sign in. The choice is
  saved in the browser and applied before the page paints (`src/layouts/Base.astro`), so there's no flash. Colours are
  tokens in `src/styles/_tokens.scss`.
- **Tickets** are light paper with dark ink in both schemes, with their own darker accents, so the gold repeat steps
  (×2 to ×5+) have something bright to shine on.
- **Accessibility:** every text colour passes WCAG AA (4.5:1) on the page, cards and every gold step, in both schemes.
  Music and comedy differ in lightness as well as hue, so they stay distinguishable with colour blindness, and labels
  ("Music", "Comedy", "Upcoming") mean colour is never the only cue.
- **Effects toggle:** the "FX" button next to the theme toggle. Off is the simple view: no page spotlight, ticket
  tilt or cursor glow, gold foil shimmer or glow, Goodnight switch, or hover motion (lifts, slides, zooms, shadows).
  Animations, colours, layout and hover colour changes stay the same.
  On by default, remembered in the browser, and set before the page paints (`src/styles/_effects.scss`).
- **Spotlight:** a soft light follows the mouse across the page (`src/styles/_spotlight.scss`). It's off on touch
  screens and with reduced motion.
- **Year scroller (desktop):** a Google Photos-style timeline down the right edge of the log, on windows 1180px or
  wider with a mouse or trackpad. Years sit where they fall in the log; drag the gold handle to scrub (a bubble shows the
  year) or click a year to jump. It stays quietly visible and brightens on hover or drag (`src/scripts/yearRail.js`).
- **Goodnight:** the little light switch at the left of the footer, before the name, fades the house lights out over the page,
  leaving a follow-spot at the mouse. Flip it again or press Esc to bring them up. It isn't remembered between visits,
  and it's hidden on phones and tablets, which have no cursor to follow (`src/styles/_lights.scss`).

### Analytics

Google Analytics 4, only with the visitor's consent (`src/scripts/analytics.js`).

- **Setup:** set `PUBLIC_GA_ID` (your `G-XXXXXXXXXX` Measurement ID) in Netlify's environment variables and redeploy.
  It's read at build time. With no ID, nothing about analytics appears.
- **Consent:** a small banner asks once (Allow / No thanks). Nothing loads or is sent before Allow, and the footer's
  **Analytics** button reopens the choice. Google signals and ad personalisation are off.
- **Not counted:** localhost, deploy previews and branch deploys, and anyone signed in as an editor.
- **Page views:** the site is one page, so each view is sent as its own path: `/` (Log), `/stats`, `/stats/overview`,
  `/stats/artists`, `/stats/places`, `/stats/listening`.
- **Events:** `open_artist` and `open_venue` (name), `search` (term, once it's committed), `filter` (type or city),
  `open_review` (year), `share` (year review), `theme_change` (light or navy), `house_lights` (out or up), `effects_change` (on or off),
  `track_prompt` (open, copy, open_claude, template).

### Track your own shows

The footer's **Track your own shows** button opens a prompt for any AI chat (Claude, ChatGPT, Gemini) that helps
someone start a log of their own: it converts a list they already have, or interviews them show by show, into a CSV
Show Log can import later. It follows `docs/tracking-guide.md`. The panel has **Copy prompt**, **Open in Claude**
(a new chat with the prompt filled in) and a download of the spreadsheet template. The template and the prompt's
example rows both come from `docs/show-log-template.csv`, so they can't drift apart (`src/scripts/trackPrompt.js`).

### Search and link previews

The site is kept out of search on purpose: every page has `<meta name="robots" content="noindex">`, and `netlify.toml`
sends `X-Robots-Tag: noindex` for every file, including the JSON data. `robots.txt` lets crawlers in, since one that's
blocked can't see the noindex. To allow indexing later, remove both.

- **Live at build time:** `src/lib/site-data.mjs` fetches the shows from the production API once per build (falling
  back to `public/shows.json`), and the description, share image and summary all use its totals.
- **Link previews:** title, description, and a 1200×630 ticket-style share image (`/og.png`, drawn by
  `src/pages/og.png.js` with `satori` and `sharp` from the fonts in `src/og/fonts`).
- **Icons:** `public/favicon.svg`, and a 180×180 home-screen icon drawn from it (`src/pages/apple-touch-icon.png.js`).
- **Without JavaScript:** a readable summary (`src/components/Summary.astro`): totals, upcoming shows, recent nights and
  most-seen artists. With JavaScript it's hidden from the first paint and replaced by the app.

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

To get production's latest data locally, run `node scripts/pull-prod.mjs` while `npm run dev` is running. It replaces
the local shows, artists, venues and photos with production's and copies the photo images into the local blob store.
It reads production's public API, so price and companions (editor-only) don't come over, and it clears the local
change history.

`npm run build` then `npm run preview` serves the built site without the functions. With no API it runs in "local" mode
and saves edits to the browser only. Opening a file straight from disk no longer works, since the site needs a server.

## Packages
| Package | Why |
|---|---|
| `@netlify/database` | Connects functions to Netlify Database; picks the right driver for local dev vs. production. |
| `@netlify/identity` | Sign-in for editors, and the server-side check that a request comes from one. |
| `@netlify/blobs` | Stores your uploaded photos. Same Netlify account as the site, so no other service to set up. |
| `astro` | Builds the static site: splits the page into components and bundles the scripts and styles. No adapter, since the API is plain Netlify Functions. Held at version 6 because version 7 needs Node 22.23.4 or newer. |
| `sass` | Compiles the SCSS partials. |
| `leaflet` | The venue map: a real, zoomable street map with OpenStreetMap tiles. Small (about 40 KB gzipped), no API key, and loaded only on the Places section. |
| `leaflet.markercluster` | Groups nearby venue pins (16 are in metro Atlanta) into clusters that split apart as you zoom, and fans out venues at the same spot. |
| `satori` | Lays out the share image and draws its text as shapes from the bundled fonts, so it looks the same on any build machine. |
| `sharp` | Turns the share image's SVG into a PNG, and draws the home-screen icon. Astro already uses it; listed so the build can rely on it. |

No charting or animation libraries: the charts and the hometowns map are plain HTML and SVG, and the motion is CSS plus browser
features (view transitions and scroll timelines, where supported). All of it respects `prefers-reduced-motion`.

External data: venue map tiles from [OpenStreetMap](https://www.openstreetmap.org/copyright), map outlines from Natural Earth (public domain, via `world-atlas`), hometown coordinates from Wikidata,
setlists from [setlist.fm](https://www.setlist.fm), listening totals from your own Spotify data export, Bucket list
photos from Wikipedia and Wikimedia Commons.
