import { ManagersTable } from "@/app/managers/ManagersTable";
import { loadLeagueData } from "@/lib/data/loadLeague";

export default function ManagersPage() {
  const data = loadLeagueData();
  const activeManagerIds = new Set(data.seasons.find((season) => season.year === 2026)?.teams.map((team) => team.managerId) ?? []);
  const activeYearsByManagerId = new Map(
    data.managers.map((manager) => {
      const years = data.seasons.flatMap((season) => {
        const team = season.teams.find((seasonTeam) => seasonTeam.managerId === manager.id);
        if (!team) return [];
        const lastPlace = [...season.teams]
          .filter((seasonTeam) => seasonTeam.finalPlacement !== undefined && seasonTeam.finalPlacement > 0)
          .sort((a, b) => (b.finalPlacement ?? 0) - (a.finalPlacement ?? 0))[0];
        const marker = team.finalPlacement === 1 ? " 🏆" : team.teamId === lastPlace?.teamId ? " 💩" : "";
        return [`${season.year}${marker}`];
      });
      return [manager.id, years.length ? years.join(", ") : "-"];
    })
  );
  const managerRows = data.careerRecords.map((record) => ({
    record,
    activeYears: activeYearsByManagerId.get(record.manager.id) ?? "-",
    isActive: activeManagerIds.has(record.manager.id),
    placements: data.seasons.flatMap((season) => {
      const team = season.teams.find((seasonTeam) => seasonTeam.managerId === record.manager.id);
      return team ? [{ year: season.year, placement: team.finalPlacement || undefined, teamName: team.teamName }] : [];
    })
  }));

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Identity continuity</div>
          <h1>Manager Stats</h1>
          <p>Managers are connected across seasons by ESPN member ID first, with team ID fallback only when ESPN omits owner data.</p>
        </div>
      </header>
      <section className="card">
        <ManagersTable rows={managerRows} />
      </section>
    </>
  );
}
