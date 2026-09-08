import { PlayerLookupExplorer } from "@/app/player-lookup/PlayerLookupExplorer";
import { loadLeagueData } from "@/lib/data/loadLeague";

export default function PlayerLookupPage() {
  const data = loadLeagueData();
  const seasonsWithDrafts = data.seasons.filter((season) => season.draftPicks.length);

  return (
    <>
      <header className="page-header history-accent">
        <h1>Player Lookup</h1>
      </header>
      <PlayerLookupExplorer seasons={seasonsWithDrafts} managers={data.managers} />
    </>
  );
}
