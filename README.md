# Show Log

Every concert and stand-up show, as a browsable ticket-stub log with stats.
Anyone with the link can view; signed-in editors can add, edit and delete, and every change is recorded
in a history they can browse and undo.

## What's here
| Path | What it is |
|---|---|
| `index.html` | The whole app. No build step. |
| `netlify/database/migrations/` | Database schema and seed data, applied automatically on deploy. |
| `netlify/functions/shows.mjs` | `GET /api/shows` (public); add, edit, delete and bulk replace (editors). |
| `netlify/functions/info.mjs` | `GET /api/info` (public); save one artist or venue record (editors). |
| `netlify/functions/changes.mjs` | Change history and undo (editors). |
| `netlify/lib/db.mjs` | Database connection, transactions tagged with the editor, show validation. |
| `netlify/lib/auth.mjs` | Shared editor check. |
| `shows.json`, `info.json` | The data the database was seeded from. Also used when `index.html` is opened from disk. |
| `scripts/build-seed.mjs` | Regenerates the seed migration from `shows.json` and `info.json`. |
| `vendor/identity.js` | Prebuilt Netlify Identity client (`@netlify/identity` 2.0.0). |

## Data
The data lives in Netlify Database (Postgres). Four tables:

| Table | Holds |
|---|---|
| `shows` | One row per act per night: `id, artist, venue, city, state, country, date, type, notes, sort_order`, plus `created_at` / `updated_at`. |
| `artists` | `name` → `info` (jsonb Wikipedia/Wikidata details, or `NULL` when no match was found). |
| `venues` | `key` (`venue|city`) → `info`, same as artists. |
| `changes` | Every insert, update and delete on the three tables above. |

Acts sharing a date + venue + city are shown as one night, billed in `sort_order` (headliner first). Adding an act to a
night places it after the night's last act; a new show goes to the top.

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

To look at history in SQL:

```sql
SELECT id, table_name, row_id, action, changed_by, changed_at, before, after
FROM changes WHERE table_name = 'shows' AND row_id = 's036' ORDER BY id DESC;
```

### Changing the schema
Add a new numbered file to `netlify/database/migrations/` (e.g. `0004_add_rating.sql`). Applied migrations can't be
edited. Netlify applies new migrations right before a deploy is published; a failing migration blocks the deploy.
Deploy previews get their own copy of the production database, so testing there never touches real data.

## Deploy
1. Push this folder to a Git repo and import it in Netlify. No build command; publish directory is the repo root.
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
npx netlify dev
```
`netlify dev` starts a local Postgres database. Useful commands:

```
npx netlify database migrations apply   # apply new migrations locally
npx netlify database status             # what's applied and pending
npx netlify database reset              # wipe the local database (then apply again)
```

Opening `index.html` straight from disk also works: it runs in "local" mode and saves edits to the browser only.

## Packages
| Package | Why |
|---|---|
| `@netlify/database` | Connects functions to Netlify Database; picks the right driver for local dev vs. production. |
| `@netlify/identity` | Sign-in for editors, and the server-side check that a request comes from one. |
| `esbuild` (dev) | Builds the browser copy of the Identity client into `vendor/identity.js`. |

## Upgrading the Identity client
```
npm install @netlify/identity@<version>
npm run build:identity
```
