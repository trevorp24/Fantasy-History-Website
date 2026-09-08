import { CurrentSeasonStandings } from "@/app/current-season/CurrentSeasonStandings";
import { loadLeagueData, formatPoints } from "@/lib/data/loadLeague";
import type { Matchup, Season, TeamSeason } from "@/lib/domain/types";

const STARTER_LINEUP_SLOTS = new Set([0, 2, 4, 6, 16, 17, 23]);
const BEER_MARKER = "🍺";

type StandingRow = TeamSeason & {
  ownerName: string;
  rank: number;
  movement: number;
};

const winPct = (team: Pick<TeamSeason, "wins" | "losses" | "ties">) => {
  const games = team.wins + team.losses + team.ties;
  return games ? (team.wins + team.ties * 0.5) / games : 0;
};

function sortStandings<T extends Pick<TeamSeason, "wins" | "losses" | "ties" | "pointsFor" | "teamName">>(rows: T[]) {
  return [...rows].sort((a, b) =>
    winPct(b) - winPct(a) ||
    b.wins - a.wins ||
    b.pointsFor - a.pointsFor ||
    a.teamName.localeCompare(b.teamName)
  );
}

function standingsThroughWeek(season: Season, week: number) {
  const rows = new Map(season.teams.map((team) => [team.managerId, { ...team, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 }]));
  const applyGame = (matchup: Matchup) => {
    if (!matchup.completed || matchup.week > week || !matchup.homeManagerId || !matchup.awayManagerId || matchup.homeScore === undefined || matchup.awayScore === undefined) return;
    const home = rows.get(matchup.homeManagerId);
    const away = rows.get(matchup.awayManagerId);
    if (!home || !away) return;
    home.pointsFor += matchup.homeScore;
    home.pointsAgainst += matchup.awayScore;
    away.pointsFor += matchup.awayScore;
    away.pointsAgainst += matchup.homeScore;
    if (matchup.homeScore > matchup.awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else if (matchup.awayScore > matchup.homeScore) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.ties += 1;
      away.ties += 1;
    }
  };
  season.matchups.forEach(applyGame);
  return sortStandings(Array.from(rows.values()));
}

function lowScorerCounts(season: Season) {
  const counts = new Map<number, number>();
  const weeks = new Map<number, typeof season.weeklyPlayerScores>();

  for (const score of season.weeklyPlayerScores) {
    if (score.projected) continue;
    if (score.lineupSlotId !== undefined && !STARTER_LINEUP_SLOTS.has(score.lineupSlotId)) continue;
    const rows = weeks.get(score.week) ?? [];
    rows.push(score);
    weeks.set(score.week, rows);
  }

  for (const rows of weeks.values()) {
    const lowest = Math.min(...rows.map((score) => score.points));
    for (const score of rows.filter((row) => row.points === lowest)) {
      counts.set(score.playerId, (counts.get(score.playerId) ?? 0) + 1);
    }
  }

  return counts;
}

export default function CurrentSeasonPage() {
  const data = loadLeagueData();
  const season = data.seasons.find((item) => item.year === 2026);
  const managerById = new Map(data.managers.map((manager) => [manager.id, manager.displayName]));
  if (!season) return <h1>Current Season</h1>;

  const latestCompletedWeek = Math.max(0, ...season.matchups.filter((matchup) => matchup.completed).map((matchup) => matchup.week));
  const previousRanks = latestCompletedWeek > 1
    ? new Map(standingsThroughWeek(season, latestCompletedWeek - 1).map((team, index) => [team.managerId, index + 1]))
    : new Map<string, number>();
  const standings: StandingRow[] = sortStandings(season.teams).map((team, index) => {
    const rank = index + 1;
    const previousRank = previousRanks.get(team.managerId);
    return {
      ...team,
      ownerName: managerById.get(team.managerId) ?? "Owner unavailable",
      rank,
      movement: previousRank ? previousRank - rank : 0
    };
  });
  const playerLowScoreCounts = lowScorerCounts(season);
  const rows = standings.map((team) => ({
    ...team,
    pointsFor: formatPoints(team.pointsFor),
    pointsAgainst: formatPoints(team.pointsAgainst),
    roster: season.finalRosters.filter((player) => player.teamId === team.teamId).map((player) => ({
      ...player,
      lowScoreMarker: player.playerId ? BEER_MARKER.repeat(playerLowScoreCounts.get(player.playerId) ?? 0) : ""
    }))
  }));

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">2026</div>
          <h1>Current Season</h1>
        </div>
        <span className="status-pill">{latestCompletedWeek ? `Through Week ${latestCompletedWeek}` : "Preseason"}</span>
      </header>

      <section className="card">
        <CurrentSeasonStandings standings={rows} />
      </section>
    </>
  );
}
