import { loadLeagueData, formatPoints } from "@/lib/data/loadLeague";
import type { Matchup, Season, TeamSeason } from "@/lib/domain/types";

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

function movementLabel(movement: number) {
  if (movement > 0) return <span className="movement up">↑ {movement}</span>;
  if (movement < 0) return <span className="movement down">↓ {Math.abs(movement)}</span>;
  return <span className="movement even">-</span>;
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
        <table className="table current-standings">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Weekly Move</th>
              <th>Team</th>
              <th>Record</th>
              <th>PF (Tiebreaker)</th>
              <th>PA</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team) => (
              <tr className={team.rank === 9 ? "playoff-cutoff" : ""} key={team.teamId}>
                <td>{team.rank}</td>
                <td>{movementLabel(team.movement)}</td>
                <td><strong>{team.teamName}</strong><span className="cell-note">{team.ownerName}</span></td>
                <td>{team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ""}</td>
                <td>{formatPoints(team.pointsFor)}</td>
                <td>{formatPoints(team.pointsAgainst)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
