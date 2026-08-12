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
  const selected = useMemo(
    () => seasons.find((season) => season.year === selectedYear) ?? seasons[0],
    [seasons, selectedYear]
  );

  if (!seasons.length || !selected) {
    return <div className="card">Add draft exports to populate this page.</div>;
  }

  const sortedPicks = [...selected.draftPicks].sort((a, b) => (a.overall ?? 999) - (b.overall ?? 999));
  const idOnlyCount = sortedPicks.filter((pick) => pick.playerName.startsWith("Player ")).length;
  const tbdCount = sortedPicks.filter((pick) => pick.playerName === "TBD").length;

  return (
    <section className="rivalry-explorer">
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
    </section>
  );
}
