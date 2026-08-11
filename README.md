# Moggate Fantasy Football History

Fantasy football history site for the Moggate league archive.

## GitHub Pages

The static version of the site lives in:

```text
docs/
```

Use GitHub Pages with:

```text
Source: Deploy from a branch
Branch: main
Folder: /docs
```

## Weekly Update

Put the newest current-season ESPN export in your Downloads folder using this name:

```text
moggate_2026.json
```

Then double-click:

```text
update-moggate-site.cmd
```

That copies the newest 2026 export into the project, rebuilds the `docs` website, validates the data, commits the update, and pushes it to GitHub when this folder has a GitHub remote connected.

To download the ESPN JSON and update the site in one run, double-click:

```text
export-and-update-moggate-site.cmd
```

The first time, it asks for your ESPN `SWID` and `espn_s2` cookies. They are saved only on your computer in `.env.local`, which is ignored by Git.

To only download the latest ESPN JSON without rebuilding the site, double-click:

```text
export-moggate-json.cmd
```

If ESPN says `401 Unauthorized`, your saved cookies are probably expired or copied wrong. Open `espn-cookie.txt`, paste the full ESPN Cookie header into it, save it, then double-click this:

```text
reset-espn-cookies-and-export.cmd
```

## Data

Drop the ESPN JSON exports into:

```text
data/raw/moggate_2020.json
data/raw/moggate_2021.json
data/raw/moggate_2022.json
data/raw/moggate_2023.json
data/raw/moggate_2024.json
data/raw/moggate_2025.json
data/raw/moggate_2026.json
```

The importer only uses local JSON files and does not call ESPN directly. Raw ESPN JSON files are ignored by Git so they are not published accidentally.

## Run

```bash
npm install
npm run validate:data
npm run dev
```

## Structure

- `lib/espn/parser.ts` normalizes ESPN JSON into local domain models.
- `lib/stats/calculate.ts` computes career records, head-to-head, record book entries, rivalry rankings, placements, and all-play/luck scaffolding.
- `lib/data/loadLeague.ts` is the local data boundary. This is the future handoff point for Prisma/PostgreSQL.
- `app/*` contains the first UI pages.

No unsupported results are invented. If a JSON export is missing, incomplete, or does not contain a derivable field, the site labels that value as pending or unavailable.
