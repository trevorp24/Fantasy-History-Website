# ESPN Export Drop Zone

Place raw ESPN exports here using these filenames:

- `moggate_2024.json`
- `moggate_2025.json`
- `moggate_2026.json`

The site also reserves 2020, 2021, 2022, and 2023 as missing seasons so they can be backfilled later without changing the data model.

Optional copied draft recap text can be placed in:

- `draft-recaps/moggate_2024_draft_recap.txt`
- `draft-recaps/moggate_2025_draft_recap.txt`

Those files are used only to fill draft pick names/positions when ESPN's JSON export has player IDs but no embedded player names.
