export function scheduleWeek(season) {
  const matchups = (season?.matchups ?? []).filter((matchup) => matchup.week > 0);
  const weeks = [...new Set(matchups.map((matchup) => matchup.week))].sort((a, b) => a - b);
  if (weeks.includes(season?.currentMatchupPeriod)) return season.currentMatchupPeriod;

  // Stay on a live week until all of its games have a final result.
  return weeks.find((week) => matchups.some((matchup) => matchup.week === week && !matchup.completed))
    ?? weeks[weeks.length - 1]
    ?? 1;
}
