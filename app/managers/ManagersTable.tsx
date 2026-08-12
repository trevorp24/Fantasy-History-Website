"use client";

import { Fragment, useMemo, useState } from "react";
import type { CareerRecord } from "@/lib/domain/types";
import { formatPct, formatPoints } from "@/lib/data/loadLeague";

type PlacementPoint = {
  year: number;
  placement?: number;
  teamName: string;
};

type ManagerTableRow = {
  record: CareerRecord;
  activeYears: string;
  isActive: boolean;
  placements: PlacementPoint[];
};

type SortKey = "winPct" | "seasons" | "wins" | "championships" | "topThreeFinishes" | "playoffAppearances" | "playoffWins" | "averageFinish" | "pointsFor";
type SortDirection = "desc" | "asc";

type ManagersTableProps = {
  rows: ManagerTableRow[];
};

const sortLabels: Record<SortKey, string> = {
  winPct: "Win %",
  seasons: "Seasons",
  wins: "Regular Season Record",
  championships: "Titles",
  topThreeFinishes: "Top 3 Finishes",
  playoffAppearances: "Playoffs",
  playoffWins: "Winners Bracket Record",
  averageFinish: "Avg Finish",
  pointsFor: "PF"
};

function sortValue(row: ManagerTableRow, key: SortKey) {
  if (key === "wins") return row.record.wins;
  if (key === "playoffWins") return row.record.playoffWins;
  if (key === "averageFinish") return row.record.averageFinish ?? Number.NEGATIVE_INFINITY;
  return row.record[key];
}

export function ManagersTable({ rows }: ManagersTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("winPct");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [openManagerId, setOpenManagerId] = useState<string | undefined>();
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const diff = sortValue(b, sortKey) - sortValue(a, sortKey);
      return (sortDirection === "desc" ? diff : -diff) || a.record.manager.displayName.localeCompare(b.record.manager.displayName);
    });
  }, [rows, sortDirection, sortKey]);

  function updateSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((current) => current === "desc" ? "asc" : "desc");
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  }

  function sortLabel(key: SortKey) {
    return sortKey === key ? `${sortLabels[key]} ${sortDirection === "desc" ? "↓" : "↑"}` : sortLabels[key];
  }

  return (
    <table className="table sortable-table">
      <thead>
        <tr>
          <th>Manager</th>
          <th>Years Active</th>
          <th><button className={sortKey === "seasons" ? "active" : ""} type="button" onClick={() => updateSort("seasons")}>{sortLabel("seasons")}</button></th>
          <th><button className={sortKey === "wins" ? "active" : ""} type="button" onClick={() => updateSort("wins")}>{sortLabel("wins")}</button></th>
          <th><button className={sortKey === "winPct" ? "active" : ""} type="button" onClick={() => updateSort("winPct")}>{sortLabel("winPct")}</button></th>
          <th><button className={sortKey === "championships" ? "active" : ""} type="button" onClick={() => updateSort("championships")}>{sortLabel("championships")}</button></th>
          <th><button className={sortKey === "topThreeFinishes" ? "active" : ""} type="button" onClick={() => updateSort("topThreeFinishes")}>{sortLabel("topThreeFinishes")}</button></th>
          <th><button className={sortKey === "playoffAppearances" ? "active" : ""} type="button" onClick={() => updateSort("playoffAppearances")}>{sortLabel("playoffAppearances")}</button></th>
          <th><button className={sortKey === "playoffWins" ? "active" : ""} type="button" onClick={() => updateSort("playoffWins")}>{sortLabel("playoffWins")}</button></th>
          <th><button className={sortKey === "averageFinish" ? "active" : ""} type="button" onClick={() => updateSort("averageFinish")}>{sortLabel("averageFinish")}</button></th>
          <th className="right"><button className={sortKey === "pointsFor" ? "active" : ""} type="button" onClick={() => updateSort("pointsFor")}>{sortLabel("pointsFor")}</button></th>
        </tr>
      </thead>
      <tbody>
        {sortedRows.map(({ record, activeYears, isActive, placements }) => {
          const isOpen = openManagerId === record.manager.id;
          return (
            <Fragment key={record.manager.id}>
              <tr>
                <td>
                  <button
                    className={`row-toggle ${isOpen ? "open" : ""}`}
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenManagerId(isOpen ? undefined : record.manager.id)}
                  >
                    <span aria-hidden>▾</span>
                    {record.manager.displayName}
                  </button>
                </td>
                <td><span className={`tag ${isActive ? "green" : "red"}`}>{activeYears}</span></td>
                <td>{record.seasons}</td>
                <td>{record.wins}-{record.losses}{record.ties ? `-${record.ties}` : ""}</td>
                <td>{formatPct(record.winPct)}</td>
                <td>{record.championships}</td>
                <td>{record.topThreeFinishes}</td>
                <td>{record.playoffAppearances}</td>
                <td>{record.playoffWins}-{record.playoffLosses}{record.playoffTies ? `-${record.playoffTies}` : ""}</td>
                <td>{record.averageFinish?.toFixed(1) ?? "-"}</td>
                <td className="right">{formatPoints(record.pointsFor)}</td>
              </tr>
              {isOpen && (
                <tr className="manager-detail-row">
                  <td colSpan={11}>
                    <PlacementChart placements={placements} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
        {!sortedRows.length && <tr><td colSpan={11}>Add ESPN exports to populate manager profiles.</td></tr>}
      </tbody>
    </table>
  );
}

function PlacementChart({ placements }: { placements: PlacementPoint[] }) {
  const validPlacements = placements.filter((placement) => placement.placement);
  const maxPlacement = Math.max(...validPlacements.map((placement) => placement.placement ?? 0), 1);
  const width = Math.max(430, placements.length * 76);
  const height = 155;
  const paddingX = 28;
  const chartTop = 28;
  const chartBottom = 112;
  const usableWidth = width - paddingX * 2;
  const step = placements.length > 1 ? usableWidth / (placements.length - 1) : usableWidth;
  const points = placements.map((placement, index) => {
    const x = placements.length > 1 ? paddingX + index * step : width / 2;
    const y = placement.placement
      ? chartTop + ((placement.placement - 1) / Math.max(maxPlacement - 1, 1)) * (chartBottom - chartTop)
      : undefined;
    return { ...placement, x, y };
  });
  const linePath = points
    .filter((point) => point.y !== undefined)
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div className="placement-line-chart" aria-label="Placement history">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <line className="chart-grid-line" x1={paddingX} x2={width - paddingX} y1={chartTop} y2={chartTop} />
        <line className="chart-grid-line" x1={paddingX} x2={width - paddingX} y1={chartBottom} y2={chartBottom} />
        {linePath && <path className="placement-line" d={linePath} />}
        {points.map((point) => (
          <g key={point.year}>
            {point.y !== undefined && (
              <>
                <circle className={point.placement === 1 ? "placement-dot champion" : "placement-dot"} cx={point.x} cy={point.y} r="7" />
                <text className="placement-value" x={point.x} y={point.y - 13} textAnchor="middle">{point.placement}</text>
              </>
            )}
            <text className="placement-year" x={point.x} y="138" textAnchor="middle">{point.year}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
