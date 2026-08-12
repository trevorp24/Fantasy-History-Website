"use client";

import { useMemo, useState } from "react";
import { DraftSeasonView } from "@/app/drafts/DraftSeasonView";
import { Manager, Season } from "@/lib/domain/types";

type DraftExplorerProps = {
  seasons: Season[];
  managers: Manager[];
};

export function DraftExplorer({ seasons, managers }: DraftExplorerProps) {
  const defaultSeason = [...seasons].reverse().find((season) => season.draftPicks.length)?.year ?? seasons[0]?.year ?? 0;
  const [selectedYear, setSelectedYear] = useState(defaultSeason);
  const [pageMode, setPageMode] = useState<"draft-board" | "player-lookup">("draft-board");
  const [playerSearch, setPlayerSearch] = useState("");
  const selected = useMemo(
    () => seasons.find((season) => season.year === selectedYear) ?? seasons[0],
    [seasons, selectedYear]
  );
  const managerName = (managerId?: string) => managers.find((manager) => manager.id === managerId)?.displayName ?? managerId ?? "Unavailable";
  const lookupRows = useMemo(() => {
    const search = playerSearch.trim().toLowerCase();
    return seasons
      .flatMap((season) => season.draftPicks.map((pick) => ({ season, pick })))
      .filter(({ pick }) => search.length >= 2 && pick.playerName.toLowerCase().includes(search))
      .sort((a, b) => b.season.year - a.season.year || (a.pick.overall ?? 999) - (b.pick.overall ?? 999));
  }, [playerSearch, seasons]);

  if (!seasons.length || !selected) {
    return <div className="card">Add draft exports to populate this page.</div>;
  }

  const sortedPicks = [...selected.draftPicks].sort((a, b) => (a.overall ?? 999) - (b.overall ?? 999));
  const idOnlyCount = sortedPicks.filter((pick) => pick.playerName.startsWith("Player ")).length;
  const tbdCount = sortedPicks.filter((pick) => pick.playerName === "TBD").length;

  return (
    <section className="rivalry-explorer">
      <div className="segmented-control" aria-label="Draft page view">
        <button className={pageMode === "draft-board" ? "active" : ""} type="button" onClick={() => setPageMode("draft-board")}>Draft Board</button>
        <button className={pageMode === "player-lookup" ? "active" : ""} type="button" onClick={() => setPageMode("player-lookup")}>Player Lookup</button>
      </div>

      {pageMode === "draft-board" ? (
        <>
          <div className="manager-picker season-picker" aria-label="Select draft season">
            {seasons.map((season) => (
              <button
                className={season.year === selected.year ? "active" : ""}
                key={season.year}
                type="button"
                onClick={() => setSelectedYear(season.year)}
              >
                <strong>{season.year}</strong>
                <span>{season.draftPicks.length} picks</span>
              </button>
            ))}
          </div>

          <article className="card rivalry-panel">
            <div className="row-between">
              <div>
                <h2>{selected.year} Draft</h2>
                <span className={`tag ${selected.status === "preseason" ? "gold" : "green"}`}>{selected.status === "preseason" ? "order slots" : "complete"}</span>
              </div>
              <div className="season-summary-meta">
                <span>{sortedPicks.length} picks</span>
                {(idOnlyCount > 0 || tbdCount > 0) && <span>{idOnlyCount + tbdCount} need player lookup</span>}
              </div>
            </div>
            <DraftSeasonView key={selected.year} picks={sortedPicks} managers={managers} />
          </article>
        </>
      ) : (
        <article className="card rivalry-panel">
          <div className="row-between">
            <h2>Player Lookup</h2>
            <span className="tag">{lookupRows.length} matches</span>
          </div>
          <label className="select-field lookup-field">
            <span>Search Player</span>
            <input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder="Type a player name" />
          </label>
          {playerSearch.trim().length < 2 ? (
            <p className="muted">Type at least 2 letters to search draft history.</p>
          ) : lookupRows.length ? (
            <table className="table section">
              <thead>
                <tr><th>Season</th><th>Pick</th><th>Round</th><th>Player</th><th>Position</th><th>Manager</th><th>Team</th></tr>
              </thead>
              <tbody>
                {lookupRows.map(({ season, pick }) => {
                  const team = season.teams.find((item) => item.teamId === pick.teamId || item.managerId === pick.managerId);
                  return (
                    <tr key={`${pick.season}-${pick.overall}-${pick.playerId ?? pick.playerName}`}>
                      <td>{pick.season}</td>
                      <td>{pick.overall ?? "-"}</td>
                      <td>{pick.round ?? "-"}{pick.roundPick ? `.${pick.roundPick}` : ""}</td>
                      <td><strong>{pick.playerName}</strong></td>
                      <td>{pick.position ?? "-"}</td>
                      <td>{managerName(pick.managerId)}</td>
                      <td>{team?.teamName ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="muted">No draft picks found for that player.</p>
          )}
        </article>
      )}
    </section>
  );
}
