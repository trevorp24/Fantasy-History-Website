import { ScheduleExplorer } from "@/app/schedule/ScheduleExplorer";
import { loadLeagueData } from "@/lib/data/loadLeague";

export default function SchedulePage() {
  const data = loadLeagueData();
  const season = data.seasons.find((item) => item.year === 2026);
  const managerNames = Object.fromEntries(data.managers.map((manager) => [manager.id, manager.displayName]));

  if (!season) return <header className="page-header history-accent"><h1>Schedule</h1></header>;

  const weeks = [...new Set(season.matchups.map((matchup) => matchup.week).filter((week) => week > 0))].sort((a, b) => a - b);

  const rivalryRecords = Object.fromEntries(data.headToHead.flatMap((record) => [
    [
      `${record.managerAId}|${record.managerBId}`,
      `${record.winsA}-${record.winsB}${record.ties ? `-${record.ties}` : ""}`
    ],
    [
      `${record.managerBId}|${record.managerAId}`,
      `${record.winsB}-${record.winsA}${record.ties ? `-${record.ties}` : ""}`
    ]
  ]));

  return (
    <>
      <header className="page-header history-accent">
        <h1>Schedule</h1>
      </header>

      <ScheduleExplorer
        weeks={weeks}
        matchups={season.matchups}
        teams={season.teams}
        managerNames={managerNames}
        rivalryRecords={rivalryRecords}
      />
    </>
  );
}
