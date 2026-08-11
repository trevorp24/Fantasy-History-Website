import { DraftExplorer } from "@/app/drafts/DraftExplorer";
import { loadLeagueData } from "@/lib/data/loadLeague";

export default function DraftsPage() {
  const data = loadLeagueData();
  const seasonsWithDrafts = data.seasons.filter((season) => season.draftPicks.length);
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Draft archive</div>
          <h1>Drafts</h1>
        </div>
      </header>
      <DraftExplorer seasons={seasonsWithDrafts} managers={data.managers} />
    </>
  );
}
