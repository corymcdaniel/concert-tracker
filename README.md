# Show Log

Every concert and stand-up show, as a browsable ticket-stub log with stats.
Anyone with the link can view; signed-in editors can add, edit and delete.

## What's here
| Path | What it is |
|---|---|
| `index.html` | The whole app. No build step. |
| `shows.json` | Starting show list. Served by the API until the first save. |
| `info.json` | Starting artist and venue details (Wikipedia/Wikidata matches, photos, facts). |
| `vendor/identity.js` | Prebuilt Netlify Identity client (`@netlify/identity` 2.0.0). |
| `netlify/functions/shows.mjs` | `GET /api/shows` (public) and `PUT /api/shows` (editors only), stored in Netlify Blobs. |
| `netlify/functions/info.mjs` | `GET /api/info` (public) and `PUT /api/info` (editors only). |
| `netlify/lib/auth.mjs` | Shared editor check and daily backups. |

Each show is one act on one night:

```json
{ "id": "s001", "artist": "Weezer", "venue": "Mortgage Matchup Center",
  "city": "Phoenix", "state": "AZ", "country": "US",
  "date": "2026-10-20", "type": "Music", "notes": "" }
```

Acts sharing a date + venue + city are shown as one night, in list order (headliner first).

**Upcoming shows:** add a show with a future date and it's pinned under **Up next** at the top of the log, soonest first.
Upcoming shows (including tonight's) are left out of every count: header totals, the Stats tab, the year headers and
the "seen N times" counts in the artist and venue pop-ups. The day after the show, it moves into its year in the log and
starts counting. There is no separate flag; the date alone decides, so nothing needs updating after the show.

Artist and venue details live in `info.json`, keyed by artist name and by `venue|city`:

```json
{ "artists": { "Deftones": { "wiki": "Deftones", "qid": "Q485039", "desc": "American alternative metal band",
                             "img": "Deftones2011.jpg", "inception": "1988", "formed_in": "Sacramento",
                             "genre": ["alternative metal", "nu metal"], "website": "deftones.com" } },
  "venues":  { "Tabernacle|Atlanta": { "wiki": "Tabernacle (concert hall)", "opened": "1911", "capacity": 2600 } } }
```

`img` is a Wikimedia Commons file name (suffix `|en` for files hosted on English Wikipedia). The pop-up loads the
photo, its credit and the Wikipedia summary live from Wikipedia. `null` means no match was found; editors can fix
any match from the pop-up with **Edit info → Look up**.

## Deploy
1. Push this folder to a Git repo and import it in Netlify. No build command; publish directory is the repo root.
2. **Enable Identity:** Project configuration → Identity → Enable.
3. **Lock down sign-ups:** Identity → Registration → **Invite only**.
4. **Single sign-on (optional):** Identity → External providers → add Google and/or GitHub.
   The sign-in sheet only shows the providers you enable.
5. **Say who can edit**, either way:
   - Environment variable `EDITOR_EMAILS=you@example.com` (comma-separated), or
   - Identity → Users → your user → add role `editor` (or `admin`).
6. **Invite yourself** from Identity → Users → Invite. The email link opens the site and asks you to set a password.
   If you use Google/GitHub, sign in with the same email you invited.

Each save keeps a dated backup of the previous version in the `show-log` blob store (`backup-shows-YYYY-MM-DD`, `backup-info-YYYY-MM-DD`).

## Local development
```
npm install
npx netlify dev
```
Opening `index.html` straight from disk also works: it runs in "local" mode and saves edits to the browser only.

## Upgrading the Identity client
```
npm install @netlify/identity@<version>
npm run build:identity
```
