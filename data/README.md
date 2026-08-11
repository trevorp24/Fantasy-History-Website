# ESPN Export Drop Zone

Place raw ESPN exports here using these filenames:

- `moggate_2020.json`
- `moggate_2021.json`
- `moggate_2022.json`
- `moggate_2023.json`
- `moggate_2024.json`
- `moggate_2025.json`
- `moggate_2026.json`

The weekly updater only needs to refresh `moggate_2026.json` and `moggate_2026_activity.json` from now on.
Each one-click ESPN download also saves dated copies under `snapshots/2026/` so future trade-impact calculations can compare weekly roster and scoring snapshots.

Optional copied draft recap text can be placed in:

- `draft-recaps/moggate_2024_draft_recap.txt`
- `draft-recaps/moggate_2025_draft_recap.txt`

Those files are used only to fill draft pick names/positions when ESPN's JSON export has player IDs but no embedded player names.
