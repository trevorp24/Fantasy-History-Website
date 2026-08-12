import { DraftPick, Manager, Matchup, RosterMoveActivity, RosterPlayer, Season, SeasonStatus, TeamSeason, WeeklyPlayerScore } from "@/lib/domain/types";
import { LINEUP_SLOT_BY_ID, POSITION_BY_ID } from "@/lib/espn/constants";

type JsonObject = Record<string, unknown>;

const MANAGER_OVERRIDES = {
  andresPalacio: "{E99193C6-A234-4A24-9193-C6A234BA2477}",
  alexKlang: "{900D53E0-6C85-4D02-8D53-E06C85ED0253}"
} as const;

const asObject = (value: unknown): JsonObject => (value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {});
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value : undefined;
const asNumber = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const asNumberish = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
};

function teamName(team: JsonObject): string {
  const explicit = asString(team.name);
  if (explicit) return explicit;
  const location = asString(team.location);
  const nickname = asString(team.nickname);
  if (location || nickname) return [location, nickname].filter(Boolean).join(" ");
  return `Team ${asNumber(team.id) ?? "Unknown"}`;
}

function recordFromTeam(team: JsonObject) {
  const record = asObject(team.record);
  const overall = asObject(record.overall);
  return {
    wins: asNumber(overall.wins) ?? 0,
    losses: asNumber(overall.losses) ?? 0,
    ties: asNumber(overall.ties) ?? 0,
    pointsFor: asNumber(overall.pointsFor) ?? 0,
    pointsAgainst: asNumber(overall.pointsAgainst) ?? 0
  };
}

function extractMembers(raw: JsonObject): Map<string, Manager> {
  const managers = new Map<string, Manager>();
  for (const item of asArray(raw.members)) {
    const member = asObject(item);
    const id = asString(member.id) ?? asString(member.guid) ?? asString(member.memberId);
    if (!id) continue;
    const fullName = [asString(member.firstName), asString(member.lastName)].filter(Boolean).join(" ");
    const espnName = asString(member.displayName);
    const displayName = fullName || espnName || id;
    managers.set(id, {
      id,
      displayName,
      firstName: asString(member.firstName),
      lastName: asString(member.lastName)
    });
  }
  return managers;
}

function managerForTeam(team: JsonObject, members: Map<string, Manager>): string {
  const owners = asArray(team.owners);
  const ownerId = owners.map(asString).find(Boolean);
  if (ownerId) return ownerId;
  const primaryOwner = asString(team.primaryOwner) ?? asString(team.ownerId);
  if (primaryOwner) return primaryOwner;
  const teamId = asNumber(team.id);
  const fallback = `team-${teamId ?? "unknown"}`;
  if (!members.has(fallback)) {
    members.set(fallback, { id: fallback, displayName: teamName(team) });
  }
  return fallback;
}

function extractTeams(raw: JsonObject, year: number, members: Map<string, Manager>): TeamSeason[] {
  const teams = asArray(raw.teams).map((item) => {
    const team = asObject(item);
    const record = recordFromTeam(team);
    const managerId = managerForTeam(team, members);
    if (!members.has(managerId)) {
      members.set(managerId, { id: managerId, displayName: teamName(team) });
    }
    return {
      season: year,
      teamId: asNumber(team.id) ?? 0,
      managerId,
      teamName: teamName(team),
      abbreviation: asString(team.abbrev),
      ...record,
      playoffSeed: asNumber(team.playoffSeed),
      finalPlacement: asNumber(team.rankCalculatedFinal)
    };
  });
  applyManagerCorrections(year, teams, members);
  return teams;
}

function applyManagerCorrections(year: number, teams: TeamSeason[], members: Map<string, Manager>) {
  if (year !== 2025) return;
  const correctedTeam = teams.find((team) => team.managerId === MANAGER_OVERRIDES.alexKlang && team.teamName === "Illegal Motion");
  if (!correctedTeam) return;
  correctedTeam.managerId = MANAGER_OVERRIDES.andresPalacio;
  if (!members.has(MANAGER_OVERRIDES.andresPalacio)) {
    members.set(MANAGER_OVERRIDES.andresPalacio, { id: MANAGER_OVERRIDES.andresPalacio, displayName: "Andres palacio" });
  }
}

function extractMatchups(raw: JsonObject, year: number, teams: TeamSeason[]): Matchup[] {
  const teamToManager = new Map(teams.map((team) => [team.teamId, team.managerId]));
  return asArray(raw.schedule).map((item, index) => {
    const matchup = asObject(item);
    const home = asObject(matchup.home);
    const away = asObject(matchup.away);
    const homeTeamId = asNumber(home.teamId);
    const awayTeamId = asNumber(away.teamId);
    const homeScore = asNumber(home.totalPoints);
    const awayScore = asNumber(away.totalPoints);
    const homeManagerId = homeTeamId ? teamToManager.get(homeTeamId) : undefined;
    const awayManagerId = awayTeamId ? teamToManager.get(awayTeamId) : undefined;
    const completed = homeScore !== undefined && awayScore !== undefined && (homeScore > 0 || awayScore > 0);
    const margin = completed ? Math.abs((homeScore ?? 0) - (awayScore ?? 0)) : undefined;
    const winnerCode = asString(matchup.winner);
    const winnerManagerId =
      completed && winnerCode === "HOME" ? homeManagerId :
      completed && winnerCode === "AWAY" ? awayManagerId :
      undefined;
    const loserManagerId =
      winnerManagerId === homeManagerId ? awayManagerId :
      winnerManagerId === awayManagerId ? homeManagerId :
      undefined;
    const playoffTier = asString(matchup.playoffTierType);
    return {
      id: `${year}-${asNumber(matchup.id) ?? index}`,
      season: year,
      week: asNumber(matchup.matchupPeriodId) ?? asNumber(matchup.scoringPeriodId) ?? 0,
      homeTeamId,
      awayTeamId,
      homeManagerId,
      awayManagerId,
      homeScore,
      awayScore,
      winnerManagerId,
      loserManagerId,
      margin,
      isPlayoff: Boolean(playoffTier && playoffTier !== "NONE"),
      completed
    };
  });
}

function extractPlayerLookup(raw: JsonObject): Map<number, { name: string; position?: string; proTeam?: string }> {
  const players = new Map<number, { name: string; position?: string; proTeam?: string }>();
  const addPlayer = (entry: JsonObject) => {
    const player = asObject(entry.player);
    const id = asNumber(player.id) ?? asNumber(entry.id) ?? asNumber(entry.playerId);
    if (!id) return;
    if (players.has(id)) return;
    const defaultPositionId = asNumber(player.defaultPositionId);
    players.set(id, {
      name: asString(player.fullName) ?? asString(player.name) ?? `Player ${id}`,
      position: defaultPositionId !== undefined ? POSITION_BY_ID[defaultPositionId] : undefined,
      proTeam: asNumber(player.proTeamId)?.toString()
    });
  };
  for (const entry of asArray(raw.players).map(asObject)) {
    addPlayer(entry);
  }
  for (const team of asArray(raw.teams).map(asObject)) {
    for (const entryValue of asArray(asObject(team.roster).entries)) {
      addPlayer(asObject(asObject(entryValue).playerPoolEntry));
    }
  }
  return players;
}

function extractDraft(raw: JsonObject, year: number, teams: TeamSeason[]): DraftPick[] {
  const teamToManager = new Map(teams.map((team) => [team.teamId, team.managerId]));
  const playerLookup = extractPlayerLookup(raw);
  const draft = asObject(raw.draftDetail);
  const drafted = Boolean(draft.drafted);
  return asArray(draft.picks).map((item) => {
    const pick = asObject(item);
    const poolEntry = asObject(pick.playerPoolEntry);
    const player = asObject(poolEntry.player);
    const teamId = asNumber(pick.teamId);
    const rawPlayerId = asNumber(player.id) ?? asNumber(pick.playerId);
    const playerId = rawPlayerId && rawPlayerId > 0 ? rawPlayerId : undefined;
    const knownPlayer = playerId ? playerLookup.get(playerId) : undefined;
    const defaultPositionId = asNumber(player.defaultPositionId);
    const lineupSlotId = asNumber(pick.lineupSlotId);
    return {
      season: year,
      round: asNumber(pick.roundId),
      roundPick: asNumber(pick.roundPickNumber),
      overall: asNumber(pick.overallPickNumber),
      teamId,
      managerId: teamId ? teamToManager.get(teamId) : undefined,
      playerId,
      playerName: knownPlayer?.name ?? asString(player.fullName) ?? asString(player.name) ?? (drafted ? `Player ${playerId ?? "Unknown"}` : "TBD"),
      position: knownPlayer?.position ?? (defaultPositionId !== undefined ? POSITION_BY_ID[defaultPositionId] : undefined) ?? (lineupSlotId !== undefined ? LINEUP_SLOT_BY_ID[lineupSlotId] : undefined),
      proTeam: knownPlayer?.proTeam ?? asNumber(player.proTeamId)?.toString(),
      keeper: Boolean(pick.keeper),
      auctionAmount: asNumber(pick.bidAmount) ?? asNumber(pick.auctionValue)
    };
  });
}

function extractFinalRosters(raw: JsonObject, year: number, teams: TeamSeason[]): RosterPlayer[] {
  const teamToManager = new Map(teams.map((team) => [team.teamId, team.managerId]));
  return asArray(raw.teams).flatMap((teamValue) => {
    const team = asObject(teamValue);
    const teamId = asNumber(team.id);
    return asArray(asObject(team.roster).entries).map((entryValue) => {
      const entry = asObject(entryValue);
      const poolEntry = asObject(entry.playerPoolEntry);
      const player = asObject(poolEntry.player);
      const playerId = asNumberish(entry.playerId) ?? asNumberish(player.id);
      const defaultPositionId = asNumber(player.defaultPositionId);
      return {
        season: year,
        teamId,
        managerId: teamId ? teamToManager.get(teamId) : undefined,
        playerId,
        playerName: asString(player.fullName) ?? asString(player.name) ?? (playerId ? `Player ${playerId}` : "Player Unknown"),
        position: defaultPositionId !== undefined ? POSITION_BY_ID[defaultPositionId] : undefined,
        proTeam: asNumber(player.proTeamId)?.toString(),
        lineupSlotId: asNumber(entry.lineupSlotId),
        acquisitionType: asString(entry.acquisitionType)
      };
    });
  }).sort((a, b) => (a.teamId ?? 0) - (b.teamId ?? 0) || (a.lineupSlotId ?? 999) - (b.lineupSlotId ?? 999) || a.playerName.localeCompare(b.playerName));
}

function extractWeeklyPlayerScores(raw: JsonObject, year: number, teams: TeamSeason[]): WeeklyPlayerScore[] {
  const teamToManager = new Map(teams.map((team) => [team.teamId, team.managerId]));
  const scores = new Map<string, WeeklyPlayerScore>();

  for (const item of asArray(raw.schedule).map(asObject)) {
    const week = asNumber(item.matchupPeriodId) ?? asNumber(item.scoringPeriodId);
    if (!week) continue;

    for (const side of ["home", "away"] as const) {
      const matchupSide = asObject(item[side]);
      const teamId = asNumber(matchupSide.teamId);
      const roster = asObject(matchupSide.rosterForCurrentScoringPeriod);
      for (const rosterEntry of asArray(roster.entries).map(asObject)) {
        const playerId = asNumberish(rosterEntry.playerId);
        if (!playerId) continue;

        const poolEntry = asObject(rosterEntry.playerPoolEntry);
        const player = asObject(poolEntry.player);
        const statRows = asArray(player.stats).map(asObject).filter((stat) => asNumberish(stat.scoringPeriodId) === week);
        const actual = statRows.find((stat) => asNumberish(stat.statSourceId) === 0);
        const projected = statRows.find((stat) => asNumberish(stat.statSourceId) === 1);
        const stat = actual ?? projected;
        const points = asNumber(stat?.appliedTotal);
        if (!stat || points === undefined) continue;

        const key = `${year}-${week}-${teamId ?? "unknown"}-${playerId}`;
        scores.set(key, {
          season: year,
          week,
          teamId,
          managerId: teamId ? teamToManager.get(teamId) : undefined,
          playerId,
          playerName: asString(player.fullName) ?? asString(player.name) ?? `Player ${playerId}`,
          lineupSlotId: asNumber(rosterEntry.lineupSlotId),
          points,
          projected: asNumberish(stat.statSourceId) !== 0
        });
      }
    }
  }

  return Array.from(scores.values()).sort((a, b) => a.week - b.week || a.playerName.localeCompare(b.playerName));
}

export function parseEspnRosterMoveActivity(raw: unknown, year: number, season: Season, seasonRaw: unknown): RosterMoveActivity[] {
  const data = asObject(raw);
  const original = asObject(seasonRaw);
  const teamToManager = new Map(season.teams.map((team) => [team.teamId, team.managerId]));
  const players = extractPlayerLookup(original);
  const addDropTypeIds = new Set([178, 179, 180, 181, 239]);
  return asArray(data.topics).flatMap((item, index) => {
    const topic = asObject(item);
    const messages = asArray(topic.messages).map(asObject);
    const tradeMessages = messages.filter((message) => asNumberish(message.messageTypeId) === 244);
    const addDropMessages = messages.filter((message) => addDropTypeIds.has(asNumberish(message.messageTypeId) ?? 0));
    if (!tradeMessages.length && !addDropMessages.length) return [];
    const timestamp = asNumberish(topic.date);
    const week = asNumberish(topic.scoringPeriodId) ?? asNumberish(topic.matchupPeriodId) ?? asNumberish(topic.proScoringPeriodId);
    const activities: RosterMoveActivity[] = [];
    if (tradeMessages.length) {
      activities.push({
        id: `${year}-${asString(topic.id) ?? index}-trade`,
        season: year,
        week,
        kind: "trade",
        timestamp,
        date: timestamp ? new Date(timestamp).toISOString() : undefined,
        moves: tradeMessages.map((message) => {
          const playerId = asNumberish(message.targetId);
          const fromTeamId = asNumberish(message.from);
          const toTeamId = asNumberish(message.to);
          return {
            kind: "trade",
            action: "traded",
            playerId,
            playerName: playerId ? players.get(playerId)?.name ?? `Player ${playerId}` : "Player Unknown",
            fromTeamId,
            toTeamId,
            fromManagerId: fromTeamId ? teamToManager.get(fromTeamId) : undefined,
            toManagerId: toTeamId ? teamToManager.get(toTeamId) : undefined
          };
        })
      });
    }
    if (addDropMessages.length) {
      activities.push({
        id: `${year}-${asString(topic.id) ?? index}-add-drop`,
        season: year,
        week,
        kind: "add-drop",
        timestamp,
        date: timestamp ? new Date(timestamp).toISOString() : undefined,
        moves: addDropMessages.map((message) => {
          const typeId = asNumberish(message.messageTypeId);
          const playerId = asNumberish(message.targetId);
          const teamId = typeId === 239 ? asNumberish(message.for) : asNumberish(message.to);
          const action = typeId === 178 || typeId === 180 ? "added" : "dropped";
          return {
            kind: "add-drop",
            action,
            playerId,
            playerName: playerId ? players.get(playerId)?.name ?? `Player ${playerId}` : "Player Unknown",
            teamId,
            managerId: teamId ? teamToManager.get(teamId) : undefined,
            bidAmount: typeId === 180 ? asNumberish(message.from) : undefined
          };
        })
      });
    }
    return activities;
  });
}

function determineStatus(year: number, teams: TeamSeason[], matchups: Matchup[]): SeasonStatus {
  const hasScores = matchups.some((matchup) => matchup.completed);
  const hasFinalPlacements = teams.some((team) => team.finalPlacement !== undefined && team.finalPlacement > 0);
  const hasRecords = teams.some((team) => team.wins || team.losses || team.ties || team.pointsFor);
  if (hasFinalPlacements || hasRecords) return "complete";
  if (hasScores) return "active";
  return "preseason";
}

export function parseEspnSeason(raw: unknown, year: number, sourceFile: string): { season: Season; managers: Manager[] } {
  const data = asObject(raw);
  const managers = extractMembers(data);
  const teams = extractTeams(data, year, managers);
  const matchups = extractMatchups(data, year, teams);
  const draftPicks = extractDraft(data, year, teams);
  const finalRosters = extractFinalRosters(data, year, teams);
  const weeklyPlayerScores = extractWeeklyPlayerScores(data, year, teams);
  const settings = asObject(data.settings);
  const scheduleSettings = asObject(settings.scheduleSettings);
  const notes: string[] = [];
  if (!teams.length) notes.push("No teams found in the ESPN export.");
  if (!matchups.length) notes.push("No schedule or matchup rows found in the ESPN export.");
  if (!draftPicks.length) notes.push("No completed draft picks found in the ESPN export.");
  if (draftPicks.length && !Boolean(asObject(data.draftDetail).drafted)) notes.push("Draft picks represent order slots only; ESPN marks the draft as not completed.");
  return {
    managers: Array.from(managers.values()),
    season: {
      year,
      status: determineStatus(year, teams, matchups),
      sourceFile,
      leagueId: asNumber(data.id),
      leagueName: asString(settings.name) ?? asString(data.name),
      playoffTeamCount: asNumber(scheduleSettings.playoffTeamCount),
      teams,
      matchups,
      draftPicks,
      finalRosters,
      rosterMoves: [],
      weeklyPlayerScores,
      notes
    }
  };
}

export function missingSeason(year: number): Season {
  return {
    year,
    status: "missing",
    teams: [],
    matchups: [],
    draftPicks: [],
    finalRosters: [],
    rosterMoves: [],
    weeklyPlayerScores: [],
    notes: ["Backfill ready. Add a matching ESPN JSON export when available."]
  };
}
