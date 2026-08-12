"use client";

import { Fragment, useState } from "react";
import type { RosterPlayer } from "@/lib/domain/types";

type CurrentSeasonRow = {
  teamId: number;
  teamName: string;
  ownerName: string;
  rank: number;
  movement: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: string;
  pointsAgainst: string;
  roster: RosterPlayer[];
};

type Props = {
  standings: CurrentSeasonRow[];
};

function movementLabel(movement: number) {
  if (movement > 0) return <span className="movement up">↑ {movement}</span>;
  if (movement < 0) return <span className="movement down">↓ {Math.abs(movement)}</span>;
  return <span className="movement even">-</span>;
}

export function CurrentSeasonStandings({ standings }: Props) {
  const [openTeamId, setOpenTeamId] = useState<number | undefined>();

  return (
    <table className="table current-standings">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Weekly Move</th>
          <th>Team</th>
          <th>Record</th>
          <th>PF (Tiebreaker)</th>
          <th>PA</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((team) => {
          const hasRoster = team.roster.length > 0;
          const isOpen = openTeamId === team.teamId;
          return (
            <Fragment key={team.teamId}>
              <tr className={team.rank === 9 ? "playoff-cutoff" : ""}>
                <td>{team.rank}</td>
                <td>{movementLabel(team.movement)}</td>
                <td>
                  {hasRoster ? (
                    <button className={`row-toggle ${isOpen ? "open" : ""}`} type="button" onClick={() => setOpenTeamId(isOpen ? undefined : team.teamId)}>
                      <span>▾</span>
                      <strong>{team.teamName}</strong>
                    </button>
                  ) : (
                    <strong>{team.teamName}</strong>
                  )}
                  <span className="cell-note">{team.ownerName}</span>
                </td>
                <td>{team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ""}</td>
                <td>{team.pointsFor}</td>
                <td>{team.pointsAgainst}</td>
              </tr>
              {hasRoster && isOpen && (
                <tr className="manager-detail-row">
                  <td colSpan={6}>
                    {team.roster.length ? (
                      <div className="live-roster-list">
                        {team.roster.map((player) => (
                          <div className="live-roster-player" key={`${player.playerId ?? player.playerName}-${player.lineupSlotId ?? "slot"}`}>
                            <strong>{player.playerName}</strong>
                            <span>{player.position ?? "-"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">No live roster snapshot found in this ESPN export.</p>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
