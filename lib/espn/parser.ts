import { DraftPick, Manager, Matchup, Season, SeasonStatus, TeamSeason } from "@/lib/domain/types";
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
    notes: ["Backfill ready. Add a matching ESPN JSON export when available."]
  };
}
