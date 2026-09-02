"use client";

import { useMemo, useState } from "react";
import type { RosterMove, RosterMoveActivity, TradeImpact } from "@/lib/domain/types";

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

function impactFor(tradeImpacts: TradeImpact[], activityId: string, moveIndex: number) {
  return tradeImpacts.find((impact) => impact.activityId === activityId && impact.moveIndex === moveIndex);
}

function impactPoints(impact?: TradeImpact) {
  if (!impact?.weeksTracked) return "Pending";
  return impact.pointsAfterMove.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

type MoveRow = {
  activity: RosterMoveActivity;
  move: RosterMove;
  moveIndex: number;
  managerIds: string[];
  sortName: string;
};

type MoveGroup = {
  key: string;
  label: string;
  timestamp: number;
  rows: MoveRow[];
};

function activityTimestamp(activity: RosterMoveActivity) {
  return activity.timestamp ?? (activity.date ? new Date(activity.date).getTime() : 0);
}

function dateKey(activity: RosterMoveActivity) {
  if (!activity.date) return "unknown";
  const parsed = new Date(activity.date);
  return Number.isNaN(parsed.getTime()) ? activity.date : parsed.toISOString().slice(0, 10);
}

function moveManagerIds(move: RosterMove) {
  return [move.fromManagerId, move.toManagerId, move.managerId].filter((value): value is string => Boolean(value));
}

function tradeSortName(managerNames: Record<string, string>, move: RosterMove) {
  return [managerName(managerNames, move.fromManagerId), managerName(managerNames, move.toManagerId)]
    .filter((value) => value !== "-")
    .sort((a, b) => a.localeCompare(b))[0] ?? "-";
}

function groupedRows(
  activities: RosterMoveActivity[],
  managerNames: Record<string, string>,
  managerFilter: string,
  sortMode: "date" | "team"
): MoveGroup[] {
  const groups = new Map<string, MoveGroup>();
  for (const activity of activities) {
    activity.moves.forEach((move, moveIndex) => {
      const managerIds = moveManagerIds(move);
      if (managerFilter !== "all" && !managerIds.includes(managerFilter)) return;
      const key = dateKey(activity);
      const group = groups.get(key) ?? {
        key,
        label: dateLabel(activity.date),
        timestamp: activityTimestamp(activity),
        rows: []
      };
      group.timestamp = Math.max(group.timestamp, activityTimestamp(activity));
      group.rows.push({
        activity,
        move,
        moveIndex,
        managerIds,
        sortName: activity.kind === "trade" ? tradeSortName(managerNames, move) : managerName(managerNames, move.managerId)
      });
      groups.set(key, group);
    });
  }
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      rows: group.rows.sort((a, b) => {
        if (sortMode === "team") {
          return a.sortName.localeCompare(b.sortName) || a.move.playerName.localeCompare(b.move.playerName);
        }
        return activityTimestamp(b.activity) - activityTimestamp(a.activity) || a.move.playerName.localeCompare(b.move.playerName);
      })
    }))
    .sort((a, b) => b.timestamp - a.timestamp || a.label.localeCompare(b.label));
}

function managerOptions(activities: RosterMoveActivity[], managerNames: Record<string, string>) {
  const ids = new Set<string>();
  for (const activity of activities) {
    for (const move of activity.moves) {
      moveManagerIds(move).forEach((id) => ids.add(id));
    }
  }
  return Array.from(ids)
    .map((id) => ({ id, label: managerName(managerNames, id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function RosterMovesTabs({ trades, addDrops, tradeImpacts, managerNames }: Props) {
  const [tab, setTab] = useState<"trades" | "add-drop">("trades");
  const [tradeManagerFilter, setTradeManagerFilter] = useState("all");
  const [addDropManagerFilter, setAddDropManagerFilter] = useState("all");
  const [tradeSortMode, setTradeSortMode] = useState<"date" | "team">("date");
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
  const activeManagerFilter = tab === "trades" ? tradeManagerFilter : addDropManagerFilter;
  const sortMode = tab === "trades" ? tradeSortMode : "date";
  const groups = useMemo(
    () => groupedRows(activeMoves, managerNames, activeManagerFilter, sortMode),
    [activeMoves, activeManagerFilter, managerNames, sortMode]
  );
  const options = useMemo(() => managerOptions(activeMoves, managerNames), [activeMoves, managerNames]);

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
          <section className="card roster-move-controls">
            <label className="select-field">
              <span>{tab === "trades" ? "Team / Manager" : "Manager"}</span>
              <select
                value={activeManagerFilter}
                onChange={(event) => tab === "trades" ? setTradeManagerFilter(event.target.value) : setAddDropManagerFilter(event.target.value)}
              >
                <option value="all">All teams</option>
                {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            {tab === "trades" && (
              <label className="select-field">
                <span>Sort</span>
                <select value={tradeSortMode} onChange={(event) => setTradeSortMode(event.target.value as "date" | "team")}>
                  <option value="date">Date</option>
                  <option value="team">Team</option>
                </select>
              </label>
            )}
          </section>
          {groups.length ? groups.map((group, groupIndex) => (
            <details className="card move-date-group" key={group.key} open={groupIndex === 0}>
              <summary className="move-date-summary">
                <div>
                  <h2>{group.label}</h2>
                  <span className="tag green">{group.rows[0]?.activity.season}</span>
                </div>
                <span className="tag">{group.rows.length} player moves</span>
              </summary>
              {tab === "trades" ? (
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Weeks Since</th>
                      <th>Points Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map(({ activity, move, moveIndex }) => {
                      const impact = impactFor(tradeImpacts, activity.id, moveIndex);
                      return (
                        <tr key={`${activity.id}-${moveIndex}`}>
                          <td>
                            <strong>{move.playerName}</strong>
                            {impact?.projectedOnly && <span className="cell-note">Projected until games are final</span>}
                          </td>
                          <td>{managerName(managerNames, move.fromManagerId)}</td>
                          <td>{managerName(managerNames, move.toManagerId)}</td>
                          <td>{impact?.weeksTracked || "-"}</td>
                          <td>{impactPoints(impact)}</td>
                        </tr>
                      );
                    })}
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
                      <th>Weeks Since</th>
                      <th>Points Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map(({ activity, move, moveIndex }) => {
                      const impact = impactFor(tradeImpacts, activity.id, moveIndex);
                      return (
                        <tr key={`${activity.id}-${moveIndex}`}>
                          <td>
                            <strong>{move.playerName}</strong>
                            {impact?.projectedOnly && <span className="cell-note">Projected until games are final</span>}
                          </td>
                          <td>
                            <span className={`move-action ${move.action}`}>{move.action === "added" ? "Added" : "Dropped"}</span>
                          </td>
                          <td>{managerName(managerNames, move.managerId)}</td>
                          <td>{move.bidAmount !== undefined ? `$${move.bidAmount}` : "-"}</td>
                          <td>{impact?.weeksTracked || "-"}</td>
                          <td>{move.action === "added" ? impactPoints(impact) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </details>
          )) : (
            <section className="card">
              <h2>No moves match that manager</h2>
              <p>Switch back to all teams to see every transaction.</p>
            </section>
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
