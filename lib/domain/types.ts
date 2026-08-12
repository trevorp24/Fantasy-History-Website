export type SeasonStatus = "missing" | "preseason" | "active" | "complete";

export type Manager = {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
};

export type TeamSeason = {
  season: number;
  teamId: number;
  managerId: string;
  teamName: string;
  abbreviation?: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  playoffSeed?: number;
  finalPlacement?: number;
};

export type Matchup = {
  id: string;
  season: number;
  week: number;
  homeTeamId?: number;
  awayTeamId?: number;
  homeManagerId?: string;
  awayManagerId?: string;
  homeScore?: number;
  awayScore?: number;
  winnerManagerId?: string;
  loserManagerId?: string;
  margin?: number;
  isPlayoff: boolean;
  playoffTier?: string;
  completed: boolean;
};

export type DraftPick = {
  season: number;
  round?: number;
  roundPick?: number;
  overall?: number;
  teamId?: number;
  managerId?: string;
  playerId?: number;
  playerName: string;
  position?: string;
  proTeam?: string;
  keeper: boolean;
  auctionAmount?: number;
};

export type RosterPlayer = {
  season: number;
  teamId?: number;
  managerId?: string;
  playerId?: number;
  playerName: string;
  position?: string;
  proTeam?: string;
  lineupSlotId?: number;
  acquisitionType?: string;
};

export type RosterMoveKind = "trade" | "add-drop";
export type RosterMoveAction = "added" | "dropped" | "traded";

export type RosterMove = {
  kind: RosterMoveKind;
  action: RosterMoveAction;
  playerId?: number;
  playerName: string;
  teamId?: number;
  managerId?: string;
  fromTeamId?: number;
  toTeamId?: number;
  fromManagerId?: string;
  toManagerId?: string;
  bidAmount?: number;
};

export type RosterMoveActivity = {
  id: string;
  season: number;
  week?: number;
  kind: RosterMoveKind;
  date?: string;
  timestamp?: number;
  moves: RosterMove[];
};

export type WeeklyPlayerScore = {
  season: number;
  week: number;
  teamId?: number;
  managerId?: string;
  playerId: number;
  playerName: string;
  lineupSlotId?: number;
  points: number;
  projected: boolean;
};

export type TradeImpact = {
  activityId: string;
  moveIndex: number;
  season: number;
  tradeDate?: string;
  kind: RosterMoveKind;
  action: RosterMoveAction;
  playerId?: number;
  playerName: string;
  fromManagerId?: string;
  toManagerId?: string;
  managerId?: string;
  weeksTracked: number;
  pointsAfterMove: number;
  projectedOnly: boolean;
};

export type Season = {
  year: number;
  status: SeasonStatus;
  sourceFile?: string;
  leagueId?: number;
  leagueName?: string;
  playoffTeamCount?: number;
  teams: TeamSeason[];
  matchups: Matchup[];
  draftPicks: DraftPick[];
  finalRosters: RosterPlayer[];
  rosterMoves: RosterMoveActivity[];
  weeklyPlayerScores: WeeklyPlayerScore[];
  notes: string[];
};

export type CareerRecord = {
  manager: Manager;
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  championships: number;
  runnerUps: number;
  topThreeFinishes: number;
  playoffAppearances: number;
  playoffWins: number;
  playoffLosses: number;
  playoffTies: number;
  winPct: number;
  averageFinish?: number;
};

export type HeadToHeadRecord = {
  managerAId: string;
  managerBId: string;
  managerAName: string;
  managerBName: string;
  winsA: number;
  winsB: number;
  ties: number;
  pointsA: number;
  pointsB: number;
  games: number;
  largestMargin?: number;
  closestMargin?: number;
};

export type RecordBookEntry = {
  label: string;
  value: string;
  detail: string;
  season?: number;
  managerId?: string;
};

export type AllPlaySeason = {
  season: number;
  managerId: string;
  managerName: string;
  actualWins: number;
  allPlayWins: number;
  allPlayLosses: number;
  luckDelta: number;
};

export type LeagueData = {
  managers: Manager[];
  seasons: Season[];
  careerRecords: CareerRecord[];
  headToHead: HeadToHeadRecord[];
  recordBook: RecordBookEntry[];
  allPlay: AllPlaySeason[];
  tradeImpacts: TradeImpact[];
  backfillYears: number[];
};
