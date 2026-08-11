import { loadLeagueData } from "@/lib/data/loadLeague";

export default function TradesPage() {
  const data = loadLeagueData();
  const managerById = new Map(data.managers.map((manager) => [manager.id, manager.displayName]));
  const trades = data.seasons.flatMap((season) => season.trades).sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  return (
    <>
      <h1>Trades</h1>
      {trades.length ? (
        <section className="nested-sections">
          {trades.map((trade) => (
            <article className="card" key={trade.id}>
              <div className="top">
                <div>
                  <h2>{trade.date ? new Date(trade.date).toLocaleDateString() : "Unknown date"}</h2>
                  <span className="tag green">{trade.season}</span>
                </div>
                <span className="tag">{trade.moves.length} player moves</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>From</th>
                    <th>To</th>
                  </tr>
                </thead>
                <tbody>
                  {trade.moves.map((move, index) => (
                    <tr key={`${trade.id}-${index}`}>
                      <td><strong>{move.playerName}</strong></td>
                      <td>{move.fromManagerId ? managerById.get(move.fromManagerId) ?? move.fromManagerId : "-"}</td>
                      <td>{move.toManagerId ? managerById.get(move.toManagerId) ?? move.toManagerId : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </section>
      ) : (
        <section className="card">
          <span className="tag gold">2026</span>
          <h2>No trade activity found yet</h2>
          <p>The weekly updater is now saving ESPN trade/activity data for 2026 forward. Once ESPN returns completed trade messages, they will show here.</p>
        </section>
      )}
    </>
  );
}
