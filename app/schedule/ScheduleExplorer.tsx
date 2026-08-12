"use client";

import { useMemo, useState } from "react";
import type { Matchup, TeamSeason } from "@/lib/domain/types";

type ScheduleExplorerProps = {
  weeks: number[];
  matchups: Matchup[];
  teams: TeamSeason[];
  managerNames: Record<string, string>;
  rivalryRecords: Record<string, string>;
};

const fmt = (value?: number) => value === undefined ? "0" : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function ScheduleExplorer({ weeks, matchups, teams, managerNames, rivalryRecords }: ScheduleExplorerProps) {
  const [selectedWeek, setSelectedWeek] = useState(weeks[0] ?? 1);
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.teamId ?? 0);
  const teamById = useMemo(() => new Map(teams.map((team) => [team.teamId, team])), [teams]);
  const selectedTeam = teamById.get(selectedTeamId);
  const selectedMatchups = matchups
    .filter((matchup) => matchup.week === selectedWeek && matchup.homeTeamId && matchup.awayTeamId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const fullSchedule = weeks.map((week) => matchups.find((matchup) => matchup.week === week && (matchup.homeTeamId === selectedTeamId || matchup.awayTeamId === selectedTeamId))).filter(Boolean) as Matchup[];
  const opponentForTeam = (matchup?: Matchup, teamId?: number) => {
    if (!matchup || teamId === undefined) return undefined;
    return teamById.get(matchup.homeTeamId === teamId ? matchup.awayTeamId ?? -1 : matchup.homeTeamId ?? -1);
  };
  const scoreForTeam = (matchup: Matchup, teamId?: number) => {
    if (teamId === undefined) return "-";
    const mine = matchup.homeTeamId === teamId ? matchup.homeScore : matchup.awayScore;
    const theirs = matchup.homeTeamId === teamId ? matchup.awayScore : matchup.homeScore;
    return `${fmt(mine)} - ${fmt(theirs)}`;
  };
  const rivalryForTeam = (matchup: Matchup, teamId?: number) => {
    const team = teamById.get(teamId ?? -1);
    const opponent = opponentForTeam(matchup, teamId);
    const rivalryKey = [team?.managerId, opponent?.managerId].filter(Boolean).join("|");
    return rivalryRecords[rivalryKey] ?? "0-0";
  };

  return (
    <>
      <section className="card">
        <label className="select-field">
          <span>Week</span>
          <select value={selectedWeek} onChange={(event) => setSelectedWeek(Number(event.target.value))}>
            {weeks.map((week) => (
              <option value={week} key={week}>
                Week {week}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>Week {selectedWeek} Matchups</h2>
          <span className="tag">{selectedMatchups.length} games</span>
        </div>
        <div className="schedule-list">
          {selectedMatchups.map((matchup) => {
            const home = teamById.get(matchup.homeTeamId ?? -1);
            const away = teamById.get(matchup.awayTeamId ?? -1);
            const rivalryKey = [home?.managerId, away?.managerId].filter(Boolean).join("|");
            return (
              <div className="schedule-matchup" key={matchup.id}>
                <div>
                  <strong>{home?.teamName ?? "Home Team"}</strong>
                  <span>{home ? managerNames[home.managerId] ?? "Owner unavailable" : "Owner unavailable"}</span>
                </div>
                <div className="matchup-score">
                  <b>{fmt(matchup.homeScore)} - {fmt(matchup.awayScore)}</b>
                  <span>Rivalry: {rivalryRecords[rivalryKey] ?? "0-0"}</span>
                </div>
                <div>
                  <strong>{away?.teamName ?? "Away Team"}</strong>
                  <span>{away ? managerNames[away.managerId] ?? "Owner unavailable" : "Owner unavailable"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>Schedule Lookup</h2>
          <span className="tag">{selectedTeam ? managerNames[selectedTeam.managerId] : "Select manager"}</span>
        </div>
        <label className="select-field lookup-field">
          <span>Manager / Team</span>
          <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(Number(event.target.value))}>
            {teams.map((team) => (
              <option value={team.teamId} key={team.teamId}>
                {managerNames[team.managerId] ?? "Owner unavailable"} - {team.teamName}
              </option>
            ))}
          </select>
        </label>
        <table className="table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Matchup</th>
              <th>Opponent</th>
              <th>Score</th>
              <th>Rivalry</th>
            </tr>
          </thead>
          <tbody>
            {fullSchedule.map((matchup) => {
              const opponent = opponentForTeam(matchup, selectedTeamId);
              const home = teamById.get(matchup.homeTeamId ?? -1);
              const away = teamById.get(matchup.awayTeamId ?? -1);
              return (
                <tr key={`${selectedTeamId}-${matchup.id}`}>
                  <td>Week {matchup.week}</td>
                  <td>
                    <strong>{home?.teamName ?? "Home Team"} vs {away?.teamName ?? "Away Team"}</strong>
                    <span className="cell-note">{home ? managerNames[home.managerId] : "Owner unavailable"} vs {away ? managerNames[away.managerId] : "Owner unavailable"}</span>
                  </td>
                  <td>{opponent ? `${opponent.teamName} (${managerNames[opponent.managerId] ?? "Owner unavailable"})` : "-"}</td>
                  <td>{scoreForTeam(matchup, selectedTeamId)}</td>
                  <td>{rivalryForTeam(matchup, selectedTeamId)}</td>
                </tr>
              );
            })}
            {!fullSchedule.length && (
              <tr>
                <td colSpan={5}>No schedule found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
