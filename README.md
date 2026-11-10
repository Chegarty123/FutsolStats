# Iona Futsal League

A small website showing standings, player stats and Player of the Week for the Iona Futsal League. Everything comes straight from the league's Google Sheet, so updating the sheet updates the site. Pages check for new numbers every few minutes.

It's plain HTML, CSS and JavaScript: no build step, nothing to install.

## Pages

| Page | File |
|---|---|
| Home dashboard | `index.html` |
| Standings | `standings.html` (the old `JPProject.html` link redirects here) |
| Player stats (sortable and searchable) | `PlayerStats.html` |
| Player of the Week | `PlayerOfTheWeek.html` |

## Updating stats

Edit the Google Sheet. That's it. Google takes up to about 5 minutes to publish changes, so the site lags behind slightly.

The site finds columns **by their header name**, so you can reorder columns. Keep the header names recognisable:

- **Standings tab:** `Position`, `Club`, `MP`, `W`, `D`, `L`, `GF`, `GA`, `GD`, `Pts`, `Form`. Form is a string like `WWDLW`.
- **Player stats tab:** `Player`, `Team`, `Goals`, `Assists`, `G + A`, `Latest Rating`, `Season Rating`. If G + A is blank, it's calculated. Ratings are out of 10; leave a rating blank if the player hasn't been rated yet (it shows as "–", not 0).
- **Player of the Week tab:** `Player`, `Date`, `Week`, `Team`, `Goals`, `Assists`, `G + A`. Add one row per week; the last row is the latest winner.

Data ends at the first completely blank row, so notes can go below a gap.

## New season checklist

1. Open `js/config.js` and change `season` (and `leagueName` if needed).
2. If you made a new spreadsheet: **File → Share → Publish to web → Entire document → CSV**. Then update `sheet.base` and the `gid` numbers in `js/config.js`. Each tab's `gid` is shown in its URL.
3. New team colour? Add a line under "Team colours" near the top of `css/styles.css`.

## Publishing code changes

After editing anything in `css/` or `js/`, run this before uploading:

```sh
node scripts/bump-version.mjs
```

It updates the `?v=…` tag on the CSS/JS links in every page. Without it, a browser that visited recently can mix a saved copy of an old file with a new page and show "Something went wrong" (GitHub Pages lets browsers reuse files for up to 10 minutes). Editing the Google Sheet doesn't need this.

## Running it locally

Double-clicking `index.html` **won't load stats**: Google blocks data requests from pages opened as files (`file://`). Serve the folder instead:

```sh
node scripts/serve.mjs   # then open http://localhost:8000
```

## Hosting (GitHub Pages)

1. Push this folder to a GitHub repository.
2. In the repo, go to **Settings → Pages → Build from branch → `main` / root**.
3. The site will be at `https://<your-username>.github.io/<repo-name>/`.

### Backup data (optional, automatic)

`.github/workflows/snapshot.yml` downloads the sheet into `data/` every hour, and only commits when something changed. If a visitor can't reach Google, the site falls back to that copy, or to the last copy saved in their own browser. A banner tells them they're seeing saved stats.

To run it by hand: **Actions → Snapshot sheet data → Run workflow**, or `node scripts/snapshot.mjs` locally.

> GitHub pauses scheduled workflows on repos with no activity for 60 days. Re-enable it from the Actions tab at the start of each season.

## How loading works

`js/futsal.js` fetches each tab's CSV directly from Google. Published sheets allow this, so no proxy is needed; the old version broke because the free proxy services it relied on shut down. If the fetch fails, it falls back to the newest saved copy.
