import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rawDir = path.join(root, "data", "raw");
const recapDir = path.join(root, "data", "draft-recaps");
const outDir = path.join(root, "outputs", "moggate-preview-pages");
const siteVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const currentYear = 2026;
const tradeMessageTypeId = 244;
const addDropMessageTypeIds = new Set([178, 179, 180, 181, 239]);
const positionById = { 0: "QB", 1: "QB", 2: "RB", 3: "RB/WR", 4: "WR", 5: "WR/TE", 6: "TE", 16: "D/ST", 17: "K" };
const lineupSlotById = { 0: "QB", 2: "RB", 4: "WR", 6: "TE", 16: "D/ST", 17: "K", 20: "Bench", 21: "IR", 23: "Flex" };

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const fmt = (value) => Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const pct = (value) => Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/^0/, "");
const num = (value) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
const arr = (value) => Array.isArray(value) ? value : [];
const obj = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const currentRosterPosition = (player) => lineupSlotById[player.lineupSlotId] ?? player.position ?? "-";
const rosterPosition = (player) => player.position ?? lineupSlotById[player.lineupSlotId] ?? "-";
const managerOverrides = {
  andresPalacio: "{E99193C6-A234-4A24-9193-C6A234BA2477}",
  alexKlang: "{900D53E0-6C85-4D02-8D53-E06C85ED0253}"
};

function teamName(team) {
  return team.name || [team.location, team.nickname].filter(Boolean).join(" ") || `Team ${team.id ?? "Unknown"}`;
}

function loadSeason(year) {
  const raw = JSON.parse(fs.readFileSync(path.join(rawDir, `moggate_${year}.json`), "utf8"));
  const managers = new Map();
  for (const member of arr(raw.members)) {
    const id = member.id || member.guid || member.memberId;
    if (!id) continue;
    const full = [member.firstName, member.lastName].filter(Boolean).join(" ");
    managers.set(id, { id, displayName: full || member.displayName || id });
  }
  const teams = arr(raw.teams).map((team) => {
    const ownerId = arr(team.owners).find(Boolean) || team.primaryOwner || team.ownerId || `team-${team.id ?? "unknown"}`;
    if (!managers.has(ownerId)) managers.set(ownerId, { id: ownerId, displayName: teamName(team) });
    const overall = obj(obj(team.record).overall);
    return {
      season: year,
      teamId: team.id ?? 0,
      managerId: ownerId,
      teamName: teamName(team),
      wins: num(overall.wins) ?? 0,
      losses: num(overall.losses) ?? 0,
      ties: num(overall.ties) ?? 0,
      pointsFor: num(overall.pointsFor) ?? 0,
      pointsAgainst: num(overall.pointsAgainst) ?? 0,
      playoffSeed: num(team.playoffSeed),
      finalPlacement: num(team.rankCalculatedFinal)
    };
  });
  applyManagerCorrections(year, teams, managers);
  const teamToManager = new Map(teams.map((team) => [team.teamId, team.managerId]));
  const matchups = arr(raw.schedule).map((matchup, index) => {
    const home = obj(matchup.home);
    const away = obj(matchup.away);
    const homeTeamId = num(home.teamId);
    const awayTeamId = num(away.teamId);
    const homeScore = num(home.totalPoints);
    const awayScore = num(away.totalPoints);
    const completed = homeScore !== undefined && awayScore !== undefined && (homeScore > 0 || awayScore > 0);
    const homeManagerId = homeTeamId ? teamToManager.get(homeTeamId) : undefined;
    const awayManagerId = awayTeamId ? teamToManager.get(awayTeamId) : undefined;
    const winnerManagerId = completed && matchup.winner === "HOME" ? homeManagerId : completed && matchup.winner === "AWAY" ? awayManagerId : undefined;
    return {
      id: `${year}-${matchup.id ?? index}`,
      season: year,
      week: num(matchup.matchupPeriodId) ?? num(matchup.scoringPeriodId) ?? 0,
      homeTeamId,
      awayTeamId,
      homeManagerId,
      awayManagerId,
      homeScore,
      awayScore,
      winnerManagerId,
      loserManagerId: winnerManagerId === homeManagerId ? awayManagerId : winnerManagerId === awayManagerId ? homeManagerId : undefined,
      margin: completed ? Math.abs((homeScore ?? 0) - (awayScore ?? 0)) : undefined,
      isPlayoff: Boolean(matchup.playoffTierType && matchup.playoffTierType !== "NONE"),
      playoffTier: matchup.playoffTierType,
      completed
    };
  });
  const players = new Map();
  const addPlayer = (entry) => {
    const player = obj(entry.player);
    const id = num(player.id) ?? num(entry.id) ?? num(entry.playerId);
    if (id && !players.has(id)) players.set(id, { name: player.fullName || player.name || `Player ${id}` });
  };
  arr(raw.players).forEach((entry) => addPlayer(obj(entry)));
  for (const team of arr(raw.teams)) for (const entry of arr(obj(team.roster).entries)) addPlayer(obj(obj(entry).playerPoolEntry));
  const draft = obj(raw.draftDetail);
  const draftPicks = arr(draft.picks).map((pick) => {
    const poolEntry = obj(pick.playerPoolEntry);
    const player = obj(poolEntry.player);
    const rawPlayerId = num(player.id) ?? num(pick.playerId);
    const playerId = rawPlayerId && rawPlayerId > 0 ? rawPlayerId : undefined;
    const teamId = num(pick.teamId);
    return {
      season: year,
      round: num(pick.roundId),
      roundPick: num(pick.roundPickNumber),
      overall: num(pick.overallPickNumber),
      teamId,
      playerId,
      managerId: teamId ? teamToManager.get(teamId) : undefined,
      playerName: playerId ? (players.get(playerId)?.name || player.fullName || player.name || `Player ${playerId}`) : (draft.drafted ? "Player Unknown" : "TBD")
    };
  });
  applyDraftRecap(draftPicks, year);
  let finalRosters = arr(raw.teams).flatMap((team) => {
    const teamId = num(team.id);
    return arr(obj(team.roster).entries).map((entry) => {
      const player = obj(obj(entry.playerPoolEntry).player);
      const playerId = num(entry.playerId) ?? num(player.id);
      return {
        season: year,
        teamId,
        managerId: teamId ? teamToManager.get(teamId) : undefined,
        playerId,
        playerName: player.fullName || player.name || `Player ${playerId ?? "Unknown"}`,
        position: positionById[num(player.defaultPositionId)],
        lineupSlotId: num(entry.lineupSlotId),
        acquisitionType: entry.acquisitionType
      };
    });
  }).sort((a, b) => (a.teamId ?? 0) - (b.teamId ?? 0) || (a.lineupSlotId ?? 999) - (b.lineupSlotId ?? 999) || a.playerName.localeCompare(b.playerName));
  const hasCompletedMatchups = arr(raw.schedule).some((matchup) => {
    const home = obj(matchup.home);
    const away = obj(matchup.away);
    const homeScore = num(home.totalPoints);
    const awayScore = num(away.totalPoints);
    return homeScore !== undefined && awayScore !== undefined && (homeScore > 0 || awayScore > 0);
  });
  if (!finalRosters.length && hasCompletedMatchups) {
    const rawScoringPeriod = num(raw.scoringPeriodId);
    const snapshotWeek = rawScoringPeriod && rawScoringPeriod > 0 ? rawScoringPeriod : Math.min(...arr(raw.schedule).map((matchup) => num(matchup.matchupPeriodId) ?? 999));
    const seen = new Set();
    const snapshotRows = [];
    for (const matchup of arr(raw.schedule)) {
      const week = num(matchup.matchupPeriodId) ?? num(matchup.scoringPeriodId);
      if (week !== snapshotWeek) continue;
      for (const side of ["home", "away"]) {
        const matchupSide = obj(matchup[side]);
        const teamId = num(matchupSide.teamId);
        for (const entry of arr(obj(matchupSide.rosterForCurrentScoringPeriod).entries)) {
          const player = obj(obj(entry.playerPoolEntry).player);
          const playerId = num(entry.playerId) ?? num(player.id);
          const key = `${teamId ?? "unknown"}-${playerId ?? player.fullName ?? player.name}`;
          if (seen.has(key)) continue;
          seen.add(key);
          snapshotRows.push({
            season: year,
            teamId,
            managerId: teamId ? teamToManager.get(teamId) : undefined,
            playerId,
            playerName: player.fullName || player.name || `Player ${playerId ?? "Unknown"}`,
            position: positionById[num(player.defaultPositionId)],
            lineupSlotId: num(entry.lineupSlotId),
            acquisitionType: entry.acquisitionType
          });
        }
      }
    }
    finalRosters = snapshotRows.sort((a, b) => (a.teamId ?? 0) - (b.teamId ?? 0) || (a.lineupSlotId ?? 999) - (b.lineupSlotId ?? 999) || a.playerName.localeCompare(b.playerName));
  }
  const weeklyPlayerScores = [];
  const scoreKeys = new Set();
  for (const matchup of arr(raw.schedule)) {
    const week = num(matchup.matchupPeriodId) ?? num(matchup.scoringPeriodId);
    if (!week) continue;
    for (const side of ["home", "away"]) {
      const matchupSide = obj(matchup[side]);
      const teamId = num(matchupSide.teamId);
      for (const entry of arr(obj(matchupSide.rosterForCurrentScoringPeriod).entries)) {
        const playerId = num(entry.playerId);
        if (!playerId) continue;
        const player = obj(obj(entry.playerPoolEntry).player);
        const stats = arr(player.stats).filter((stat) => num(stat.scoringPeriodId) === week);
        const stat = stats.find((row) => num(row.statSourceId) === 0) ?? stats.find((row) => num(row.statSourceId) === 1);
        const points = num(stat?.appliedTotal);
        if (!stat || points === undefined) continue;
        const key = `${year}-${week}-${teamId ?? "unknown"}-${playerId}`;
        if (scoreKeys.has(key)) continue;
        scoreKeys.add(key);
        weeklyPlayerScores.push({
          season: year,
          week,
          teamId,
          managerId: teamId ? teamToManager.get(teamId) : undefined,
          playerId,
          playerName: player.fullName || player.name || `Player ${playerId}`,
          points,
          projected: num(stat.statSourceId) !== 0
        });
      }
    }
  }
  return { year, playoffTeamCount: num(obj(obj(raw.settings).scheduleSettings).playoffTeamCount), teams, matchups, draftPicks, finalRosters, weeklyPlayerScores, managers: [...managers.values()], status: teams.some((team) => team.pointsFor || team.finalPlacement) ? "complete" : "preseason" };
}

function playerLookupForYear(year) {
  const raw = JSON.parse(fs.readFileSync(path.join(rawDir, `moggate_${year}.json`), "utf8"));
  const players = new Map();
  const addPlayer = (entry) => {
    const player = obj(entry.player);
    const id = num(player.id) ?? num(entry.id) ?? num(entry.playerId);
    if (id && !players.has(id)) players.set(id, player.fullName || player.name || `Player ${id}`);
  };
  arr(raw.players).forEach((entry) => addPlayer(obj(entry)));
  for (const team of arr(raw.teams)) for (const entry of arr(obj(team.roster).entries)) addPlayer(obj(obj(entry).playerPoolEntry));
  return players;
}

function loadRosterMoves(year) {
  const file = path.join(rawDir, `moggate_${year}_activity.json`);
  if (!fs.existsSync(file)) return [];
  const season = seasons.find((item) => item.year === year);
  if (!season) return [];
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const teamToManager = new Map(season.teams.map((team) => [team.teamId, team.managerId]));
  const players = playerLookupForYear(year);
  return arr(raw.topics).flatMap((topic, index) => {
    const messages = arr(topic.messages);
    const tradeMessages = messages.filter((message) => message.messageTypeId === tradeMessageTypeId);
    const addDropMessages = messages.filter((message) => addDropMessageTypeIds.has(message.messageTypeId));
    if (!tradeMessages.length && !addDropMessages.length) return [];
    const date = topic.date ? new Date(topic.date).toLocaleDateString() : "Unknown date";
    const week = num(topic.scoringPeriodId) ?? num(topic.matchupPeriodId) ?? num(topic.proScoringPeriodId);
    const activities = [];
    if (tradeMessages.length) {
      const moves = tradeMessages.map((message) => {
        const fromTeamId = num(message.from);
        const toTeamId = num(message.to);
        const playerId = num(message.targetId);
        const fromManagerId = teamToManager.get(fromTeamId);
        const toManagerId = teamToManager.get(toTeamId);
        const player = players.get(playerId) || `Player ${message.targetId ?? "Unknown"}`;
        return { kind: "trade", action: "traded", fromManager: managerName(fromManagerId), toManager: managerName(toManagerId), fromManagerId, toManagerId, playerId, player };
      });
      const managersInvolved = [...new Set(moves.flatMap((move) => [move.fromManager, move.toManager]).filter(Boolean))];
      activities.push({ id: `${year}-${topic.id ?? index}-trade`, kind: "trade", season: year, week, date, managersInvolved, moves });
    }
    if (addDropMessages.length) {
      const moves = addDropMessages.map((message) => {
        const typeId = message.messageTypeId;
        const teamId = typeId === 239 ? num(message.for) : num(message.to);
        const managerId = teamToManager.get(teamId);
        const manager = managerName(managerId);
        const player = players.get(num(message.targetId)) || `Player ${message.targetId ?? "Unknown"}`;
        const action = typeId === 178 || typeId === 180 ? "Added" : "Dropped";
        const bidAmount = typeId === 180 ? num(message.from) : undefined;
        return { kind: "add-drop", action, managerId, manager, playerId: num(message.targetId), player, bidAmount };
      });
      const managersInvolved = [...new Set(moves.map((move) => move.manager).filter(Boolean))];
      activities.push({ id: `${year}-${topic.id ?? index}-add-drop`, kind: "add-drop", season: year, week, date, managersInvolved, moves });
    }
    return activities;
  });
}

function applyManagerCorrections(year, teams, managers) {
  if (year !== 2025) return;
  const correctedTeam = teams.find((team) => team.managerId === managerOverrides.alexKlang && team.teamName === "Illegal Motion");
  if (!correctedTeam) return;
  correctedTeam.managerId = managerOverrides.andresPalacio;
  if (!managers.has(managerOverrides.andresPalacio)) {
    managers.set(managerOverrides.andresPalacio, { id: managerOverrides.andresPalacio, displayName: "Andres palacio" });
  }
}

function parseRecapPlayer(line) {
  const match = line.match(/^(.+)\s+([A-Za-z]{2,4}),\s*([A-Za-z/]+)$/);
  if (!match) return { playerName: line };
  return { playerName: match[1].trim(), proTeam: match[2].trim(), position: match[3].trim() };
}

function applyDraftRecap(picks, year) {
  const file = path.join(recapDir, `moggate_${year}_draft_recap.txt`);
  if (!fs.existsSync(file)) return;
  const teamsPerRound = Math.max(...picks.map((pick) => pick.roundPick ?? 0), 0) || 14;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const recap = new Map();
  let round = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const roundMatch = lines[index].match(/^Round\s+(\d+)$/i);
    if (roundMatch) {
      round = Number(roundMatch[1]);
      continue;
    }
    if (!round || !/^\d+$/.test(lines[index])) continue;
    const roundPick = Number(lines[index]);
    const playerLine = lines[index + 1];
    const teamLine = lines[index + 2];
    if (!playerLine || !teamLine || /^Player$/i.test(playerLine) || /^Team$/i.test(teamLine)) continue;
    const overall = (round - 1) * teamsPerRound + roundPick;
    recap.set(overall, parseRecapPlayer(playerLine));
    index += 2;
  }
  for (const pick of picks) {
    const recapPick = recap.get(pick.overall);
    if (recapPick) Object.assign(pick, recapPick);
  }
}

const seasons = years.map(loadSeason);
const managers = new Map();
for (const season of seasons) for (const manager of season.managers) managers.set(manager.id, manager);
const managerName = (id) => managers.get(id)?.displayName || id || "Owner unavailable";
const active2026 = new Set(seasons.find((season) => season.year === currentYear)?.teams.map((team) => team.managerId) ?? []);
const yearLabels = new Map();
for (const [id] of managers) {
  const labels = seasons.flatMap((season) => {
    const team = season.teams.find((item) => item.managerId === id);
    if (!team) return [];
    const lastPlace = season.teams.filter((item) => item.finalPlacement !== undefined && item.finalPlacement > 0).sort((a, b) => (b.finalPlacement ?? 0) - (a.finalPlacement ?? 0))[0];
    const marker = team.finalPlacement === 1 ? " 🏆" : team.teamId === lastPlace?.teamId ? " 💩" : "";
    return [`${season.year}${marker}`];
  });
  yearLabels.set(id, labels.join(", ") || "-");
}

function careerRows() {
  return [...managers.values()].map((manager) => {
    const rows = seasons.flatMap((season) => season.teams.filter((team) => team.managerId === manager.id));
    const wins = rows.reduce((sum, row) => sum + row.wins, 0);
    const losses = rows.reduce((sum, row) => sum + row.losses, 0);
    const ties = rows.reduce((sum, row) => sum + row.ties, 0);
    const playoffGames = seasons.flatMap((season) => season.matchups).filter((game) => game.completed && countsTowardPlayoffRecord(game) && (game.homeManagerId === manager.id || game.awayManagerId === manager.id));
    const playoffWins = playoffGames.filter((game) => game.winnerManagerId === manager.id).length;
    const playoffLosses = playoffGames.filter((game) => game.loserManagerId === manager.id).length;
    const playoffTies = playoffGames.length - playoffWins - playoffLosses;
    const playoffAppearances = rows.filter((row) => {
      const season = seasons.find((item) => item.year === row.season);
      return row.finalPlacement && season?.playoffTeamCount && row.finalPlacement <= season.playoffTeamCount;
    }).length;
    const finishes = rows.map((row) => row.finalPlacement).filter((value) => value);
    return {
      manager,
      seasons: rows.length,
      wins,
      losses,
      ties,
      winPct: wins + losses + ties ? (wins + ties * 0.5) / (wins + losses + ties) : 0,
      pointsFor: rows.reduce((sum, row) => sum + row.pointsFor, 0),
      championships: rows.filter((row) => row.finalPlacement === 1).length,
      topThreeFinishes: rows.filter((row) => row.finalPlacement && row.finalPlacement <= 3).length,
      playoffAppearances,
      playoffWins,
      playoffLosses,
      playoffTies,
      averageFinish: finishes.length ? finishes.reduce((sum, value) => sum + value, 0) / finishes.length : undefined
    };
  }).filter((row) => row.seasons).sort((a, b) => b.winPct - a.winPct || a.manager.displayName.localeCompare(b.manager.displayName));
}

function countsTowardPlayoffRecord(game) {
  return game.playoffTier === "WINNERS_BRACKET";
}

function headToHead() {
  const map = new Map();
  for (const game of seasons.flatMap((season) => season.matchups).filter((game) => game.completed && game.homeManagerId && game.awayManagerId)) {
    const ids = [game.homeManagerId, game.awayManagerId].sort();
    const key = ids.join("|");
    const row = map.get(key) ?? { a: ids[0], b: ids[1], winsA: 0, winsB: 0, games: 0, pointsA: 0, pointsB: 0, closest: undefined, largest: undefined };
    const aHome = game.homeManagerId === row.a;
    row.games += 1;
    row.pointsA += aHome ? game.homeScore : game.awayScore;
    row.pointsB += aHome ? game.awayScore : game.homeScore;
    if (game.winnerManagerId === row.a) row.winsA += 1;
    if (game.winnerManagerId === row.b) row.winsB += 1;
    row.closest = row.closest === undefined ? game.margin : Math.min(row.closest, game.margin);
    row.largest = row.largest === undefined ? game.margin : Math.max(row.largest, game.margin);
    map.set(key, row);
  }
  return [...map.values()];
}

function tradeImpacts(rosterMoves, season) {
  const weeklyScores = arr(season.weeklyPlayerScores).filter((score) => score.playerId && score.managerId);
  return rosterMoves
    .flatMap((activity) => activity.moves
      .map((move, moveIndex) => {
        const targetManager = move.action === "traded" ? move.toManagerId : move.action === "Added" ? move.managerId : undefined;
        const rows = activity.week
          ? weeklyScores.filter((score) => score.playerId === move.playerId && score.managerId === targetManager && score.week > activity.week)
          : [];
        return {
          activityId: activity.id,
          moveIndex,
          action: move.action,
          playerId: move.playerId,
          player: move.player,
          toManager: move.toManager,
          manager: move.manager,
          date: activity.date,
          weeksTracked: rows.length,
          pointsAfterMove: rows.reduce((sum, row) => sum + row.points, 0),
          projectedOnly: rows.length > 0 && rows.every((row) => row.projected)
        };
      }))
}

const careers = careerRows();
const h2h = headToHead();

function championBannerHtml() {
  const championBanners = seasons
    .filter((season) => season.status === "complete")
    .slice()
    .sort((a, b) => a.year - b.year)
    .flatMap((season) => {
      const champion = season.teams.find((team) => team.finalPlacement === 1);
      return champion ? [{ season: season.year, champion }] : [];
    });
  if (!championBanners.length) return "";
  return `<section class="champion-banners" aria-label="Previous winners">${championBanners.map(({ season, champion }, index) => `<div class="champion-banner ${index === championBanners.length - 1 ? "latest" : ""}" style="animation-delay:${index * -0.45}s"><span>Moggate</span><span class="banner-year">${season}</span><strong>${esc(managerName(champion.managerId))}</strong><small>${champion.wins}-${champion.losses}${champion.ties ? `-${champion.ties}` : ""}</small></div>`).join("")}</section>`;
}

function shell(title, active, content) {
  const nav = ["index:Home", "current-season:Current Season", "schedule:2026 Schedule", "trades:2026 Roster Moves", "divider:", "history:League History", "managers:Manager Stats", "records:Awards", "rivalries:Rivalries", "drafts:Drafts", "player-lookup:Player Lookup"].map((item, index) => {
    const [file, label] = item.split(":");
    if (file === "divider") return `<span class="nav-divider" aria-hidden="true"></span>`;
    return `<a class="${active === file ? "active" : ""}" href="${file}.html">${label}</a>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><script>document.documentElement.dataset.theme=localStorage.getItem('moggate-theme')==='dark'?'dark':'light';</script><style>${css()}${extraCss()}</style></head><body><div class="shell"><aside><a class="brand" href="index.html"><span>M</span><b>Moggate<small>League Archive</small></b></a><details class="nav" open><summary>Pages <span>v</span></summary><nav>${nav}</nav></details><button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch color mode">☾</button></aside><main>${championBannerHtml()}${content}</main></div><span class="site-version">v${esc(siteVersion)}</span>${themeScript()}</body></html>`;
}

function css() {
  return `:root{--bg:#f5f2ec;--panel:#fff;--ink:#17201d;--muted:#66736d;--line:#dcd6cb;--green:#1f6f52;--gold:#b98524;--red:#b84a3b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Arial,Helvetica,sans-serif}.shell{display:grid;grid-template-columns:220px 1fr;min-height:100vh}aside{position:sticky;top:0;height:100vh;padding:24px 18px;background:#fbfaf7;border-right:1px solid var(--line)}main{padding:34px}.brand{display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit;margin-bottom:22px}.brand span{display:grid;place-items:center;width:42px;height:42px;border-radius:8px;background:var(--green);color:#fff;font-weight:900}.brand small{display:block;color:var(--muted);font-weight:400}details.nav{border:1px solid var(--line);border-radius:8px;background:#fff;padding:8px}details.nav summary{display:flex;justify-content:space-between;cursor:pointer;color:var(--muted);font-size:12px;font-weight:900;text-transform:uppercase;padding:6px 4px 10px}nav{display:grid;gap:6px}nav a{padding:10px 12px;border-radius:8px;color:#34433d;text-decoration:none;font-weight:800}nav a.active,nav a:hover{background:#ece8df}.nav-divider{border-top:1px solid var(--line);display:block;margin:6px 4px}.site-version{position:fixed;right:12px;bottom:10px;z-index:20;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.9);color:var(--muted);font-size:11px;font-weight:900;line-height:1;padding:6px 8px}h1{font-size:clamp(34px,5vw,64px);line-height:.95;margin:6px 0 18px}h2{margin:0 0 14px}.card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:18px;box-shadow:0 18px 50px rgba(38,31,22,.08);margin:16px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.picker{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.picker button{border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);cursor:pointer;min-height:72px;padding:12px;text-align:left}.picker button.active,.picker button:hover{border-color:var(--green);background:#dfeee6}.picker button.inactive{background:#f7f5f0;border-style:dashed;opacity:.72}.picker button.inactive:hover,.picker button.inactive.active{background:#f5dfda;border-color:var(--red);opacity:1}.picker strong,.picker span{display:block}.picker span,.muted{color:var(--muted);font-size:12px;margin-top:5px}.top{display:flex;justify-content:space-between;align-items:center;gap:14px}.tag{display:inline-flex;border-radius:999px;padding:4px 9px;background:#ece8df;color:#4a564f;font-size:12px;font-weight:900}.tag.green{background:#dfeee6;color:var(--green)}.tag.red{background:#f5dfda;color:var(--red)}.tag.gold{background:#f4ead4;color:var(--gold)}.tag-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border-bottom:1px solid var(--line);padding:10px;text-align:center;vertical-align:top}th{font-size:12px;text-transform:uppercase;color:var(--muted)}td.right,th.right,td:nth-child(n+4),th:nth-child(n+4){text-align:center}th button{align-items:center;background:transparent;border:0;color:inherit;cursor:pointer;display:inline-flex;font:inherit;font-weight:900;gap:5px;justify-content:center;padding:0;text-transform:inherit}th button:after{content:"↓";color:transparent}th button:hover,th button.active{color:var(--green)}th button.active:after{color:currentColor}.cell-note{display:block;color:var(--muted);font-size:12px;margin-top:3px}.former-note{color:var(--red);font-weight:900}.panel{min-height:360px}.record b{display:block;font-size:30px;margin:6px 0}.seg{display:inline-flex;gap:4px;margin:8px 0 14px;padding:4px;border:1px solid var(--line);border-radius:8px}.seg button{border:0;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer;font-weight:900;padding:8px 12px}.seg button.active{background:var(--green);color:#fff}.roster-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.roster-player{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:10px}.roster-player strong,.roster-player span{display:block}.roster-player span{color:var(--muted);font-size:12px;margin-top:4px}@media(max-width:900px){.shell{grid-template-columns:1fr}aside{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}main{padding:22px}.grid,.picker,.roster-grid{grid-template-columns:1fr}.top{display:block}}`;
}

function extraCss() {
  return `:root[data-theme=dark]{--bg:#101512;--panel:#18201c;--ink:#f1f5ef;--muted:#a4b0aa;--line:#2d3933;--green:#5eb98c;--gold:#d5a64a;--red:#e17a6e}.theme-toggle{align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--ink);cursor:pointer;display:grid;font:inherit;font-size:22px;font-weight:900;height:42px;justify-content:center;margin-top:12px;padding:0;width:42px}.theme-toggle:hover{border-color:var(--green);color:var(--green)}:root[data-theme=dark] aside{background:#141b17}:root[data-theme=dark] details.nav,:root[data-theme=dark] .card,:root[data-theme=dark] .picker button,:root[data-theme=dark] .seg,:root[data-theme=dark] .select-field select,:root[data-theme=dark] .select-field input{background:var(--panel);color:var(--ink)}:root[data-theme=dark] nav a{color:var(--ink)}:root[data-theme=dark] nav a.active,:root[data-theme=dark] nav a:hover,:root[data-theme=dark] .picker button.active,:root[data-theme=dark] .picker button:hover{background:#203f31}:root[data-theme=dark] .picker button.inactive,:root[data-theme=dark] .member-tile,:root[data-theme=dark] .subsection{background:#141b17}:root[data-theme=dark] .tag{background:#26312c;color:var(--ink)}.champion-banners{display:flex;gap:18px;margin:-34px -34px 28px;padding:14px 24px 20px;overflow-x:auto}.champion-banner{position:relative;display:grid;align-content:start;gap:6px;width:138px;min-width:138px;height:188px;padding:24px 12px 42px;border:4px solid #16251f;border-top-width:5px;background:linear-gradient(180deg,#1f6f52 0%,#15543f 100%);clip-path:polygon(0 0,100% 0,100% 78%,50% 100%,0 78%);color:#fff;text-align:center;transform-origin:top center;animation:banner-sway 5.2s ease-in-out infinite;box-shadow:0 12px 28px rgba(38,31,22,.14)}.champion-banner.latest{width:158px;min-width:158px;height:212px;background:linear-gradient(180deg,#f1c95d 0%,#b98524 100%);color:#17201d;transform:translateY(8px)}.champion-banner:before{content:"";position:absolute;top:-13px;left:-10px;right:-10px;height:4px;border-radius:999px;background:#16251f}.champion-banner:after{content:"";position:absolute;inset:8px 8px 28px;border:1px solid rgba(255,255,255,.72);clip-path:polygon(0 0,100% 0,100% 79%,50% 100%,0 79%);pointer-events:none}.champion-banner span,.champion-banner small{font-size:12px;font-weight:900;text-transform:uppercase}.champion-banner strong{display:block;margin-top:2px;color:#f6dc8a;font-size:17px;line-height:1.05;text-transform:uppercase}.champion-banner.latest strong{color:#17201d;font-size:19px}.champion-banner .banner-year{color:#fff;font-size:34px;line-height:.9}.champion-banner.latest .banner-year{font-size:40px}.champion-banner small{color:#dfeee6}.champion-banner.latest small{color:#17201d}@keyframes banner-sway{0%,100%{transform:rotate(-1.6deg)}50%{transform:rotate(1.6deg)}}h3{margin:0}.cols-2{grid-template-columns:repeat(2,1fr)}.home-hero{align-items:start;display:grid;grid-template-columns:1fr minmax(280px,420px);gap:18px;margin-bottom:8px}.eyebrow{color:var(--green);font-size:12px;font-weight:900;text-transform:uppercase}.countdown-card{background:var(--green);border-radius:8px;color:#fff;padding:18px}.countdown-card p{margin:6px 0 14px;color:#dbe9e3}.countdown-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.countdown-grid span{background:rgba(255,255,255,.14);border-radius:8px;padding:10px;text-align:center}.countdown-grid b{display:block;font-size:24px}.countdown-grid small{font-size:11px;text-transform:uppercase}.mini-stats,.member-grid{display:grid;gap:10px}.mini-stats span{border-top:1px solid var(--line);padding-top:10px}.mini-stats b{display:block;font-size:28px}.mini-stats small,.member-tile span{color:var(--muted);display:block;font-size:12px}.member-grid{grid-template-columns:repeat(4,1fr)}.member-tile{border:1px solid var(--line);border-radius:8px;padding:12px}.link-card{color:inherit;text-decoration:none}.text-button{color:var(--green);font-weight:900;text-decoration:none}.row-between{display:flex;justify-content:space-between;align-items:center;gap:14px}.nested-sections{display:grid;gap:14px}.subsection{border:1px solid var(--line);border-radius:8px;padding:14px}.subsection-header{align-items:center;display:flex;justify-content:space-between;gap:12px}.subsection-header span{color:var(--muted);font-size:12px;font-weight:900}.select-field{display:grid;gap:6px;max-width:320px}.select-field span{color:var(--muted);font-size:12px;font-weight:900;text-transform:uppercase}.select-field select,.select-field input{background:#fff;border:1px solid var(--line);border-radius:8px;color:var(--ink);font:inherit;font-weight:800;padding:10px 12px}.current-standings .playoff-cutoff td{border-top:3px solid var(--gold)}.movement{display:inline-flex;justify-content:center;min-width:44px;border-radius:999px;padding:4px 8px;font-weight:900}.movement.up{background:#dfeee6;color:var(--green)}.movement.down{background:#f5dfda;color:var(--red)}.movement.even{background:rgba(102,115,109,.14);color:var(--muted)}@media(max-width:900px){.champion-banners{margin:-22px -22px 22px;padding-inline:16px}.home-hero,.member-grid,.cols-2{grid-template-columns:1fr}.row-between{display:block}}`;
}

function themeScript() {
  return `<script>function updateThemeButton(){const b=document.querySelector('[data-theme-toggle]');if(!b)return;const dark=document.documentElement.dataset.theme==='dark';b.textContent=dark?'☀':'☾';b.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode')}updateThemeButton();document.querySelector('[data-theme-toggle]')?.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;localStorage.setItem('moggate-theme',next);updateThemeButton();});</script>`;
}

function write(file, html) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, file), html);
}

function scriptPicker(defaultSort = "") {
  return `<script>document.querySelectorAll('.picker button').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.id;document.querySelectorAll('.picker button').forEach(b=>b.classList.toggle('active',b===btn));document.querySelectorAll('[data-panel]').forEach(p=>p.style.display=p.dataset.panel===id?'block':'none');}));${defaultSort}</script>`;
}

function teamWinPct(team) {
  const games = team.wins + team.losses + team.ties;
  return games ? (team.wins + team.ties * 0.5) / games : 0;
}

function sortStandings(rows) {
  return rows.slice().sort((a, b) => teamWinPct(b) - teamWinPct(a) || b.wins - a.wins || b.pointsFor - a.pointsFor || a.teamName.localeCompare(b.teamName));
}

function standingsThroughWeek(season, week) {
  const rows = new Map(season.teams.map((team) => [team.managerId, { ...team, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 }]));
  for (const matchup of season.matchups) {
    if (!matchup.completed || matchup.week > week || !matchup.homeManagerId || !matchup.awayManagerId || matchup.homeScore === undefined || matchup.awayScore === undefined) continue;
    const home = rows.get(matchup.homeManagerId);
    const away = rows.get(matchup.awayManagerId);
    if (!home || !away) continue;
    home.pointsFor += matchup.homeScore;
    home.pointsAgainst += matchup.awayScore;
    away.pointsFor += matchup.awayScore;
    away.pointsAgainst += matchup.homeScore;
    if (matchup.homeScore > matchup.awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else if (matchup.awayScore > matchup.homeScore) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.ties += 1;
      away.ties += 1;
    }
  }
  return sortStandings([...rows.values()]);
}

function movementHtml(movement) {
  if (movement > 0) return `<span class="movement up">↑ ${movement}</span>`;
  if (movement < 0) return `<span class="movement down">↓ ${Math.abs(movement)}</span>`;
  return `<span class="movement even">-</span>`;
}

function writeCurrentSeason() {
  const season = seasons.find((item) => item.year === currentYear);
  const latestCompletedWeek = Math.max(0, ...season.matchups.filter((matchup) => matchup.completed).map((matchup) => matchup.week));
  const previousRanks = latestCompletedWeek > 1
    ? new Map(standingsThroughWeek(season, latestCompletedWeek - 1).map((team, index) => [team.managerId, index + 1]))
    : new Map();
  const standings = sortStandings(season.teams).map((team, index) => {
    const rank = index + 1;
    const previousRank = previousRanks.get(team.managerId);
    return { ...team, rank, movement: previousRank ? previousRank - rank : 0 };
  });
  const currentStyle = `<style>.row-toggle{align-items:center;background:transparent;border:0;color:var(--ink);cursor:pointer;display:inline-flex;font:inherit;font-weight:900;gap:8px;padding:0;text-align:left}.row-toggle span{color:var(--muted);display:inline-block;transition:transform 160ms ease}.row-toggle.open span{transform:rotate(180deg)}.manager-detail-row td{background:var(--bg);padding:16px}</style>`;
  const rows = standings.map((team) => {
    const roster = arr(season.finalRosters).filter((player) => player.teamId === team.teamId);
    const rosterHtml = roster.length
      ? `<div class="roster-grid">${roster.map((player) => `<div class="roster-player"><strong>${esc(player.playerName)}</strong><span>${esc(currentRosterPosition(player))}</span></div>`).join("")}</div>`
      : `<p class="muted">No live roster snapshot found in this ESPN export.</p>`;
    const teamCell = roster.length
      ? `<button class="row-toggle" type="button" data-current-roster="${team.teamId}" aria-expanded="false"><span>▾</span><strong>${esc(team.teamName)}</strong></button>`
      : `<strong>${esc(team.teamName)}</strong>`;
    const detailRow = roster.length ? `<tr class="manager-detail-row" data-current-roster-panel="${team.teamId}" style="display:none"><td colspan="6">${rosterHtml}</td></tr>` : "";
    return `<tr class="${team.rank === 9 ? "playoff-cutoff" : ""}"><td>${team.rank}</td><td>${movementHtml(team.movement)}</td><td>${teamCell}<span class="cell-note">${esc(managerName(team.managerId))}</span></td><td>${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}</td><td>${fmt(team.pointsFor)}</td><td>${fmt(team.pointsAgainst)}</td></tr>${detailRow}`;
  }).join("");
  const rosterScript = `<script>document.querySelectorAll('[data-current-roster]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.currentRoster;const panel=document.querySelector('[data-current-roster-panel="'+id+'"]');const open=panel&&panel.style.display!=='none';document.querySelectorAll('[data-current-roster-panel]').forEach(row=>row.style.display='none');document.querySelectorAll('[data-current-roster]').forEach(item=>{item.classList.remove('open');item.setAttribute('aria-expanded','false')});if(panel&&!open){panel.style.display='table-row';btn.classList.add('open');btn.setAttribute('aria-expanded','true')}}));</script>`;
  write("current-season.html", shell("Moggate Current Season", "current-season", `${currentStyle}<header class="top"><div><span class="tag green">2026</span><h1>Current Season</h1></div><span class="tag gold">${latestCompletedWeek ? `Through Week ${latestCompletedWeek}` : "Preseason"}</span></header><section class="card"><table class="current-standings"><thead><tr><th>Rank</th><th>Weekly Move</th><th>Team</th><th>Record</th><th>PF (Tiebreaker)</th><th>PA</th></tr></thead><tbody>${rows}</tbody></table></section>${rosterScript}`));
}

function writeHome() {
  const completed = seasons.filter((season) => season.status === "complete").sort((a, b) => b.year - a.year);
  const previous = completed[0];
  const winner = previous?.teams.find((team) => team.finalPlacement === 1);
  const loser = previous?.teams.filter((team) => team.finalPlacement !== undefined).reduce((last, team) => !last || (team.finalPlacement ?? 0) > (last.finalPlacement ?? 0) ? team : last, undefined);
  const currentSeason = seasons.find((season) => season.year === currentYear);
  const active = currentSeason?.teams ?? [];
  const teamById = new Map(active.map((team) => [team.teamId, team]));
  const draftOrder = arr(currentSeason?.draftPicks)
    .filter((pick) => pick.overall && pick.teamId)
    .sort((a, b) => (a.overall ?? 999) - (b.overall ?? 999))
    .reduce((rows, pick) => {
      if (!pick.teamId || rows.some((row) => row.teamId === pick.teamId)) return rows;
      const team = teamById.get(pick.teamId);
      rows.push({
        slot: pick.overall ?? rows.length + 1,
        teamId: pick.teamId,
        managerName: team ? managerName(team.managerId) : "Owner unavailable",
        teamName: team?.teamName ?? `Team ${pick.teamId}`
      });
      return rows;
    }, []);
  const latestCompletedWeek = Math.max(0, ...arr(currentSeason?.matchups).filter((matchup) => matchup.completed).map((matchup) => matchup.week));
  const currentWeek = latestCompletedWeek || Math.min(...arr(currentSeason?.matchups).map((matchup) => matchup.week).filter((week) => week > 0));
  const weeklyMatchups = arr(currentSeason?.matchups).filter((matchup) => matchup.week === currentWeek && matchup.homeTeamId && matchup.awayTeamId);
  const rivalryRecord = (homeManagerId, awayManagerId) => {
    if (!homeManagerId || !awayManagerId) return "No history";
    const record = h2h.find((item) => (item.a === homeManagerId && item.b === awayManagerId) || (item.a === awayManagerId && item.b === homeManagerId));
    if (!record) return "0-0";
    return record.a === homeManagerId ? `${record.winsA}-${record.winsB}` : `${record.winsB}-${record.winsA}`;
  };
  const weeklyScheduleHtml = weeklyMatchups.map((matchup) => {
    const home = teamById.get(matchup.homeTeamId);
    const away = teamById.get(matchup.awayTeamId);
    return `<div class="schedule-matchup"><div><strong>${esc(home?.teamName ?? "Home Team")}</strong><span>${esc(managerName(home?.managerId))}</span></div><div class="matchup-score"><b>${fmt(matchup.homeScore ?? 0)} - ${fmt(matchup.awayScore ?? 0)}</b><span>Rivalry: ${esc(rivalryRecord(home?.managerId, away?.managerId))}</span></div><div><strong>${esc(away?.teamName ?? "Away Team")}</strong><span>${esc(managerName(away?.managerId))}</span></div></div>`;
  }).join("");
  const completedMatchups = seasons.flatMap((season) => season.matchups).filter((game) => game.completed).length;
  const draftOrderHtml = draftOrder.map((row) => `<div class="draft-order-tile"><b>${row.slot}</b><strong>${esc(row.managerName)}</strong><span>${esc(row.teamName)}</span></div>`).join("");
  const homeStyle = `<style>.stacked-spotlight{display:grid;gap:18px}.stacked-spotlight>div+div{border-top:1px solid var(--line);padding-top:18px}.rule-list{color:var(--muted);line-height:1.45;margin:12px 0 0;padding-left:18px}.rule-list li+li{margin-top:8px}.draft-order-grid{display:grid;gap:10px;grid-template-columns:repeat(7,minmax(0,1fr));margin-top:14px}.draft-order-tile{background:#fbfaf7;border:1px solid var(--line);border-radius:8px;display:grid;gap:5px;min-height:112px;padding:12px;text-align:center}.draft-order-tile b{align-items:center;background:var(--green);border-radius:999px;color:#fff;display:inline-flex;height:32px;justify-content:center;justify-self:center;width:32px}.draft-order-tile strong{font-size:14px;line-height:1.15}.draft-order-tile span{color:var(--muted);font-size:12px;line-height:1.2}:root[data-theme=dark] .draft-order-tile{background:#141b17}.schedule-list{display:grid;gap:10px;margin-top:14px}.schedule-matchup{align-items:center;border:1px solid var(--line);border-radius:8px;display:grid;gap:12px;grid-template-columns:1fr auto 1fr;padding:12px}.schedule-matchup>div:last-child{text-align:right}.schedule-matchup span,.matchup-score span{color:var(--muted);display:block;font-size:12px;margin-top:3px}.matchup-score{min-width:150px;text-align:center}.matchup-score b{font-size:18px}@media(max-width:900px){.draft-order-grid,.schedule-matchup{grid-template-columns:1fr}.schedule-matchup>div,.schedule-matchup>div:last-child,.matchup-score{text-align:left}}</style>`;
  const homeScript = `<script>const target=new Date('2026-08-31T19:00:00-04:00').getTime();function tick(){const left=Math.max(0,target-Date.now());const d=Math.floor(left/86400000),h=Math.floor(left%86400000/3600000),m=Math.floor(left%3600000/60000),s=Math.floor(left%60000/1000);document.querySelector('[data-days]').textContent=d;document.querySelector('[data-hours]').textContent=h;document.querySelector('[data-minutes]').textContent=m;document.querySelector('[data-seconds]').textContent=s}tick();setInterval(tick,1000);</script>`;
  write("index.html", shell("Moggate Home", "index", `${homeStyle}<header class="home-hero"><div><h1>Moggate 2026</h1></div><div class="countdown-card"><strong>Draft countdown</strong><p>Aug 31, 2026 at 7 PM ET</p><div class="countdown-grid"><span><b data-days>0</b><small>Days</small></span><span><b data-hours>0</b><small>Hours</small></span><span><b data-minutes>0</b><small>Minutes</small></span><span><b data-seconds>0</b><small>Seconds</small></span></div></div></header><section class="grid"><article class="card"><div class="stacked-spotlight"><div><span class="tag gold">Previous winner</span><h2>${esc(winner?.teamName ?? "Unavailable")}</h2><p>${esc(winner ? `${managerName(winner.managerId)} won ${previous?.year}.` : "Unavailable")}</p>${winner ? `<strong>${winner.wins}-${winner.losses}${winner.ties ? `-${winner.ties}` : ""} - ${fmt(winner.pointsFor)} PF</strong>` : ""}</div><div><span class="tag red">Previous loser</span><h2>${esc(loser?.teamName ?? "Unavailable")}</h2><p>${esc(loser ? `${managerName(loser.managerId)} finished ${loser.finalPlacement ?? "last"} in ${previous?.year}.` : "Unavailable")}</p>${loser ? `<strong>${loser.wins}-${loser.losses}${loser.ties ? `-${loser.ties}` : ""} - ${fmt(loser.pointsFor)} PF</strong>` : ""}</div></div></article><article class="card"><span class="tag green">2026</span><h2>Rule Changes</h2><ul class="rule-list"><li>FAAB bidding for waivers</li><li>Bench spot -1</li></ul></article><article class="card"><h2>Archive Status</h2><div class="mini-stats"><span><b>${completed.length}</b><small>Completed seasons</small></span><span><b>0</b><small>Backfill years</small></span><span><b>${completedMatchups}</b><small>Scored matchups</small></span></div></article></section><section class="card"><div class="row-between"><h2>2026 Draft Order</h2><a class="text-button" href="drafts.html">Drafts</a></div><div class="draft-order-grid">${draftOrderHtml || `<p class="muted">No 2026 draft order found.</p>`}</div></section><section class="card"><div class="row-between"><h2>Week ${currentWeek} Schedule</h2><a class="text-button" href="current-season.html">Current season</a></div><div class="schedule-list">${weeklyScheduleHtml || `<p class="muted">No current week matchups found.</p>`}</div></section><section class="card"><div class="row-between"><h2>Active Members for 2026</h2><a class="text-button" href="managers.html">Manager history</a></div><div class="member-grid">${active.map((team) => `<div class="member-tile"><strong>${esc(managerName(team.managerId))}</strong><span>${esc(team.teamName)}</span></div>`).join("")}</div></section><section class="grid cols-2"><a class="card link-card" href="history.html"><h2>League History</h2></a><a class="card link-card" href="rivalries.html"><h2>Rivalries</h2></a></section>${homeScript}`));
}

function matchupRivalry(homeManagerId, awayManagerId) {
  if (!homeManagerId || !awayManagerId) return "No history";
  const record = h2h.find((item) => (item.a === homeManagerId && item.b === awayManagerId) || (item.a === awayManagerId && item.b === homeManagerId));
  if (!record) return "0-0";
  return record.a === homeManagerId ? `${record.winsA}-${record.winsB}` : `${record.winsB}-${record.winsA}`;
}

function writeSchedule() {
  const season = seasons.find((item) => item.year === currentYear);
  if (!season) {
    write("schedule.html", shell("Moggate 2026 Schedule", "schedule", `<h1>2026 Schedule</h1><section class="card"><p class="muted">No 2026 schedule export found.</p></section>`));
    return;
  }
  const weeks = [...new Set(season.matchups.map((matchup) => matchup.week).filter((week) => week > 0))].sort((a, b) => a - b);
  const teamById = new Map(season.teams.map((team) => [team.teamId, team]));
  const matchupInfoForTeam = (week, teamId) => {
    const matchup = season.matchups.find((item) => item.week === week && (item.homeTeamId === teamId || item.awayTeamId === teamId));
    if (!matchup) return { matchup: "-", opponent: "-", score: "-", rivalry: "-" };
    const opponent = teamById.get(matchup.homeTeamId === teamId ? matchup.awayTeamId : matchup.homeTeamId);
    const home = teamById.get(matchup.homeTeamId);
    const away = teamById.get(matchup.awayTeamId);
    const ownScore = matchup.homeTeamId === teamId ? matchup.homeScore : matchup.awayScore;
    const opponentScore = matchup.homeTeamId === teamId ? matchup.awayScore : matchup.homeScore;
    return {
      matchup: `${home?.teamName ?? "Home Team"} vs ${away?.teamName ?? "Away Team"}`,
      opponent: opponent ? `${opponent.teamName} (${managerName(opponent.managerId)})` : "-",
      score: `${fmt(ownScore ?? 0)} - ${fmt(opponentScore ?? 0)}`,
      rivalry: matchupRivalry(teamById.get(teamId)?.managerId, opponent?.managerId)
    };
  };
  const weekOptions = weeks.map((week) => `<option value="week-${week}">Week ${week}</option>`).join("");
  const panels = weeks.map((week, index) => {
    const matchups = season.matchups.filter((matchup) => matchup.week === week && matchup.homeTeamId && matchup.awayTeamId).sort((a, b) => a.id.localeCompare(b.id));
    const rows = matchups.map((matchup) => {
      const home = teamById.get(matchup.homeTeamId);
      const away = teamById.get(matchup.awayTeamId);
      return `<div class="schedule-matchup"><div><strong>${esc(home?.teamName ?? "Home Team")}</strong><span>${esc(managerName(home?.managerId))}</span></div><div class="matchup-score"><b>${fmt(matchup.homeScore ?? 0)} - ${fmt(matchup.awayScore ?? 0)}</b><span>Rivalry: ${esc(matchupRivalry(home?.managerId, away?.managerId))}</span></div><div><strong>${esc(away?.teamName ?? "Away Team")}</strong><span>${esc(managerName(away?.managerId))}</span></div></div>`;
    }).join("");
    return `<article class="card panel" data-panel="week-${week}" style="display:${index === 0 ? "block" : "none"}"><div class="row-between"><h2>Week ${week} Matchups</h2><span class="tag">${matchups.length} games</span></div><div class="schedule-list">${rows || `<p class="muted">No matchups found for this week.</p>`}</div></article>`;
  }).join("");
  const scheduleOptions = season.teams
    .slice()
    .sort((a, b) => managerName(a.managerId).localeCompare(managerName(b.managerId)))
    .map((team) => `<option value="${team.teamId}">${esc(managerName(team.managerId))} - ${esc(team.teamName)}</option>`)
    .join("");
  const lookupRows = season.teams.flatMap((team, teamIndex) => weeks.map((week) => {
    const matchup = matchupInfoForTeam(week, team.teamId);
    return `<tr data-team-schedule="${team.teamId}" style="display:${teamIndex === 0 ? "" : "none"}"><td>Week ${week}</td><td><strong>${esc(matchup.matchup)}</strong></td><td>${esc(matchup.opponent)}</td><td>${esc(matchup.score)}</td><td>${esc(matchup.rivalry)}</td></tr>`;
  })).join("");
  const scheduleStyle = `<style>.schedule-list{display:grid;gap:10px;margin-top:14px}.schedule-matchup{align-items:center;border:1px solid var(--line);border-radius:8px;display:grid;gap:12px;grid-template-columns:1fr auto 1fr;padding:12px}.schedule-matchup>div:last-child{text-align:right}.schedule-matchup span,.matchup-score span{color:var(--muted);display:block;font-size:12px;margin-top:3px}.matchup-score{min-width:150px;text-align:center}.matchup-score b{font-size:18px}.lookup-field{margin-top:12px}@media(max-width:900px){.schedule-matchup{grid-template-columns:1fr}.schedule-matchup>div,.schedule-matchup>div:last-child,.matchup-score{text-align:left}}</style>`;
  const lookup = `<section class="card"><div class="row-between"><h2>Schedule Lookup</h2><span class="tag">Full 2026 schedule</span></div><label class="select-field lookup-field"><span>Manager / Team</span><select data-schedule-team-select>${scheduleOptions}</select></label><table><thead><tr><th>Week</th><th>Matchup</th><th>Opponent</th><th>Score</th><th>Rivalry</th></tr></thead><tbody>${lookupRows}</tbody></table></section>`;
  const script = `<script>const weekSelect=document.querySelector('[data-schedule-week-select]');function showWeek(){const value=weekSelect?.value;document.querySelectorAll('[data-panel]').forEach(panel=>panel.style.display=panel.dataset.panel===value?'block':'none')}weekSelect?.addEventListener('change',showWeek);showWeek();const scheduleSelect=document.querySelector('[data-schedule-team-select]');function showFullSchedule(){const value=scheduleSelect?.value;document.querySelectorAll('[data-team-schedule]').forEach(row=>row.style.display=row.dataset.teamSchedule===value?'':'none')}scheduleSelect?.addEventListener('change',showFullSchedule);showFullSchedule();</script>`;
  write("schedule.html", shell("Moggate 2026 Schedule", "schedule", `${scheduleStyle}<header class="top"><div><span class="tag green">2026</span><h1>Schedule</h1></div><span class="tag gold">${weeks.length} weeks</span></header><section class="card"><label class="select-field"><span>Week</span><select data-schedule-week-select>${weekOptions}</select></label></section>${panels}${lookup}${script}`));
}

function writeHistory() {
  const buttons = seasons.map((season, i) => `<button class="${i === 0 ? "active" : ""}" data-id="${season.year}"><strong>${season.year}</strong><span>${season.teams.length} teams</span></button>`).join("");
  const panels = seasons.map((season, i) => {
    const lastPlace = season.teams.filter((team) => team.finalPlacement !== undefined && team.finalPlacement > 0).sort((a, b) => (b.finalPlacement ?? 0) - (a.finalPlacement ?? 0))[0];
    return `<article class="card panel" data-panel="${season.year}" style="display:${i === 0 ? "block" : "none"}"><div class="top"><h2>${season.year}</h2><span class="tag ${season.status === "preseason" ? "gold" : "green"}">${season.status}</span></div><table><thead><tr><th>Team</th><th>Record</th><th>PF</th><th>PA</th><th>Finish</th></tr></thead><tbody>${season.teams.slice().sort((a,b)=>(a.finalPlacement??99)-(b.finalPlacement??99)||b.wins-a.wins).map((team)=>`<tr><td>${esc(team.finalPlacement === 1 ? `${team.teamName} 🏆` : team.teamId === lastPlace?.teamId ? `${team.teamName} 💩` : team.teamName)}<span class="cell-note">${esc(managerName(team.managerId))}</span></td><td>${team.wins}-${team.losses}${team.ties?`-${team.ties}`:""}</td><td>${fmt(team.pointsFor)}</td><td>${fmt(team.pointsAgainst)}</td><td>${team.finalPlacement ?? "-"}</td></tr>`).join("")}</tbody></table></article>`;
  }).join("");
  write("history.html", shell("Moggate League History", "history", `<h1>League History</h1><section><div class="picker">${buttons}</div>${panels}</section>${scriptPicker()}`));
}

function writeHistoryWithRosters() {
  const historyStyle = `<style>.row-toggle{align-items:center;background:transparent;border:0;color:var(--ink);cursor:pointer;display:inline-flex;font:inherit;font-weight:900;gap:8px;padding:0;text-align:left}.row-toggle span{color:var(--muted);display:inline-block;transition:transform 160ms ease}.row-toggle.open span{transform:rotate(180deg)}.manager-detail-row td{background:var(--bg);padding:16px}.roster-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.roster-player{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:10px}.roster-player strong,.roster-player span{display:block}.roster-player span{color:var(--muted);font-size:12px;margin-top:4px}@media(max-width:900px){.roster-grid{grid-template-columns:1fr}}</style>`;
  const buttons = seasons.map((season, i) => `<button class="${i === 0 ? "active" : ""}" data-id="${season.year}"><strong>${season.year}</strong><span>${season.teams.length} teams</span></button>`).join("");
  const panels = seasons.map((season, i) => {
    const lastPlace = season.teams.filter((team) => team.finalPlacement !== undefined && team.finalPlacement > 0).sort((a, b) => (b.finalPlacement ?? 0) - (a.finalPlacement ?? 0))[0];
    const rows = season.teams.slice().sort((a,b)=>(a.finalPlacement??99)-(b.finalPlacement??99)||b.wins-a.wins).map((team) => {
      const roster = arr(season.finalRosters).filter((player) => player.teamId === team.teamId);
      const label = team.finalPlacement === 1 ? `${team.teamName} 🏆` : team.teamId === lastPlace?.teamId ? `${team.teamName} 💩` : team.teamName;
      const rosterHtml = roster.length
        ? `<div class="roster-grid">${roster.map((player) => `<div class="roster-player"><strong>${esc(player.playerName)}</strong><span>${esc(rosterPosition(player))}${player.acquisitionType ? ` - ${esc(player.acquisitionType)}` : ""}</span></div>`).join("")}</div>`
        : `<p class="muted">No final roster snapshot found in this ESPN export.</p>`;
      return `<tr><td><button class="row-toggle" type="button" data-history-roster="${season.year}-${team.teamId}" aria-expanded="false"><span>▾</span><strong>${esc(label)}</strong></button><span class="cell-note">${esc(managerName(team.managerId))}</span></td><td>${team.wins}-${team.losses}${team.ties?`-${team.ties}`:""}</td><td>${fmt(team.pointsFor)}</td><td>${fmt(team.pointsAgainst)}</td><td>${team.finalPlacement ?? "-"}</td></tr><tr class="manager-detail-row" data-history-roster-panel="${season.year}-${team.teamId}" style="display:none"><td colspan="5">${rosterHtml}</td></tr>`;
    }).join("");
    return `<article class="card panel" data-panel="${season.year}" style="display:${i === 0 ? "block" : "none"}"><div class="top"><h2>${season.year}</h2><span class="tag ${season.status === "preseason" ? "gold" : "green"}">${season.status}</span></div><table><thead><tr><th>Team</th><th>Record</th><th>PF</th><th>PA</th><th>Finish</th></tr></thead><tbody>${rows}</tbody></table></article>`;
  }).join("");
  const rosterScript = `document.querySelectorAll('[data-history-roster]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.historyRoster;const panel=document.querySelector('[data-history-roster-panel="'+id+'"]');const open=panel&&panel.style.display!=='none';document.querySelectorAll('[data-history-roster-panel]').forEach(row=>row.style.display='none');document.querySelectorAll('[data-history-roster]').forEach(item=>{item.classList.remove('open');item.setAttribute('aria-expanded','false')});if(panel&&!open){panel.style.display='table-row';btn.classList.add('open');btn.setAttribute('aria-expanded','true')}}));`;
  write("history.html", shell("Moggate League History", "history", `${historyStyle}<h1>League History</h1><section><div class="picker">${buttons}</div>${panels}</section>${scriptPicker(rosterScript)}`));
}

function writeManagersWithCharts() {
  const rows = careers.map((row) => `<tr><td>${esc(row.manager.displayName)}</td><td><span class="tag ${active2026.has(row.manager.id) ? "green" : "red"}">${esc(yearLabels.get(row.manager.id))}</span></td><td>${row.seasons}</td><td>${row.wins}-${row.losses}${row.ties?`-${row.ties}`:""}</td><td>${pct(row.winPct)}</td><td>${row.championships}</td><td>${row.averageFinish?.toFixed(1) ?? "-"}</td><td>${fmt(row.pointsFor)}</td></tr>`).join("");
  const script = `<script>const table=document.querySelector('table'),body=table.querySelector('tbody');let key='winPct',dir='desc';function value(r,k){const c=r.children;if(k==='seasons')return+c[2].textContent||0;if(k==='wins')return +(c[3].textContent.match(/^\\d+/)||['0'])[0];if(k==='winPct')return +c[4].textContent.replace('.','0.')||0;if(k==='titles')return+c[5].textContent||0;if(k==='avg')return+c[6].textContent||-Infinity;if(k==='pf')return+c[7].textContent.replace(/,/g,'')||0;return 0}function sortRows(k,init=false){if(!init){dir=k===key&&dir==='desc'?'asc':'desc';key=k}else key=k;document.querySelectorAll('th button').forEach(b=>{b.classList.toggle('active',b.dataset.sort===key);const base=b.dataset.label||b.textContent.replace(/\\s*[↑↓]$/,'');b.dataset.label=base;b.textContent=b.dataset.sort===key?base+' '+(dir==='desc'?'↓':'↑'):base});[...body.rows].sort((a,b)=>{const diff=value(b,key)-value(a,key);return (dir==='desc'?diff:-diff)||a.cells[0].textContent.localeCompare(b.cells[0].textContent)}).forEach(r=>body.appendChild(r))}document.querySelectorAll('th button').forEach(b=>b.addEventListener('click',()=>sortRows(b.dataset.sort)));sortRows('winPct',true);</script>`;
  write("managers.html", shell("Moggate Manager Stats", "managers", `<h1>Manager Stats</h1><section class="card"><table><thead><tr><th>Manager</th><th>Years Active</th><th><button data-sort="seasons">Seasons</button></th><th><button data-sort="wins">Record</button></th><th><button class="active" data-sort="winPct">Win %</button></th><th><button data-sort="titles">Titles</button></th><th><button data-sort="avg">Avg Finish</button></th><th><button data-sort="pf">PF</button></th></tr></thead><tbody>${rows}</tbody></table></section>${script}`));
}

function writeRivalries() {
  const sections = careers.map((career) => {
    const rows = h2h.filter((row) => row.a === career.manager.id || row.b === career.manager.id).map((row) => {
      const isA = row.a === career.manager.id;
      const opp = isA ? row.b : row.a;
      return { opp, wins: isA ? row.winsA : row.winsB, losses: isA ? row.winsB : row.winsA, games: row.games, pf: isA ? row.pointsA : row.pointsB, pa: isA ? row.pointsB : row.pointsA, closest: row.closest, largest: row.largest };
    });
    return { manager: career.manager, isActive: active2026.has(career.manager.id), rows };
  }).sort((a,b)=>Number(b.isActive)-Number(a.isActive)||a.manager.displayName.localeCompare(b.manager.displayName));
  const buttons = sections.map((section, i) => `<button class="${i===0?"active":""} ${section.isActive?"":"inactive"}" data-id="${esc(section.manager.id)}"><strong>${esc(section.manager.displayName)}</strong><span>${esc(yearLabels.get(section.manager.id))}</span></button>`).join("");
  const panels = sections.map((section, i) => `<article class="card panel" data-panel="${esc(section.manager.id)}" style="display:${i===0?"block":"none"}"><div class="top"><h2>${esc(section.manager.displayName)}</h2><div class="tag-row"><span class="tag ${section.isActive?"green":"red"}">${esc(yearLabels.get(section.manager.id))}</span><span class="tag">${section.rows.length} opponents</span></div></div><table><thead><tr><th>Opponent</th><th><button class="active" data-sort="wins">Record</button></th><th><button data-sort="games">Games</button></th><th><button data-sort="points">Points</button></th><th><button data-sort="closest">Closest</button></th><th><button data-sort="largest">Largest</button></th></tr></thead><tbody>${section.rows.sort((a,b)=>b.wins-a.wins||b.games-a.games).map((row)=>`<tr><td>${esc(managerName(row.opp))}</td><td>${row.wins}-${row.losses}</td><td>${row.games}</td><td>${fmt(row.pf)}-${fmt(row.pa)}</td><td>${fmt(row.closest)}</td><td>${fmt(row.largest)}</td></tr>`).join("")}</tbody></table></article>`).join("");
  const sortScript = `function v(r,k){const c=r.children;if(k==='wins')return +(c[1].textContent.match(/^\\d+/)||['0'])[0];if(k==='games')return+c[2].textContent||0;if(k==='points')return +(c[3].textContent.split('-')[0]||'0').replace(/,/g,'')||0;if(k==='closest')return+c[4].textContent||-Infinity;if(k==='largest')return+c[5].textContent||-Infinity;return 0}document.querySelectorAll('[data-panel]').forEach(p=>{let key='wins',dir='desc';function s(k,init=false){if(!init){dir=k===key&&dir==='desc'?'asc':'desc';key=k}else key=k;p.querySelectorAll('th button').forEach(b=>{b.classList.toggle('active',b.dataset.sort===key);const base=b.dataset.label||b.textContent.replace(/\\s*[↑↓]$/,'');b.dataset.label=base;b.textContent=b.dataset.sort===key?base+' '+(dir==='desc'?'↓':'↑'):base});const body=p.querySelector('tbody');[...body.rows].sort((a,b)=>{const diff=v(b,key)-v(a,key);return (dir==='desc'?diff:-diff)||a.cells[0].textContent.localeCompare(b.cells[0].textContent)}).forEach(r=>body.appendChild(r))}p.querySelectorAll('th button').forEach(b=>b.addEventListener('click',()=>s(b.dataset.sort)));s('wins',true)});`;
  write("rivalries.html", shell("Moggate Rivalries", "rivalries", `<header class="top"><div><span class="tag green">Head to head</span><h1>Rivalries</h1></div></header><section><div class="picker">${buttons}</div>${panels}</section>${scriptPicker(sortScript)}`));
}

function writeRecords() {
  const teamRows = seasons.flatMap((season) => season.teams);
  const games = seasons.flatMap((season) => season.matchups).filter((game) => game.completed && game.homeManagerId && game.awayManagerId);
  const scores = games.flatMap((game) => [{ managerId: game.homeManagerId, score: game.homeScore, season: game.season, week: game.week }, { managerId: game.awayManagerId, score: game.awayScore, season: game.season, week: game.week }]);
  const bestRecord = teamRows.slice().sort((a,b)=>(b.wins/(b.wins+b.losses+b.ties||1))-(a.wins/(a.wins+a.losses+a.ties||1))||b.wins-a.wins)[0];
  const highSeason = teamRows.slice().sort((a,b)=>b.pointsFor-a.pointsFor)[0];
  const playoffs = new Map();
  teamRows.filter((team)=>{
    const season = seasons.find((item) => item.year === team.season);
    return team.finalPlacement && season?.playoffTeamCount && team.finalPlacement <= season.playoffTeamCount;
  }).forEach((team)=>playoffs.set(team.managerId,(playoffs.get(team.managerId)||0)+1));
  const mostPlayoffs = [...playoffs.entries()].sort((a,b)=>b[1]-a[1])[0];
  const highWeek = scores.slice().sort((a,b)=>b.score-a.score)[0];
  const lowWeek = scores.filter((s)=>s.score>0).sort((a,b)=>a.score-b.score)[0];
  const blowout = games.slice().sort((a,b)=>b.margin-a.margin)[0];
  const closest = games.slice().sort((a,b)=>a.margin-b.margin)[0];
  const records = [
    ["Best Regular-Season Record", `${bestRecord.wins}-${bestRecord.losses}`, `${managerName(bestRecord.managerId)}, ${bestRecord.season}`],
    ["Highest Scoring Season", fmt(highSeason.pointsFor), `${managerName(highSeason.managerId)}, ${highSeason.season}`],
    ["Most Playoff Appearances", mostPlayoffs?.[1] ?? 0, managerName(mostPlayoffs?.[0])],
    ["Highest Single-Week Score", fmt(highWeek.score), `${managerName(highWeek.managerId)}, Week ${highWeek.week}, ${highWeek.season}`],
    ["Biggest Blowout", `${fmt(blowout.margin)} pts`, `${managerName(blowout.winnerManagerId)}, Week ${blowout.week}, ${blowout.season}`],
    ["Closest Matchup", `${fmt(closest.margin)} pts`, `${managerName(closest.homeManagerId)} vs ${managerName(closest.awayManagerId)}, Week ${closest.week}, ${closest.season}`],
    ["Lowest Single-Week Score", fmt(lowWeek.score), `${managerName(lowWeek.managerId)}, Week ${lowWeek.week}, ${lowWeek.season}`]
  ];
  write("records.html", shell("Moggate Awards", "records", `<h1>Awards</h1><section class="grid">${records.map(([label,value,detail])=>`<article class="card record"><span class="muted">${esc(label)}</span><b>${esc(value)}</b><small>${esc(detail)}</small></article>`).join("")}</section>`));
}

function writeDrafts() {
  const buttons = seasons.map((season, i)=>`<button class="${i===0?"active":""}" data-id="${season.year}"><strong>${season.year}</strong><span>${season.draftPicks.length} picks</span></button>`).join("");
  const table = (picks) => `<table><thead><tr><th>Pick</th><th>Round</th><th>Player</th><th>Position</th><th>Manager</th></tr></thead><tbody>${picks.map((pick)=>`<tr><td>${pick.overall ?? "-"}</td><td>${pick.round ?? "-"}${pick.roundPick ? `.${pick.roundPick}` : ""}</td><td><strong>${esc(pick.playerName)}</strong>${pick.position ? `<span class="cell-note">${esc([pick.proTeam, pick.position].filter(Boolean).join(", "))}</span>` : ""}</td><td>${esc(pick.position ?? "-")}</td><td>${esc(managerName(pick.managerId))}</td></tr>`).join("")}</tbody></table>`;
  const grouped = (picks, keyFn) => {
    const groups = new Map();
    for (const pick of picks) {
      const key = keyFn(pick);
      groups.set(key, [...(groups.get(key) ?? []), pick]);
    }
    return groups;
  };
  const panels = seasons.map((season,i)=>{
    const picks = season.draftPicks.slice().sort((a,b)=>(a.overall??999)-(b.overall??999));
    const roundSections = [...grouped(picks, (pick) => pick.round ?? 0).entries()].sort(([a],[b]) => a - b).map(([round, roundPicks]) => `<section class="subsection"><div class="subsection-header"><h3>${round ? `Round ${round}` : "Unassigned Round"}</h3><span>${roundPicks.length} picks</span></div>${table(roundPicks)}</section>`).join("");
    const teamGroups = [...grouped(picks, (pick) => managerName(pick.managerId)).entries()].sort(([a],[b]) => a.localeCompare(b));
    const teamOptions = teamGroups.map(([name, managerPicks]) => `<option value="${esc(name)}">${esc(name)} (${managerPicks.length} picks)</option>`).join("");
    const teamSections = teamGroups.map(([name, managerPicks], index) => `<section class="subsection" data-team-section="${esc(name)}" style="display:${index===0?"block":"none"}"><div class="subsection-header"><h3>${esc(name)}</h3><span>${managerPicks.length} picks</span></div>${table(managerPicks)}</section>`).join("");
    return `<article class="card panel" data-panel="${season.year}" data-draft-panel style="display:${i===0?"block":"none"}"><div class="top"><div><h2>${season.year} Draft</h2><span class="tag gold">${season.status}</span></div><span class="tag">${season.draftPicks.length} picks</span></div><div class="seg"><button class="active" data-mode="round" type="button">By Round</button><button data-mode="team" type="button">By Team</button></div><div class="nested-sections" data-draft-view="round">${roundSections}</div><div class="nested-sections" data-draft-view="team" style="display:none"><label class="select-field"><span>Team</span><select data-team-select>${teamOptions}</select></label>${teamSections}</div></article>`;
  }).join("");
  const draftScript = `document.querySelectorAll('[data-draft-panel]').forEach(panel=>{function showTeam(name){panel.querySelectorAll('[data-team-section]').forEach(section=>section.style.display=section.dataset.teamSection===name?'block':'none')}panel.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.mode;panel.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b===btn));panel.querySelectorAll('[data-draft-view]').forEach(view=>view.style.display=view.dataset.draftView===mode?'grid':'none');}));const select=panel.querySelector('[data-team-select]');if(select){showTeam(select.value);select.addEventListener('change',()=>showTeam(select.value));}});`;
  write("drafts.html", shell("Moggate Drafts", "drafts", `<h1>Drafts</h1><section><div class="picker">${buttons}</div>${panels}</section>${scriptPicker(draftScript)}`));
}

function normalizeDraftPosition(position) {
  const value = String(position ?? "").toUpperCase();
  if (value === "D/ST" || value === "DST" || value === "DEF") return "DEF";
  return value || "-";
}

function draftPositionRanks(season) {
  const counts = new Map();
  const ranks = new Map();
  for (const pick of season.draftPicks.slice().sort((a, b) => (a.overall ?? 999) - (b.overall ?? 999))) {
    const position = normalizeDraftPosition(pick.position);
    const rank = (counts.get(position) ?? 0) + 1;
    counts.set(position, rank);
    ranks.set(pick, rank);
  }
  return ranks;
}

function playerDraftChart(rows) {
  const valid = rows.slice().sort((a, b) => a.season - b.season).filter((row) => row.overall);
  if (valid.length < 2) return `<p class="muted">More draft history is needed for a line chart.</p>`;
  const width = Math.max(430, valid.length * 90);
  const height = 170;
  const left = 34;
  const top = 28;
  const bottom = 118;
  const maxPick = Math.max(...valid.map((row) => row.overall), 1);
  const step = valid.length > 1 ? (width - left * 2) / (valid.length - 1) : width - left * 2;
  const points = valid.map((row, index) => {
    const x = valid.length > 1 ? left + index * step : width / 2;
    const y = top + ((row.overall - 1) / Math.max(maxPick - 1, 1)) * (bottom - top);
    return { ...row, x, y };
  });
  const pathLine = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  return `<div class="placement-line-chart"><svg viewBox="0 0 ${width} ${height}" role="img"><line class="chart-grid-line" x1="${left}" x2="${width - left}" y1="${top}" y2="${top}"></line><line class="chart-grid-line" x1="${left}" x2="${width - left}" y1="${bottom}" y2="${bottom}"></line><path class="placement-line" d="${pathLine}"></path>${points.map((point) => `<g><circle class="placement-dot" cx="${point.x}" cy="${point.y}" r="6"></circle><text class="placement-value" x="${point.x}" y="${point.y - 10}" text-anchor="middle">${point.overall}</text><text class="placement-year" x="${point.x}" y="148" text-anchor="middle">${point.season}</text></g>`).join("")}</svg></div>`;
}

function writePlayerLookup() {
  const grouped = new Map();
  for (const season of seasons) {
    const ranks = draftPositionRanks(season);
    for (const pick of season.draftPicks.filter((item) => item.playerName && item.playerName !== "TBD" && !item.playerName.startsWith("Player "))) {
      const team = season.teams.find((item) => item.teamId === pick.teamId || item.managerId === pick.managerId);
      const key = pick.playerName.toLowerCase();
      grouped.set(key, [...(grouped.get(key) ?? []), {
        playerName: pick.playerName,
        season: season.year,
        overall: pick.overall,
        round: pick.round,
        roundPick: pick.roundPick,
        position: normalizeDraftPosition(pick.position),
        positionRank: ranks.get(pick),
        manager: managerName(pick.managerId),
        team: team?.teamName ?? "-"
      }]);
    }
  }
  const profiles = [...grouped.values()]
    .map((rows) => ({ name: rows[0].playerName, rows: rows.sort((a, b) => b.season - a.season || (a.overall ?? 999) - (b.overall ?? 999)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const profileArticles = profiles.map((profile, index) => {
    const picks = profile.rows.map((row) => row.overall).filter(Boolean);
    const avgPick = picks.length ? picks.reduce((sum, pick) => sum + pick, 0) / picks.length : 0;
    const bestPick = picks.length ? Math.min(...picks) : 0;
    const positionRanks = profile.rows.map((row) => row.positionRank).filter(Boolean);
    const avgPositionRank = positionRanks.length ? positionRanks.reduce((sum, rank) => sum + rank, 0) / positionRanks.length : 0;
    const latest = profile.rows[0];
    const historyRows = profile.rows.map((row) => `<tr><td>${row.season}</td><td>${row.overall ?? "-"}</td><td>${row.round ?? "-"}${row.roundPick ? `.${row.roundPick}` : ""}</td><td>${esc(row.position)}${row.positionRank ?? "-"}</td><td>${esc(row.manager)}</td><td>${esc(row.team)}</td></tr>`).join("");
    return `<section data-player-profile="${esc(profile.name.toLowerCase())}" style="display:${index === 0 ? "block" : "none"}"><section class="grid cols-4"><article class="card record"><span class="muted">Times Drafted</span><b>${profile.rows.length}</b><small>${esc(profile.rows.map((row) => row.season).join(", "))}</small></article><article class="card record"><span class="muted">Average Draft Position</span><b>${avgPick ? fmt(avgPick) : "-"}</b><small>Overall pick average</small></article><article class="card record"><span class="muted">Best Pick</span><b>${bestPick || "-"}</b><small>Earliest drafted</small></article><article class="card record"><span class="muted">Avg Position Rank</span><b>${avgPositionRank ? fmt(avgPositionRank) : "-"}</b><small>${esc(latest?.position ?? "-")} off the board</small></article></section><article class="card"><div class="row-between"><h2>${esc(profile.name)}</h2><span class="tag">${esc(latest?.position ?? "-")}</span></div>${playerDraftChart(profile.rows)}</article><article class="card"><h2>Draft History</h2><table><thead><tr><th>Season</th><th>Pick</th><th>Round</th><th>Position Rank</th><th>Manager</th><th>Team</th></tr></thead><tbody>${historyRows}</tbody></table></article></section>`;
  }).join("");
  const options = profiles.map((profile) => `<option value="${esc(profile.name.toLowerCase())}" data-name="${esc(profile.name.toLowerCase())}">${esc(profile.name)}</option>`).join("");
  const style = `<style>.lookup-field{margin-top:12px}.grid.cols-4{grid-template-columns:repeat(4,1fr)}.placement-line-chart{overflow-x:auto;padding:4px 0 0}.placement-line-chart svg{display:block;min-width:430px;width:100%}.chart-grid-line{stroke:var(--line);stroke-dasharray:4 5}.placement-line{fill:none;stroke:var(--green);stroke-linecap:round;stroke-linejoin:round;stroke-width:3}.placement-dot{fill:var(--panel);stroke:var(--green);stroke-width:3}.placement-value,.placement-year{fill:var(--ink);font-size:11px;font-weight:900}@media(max-width:900px){.grid.cols-4{grid-template-columns:1fr}}</style>`;
  const script = `<script>const search=document.querySelector('[data-player-profile-search]');const select=document.querySelector('[data-player-profile-select]');const profiles=[...document.querySelectorAll('[data-player-profile]')];const empty=document.querySelector('[data-player-profile-empty]');const allOptions=[...select.options].map(option=>({value:option.value,text:option.textContent,name:option.dataset.name}));function drawOptions(){const q=(search?.value||'').trim().toLowerCase();const matches=allOptions.filter(option=>q.length<2||option.name.includes(q)).slice(0,40);select.innerHTML=matches.map(option=>'<option value="'+option.value+'">'+option.text+'</option>').join('');select.style.display=matches.length?'block':'none';if(empty)empty.style.display=matches.length?'none':'block';if(matches.length)select.value=matches[0].value;showProfile()}function showProfile(){const value=select.value;profiles.forEach(profile=>profile.style.display=profile.dataset.playerProfile===value?'block':'none')}search?.addEventListener('input',drawOptions);select?.addEventListener('change',showProfile);showProfile();</script>`;
  write("player-lookup.html", shell("Moggate Player Lookup", "player-lookup", `${style}<header class="top"><div><span class="tag green">Draft History</span><h1>Player Lookup</h1></div><span class="tag">${profiles.length} players</span></header><article class="card"><div class="row-between"><h2>Find Player</h2><span class="tag">Draft profile</span></div><label class="select-field lookup-field"><span>Search Player</span><input data-player-profile-search placeholder="Type a player name"></label><label class="select-field lookup-field"><span>Select Player</span><select data-player-profile-select>${options}</select></label><p class="muted" data-player-profile-empty style="display:none">No matching player found.</p></article>${profileArticles}${script}`));
}

function writeTrades() {
  const season = seasons.find((item) => item.year === currentYear);
  const rosterMoves = loadRosterMoves(currentYear);
  const realTrades = rosterMoves.filter((activity) => activity.kind === "trade");
  const realAddDrops = rosterMoves.filter((activity) => activity.kind === "add-drop");
  const impacts = season ? tradeImpacts(rosterMoves, season) : [];
  const impactFor = (activityId, index) => impacts.find((impact) => impact.activityId === activityId && impact.moveIndex === index);
  const impactCell = (impact) => impact?.weeksTracked ? fmt(impact.pointsAfterMove) : "Pending";
  const projectionNote = (impact) => impact?.projectedOnly ? `<span class="cell-note">Projected until games are final</span>` : "";
  const trades = realTrades.length ? realTrades : [{
    id: "demo-trade",
    kind: "trade",
    season: currentYear,
    date: "9/10/2026",
    managersInvolved: ["Sample Manager 1", "Sample Manager 2"],
    moves: [
      { player: "Sample Player A", fromManager: "Sample Manager 1", toManager: "Sample Manager 2" },
      { player: "Sample Player B", fromManager: "Sample Manager 2", toManager: "Sample Manager 1" }
    ]
  }];
  const addDrops = realAddDrops.length ? realAddDrops : [{
    id: "demo-add-drop",
    kind: "add-drop",
    season: currentYear,
    date: "9/11/2026",
    managersInvolved: ["Sample Manager 1"],
    moves: [
      { player: "Sample Waiver Pickup", action: "Added", manager: "Sample Manager 1", bidAmount: 17 },
      { player: "Sample Dropped Player", action: "Dropped", manager: "Sample Manager 1" }
    ]
  }];
  const sampleTradeNote = realTrades.length ? "" : `<section class="card"><span class="tag gold">Sample data</span><h2>Example trade</h2><p>This is only here to show what information the page will include. It will be replaced when ESPN returns real roster moves.</p></section>`;
  const sampleAddDropNote = realAddDrops.length ? "" : `<section class="card"><span class="tag gold">Sample data</span><h2>Example add/drop</h2><p>This is only here to show what information the page will include. It will be replaced when ESPN returns real roster moves.</p></section>`;
  const tradeContent = `<section class="nested-sections">${sampleTradeNote}${trades.map((trade) => `<article class="card"><div class="top"><div><h2>${esc(trade.date)}</h2><span class="tag green">${esc(trade.managersInvolved.join(" / "))}</span></div><span class="tag">${trade.moves.length} player moves</span></div><table><thead><tr><th>Player</th><th>From</th><th>To</th><th>Weeks Since</th><th>Points Since</th></tr></thead><tbody>${trade.moves.map((move, index) => { const impact = impactFor(trade.id, index); return `<tr><td><strong>${esc(move.player)}</strong>${projectionNote(impact)}</td><td>${esc(move.fromManager)}</td><td>${esc(move.toManager)}</td><td>${impact?.weeksTracked || "-"}</td><td>${impactCell(impact)}</td></tr>`; }).join("")}</tbody></table></article>`).join("")}</section>`;
  const addDropContent = `<section class="nested-sections">${sampleAddDropNote}${addDrops.map((activity) => `<article class="card"><div class="top"><div><h2>${esc(activity.date)}</h2><span class="tag green">${esc(activity.managersInvolved.join(" / "))}</span></div><span class="tag">${activity.moves.length} player moves</span></div><table><thead><tr><th>Player</th><th>Move</th><th>Manager</th><th>FAAB</th><th>Weeks Since</th><th>Points Since</th></tr></thead><tbody>${activity.moves.map((move, index) => { const impact = impactFor(activity.id, index); return `<tr><td><strong>${esc(move.player)}</strong>${projectionNote(impact)}</td><td>${esc(move.action)}</td><td>${esc(move.manager)}</td><td>${move.bidAmount !== undefined ? `$${esc(move.bidAmount)}` : "-"}</td><td>${impact?.weeksTracked || "-"}</td><td>${move.action === "Added" ? impactCell(impact) : "-"}</td></tr>`; }).join("")}</tbody></table></article>`).join("")}</section>`;
  const script = `<script>document.querySelectorAll('[data-roster-tab]').forEach(btn=>btn.addEventListener('click',()=>{const tab=btn.dataset.rosterTab;document.querySelectorAll('[data-roster-tab]').forEach(b=>b.classList.toggle('active',b===btn));document.querySelectorAll('[data-roster-panel]').forEach(panel=>panel.style.display=panel.dataset.rosterPanel===tab?'block':'none');}));</script>`;
  write("trades.html", shell("Moggate 2026 Roster Moves", "trades", `<h1>2026 Roster Moves</h1><div class="seg"><button class="active" data-roster-tab="trades" type="button">Trades</button><button data-roster-tab="add-drop" type="button">Add/Drop</button></div><div data-roster-panel="trades">${tradeContent}</div><div data-roster-panel="add-drop" style="display:none">${addDropContent}</div>${script}`));
}

function writeManagers() {
  const managerStyle = `<style>.row-toggle{align-items:center;background:transparent;border:0;color:var(--ink);cursor:pointer;display:inline-flex;font:inherit;font-weight:900;gap:8px;padding:0;text-align:left}.row-toggle span{color:var(--muted);display:inline-block;transition:transform 160ms ease}.row-toggle.open span{transform:rotate(180deg)}.manager-detail-row td{background:var(--bg);padding:16px}.placement-line-chart{overflow-x:auto;padding:4px 0 0}.placement-line-chart svg{display:block;min-width:430px;width:100%}.chart-grid-line{stroke:var(--line);stroke-dasharray:4 5}.placement-line{fill:none;stroke:var(--green);stroke-linecap:round;stroke-linejoin:round;stroke-width:3}.placement-dot{fill:var(--panel);stroke:var(--green);stroke-width:3}.placement-dot.champion{fill:var(--gold);stroke:var(--gold)}.placement-value{fill:var(--ink);font-size:11px;font-weight:900}.placement-year{fill:var(--ink);font-size:11px;font-weight:900}</style>`;
  const rows = careers.map((row) => `<tr data-manager-row="${esc(row.manager.id)}"><td><button class="row-toggle" type="button" data-manager-toggle="${esc(row.manager.id)}" aria-expanded="false"><span>▾</span>${esc(row.manager.displayName)}</button></td><td><span class="tag ${active2026.has(row.manager.id) ? "green" : "red"}">${esc(yearLabels.get(row.manager.id))}</span></td><td>${row.seasons}</td><td>${row.wins}-${row.losses}${row.ties?`-${row.ties}`:""}</td><td>${pct(row.winPct)}</td><td>${row.championships}</td><td>${row.topThreeFinishes}</td><td>${row.playoffAppearances}</td><td>${row.playoffWins}-${row.playoffLosses}${row.playoffTies?`-${row.playoffTies}`:""}</td><td>${row.averageFinish?.toFixed(1) ?? "-"}</td><td>${fmt(row.pointsFor)}</td></tr><tr class="manager-detail-row" data-detail-for="${esc(row.manager.id)}" style="display:none"><td colspan="11">${placementChart(row.manager.id)}</td></tr>`).join("");
  const script = `<script>const table=document.querySelector('table'),body=table.querySelector('tbody');let key='winPct',dir='desc';function value(r,k){const c=r.children;if(k==='seasons')return+c[2].textContent||0;if(k==='wins')return +(c[3].textContent.match(/^\\d+/)||['0'])[0];if(k==='winPct')return +c[4].textContent.replace('.','0.')||0;if(k==='titles')return+c[5].textContent||0;if(k==='top3')return+c[6].textContent||0;if(k==='playoffs')return+c[7].textContent||0;if(k==='playoffRecord')return +(c[8].textContent.match(/^\\d+/)||['0'])[0];if(k==='avg')return+c[9].textContent||-Infinity;if(k==='pf')return+c[10].textContent.replace(/,/g,'')||0;return 0}function sortRows(k,init=false){if(!init){dir=k===key&&dir==='desc'?'asc':'desc';key=k}else key=k;document.querySelectorAll('th button').forEach(b=>{b.classList.toggle('active',b.dataset.sort===key);const base=b.dataset.label||b.textContent.replace(/\\s*[↑↓]$/,'');b.dataset.label=base;b.textContent=b.dataset.sort===key?base+' '+(dir==='desc'?'↓':'↑'):base});[...body.querySelectorAll('[data-manager-row]')].sort((a,b)=>{const diff=value(b,key)-value(a,key);return (dir==='desc'?diff:-diff)||a.cells[0].textContent.localeCompare(b.cells[0].textContent)}).forEach(r=>{body.appendChild(r);const detail=body.querySelector('[data-detail-for="'+CSS.escape(r.dataset.managerRow)+'"]');if(detail)body.appendChild(detail)})}document.querySelectorAll('th button').forEach(b=>b.addEventListener('click',()=>sortRows(b.dataset.sort)));document.querySelectorAll('[data-manager-toggle]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.managerToggle;const detail=body.querySelector('[data-detail-for="'+CSS.escape(id)+'"]');const open=detail.style.display!=='none';detail.style.display=open?'none':'table-row';btn.classList.toggle('open',!open);btn.setAttribute('aria-expanded',String(!open));}));sortRows('winPct',true);</script>`;
  write("managers.html", shell("Moggate Manager Stats", "managers", `${managerStyle}<h1>Manager Stats</h1><section class="card"><table><thead><tr><th>Manager</th><th>Years Active</th><th><button data-sort="seasons">Seasons</button></th><th><button data-sort="wins">Regular Season Record</button></th><th><button class="active" data-sort="winPct">Win %</button></th><th><button data-sort="titles">Titles</button></th><th><button data-sort="top3">Top 3 Finishes</button></th><th><button data-sort="playoffs">Playoffs</button></th><th><button data-sort="playoffRecord">Winners Bracket Record</button></th><th><button data-sort="avg">Avg Finish</button></th><th><button data-sort="pf">PF</button></th></tr></thead><tbody>${rows}</tbody></table></section>${script}`));
}

function placementChart(managerId) {
  const points = seasons.flatMap((season) => {
    const team = season.teams.find((item) => item.managerId === managerId);
    return team ? [{ year: season.year, placement: team.finalPlacement || undefined, teamName: team.teamName }] : [];
  });
  const valid = points.filter((point) => point.placement);
  const maxPlacement = Math.max(...valid.map((point) => point.placement ?? 0), 1);
  const width = Math.max(430, points.length * 76);
  const height = 155;
  const paddingX = 28;
  const top = 28;
  const bottom = 112;
  const usableWidth = width - paddingX * 2;
  const step = points.length > 1 ? usableWidth / (points.length - 1) : usableWidth;
  const plotted = points.map((point, index) => {
    const x = points.length > 1 ? paddingX + index * step : width / 2;
    const y = point.placement ? top + ((point.placement - 1) / Math.max(maxPlacement - 1, 1)) * (bottom - top) : undefined;
    return { ...point, x, y };
  });
  const linePath = plotted.filter((point) => point.y !== undefined).map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  return `<div class="placement-line-chart"><svg viewBox="0 0 ${width} ${height}" role="img"><line class="chart-grid-line" x1="${paddingX}" x2="${width - paddingX}" y1="${top}" y2="${top}"></line><line class="chart-grid-line" x1="${paddingX}" x2="${width - paddingX}" y1="${bottom}" y2="${bottom}"></line>${linePath ? `<path class="placement-line" d="${linePath}"></path>` : ""}${plotted.map((point) => `<g>${point.y !== undefined ? `<circle class="${point.placement === 1 ? "placement-dot champion" : "placement-dot"}" cx="${point.x}" cy="${point.y}" r="6"></circle><text class="placement-value" x="${point.x}" y="${point.y - 10}" text-anchor="middle">${esc(point.placement)}</text>` : ""}<text class="placement-year" x="${point.x}" y="138" text-anchor="middle">${point.year}</text></g>`).join("")}</svg></div>`;
}

writeHome();
writeCurrentSeason();
writeSchedule();
writeHistoryWithRosters();
writeManagers();
writeRecords();
writeRivalries();
writeDrafts();
writePlayerLookup();
writeTrades();
console.log(`Generated ${outDir}`);
