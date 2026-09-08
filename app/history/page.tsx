import { HistoryExplorer } from "@/app/history/HistoryExplorer";
import { loadLeagueData } from "@/lib/data/loadLeague";

export default function HistoryPage() {
  const data = loadLeagueData();
  return (
    <>
      <header className="page-header history-accent">
        <h1>League History</h1>
      </header>
      <HistoryExplorer seasons={data.seasons} managers={data.managers} />
    </>
  );
}
