"use client";

import { Fragment, useMemo, useState } from "react";
import { Manager, Season } from "@/lib/domain/types";

type HistoryExplorerProps = {
  seasons: Season[];
  managers: Manager[];
};

function formatPoints(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPosition(position?: string) {
  return position ?? "-";
}

export function HistoryExplorer({ seasons, managers }: HistoryExplorerProps) {
  const defaultSeason = [...seasons].reverse().find((season) => season.teams.length)?.year ?? seasons[0]?.year ?? 0;
  const [selectedYear, setSelectedYear] = useState(defaultSeason);
  const [openTeamId, setOpenTeamId] = useState<number | undefined>();
  const selected = useMemo(
    () => seasons.find((season) => season.year === selectedYear) ?? seasons[0],
    [seasons, selectedYear]
  );
  const managerById = useMemo(() => new Map(managers.map((manager) => [manager.id, manager])), [managers]);

  if (!seasons.length || !selected) {
    return <div className="card">No seasons available.</div>;
  }

  const champion = selected.teams.find((team) => team.finalPlacement === 1);
  const runnerUp = selected.teams.find((team) => team.finalPlacement === 2);
  const lastPlace = [...selected.teams]
    .filter((team) => team.finalPlacement !== undefined && team.finalPlacement > 0)
    .sort((a, b) => (b.finalPlacement ?? 0) - (a.finalPlacement ?? 0))[0];

  return (
    <section className="rivalry-explorer">
      <div className="manager-picker season-picker" aria-label="Select season">
        {seasons.map((season) => (
          <button
            className={season.year === selected.year ? "active" : ""}
            key={season.year}
            type="button"
            onClick={() => {
              setSelectedYear(season.year);
              setOpenTeamId(undefined);
            }}
          >
            <strong>{season.year}</strong>
            <span>{season.status}</span>
          </button>
        ))}
      </div>

      <article className="card rivalry-panel">
        <div className="row-between">
          <div>
            <h2>{selected.year}</h2>
            <span className={`tag ${selected.status === "complete" ? "green" : selected.status === "missing" ? "red" : "gold"}`}>{selected.status}</span>
          </div>
          <div className="season-summary-meta">
            <span>{selected.teams.length || "-"} teams</span>
            <span>{selected.sourceFile ?? "No source file"}</span>
          </div>
        </div>

        {selected.teams.length ? (
          <table className="table section">
            <thead>
              <tr><th>Finish</th><th>Team</th><th>Record</th><th className="right">PF</th><th className="right">PA</th></tr>
            </thead>
            <tbody>
              {[...selected.teams].sort((a, b) => (a.finalPlacement ?? 999) - (b.finalPlacement ?? 999) || b.wins - a.wins).map((team) => {
                const owner = managerById.get(team.managerId)?.displayName ?? "Owner unavailable";
                const roster = selected.finalRosters.filter((player) => player.teamId === team.teamId);
                const isOpen = openTeamId === team.teamId;
                const teamLabel = team.finalPlacement === 1
                  ? `${team.teamName} 🏆`
                  : team.teamId === lastPlace?.teamId
                    ? `${team.teamName} 💩`
                    : team.teamName;

                return (
                  <Fragment key={team.teamId}>
                    <tr>
                      <td>{team.finalPlacement ?? "-"}</td>
                      <td>
                        <button className={`row-toggle ${isOpen ? "open" : ""}`} type="button" onClick={() => setOpenTeamId(isOpen ? undefined : team.teamId)}>
                          <span>▾</span>
                          <strong>{teamLabel}</strong>
                        </button>
                        <span className="cell-note">{owner}</span>
                      </td>
                      <td>{team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ""}</td>
                      <td className="right">{formatPoints(team.pointsFor)}</td>
                      <td className="right">{formatPoints(team.pointsAgainst)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="manager-detail-row">
                        <td colSpan={5}>
                          {roster.length ? (
                            <div className="roster-grid">
                              {roster.map((player) => (
                                <div className="roster-player" key={`${player.playerId ?? player.playerName}-${player.lineupSlotId ?? "slot"}`}>
                                  <strong>{player.playerName}</strong>
                                  <span>{formatPosition(player.position)}{player.acquisitionType ? ` - ${player.acquisitionType}` : ""}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="muted">No final roster snapshot found in this ESPN export.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>{selected.notes.join(" ")}</p>
        )}

        {(champion || runnerUp) && <p>Champion: {champion?.teamName ?? "Unavailable"} - Runner-up: {runnerUp?.teamName ?? "Unavailable"}</p>}
      </article>
    </section>
  );
}
