import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputFile = path.join(root, "data", "playerbase", "espn-players.json");
const sourceDirs = [path.join(root, "data", "raw"), path.join(root, "data", "snapshots", "2026")];
const positionById = { 0: "QB", 1: "QB", 2: "RB", 3: "RB/WR", 4: "WR", 5: "WR/TE", 6: "TE", 16: "D/ST", 17: "K" };
const lineupSlotById = { 0: "QB", 2: "RB", 4: "WR", 6: "TE", 16: "D/ST", 17: "K", 20: "Bench", 21: "IR", 23: "Flex" };
const knownPlayers = [
  { id: 3122840, name: "Deshaun Watson", position: "QB" },
  { id: 4870612, name: "Zachariah Branch", position: "WR" },
  { id: -16016, name: "Vikings D/ST", position: "D/ST" }
];

const arr = (value) => Array.isArray(value) ? value : [];
const obj = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const num = (value) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
const text = (value) => typeof value === "string" && value.trim() ? value.trim() : undefined;

const players = new Map();

function addPlayer(id, name, position, proTeam, force = false) {
  if (id === undefined || !name || /^Player\s/i.test(name) || name === "Player Unknown" || name === "TBD") return;
  const key = String(id);
  const existing = players.get(key) ?? {};
  players.set(key, {
    name: force ? name : existing.name ?? name,
    position: force ? position ?? existing.position : existing.position ?? position,
    proTeam: force ? proTeam ?? existing.proTeam : existing.proTeam ?? proTeam
  });
}

function addPoolEntry(entry) {
  const poolEntry = obj(entry);
  const player = obj(poolEntry.player);
  const id = num(player.id) ?? num(poolEntry.id) ?? num(poolEntry.playerId);
  const defaultPositionId = num(player.defaultPositionId);
  const lineupSlotId = num(poolEntry.lineupSlotId);
  addPlayer(
    id,
    text(player.fullName) ?? text(player.name),
    defaultPositionId !== undefined ? positionById[defaultPositionId] : lineupSlotId !== undefined ? lineupSlotById[lineupSlotId] : undefined,
    num(player.proTeamId)?.toString()
  );
}

function scanSeason(raw) {
  arr(raw.players).forEach((entry) => addPoolEntry(obj(entry)));
  for (const team of arr(raw.teams).map(obj)) {
    for (const entry of arr(obj(team.roster).entries).map(obj)) {
      addPoolEntry(obj(entry.playerPoolEntry));
    }
  }
  for (const matchup of arr(raw.schedule).map(obj)) {
    for (const side of ["home", "away"]) {
      const roster = obj(obj(matchup[side]).rosterForCurrentScoringPeriod);
      for (const entry of arr(roster.entries).map(obj)) {
        const poolEntry = obj(entry.playerPoolEntry);
        poolEntry.lineupSlotId ??= entry.lineupSlotId;
        addPoolEntry(poolEntry);
      }
    }
  }
  for (const pick of arr(obj(raw.draftDetail).picks).map(obj)) {
    addPoolEntry(obj(pick.playerPoolEntry));
  }
}

for (const sourceDir of sourceDirs) {
  if (!fs.existsSync(sourceDir)) continue;
  for (const file of fs.readdirSync(sourceDir).filter((name) => name.endsWith(".json") && !name.includes("_activity"))) {
    scanSeason(JSON.parse(fs.readFileSync(path.join(sourceDir, file), "utf8")));
  }
}
for (const player of knownPlayers) {
  addPlayer(player.id, player.name, player.position, undefined, true);
}

const sortedPlayers = Object.fromEntries(
  [...players.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([id, player]) => [id, Object.fromEntries(Object.entries(player).filter(([, value]) => value !== undefined))])
);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify({ players: sortedPlayers }, null, 2)}\n`);
console.log(`Wrote ${Object.keys(sortedPlayers).length} ESPN player mappings to ${outputFile}`);
