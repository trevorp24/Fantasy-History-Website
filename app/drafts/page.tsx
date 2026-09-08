import { DraftExplorer } from "@/app/drafts/DraftExplorer";
import { loadLeagueData } from "@/lib/data/loadLeague";

export default function DraftsPage() {
  const data = loadLeagueData();
  const seasonsWithDrafts = data.seasons.filter((season) => season.draftPicks.length);
  return (
    <>
      <header className="page-header history-accent">
        <h1>Drafts</h1>
      </header>
      <DraftExplorer seasons={seasonsWithDrafts} managers={data.managers} />
    </>
  );
}
