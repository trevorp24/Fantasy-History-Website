import { loadLeagueData } from "@/lib/data/loadLeague";
import { RosterMovesTabs } from "@/app/trades/RosterMovesTabs";

export default function RosterMovesPage() {
  const data = loadLeagueData();
  const managerNames = Object.fromEntries(data.managers.map((manager) => [manager.id, manager.displayName]));
  const rosterMoves = data.seasons
    .flatMap((season) => season.rosterMoves)
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  const trades = rosterMoves.filter((activity) => activity.kind === "trade");
  const addDrops = rosterMoves.filter((activity) => activity.kind === "add-drop");

  return (
    <>
      <h1>Roster Moves</h1>
      <RosterMovesTabs trades={trades} addDrops={addDrops} managerNames={managerNames} />
    </>
  );
}
