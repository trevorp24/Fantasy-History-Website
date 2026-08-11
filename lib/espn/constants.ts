export const EXPECTED_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;
export const AVAILABLE_EXPORT_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;

export const POSITION_BY_ID: Record<number, string> = {
  0: "QB",
  1: "TQB",
  2: "RB",
  3: "RB/WR",
  4: "WR",
  5: "WR/TE",
  6: "TE",
  16: "D/ST",
  17: "K"
};

export const LINEUP_SLOT_BY_ID: Record<number, string> = {
  0: "QB",
  2: "RB",
  4: "WR",
  6: "TE",
  16: "D/ST",
  17: "K",
  20: "Bench",
  21: "IR",
  23: "Flex"
};
