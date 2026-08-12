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
          <h2>Archive Status</h2>
          <div className="mini-stats">
            <span><b>{completedSeasons.length}</b><small>Completed seasons</small></span>
            <span><b>{data.backfillYears.length}</b><small>Backfill years</small></span>
            <span><b>{data.seasons.flatMap((season) => season.matchups).filter((game) => game.completed).length}</b><small>Scored matchups</small></span>
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
