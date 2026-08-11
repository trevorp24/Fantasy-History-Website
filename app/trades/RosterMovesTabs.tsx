"use client";

import { useState } from "react";
import type { RosterMoveActivity } from "@/lib/domain/types";

type Props = {
  trades: RosterMoveActivity[];
  addDrops: RosterMoveActivity[];
  managerNames: Record<string, string>;
};

function managerName(managerNames: Record<string, string>, id?: string) {
  return id ? managerNames[id] ?? id : "-";
}

function dateLabel(activity: RosterMoveActivity) {
  return activity.date ? new Date(activity.date).toLocaleDateString() : "Unknown date";
}

export function RosterMovesTabs({ trades, addDrops, managerNames }: Props) {
  const [tab, setTab] = useState<"trades" | "add-drop">("trades");
  const activeMoves = tab === "trades" ? trades : addDrops;

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
          {activeMoves.map((activity) => (
            <article className="card" key={activity.id}>
              <div className="top">
                <div>
                  <h2>{dateLabel(activity)}</h2>
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
