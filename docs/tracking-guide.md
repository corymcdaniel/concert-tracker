# How to track your shows in a spreadsheet

Nov 4, 2026 · Cory McDaniel

> Also as a shareable doc: https://claude.ai/artifact/KLodjuUAXfDaCuiopDFXB2. A ready-made template is in [show-log-template.csv](show-log-template.csv).

## Why a spreadsheet, and why now

Start a spreadsheet today, one row per act, and your whole history can be imported into Show Log once it opens to more people. Show Log is the site Cory built to turn his own spreadsheet of 92 nights out into a log, stats and maps. It doesn't take sign-ups yet, but a sheet kept in the shape below will drop straight in.

Any spreadsheet works: Google Sheets, Excel or Numbers. What matters is the columns and a few rules.

## Set up your sheet

Make these 11 columns, in this order, with these exact names in the first row. The first 8 are the core; the last 3 are optional and can stay empty.

```csv
Artist,Venue,City,State,Country,Date,Type,Notes,Rating,Price,With
```

| Column | What goes in it | Example |
| --- | --- | --- |
| Artist | The act's name, one act per row | Deftones |
| Venue | The venue's name | Petco Park |
| City | The city | San Diego |
| State | US state as two letters; outside the US, the state, province or prefecture | CA |
| Country | US for the United States; otherwise the full country name | US |
| Date | The date as YYYY-MM-DD; blank if you don't know it | 2026-11-07 |
| Type | Music or Comedy, nothing else | Music |
| Notes | Anything worth remembering, in plain text | Played the whole first album |
| Rating | Optional: how good the night was, 1 to 5 | 5 |
| Price | Optional: what your ticket cost, a number with no $ sign | 89.50 |
| With | Optional: who you went with | Sam, Alex |

## The rules that matter

These six rules are what let the site group your nights and count your repeats correctly.

1. **One row per act, not per night.** A bill with a headliner and two openers is three rows.
2. **Headliner first.** Put the headliner's row first, then the openers in the order you'd list them. The site shows the first act as the night's main act.
3. **Same night, same details.** Rows with the same Date, Venue and City become one night, so type them identically on every row of a bill.
4. **Spell names the same way every time.** "Sigur Ros" and "Sigur Rós" count as two artists. The same goes for venues: pick one spelling and stick to it.
5. **Dates as YYYY-MM-DD.** For example 2019-11-02, not 11/2/19. Leave the Date blank only if you really don't know it; those nights still count, under "Undated".
6. **Type is Music or Comedy.** Use Music for concerts and festivals, Comedy for stand-up. Nothing else will import.

## Examples to copy

These rows cover the common cases: a three-act bill (headliner first), a single act, stand-up, a show abroad, an upcoming show and a night with no known date. Copy them into your sheet as a starting point, then replace them with your own.

```csv
Artist,Venue,City,State,Country,Date,Type,Notes,Rating,Price,With
Weezer,Mortgage Matchup Center,Phoenix,AZ,US,2026-10-20,Music,,5,95,Sam
The Shins,Mortgage Matchup Center,Phoenix,AZ,US,2026-10-20,Music,,,,
Silversun Pickups,Mortgage Matchup Center,Phoenix,AZ,US,2026-10-20,Music,,,,
Gorillaz,Mortgage Matchup Center,Phoenix,AZ,US,2026-10-23,Music,Front row of the upper deck,4,120,
Marc Maron,Stand Up Live,Phoenix,AZ,US,2026-07-16,Comedy,,5,45,Alex
Radiohead,GMO Arena,Saitama,Tokyo,Japan,2027-06-08,Music,Bought tickets in the lottery,,,
Tom Rhodes,The Punchline,Atlanta,GA,US,,Comedy,Sometime in college,,,
```

- **Weezer, The Shins, Silversun Pickups:** one night, three rows, identical Date, Venue and City; the extras go on the headliner's row.
- **Radiohead:** abroad, so State is the prefecture (Tokyo) and Country is the full name (Japan). A future date makes it an upcoming show.
- **Tom Rhodes:** no known date, so Date is blank.

## Optional extras

Rating, Price and With describe the whole night, so fill them in on the headliner's row only and leave them blank on the openers.

- **Rating:** a whole number from 1 to 5. Show Log turns these into a top-rated list.
- **Price:** what you paid for your own ticket, as a plain number (89.50, not $89.50). Show Log totals your spending by year.
- **With:** names separated by commas. Show Log counts who you've been to the most shows with.
- **Notes:** free text for any row, such as a setlist moment, the weather or who opened unannounced.

These stay private on the site: only the person who owns the log sees prices and companions.

## Tips, and a check before you send it

To fill in old shows, start from what you already have: ticket emails, Ticketmaster or AXS order history, calendar entries, photos (they carry dates) and setlist.fm, which lists past concerts by artist and venue. Add new shows as soon as you buy the tickets; they'll appear as upcoming.

When it's ready to import, check these, then download it as CSV (File → Download → CSV in Google Sheets; File → Save As → CSV in Excel) and send it to Cory.

- [ ] The first row is the 11 column names, spelled exactly as above
- [ ] Every act on a bill has its own row, headliner first
- [ ] Rows of the same night share an identical Date, Venue and City
- [ ] Dates are YYYY-MM-DD (or blank if unknown)
- [ ] Type is Music or Comedy on every row
- [ ] Artist and venue names are spelled the same way everywhere
