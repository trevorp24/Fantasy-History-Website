import { HistoryExplorer } from "@/app/history/HistoryExplorer";
import { loadLeagueData } from "@/lib/data/loadLeague";

export default function HistoryPage() {
  const data = loadLeagueData();
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Seasons</div>
          <h1>History</h1>
        </div>
      </header>
      <HistoryExplorer seasons={data.seasons} managers={data.managers} />
    </>
  );
}
