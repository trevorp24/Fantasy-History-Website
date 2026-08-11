"use client";

import { useMemo, useState } from "react";
import { DraftPick, Manager } from "@/lib/domain/types";

type DraftSeasonViewProps = {
  picks: DraftPick[];
  managers: Manager[];
};

type ViewMode = "round" | "team";

function pickKey(pick: DraftPick) {
  return `${pick.season}-${pick.overall}-${pick.playerId ?? pick.playerName}`;
}

function DraftTable({ picks, managers }: DraftSeasonViewProps) {
  return (
    <table className="table section">
      <thead>
        <tr><th>Pick</th><th>Round</th><th>Player</th><th>Position</th><th>Manager</th></tr>
      </thead>
      <tbody>
        {picks.map((pick) => {
          const manager = managers.find((item) => item.id === pick.managerId);
          return (
            <tr key={pickKey(pick)}>
              <td>{pick.overall ?? "-"}</td>
              <td>{pick.round ?? "-"}{pick.roundPick ? `.${pick.roundPick}` : ""}</td>
              <td>
                <strong>{pick.playerName}</strong>
                {pick.playerName.startsWith("Player ") && <span className="cell-note">ESPN player ID only in export</span>}
              </td>
              <td>{pick.position ?? "-"}</td>
              <td>{manager?.displayName ?? pick.managerId ?? "Unavailable"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function DraftSeasonView({ picks, managers }: DraftSeasonViewProps) {
  const [mode, setMode] = useState<ViewMode>("round");
  const sortedPicks = useMemo(() => [...picks].sort((a, b) => (a.overall ?? 999) - (b.overall ?? 999)), [picks]);
  const groupedByRound = useMemo(() => {
    const groups = new Map<number, DraftPick[]>();
    for (const pick of sortedPicks) {
      const round = pick.round ?? 0;
      groups.set(round, [...(groups.get(round) ?? []), pick]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [sortedPicks]);
  const groupedByTeam = useMemo(() => {
    const groups = new Map<string, DraftPick[]>();
    for (const pick of sortedPicks) {
      const manager = managers.find((item) => item.id === pick.managerId);
      const key = manager?.displayName ?? pick.managerId ?? "Unavailable";
      groups.set(key, [...(groups.get(key) ?? []), pick]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [managers, sortedPicks]);
  const [selectedTeam, setSelectedTeam] = useState(() => groupedByTeam[0]?.[0] ?? "");
  const selectedTeamPicks = groupedByTeam.find(([managerName]) => managerName === selectedTeam)?.[1] ?? groupedByTeam[0]?.[1] ?? [];
  const selectedTeamName = groupedByTeam.some(([managerName]) => managerName === selectedTeam) ? selectedTeam : groupedByTeam[0]?.[0] ?? "";

  return (
    <div>
      <div className="segmented-control" aria-label="Draft view">
        <button className={mode === "round" ? "active" : ""} type="button" onClick={() => setMode("round")}>By Round</button>
        <button className={mode === "team" ? "active" : ""} type="button" onClick={() => setMode("team")}>By Team</button>
      </div>

      {mode === "round" ? (
        <div className="nested-sections">
          {groupedByRound.map(([round, roundPicks]) => (
            <section className="subsection" key={round}>
              <div className="subsection-header">
                <h3>{round ? `Round ${round}` : "Unassigned Round"}</h3>
                <span>{roundPicks.length} picks</span>
              </div>
              <DraftTable picks={roundPicks} managers={managers} />
            </section>
          ))}
        </div>
      ) : (
        <div className="nested-sections">
          <label className="select-field">
            <span>Team</span>
            <select value={selectedTeamName} onChange={(event) => setSelectedTeam(event.target.value)}>
              {groupedByTeam.map(([managerName, managerPicks]) => (
                <option key={managerName} value={managerName}>{managerName} ({managerPicks.length} picks)</option>
              ))}
            </select>
          </label>
          <section className="subsection">
            <div className="subsection-header">
              <h3>{selectedTeamName || "Team"}</h3>
              <span>{selectedTeamPicks.length} picks</span>
            </div>
            <DraftTable picks={selectedTeamPicks} managers={managers} />
          </section>
        </div>
      )}
    </div>
  );
}
