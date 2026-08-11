import { RivalryExplorer } from "@/app/rivalries/RivalryExplorer";
import { loadLeagueData } from "@/lib/data/loadLeague";

export default function RivalriesPage() {
  const data = loadLeagueData();
  const activeManagerIds = new Set(data.seasons.find((season) => season.year === 2026)?.teams.map((team) => team.managerId) ?? []);
  const activeYearsByManagerId = new Map<string, string>();

  for (const manager of data.managers) {
    const years = data.seasons.flatMap((season) => {
      const team = season.teams.find((seasonTeam) => seasonTeam.managerId === manager.id);
      if (!team) return [];
      const lastPlace = [...season.teams]
        .filter((seasonTeam) => seasonTeam.finalPlacement !== undefined && seasonTeam.finalPlacement > 0)
        .sort((a, b) => (b.finalPlacement ?? 0) - (a.finalPlacement ?? 0))[0];
      const marker = team.finalPlacement === 1 ? " 🏆" : team.teamId === lastPlace?.teamId ? " 💩" : "";
      return [`${season.year}${marker}`];
    });
    activeYearsByManagerId.set(manager.id, years.length ? years.join(", ") : "No completed seasons");
  }

  const rivalrySections = data.careerRecords.map((careerRecord) => {
    const manager = careerRecord.manager;
    const rows = data.headToHead
      .filter((record) => record.managerAId === manager.id || record.managerBId === manager.id)
      .map((record) => {
        const isA = record.managerAId === manager.id;
        const opponentId = isA ? record.managerBId : record.managerAId;
        return {
          opponentId,
          opponentName: isA ? record.managerBName : record.managerAName,
          opponentIsActive: activeManagerIds.has(opponentId),
          opponentActiveYears: activeYearsByManagerId.get(opponentId) ?? "Unknown years",
          wins: isA ? record.winsA : record.winsB,
          losses: isA ? record.winsB : record.winsA,
          ties: record.ties,
          pointsFor: isA ? record.pointsA : record.pointsB,
          pointsAgainst: isA ? record.pointsB : record.pointsA,
          games: record.games,
          closestMargin: record.closestMargin,
          largestMargin: record.largestMargin
        };
      })
      .sort((a, b) => b.games - a.games || b.wins - a.wins || a.opponentName.localeCompare(b.opponentName));
    return {
      managerId: manager.id,
      managerName: manager.displayName,
      activeYears: activeYearsByManagerId.get(manager.id) ?? "Unknown years",
      isActive: activeManagerIds.has(manager.id),
      rows
    };
  }).sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.managerName.localeCompare(b.managerName));

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Head to head</div>
          <h1>Rivalries</h1>
        </div>
      </header>
      <RivalryExplorer sections={rivalrySections} />
    </>
  );
}
