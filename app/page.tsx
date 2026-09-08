import Link from "next/link";
import { DraftCountdown } from "@/app/components/DraftCountdown";
import { loadLeagueData, formatPoints } from "@/lib/data/loadLeague";

export default function HomePage() {
  const data = loadLeagueData();
  const completedSeasons = data.seasons.filter((season) => season.status === "complete");
  const previousSeason = [...completedSeasons].sort((a, b) => b.year - a.year)[0];
  const previousWinner = previousSeason?.teams.find((team) => team.finalPlacement === 1);
  const previousLoser = previousSeason
    ? [...previousSeason.teams]
      .filter((team) => team.finalPlacement !== undefined)
      .sort((a, b) => (b.finalPlacement ?? 0) - (a.finalPlacement ?? 0))[0]
    : undefined;
  const upcomingSeason = data.seasons.find((season) => season.year === 2026);
  const managerById = new Map(data.managers.map((manager) => [manager.id, manager]));
  const teamById = new Map(upcomingSeason?.teams.map((team) => [team.teamId, team]) ?? []);
  const latestCompletedWeek = upcomingSeason ? Math.max(0, ...upcomingSeason.matchups.filter((matchup) => matchup.completed).map((matchup) => matchup.week)) : 0;
  const currentWeek = latestCompletedWeek > 0
    ? latestCompletedWeek
    : Math.min(...(upcomingSeason?.matchups.map((matchup) => matchup.week).filter((week) => week > 0) ?? [1]));
  const weeklyMatchups = upcomingSeason?.matchups
    .filter((matchup) => matchup.week === currentWeek && matchup.homeTeamId && matchup.awayTeamId)
    .sort((a, b) => (a.id).localeCompare(b.id)) ?? [];
  const recapWeek = upcomingSeason ? Math.max(0, ...upcomingSeason.matchups.filter((matchup) =>
    matchup.completed || matchup.homeProjectedScore !== undefined || matchup.awayProjectedScore !== undefined
  ).map((matchup) => matchup.week)) : 0;
  const weeklyTotals = recapWeek && upcomingSeason
    ? upcomingSeason.matchups
      .filter((matchup) => matchup.week === recapWeek)
      .flatMap((matchup) => {
        const useFinal = matchup.completed;
        return [
          {
            team: matchup.homeTeamId ? teamById.get(matchup.homeTeamId) : undefined,
            total: useFinal ? matchup.homeScore : matchup.homeProjectedScore,
            projected: !useFinal
          },
          {
            team: matchup.awayTeamId ? teamById.get(matchup.awayTeamId) : undefined,
            total: useFinal ? matchup.awayScore : matchup.awayProjectedScore,
            projected: !useFinal
          }
        ];
      })
      .filter((row): row is { team: NonNullable<typeof row.team>; total: number; projected: boolean } => Boolean(row.team) && row.total !== undefined)
      .sort((a, b) => b.total - a.total)
    : [];
  const highestScorer = weeklyTotals[0];
  const lowestScorer = weeklyTotals[weeklyTotals.length - 1];
  const recapIsProjected = weeklyTotals.length > 0 && weeklyTotals.every((row) => row.projected);
  const recapMatchups = upcomingSeason?.matchups
    .filter((matchup) => recapWeek && matchup.week === recapWeek && matchup.homeTeamId && matchup.awayTeamId)
    .map((matchup) => {
      const home = matchup.homeTeamId ? teamById.get(matchup.homeTeamId) : undefined;
      const away = matchup.awayTeamId ? teamById.get(matchup.awayTeamId) : undefined;
      const homeScore = matchup.completed ? matchup.homeScore : matchup.homeProjectedScore;
      const awayScore = matchup.completed ? matchup.awayScore : matchup.awayProjectedScore;
      const margin = homeScore !== undefined && awayScore !== undefined ? Math.abs(homeScore - awayScore) : undefined;
      return { home, away, homeScore, awayScore, margin };
    })
    .filter((row): row is typeof row & { margin: number; homeScore: number; awayScore: number } => row.margin !== undefined && row.homeScore !== undefined && row.awayScore !== undefined) ?? [];
  const biggestEdge = [...recapMatchups].sort((a, b) => b.margin - a.margin)[0];
  const closestMatchup = [...recapMatchups].sort((a, b) => a.margin - b.margin)[0];
  const matchupLabel = (row?: typeof biggestEdge) => row ? `${row.home?.teamName ?? "Home"} ${formatPoints(row.homeScore)} - ${formatPoints(row.awayScore)} ${row.away?.teamName ?? "Away"}` : "No matchup yet";
  const rivalryRecord = (homeManagerId?: string, awayManagerId?: string) => {
    if (!homeManagerId || !awayManagerId) return "No history";
    const record = data.headToHead.find((item) =>
      (item.managerAId === homeManagerId && item.managerBId === awayManagerId) ||
      (item.managerAId === awayManagerId && item.managerBId === homeManagerId)
    );
    if (!record) return "0-0";
    return record.managerAId === homeManagerId
      ? `${record.winsA}-${record.winsB}${record.ties ? `-${record.ties}` : ""}`
      : `${record.winsB}-${record.winsA}${record.ties ? `-${record.ties}` : ""}`;
  };

  return (
    <>
      <header className="home-hero">
        <div>
          <h1>Moggate 2026</h1>
        </div>
        <DraftCountdown />
      </header>

      <section className="grid cols-3">
        <div className="card spotlight-card">
          <div className="stacked-spotlight">
            <div>
              <span className="tag gold">Previous winner</span>
              <h2>{previousWinner?.teamName ?? "Unavailable"}</h2>
              <p>{previousWinner ? `${managerById.get(previousWinner.managerId)?.displayName ?? "Owner unavailable"} won ${previousSeason?.year}.` : "Winner appears when ESPN provides final placements."}</p>
              {previousWinner && <strong>{previousWinner.wins}-{previousWinner.losses}{previousWinner.ties ? `-${previousWinner.ties}` : ""} - {formatPoints(previousWinner.pointsFor)} PF</strong>}
            </div>
            <div>
              <span className="tag red">Previous loser</span>
              <h2>{previousLoser?.teamName ?? "Unavailable"}</h2>
              <p>{previousLoser ? `${managerById.get(previousLoser.managerId)?.displayName ?? "Owner unavailable"} finished ${previousLoser.finalPlacement ?? "last"} in ${previousSeason?.year}.` : "Loser appears when ESPN provides final placements."}</p>
              {previousLoser && <strong>{previousLoser.wins}-{previousLoser.losses}{previousLoser.ties ? `-${previousLoser.ties}` : ""} - {formatPoints(previousLoser.pointsFor)} PF</strong>}
            </div>
          </div>
        </div>

        <div className="card">
          <span className="tag green">2026</span>
          <h2>Rule Changes</h2>
          <ul className="rule-list">
            <li>FAAB bidding for waivers</li>
            <li>Bench spot -1</li>
          </ul>
        </div>

        <div className="card">
          <span className={recapIsProjected ? "tag gold" : "tag green"}>{recapWeek ? `Week ${recapWeek}${recapIsProjected ? " projected" : ""}` : "2026"}</span>
          <h2>Weekly Recap</h2>
          <div className="weekly-recap-grid">
            <span>
              <small>Highest scorer</small>
              <b>{highestScorer ? formatPoints(highestScorer.total) : "-"}</b>
              <strong>{highestScorer ? managerById.get(highestScorer.team.managerId)?.displayName ?? "Owner unavailable" : "No scores yet"}</strong>
              <em>{highestScorer?.team.teamName ?? "Scores appear when ESPN updates."}</em>
            </span>
            <span>
              <small>Lowest scorer</small>
              <b>{lowestScorer ? formatPoints(lowestScorer.total) : "-"}</b>
              <strong>{lowestScorer ? managerById.get(lowestScorer.team.managerId)?.displayName ?? "Owner unavailable" : "No scores yet"}</strong>
              <em>{lowestScorer?.team.teamName ?? "Scores appear when ESPN updates."}</em>
            </span>
            <span>
              <small>{recapIsProjected ? "Biggest projected edge" : "Biggest blowout"}</small>
              <b>{biggestEdge ? formatPoints(biggestEdge.margin) : "-"}</b>
              <strong>{matchupLabel(biggestEdge)}</strong>
              <em>{biggestEdge ? `${managerById.get(biggestEdge.home?.managerId ?? "")?.displayName ?? "Home"} vs ${managerById.get(biggestEdge.away?.managerId ?? "")?.displayName ?? "Away"}` : "Scores appear when ESPN updates."}</em>
            </span>
            <span>
              <small>Closest matchup</small>
              <b>{closestMatchup ? formatPoints(closestMatchup.margin) : "-"}</b>
              <strong>{matchupLabel(closestMatchup)}</strong>
              <em>{closestMatchup ? `${managerById.get(closestMatchup.home?.managerId ?? "")?.displayName ?? "Home"} vs ${managerById.get(closestMatchup.away?.managerId ?? "")?.displayName ?? "Away"}` : "Scores appear when ESPN updates."}</em>
            </span>
          </div>
        </div>
      </section>

      <section className="section card">
        <div className="row-between">
          <h2>Active Members for 2026</h2>
          <Link className="text-button" href="/managers">Manager history</Link>
        </div>
        <div className="member-grid">
          {upcomingSeason?.teams.map((team) => (
            <div className="member-tile" key={team.teamId}>
              <strong>{managerById.get(team.managerId)?.displayName ?? "Owner unavailable"}</strong>
              <span>{team.teamName}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section card">
        <div className="row-between">
          <h2>Week {currentWeek} Schedule</h2>
          <Link className="text-button" href="/current-season">Current season</Link>
        </div>
        <div className="schedule-list">
          {weeklyMatchups.map((matchup) => {
            const home = matchup.homeTeamId ? teamById.get(matchup.homeTeamId) : undefined;
            const away = matchup.awayTeamId ? teamById.get(matchup.awayTeamId) : undefined;
            return (
              <div className="schedule-matchup" key={matchup.id}>
                <div>
                  <strong>{home?.teamName ?? "Home Team"}</strong>
                  <span>{home ? managerById.get(home.managerId)?.displayName ?? "Owner unavailable" : "Owner unavailable"}</span>
                </div>
                <div className="matchup-score">
                  <b>{formatPoints(matchup.homeScore ?? 0)} - {formatPoints(matchup.awayScore ?? 0)}</b>
                  <span>Rivalry: {rivalryRecord(home?.managerId, away?.managerId)}</span>
                </div>
                <div>
                  <strong>{away?.teamName ?? "Away Team"}</strong>
                  <span>{away ? managerById.get(away.managerId)?.displayName ?? "Owner unavailable" : "Owner unavailable"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section grid cols-2">
        <Link className="card link-card" href="/history">
          <h2>League History</h2>
        </Link>
        <Link className="card link-card" href="/rivalries">
          <h2>Rivalries</h2>
        </Link>
      </section>
    </>
  );
}
