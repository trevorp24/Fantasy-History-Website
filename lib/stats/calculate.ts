import {
  AllPlaySeason,
  CareerRecord,
  HeadToHeadRecord,
  LeagueData,
  Manager,
  Matchup,
  RecordBookEntry,
  Season,
  TradeImpact
} from "@/lib/domain/types";

const pct = (wins: number, losses: number, ties: number) => {
  const games = wins + losses + ties;
  return games ? (wins + ties * 0.5) / games : 0;
};

const formatRecord = (wins: number, losses: number, ties = 0) => ties ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
const points = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function calculateLeague(managers: Manager[], seasons: Season[], backfillYears: number[]): LeagueData {
  const managerById = new Map(managers.map((manager) => [manager.id, manager]));
  return {
    managers,
    seasons,
    careerRecords: calculateCareerRecords(managers, seasons),
    headToHead: calculateHeadToHead(seasons, managerById),
    recordBook: calculateRecordBook(seasons, managerById),
    allPlay: calculateAllPlay(seasons, managerById),
    tradeImpacts: calculateTradeImpacts(seasons),
    backfillYears
  };
}

function calculateCareerRecords(managers: Manager[], seasons: Season[]): CareerRecord[] {
  return managers.map((manager) => {
    const rows = seasons.flatMap((season) => season.teams.filter((team) => team.managerId === manager.id));
    const playoffAppearances = seasons.reduce((sum, season) => {
      const row = season.teams.find((team) => team.managerId === manager.id);
      if (!row || !season.playoffTeamCount) return sum;
      return sum + (row.finalPlacement !== undefined && row.finalPlacement > 0 && row.finalPlacement <= season.playoffTeamCount ? 1 : 0);
    }, 0);
    const wins = rows.reduce((sum, row) => sum + row.wins, 0);
    const losses = rows.reduce((sum, row) => sum + row.losses, 0);
    const ties = rows.reduce((sum, row) => sum + row.ties, 0);
    const finishes = rows.map((row) => row.finalPlacement).filter((finish): finish is number => finish !== undefined && finish > 0);
    return {
      manager,
      seasons: rows.length,
      wins,
      losses,
      ties,
      pointsFor: rows.reduce((sum, row) => sum + row.pointsFor, 0),
      pointsAgainst: rows.reduce((sum, row) => sum + row.pointsAgainst, 0),
      championships: rows.filter((row) => row.finalPlacement === 1).length,
      runnerUps: rows.filter((row) => row.finalPlacement === 2).length,
      playoffAppearances,
      winPct: pct(wins, losses, ties),
      averageFinish: finishes.length ? finishes.reduce((sum, finish) => sum + finish, 0) / finishes.length : undefined
    };
  }).filter((record) => record.seasons > 0)
    .sort((a, b) => b.championships - a.championships || b.winPct - a.winPct || b.pointsFor - a.pointsFor);
}

function completedMatchups(seasons: Season[]): Matchup[] {
  return seasons.flatMap((season) => season.matchups).filter((matchup) =>
    matchup.completed && matchup.homeManagerId && matchup.awayManagerId && matchup.homeScore !== undefined && matchup.awayScore !== undefined
  );
}

function calculateHeadToHead(seasons: Season[], managerById: Map<string, Manager>): HeadToHeadRecord[] {
  const records = new Map<string, HeadToHeadRecord>();
  for (const matchup of completedMatchups(seasons)) {
    const homeId = matchup.homeManagerId!;
    const awayId = matchup.awayManagerId!;
    const [a, b] = [homeId, awayId].sort();
    const key = `${a}::${b}`;
    const record = records.get(key) ?? {
      managerAId: a,
      managerBId: b,
      managerAName: managerById.get(a)?.displayName ?? a,
      managerBName: managerById.get(b)?.displayName ?? b,
      winsA: 0,
      winsB: 0,
      ties: 0,
      pointsA: 0,
      pointsB: 0,
      games: 0
    };
    const aScore = homeId === a ? matchup.homeScore! : matchup.awayScore!;
    const bScore = homeId === b ? matchup.homeScore! : matchup.awayScore!;
    record.pointsA += aScore;
    record.pointsB += bScore;
    record.games += 1;
    if (aScore > bScore) record.winsA += 1;
    else if (bScore > aScore) record.winsB += 1;
    else record.ties += 1;
    const margin = Math.abs(aScore - bScore);
    record.largestMargin = Math.max(record.largestMargin ?? 0, margin);
    record.closestMargin = Math.min(record.closestMargin ?? Number.POSITIVE_INFINITY, margin);
    records.set(key, record);
  }
  return Array.from(records.values())
    .map((record) => ({ ...record, closestMargin: Number.isFinite(record.closestMargin ?? Infinity) ? record.closestMargin : undefined }))
    .sort((a, b) => b.games - a.games || Math.max(b.winsA, b.winsB) - Math.max(a.winsA, a.winsB));
}

function calculateRecordBook(seasons: Season[], managerById: Map<string, Manager>): RecordBookEntry[] {
  const entries: RecordBookEntry[] = [];
  const allTeams = seasons.flatMap((season) => season.teams);
  const allGames = completedMatchups(seasons);
  const allScores = allGames.flatMap((game) => [
    { managerId: game.homeManagerId, score: game.homeScore, season: game.season, week: game.week },
    { managerId: game.awayManagerId, score: game.awayScore, season: game.season, week: game.week }
  ]).filter((row): row is { managerId: string; score: number; season: number; week: number } => Boolean(row.managerId && row.score !== undefined));
  const addTeamEntry = (label: string, row: typeof allTeams[number] | undefined, value: string, detail: string) => {
    if (row) entries.push({ label, value, detail, season: row.season, managerId: row.managerId });
  };

  const bestRecord = [...allTeams]
    .filter((team) => team.wins || team.losses || team.ties)
    .sort((a, b) => pct(b.wins, b.losses, b.ties) - pct(a.wins, a.losses, a.ties) || b.wins - a.wins || b.pointsFor - a.pointsFor)[0];
  addTeamEntry(
    "Best Regular-Season Record",
    bestRecord,
    bestRecord ? formatRecord(bestRecord.wins, bestRecord.losses, bestRecord.ties) : "Pending",
    bestRecord ? `${managerById.get(bestRecord.managerId)?.displayName ?? bestRecord.teamName}, ${bestRecord.season}` : "Add completed exports."
  );

  const highestSeason = [...allTeams].filter((team) => team.pointsFor > 0).sort((a, b) => b.pointsFor - a.pointsFor)[0];
  addTeamEntry(
    "Highest Scoring Season",
    highestSeason,
    highestSeason ? points(highestSeason.pointsFor) : "Pending",
    highestSeason ? `${managerById.get(highestSeason.managerId)?.displayName ?? highestSeason.teamName}, ${highestSeason.season}` : "Add completed exports."
  );

  const playoffAppearances = new Map<string, number>();
  for (const season of seasons) {
    if (!season.playoffTeamCount) continue;
    for (const team of season.teams) {
      if (team.finalPlacement !== undefined && team.finalPlacement > 0 && team.finalPlacement <= season.playoffTeamCount) {
        playoffAppearances.set(team.managerId, (playoffAppearances.get(team.managerId) ?? 0) + 1);
      }
    }
  }
  const mostPlayoffs = Array.from(playoffAppearances.entries()).sort((a, b) => b[1] - a[1] || (managerById.get(a[0])?.displayName ?? a[0]).localeCompare(managerById.get(b[0])?.displayName ?? b[0]))[0];
  if (mostPlayoffs) {
    entries.push({
      label: "Most Playoff Appearances",
      value: `${mostPlayoffs[1]}`,
      detail: managerById.get(mostPlayoffs[0])?.displayName ?? mostPlayoffs[0],
      managerId: mostPlayoffs[0]
    });
  }

  const highestWeek = [...allScores].sort((a, b) => b.score - a.score)[0];
  if (highestWeek) {
    entries.push({
      label: "Highest Single-Week Score",
      value: points(highestWeek.score),
      detail: `${managerById.get(highestWeek.managerId)?.displayName ?? highestWeek.managerId}, Week ${highestWeek.week}`,
      season: highestWeek.season,
      managerId: highestWeek.managerId
    });
  }

  const biggest = [...allGames].filter((game) => game.margin !== undefined).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0))[0];
  if (biggest) {
    entries.push({
      label: "Biggest Blowout",
      value: `${points(biggest.margin ?? 0)} pts`,
      detail: `${managerById.get(biggest.winnerManagerId ?? "")?.displayName ?? "Winner unavailable"}, Week ${biggest.week}`,
      season: biggest.season,
      managerId: biggest.winnerManagerId
    });
  }

  const closest = [...allGames].filter((game) => game.margin !== undefined).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0))[0];
  if (closest) {
    entries.push({
      label: "Closest Matchup",
      value: `${points(closest.margin ?? 0)} pts`,
      detail: `${managerById.get(closest.homeManagerId!)?.displayName ?? closest.homeManagerId} vs ${managerById.get(closest.awayManagerId!)?.displayName ?? closest.awayManagerId}, Week ${closest.week}`,
      season: closest.season
    });
  }

  const lowestWeek = [...allScores].filter((row) => row.score > 0).sort((a, b) => a.score - b.score)[0];
  if (lowestWeek) {
    entries.push({
      label: "Lowest Single-Week Score",
      value: points(lowestWeek.score),
      detail: `${managerById.get(lowestWeek.managerId)?.displayName ?? lowestWeek.managerId}, Week ${lowestWeek.week}`,
      season: lowestWeek.season,
      managerId: lowestWeek.managerId
    });
  }

  return entries;
}

function calculateAllPlay(seasons: Season[], managerById: Map<string, Manager>): AllPlaySeason[] {
  const rows: AllPlaySeason[] = [];
  for (const season of seasons.filter((season) => season.status !== "missing")) {
    const scoresByWeek = new Map<number, { managerId: string; score: number; actualWin: number }[]>();
    for (const game of season.matchups.filter((matchup) => matchup.completed)) {
      if (game.homeManagerId && game.homeScore !== undefined) {
        const row = scoresByWeek.get(game.week) ?? [];
        row.push({ managerId: game.homeManagerId, score: game.homeScore, actualWin: game.winnerManagerId === game.homeManagerId ? 1 : 0 });
        scoresByWeek.set(game.week, row);
      }
      if (game.awayManagerId && game.awayScore !== undefined) {
        const row = scoresByWeek.get(game.week) ?? [];
        row.push({ managerId: game.awayManagerId, score: game.awayScore, actualWin: game.winnerManagerId === game.awayManagerId ? 1 : 0 });
        scoresByWeek.set(game.week, row);
      }
    }
    const totals = new Map<string, AllPlaySeason>();
    for (const weekScores of scoresByWeek.values()) {
      for (const row of weekScores) {
        const total = totals.get(row.managerId) ?? {
          season: season.year,
          managerId: row.managerId,
          managerName: managerById.get(row.managerId)?.displayName ?? row.managerId,
          actualWins: 0,
          allPlayWins: 0,
          allPlayLosses: 0,
          luckDelta: 0
        };
        total.actualWins += row.actualWin;
        total.allPlayWins += weekScores.filter((opponent) => opponent.managerId !== row.managerId && row.score > opponent.score).length;
        total.allPlayLosses += weekScores.filter((opponent) => opponent.managerId !== row.managerId && row.score < opponent.score).length;
        totals.set(row.managerId, total);
      }
    }
    for (const total of totals.values()) {
      const denominator = total.allPlayWins + total.allPlayLosses;
      const expectedWins = denominator ? (total.allPlayWins / denominator) * total.actualWins : 0;
      rows.push({ ...total, luckDelta: total.actualWins - expectedWins });
    }
  }
  return rows.sort((a, b) => b.luckDelta - a.luckDelta);
}

function calculateTradeImpacts(seasons: Season[]): TradeImpact[] {
  const impacts: TradeImpact[] = [];

  for (const season of seasons) {
    const weeklyScores = season.weeklyPlayerScores.filter((score) => score.playerId && score.managerId);
    if (!weeklyScores.length) continue;

    for (const activity of season.rosterMoves) {
      activity.moves.forEach((move, moveIndex) => {
        const targetManagerId = move.action === "traded" ? move.toManagerId : move.action === "added" ? move.managerId : undefined;
        const rows = activity.week
          ? weeklyScores.filter((score) =>
            score.playerId === move.playerId &&
            score.managerId === targetManagerId &&
            score.week > activity.week!
          )
          : [];
        impacts.push({
          activityId: activity.id,
          moveIndex,
          season: season.year,
          tradeDate: activity.date,
          kind: activity.kind,
          action: move.action,
          playerId: move.playerId,
          playerName: move.playerName,
          fromManagerId: move.fromManagerId,
          toManagerId: move.toManagerId,
          managerId: move.managerId,
          weeksTracked: rows.length,
          pointsAfterMove: rows.reduce((sum, row) => sum + row.points, 0),
          projectedOnly: rows.length > 0 && rows.every((row) => row.projected)
        });
      });
    }
  }

  return impacts.sort((a, b) => b.pointsAfterMove - a.pointsAfterMove || a.playerName.localeCompare(b.playerName));
}
