"use client";

import { useMemo, useState } from "react";
import type { DraftPick, Manager, Season } from "@/lib/domain/types";

type PlayerDraftRow = {
  season: Season;
  pick: DraftPick;
  managerName: string;
  teamName: string;
  positionRank?: number;
};

type PlayerProfile = {
  name: string;
  rows: PlayerDraftRow[];
};

type PlayerLookupExplorerProps = {
  seasons: Season[];
  managers: Manager[];
};

const fmt = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const normalizedPosition = (position?: string) => {
  const value = (position ?? "").toUpperCase();
  if (value === "D/ST" || value === "DST" || value === "DEF") return "DEF";
  return value || "-";
};

function positionRanks(season: Season) {
  const counts = new Map<string, number>();
  const ranks = new Map<DraftPick, number>();
  for (const pick of [...season.draftPicks].sort((a, b) => (a.overall ?? 999) - (b.overall ?? 999))) {
    const position = normalizedPosition(pick.position);
    const rank = (counts.get(position) ?? 0) + 1;
    counts.set(position, rank);
    ranks.set(pick, rank);
  }
  return ranks;
}

function DraftChart({ rows }: { rows: PlayerDraftRow[] }) {
  const sorted = [...rows].sort((a, b) => a.season.year - b.season.year);
  const valid = sorted.filter((row) => row.pick.overall);
  if (valid.length < 2) return <p className="muted">More draft history is needed for a line chart.</p>;

  const width = Math.max(430, valid.length * 90);
  const height = 170;
  const left = 34;
  const top = 28;
  const bottom = 118;
  const maxPick = Math.max(...valid.map((row) => row.pick.overall ?? 1), 1);
  const step = valid.length > 1 ? (width - left * 2) / (valid.length - 1) : width - left * 2;
  const points = valid.map((row, index) => {
    const x = valid.length > 1 ? left + index * step : width / 2;
    const y = top + (((row.pick.overall ?? 1) - 1) / Math.max(maxPick - 1, 1)) * (bottom - top);
    return { ...row, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="placement-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Draft position by year">
        <line className="chart-grid-line" x1={left} x2={width - left} y1={top} y2={top} />
        <line className="chart-grid-line" x1={left} x2={width - left} y1={bottom} y2={bottom} />
        <path className="placement-line" d={path} />
        {points.map((point) => (
          <g key={point.season.year}>
            <circle className="placement-dot" cx={point.x} cy={point.y} r="6" />
            <text className="placement-value" x={point.x} y={point.y - 10} textAnchor="middle">{point.pick.overall}</text>
            <text className="placement-year" x={point.x} y="148" textAnchor="middle">{point.season.year}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function PlayerLookupExplorer({ seasons, managers }: PlayerLookupExplorerProps) {
  const profiles = useMemo<PlayerProfile[]>(() => {
    const managerName = (managerId?: string) => managers.find((manager) => manager.id === managerId)?.displayName ?? managerId ?? "Unavailable";
    const grouped = new Map<string, PlayerDraftRow[]>();
    for (const season of seasons) {
      const ranks = positionRanks(season);
      for (const pick of season.draftPicks.filter((item) => item.playerName && item.playerName !== "TBD" && !item.playerName.startsWith("Player "))) {
        const team = season.teams.find((item) => item.teamId === pick.teamId || item.managerId === pick.managerId);
        const key = pick.playerName.toLowerCase();
        grouped.set(key, [
          ...(grouped.get(key) ?? []),
          { season, pick, managerName: managerName(pick.managerId), teamName: team?.teamName ?? "-", positionRank: ranks.get(pick) }
        ]);
      }
    }
    return [...grouped.entries()]
      .map(([name, rows]) => ({ name: rows[0]?.pick.playerName ?? name, rows: rows.sort((a, b) => b.season.year - a.season.year) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [managers, seasons]);
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState(profiles[0]?.name ?? "");
  const matches = profiles.filter((profile) => query.trim().length < 2 || profile.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 40);
  const selected = matches.find((profile) => profile.name === selectedName) ?? matches[0];
  const picks = selected?.rows.map((row) => row.pick.overall).filter((pick): pick is number => Boolean(pick)) ?? [];
  const averagePick = picks.length ? picks.reduce((sum, pick) => sum + pick, 0) / picks.length : 0;
  const bestPick = picks.length ? Math.min(...picks) : 0;
  const latest = selected?.rows[0];
  const positionRanksList = selected?.rows.map((row) => row.positionRank).filter((rank): rank is number => Boolean(rank)) ?? [];
  const averagePositionRank = positionRanksList.length ? positionRanksList.reduce((sum, rank) => sum + rank, 0) / positionRanksList.length : 0;

  return (
    <section className="rivalry-explorer">
      <article className="card">
        <div className="row-between">
          <h2>Player Lookup</h2>
          <span className="tag">{profiles.length} players</span>
        </div>
        <label className="select-field lookup-field">
          <span>Search Player</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a player name" />
        </label>
        <label className="select-field lookup-field">
          <span>Select Player</span>
          <select value={selected?.name ?? ""} onChange={(event) => setSelectedName(event.target.value)} disabled={!matches.length}>
            {matches.map((profile) => <option value={profile.name} key={profile.name}>{profile.name}</option>)}
          </select>
        </label>
        {!matches.length && <p className="muted">No matching player found.</p>}
      </article>

      {selected && (
        <>
          <section className="grid cols-4">
            <article className="card record"><span className="muted">Times Drafted</span><b>{selected.rows.length}</b><small>{selected.rows.map((row) => row.season.year).join(", ")}</small></article>
            <article className="card record"><span className="muted">Average Draft Position</span><b>{averagePick ? fmt(averagePick) : "-"}</b><small>Overall pick average</small></article>
            <article className="card record"><span className="muted">Best Pick</span><b>{bestPick || "-"}</b><small>{bestPick ? "Earliest drafted" : "Unavailable"}</small></article>
            <article className="card record"><span className="muted">Avg Position Rank</span><b>{averagePositionRank ? fmt(averagePositionRank) : "-"}</b><small>{normalizedPosition(latest?.pick.position)} off the board</small></article>
          </section>

          <article className="card">
            <div className="row-between">
              <h2>{selected.name}</h2>
              <span className="tag">{normalizedPosition(latest?.pick.position)}</span>
            </div>
            <DraftChart rows={selected.rows} />
          </article>

          <article className="card">
            <h2>Draft History</h2>
            <table className="table">
              <thead>
                <tr><th>Season</th><th>Pick</th><th>Round</th><th>Position Rank</th><th>Manager</th><th>Team</th></tr>
              </thead>
              <tbody>
                {selected.rows.map((row) => (
                  <tr key={`${row.season.year}-${row.pick.overall}`}>
                    <td>{row.season.year}</td>
                    <td>{row.pick.overall ?? "-"}</td>
                    <td>{row.pick.round ?? "-"}{row.pick.roundPick ? `.${row.pick.roundPick}` : ""}</td>
                    <td>{normalizedPosition(row.pick.position)}{row.positionRank ?? "-"}</td>
                    <td>{row.managerName}</td>
                    <td>{row.teamName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </>
      )}
    </section>
  );
}
