"use client";

import { useState } from "react";
import type { RosterMoveActivity, TradeImpact } from "@/lib/domain/types";

type Props = {
  trades: RosterMoveActivity[];
  addDrops: RosterMoveActivity[];
  tradeImpacts: TradeImpact[];
  managerNames: Record<string, string>;
};

function managerName(managerNames: Record<string, string>, id?: string) {
  return id ? managerNames[id] ?? id : "-";
}

function dateLabel(date?: string) {
  return date ? new Date(date).toLocaleDateString() : "Unknown date";
}

export function RosterMovesTabs({ trades, addDrops, tradeImpacts, managerNames }: Props) {
  const [tab, setTab] = useState<"trades" | "add-drop">("trades");
  const demoTrades: RosterMoveActivity[] = [{
    id: "demo-trade",
    season: 2026,
    kind: "trade",
    date: new Date("2026-09-10T12:00:00").toISOString(),
    moves: [
      { kind: "trade", action: "traded", playerName: "Sample Player A", fromManagerId: "Sample Manager 1", toManagerId: "Sample Manager 2" },
      { kind: "trade", action: "traded", playerName: "Sample Player B", fromManagerId: "Sample Manager 2", toManagerId: "Sample Manager 1" }
    ]
  }];
  const demoAddDrops: RosterMoveActivity[] = [{
    id: "demo-add-drop",
    season: 2026,
    kind: "add-drop",
    date: new Date("2026-09-11T12:00:00").toISOString(),
    moves: [
      { kind: "add-drop", action: "added", playerName: "Sample Waiver Pickup", managerId: "Sample Manager 1", bidAmount: 17 },
      { kind: "add-drop", action: "dropped", playerName: "Sample Dropped Player", managerId: "Sample Manager 1" }
    ]
  }];
  const hasRealMoves = tab === "trades" ? trades.length > 0 : addDrops.length > 0;
  const activeMoves = hasRealMoves ? (tab === "trades" ? trades : addDrops) : (tab === "trades" ? demoTrades : demoAddDrops);

  return (
    <>
      <div className="seg" role="tablist" aria-label="Roster move type">
        <button className={tab === "trades" ? "active" : ""} type="button" onClick={() => setTab("trades")}>
          Trades
        </button>
        <button className={tab === "add-drop" ? "active" : ""} type="button" onClick={() => setTab("add-drop")}>
          Add/Drop
        </button>
      </div>

      {activeMoves.length ? (
        <section className="nested-sections">
          {!hasRealMoves && (
            <section className="card">
              <span className="tag gold">Sample data</span>
              <h2>{tab === "trades" ? "Example trade" : "Example add/drop"}</h2>
              <p>This is only here to show what information the page will include. It will be replaced when ESPN returns real roster moves.</p>
            </section>
          )}
          {activeMoves.map((activity) => (
            <article className="card" key={activity.id}>
              <div className="top">
                <div>
                  <h2>{dateLabel(activity.date)}</h2>
                  <span className="tag green">{activity.season}</span>
                </div>
                <span className="tag">{activity.moves.length} player moves</span>
              </div>
              {tab === "trades" ? (
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>From</th>
                      <th>To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.moves.map((move, index) => (
                      <tr key={`${activity.id}-${index}`}>
                        <td><strong>{move.playerName}</strong></td>
                        <td>{managerName(managerNames, move.fromManagerId)}</td>
                        <td>{managerName(managerNames, move.toManagerId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Move</th>
                      <th>Manager</th>
                      <th>FAAB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.moves.map((move, index) => (
                      <tr key={`${activity.id}-${index}`}>
                        <td><strong>{move.playerName}</strong></td>
                        <td>{move.action === "added" ? "Added" : "Dropped"}</td>
                        <td>{managerName(managerNames, move.managerId)}</td>
                        <td>{move.bidAmount !== undefined ? `$${move.bidAmount}` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          ))}
          {tab === "trades" && (
            <article className="card">
              <div className="top">
                <div>
                  <span className="tag green">Trade Impact</span>
                  <h2>Post-trade player points</h2>
                </div>
                <span className="tag">{tradeImpacts.length} players</span>
              </div>
              {tradeImpacts.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>New Manager</th>
                      <th>Weeks</th>
                      <th>Points After Trade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradeImpacts.map((impact) => (
                      <tr key={`${impact.activityId}-${impact.playerId ?? impact.playerName}`}>
                        <td>
                          <strong>{impact.playerName}</strong>
                          <span className="cell-note">{impact.tradeDate ? dateLabel(impact.tradeDate) : "Trade date pending"}</span>
                        </td>
                        <td>{managerName(managerNames, impact.toManagerId)}</td>
                        <td>{impact.weeksTracked || "-"}</td>
                        <td>
                          {impact.weeksTracked ? impact.pointsAfterTrade.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "Pending"}
                          {impact.projectedOnly && <span className="cell-note">Projected until games are final</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>Once a real 2026 trade appears and weekly roster scores are available, this will total each traded player's points for the new manager only after the trade.</p>
              )}
            </article>
          )}
        </section>
      ) : (
        <section className="card">
          <span className="tag gold">2026</span>
          <h2>{tab === "trades" ? "No trades found yet" : "No add/drop activity found yet"}</h2>
          <p>The weekly updater is saving ESPN roster-move activity for 2026 forward. Once ESPN returns completed moves, they will show here.</p>
        </section>
      )}
    </>
  );
}
