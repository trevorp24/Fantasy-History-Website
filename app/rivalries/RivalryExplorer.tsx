"use client";

import { useMemo, useState } from "react";

type RivalryRow = {
  opponentId: string;
  opponentName: string;
  opponentIsActive: boolean;
  opponentActiveYears: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  games: number;
  closestMargin?: number;
  largestMargin?: number;
};

type RivalrySection = {
  managerId: string;
  managerName: string;
  activeYears: string;
  isActive: boolean;
  rows: RivalryRow[];
};

type RivalryExplorerProps = {
  sections: RivalrySection[];
};

type RivalrySortKey = "wins" | "games" | "pointsFor" | "closestMargin" | "largestMargin";
type SortDirection = "desc" | "asc";

function formatPoints(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function sortValue(row: RivalryRow, key: RivalrySortKey) {
  return row[key] ?? Number.NEGATIVE_INFINITY;
}

export function RivalryExplorer({ sections }: RivalryExplorerProps) {
  const [selectedManagerId, setSelectedManagerId] = useState(() => sections[0]?.managerId ?? "");
  const [sortKey, setSortKey] = useState<RivalrySortKey>("wins");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const selected = useMemo(
    () => sections.find((section) => section.managerId === selectedManagerId) ?? sections[0],
    [sections, selectedManagerId]
  );
  const sortedRows = useMemo(() => {
    return [...(selected?.rows ?? [])].sort((a, b) => {
      const diff = sortValue(b, sortKey) - sortValue(a, sortKey);
      return (sortDirection === "desc" ? diff : -diff) || b.games - a.games || a.opponentName.localeCompare(b.opponentName);
    });
  }, [selected, sortDirection, sortKey]);

  function updateSort(key: RivalrySortKey) {
    if (key === sortKey) {
      setSortDirection((current) => current === "desc" ? "asc" : "desc");
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  }

  function sortLabel(key: RivalrySortKey, label: string) {
    return sortKey === key ? `${label} ${sortDirection === "desc" ? "↓" : "↑"}` : label;
  }

  if (!sections.length || !selected) {
    return <div className="card">Rivalries need completed matchup exports.</div>;
  }

  return (
    <section className="rivalry-explorer">
      <div className="manager-picker" aria-label="Select manager">
        {sections.map((section) => (
          <button
            className={`${section.managerId === selected.managerId ? "active" : ""} ${section.isActive ? "" : "inactive"}`.trim()}
            key={section.managerId}
            type="button"
            onClick={() => setSelectedManagerId(section.managerId)}
          >
            <strong>{section.managerName}</strong>
            <span>{section.activeYears}</span>
          </button>
        ))}
      </div>

      <article className="card rivalry-panel">
        <div className="row-between">
          <h2>{selected.managerName}</h2>
          <div className="tag-row">
            <span className={`tag ${selected.isActive ? "green" : "red"}`}>{selected.activeYears}</span>
            <span className="tag">{selected.rows.length} opponents</span>
          </div>
        </div>
        <table className="table section sortable-table">
          <thead>
            <tr>
              <th>Opponent</th>
              <th><button className={sortKey === "wins" ? "active" : ""} type="button" onClick={() => updateSort("wins")}>{sortLabel("wins", "Record")}</button></th>
              <th><button className={sortKey === "games" ? "active" : ""} type="button" onClick={() => updateSort("games")}>{sortLabel("games", "Games")}</button></th>
              <th className="right"><button className={sortKey === "pointsFor" ? "active" : ""} type="button" onClick={() => updateSort("pointsFor")}>{sortLabel("pointsFor", "Points")}</button></th>
              <th className="right"><button className={sortKey === "closestMargin" ? "active" : ""} type="button" onClick={() => updateSort("closestMargin")}>{sortLabel("closestMargin", "Closest")}</button></th>
              <th className="right"><button className={sortKey === "largestMargin" ? "active" : ""} type="button" onClick={() => updateSort("largestMargin")}>{sortLabel("largestMargin", "Largest")}</button></th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={`${selected.managerId}-${row.opponentId}`}>
                <td>
                  {row.opponentName}
                </td>
                <td>{row.wins}-{row.losses}{row.ties ? `-${row.ties}` : ""}</td>
                <td>{row.games}</td>
                <td className="right">{formatPoints(row.pointsFor)}-{formatPoints(row.pointsAgainst)}</td>
                <td className="right">{row.closestMargin !== undefined ? formatPoints(row.closestMargin) : "-"}</td>
                <td className="right">{row.largestMargin !== undefined ? formatPoints(row.largestMargin) : "-"}</td>
              </tr>
            ))}
            {!sortedRows.length && <tr><td colSpan={6}>No completed matchups yet.</td></tr>}
          </tbody>
        </table>
      </article>
    </section>
  );
}
