import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const season = Number(process.argv.find((arg) => arg.startsWith("--season="))?.split("=")[1] ?? 2026);
const leagueId = Number(process.argv.find((arg) => arg.startsWith("--leagueId="))?.split("=")[1] ?? 69640845);
const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.split("=").slice(1).join("=");
const outputFile = outputArg ? path.resolve(projectRoot, outputArg) : path.join(projectRoot, "data", "raw", `moggate_${season}.json`);
const activityFile = path.join(projectRoot, "data", "raw", `moggate_${season}_activity.json`);
const snapshotDir = path.join(projectRoot, "data", "snapshots", String(season));
const snapshotStamp = new Date().toISOString().slice(0, 10);
const snapshotFile = path.join(snapshotDir, `moggate_${season}_${snapshotStamp}.json`);
const activitySnapshotFile = path.join(snapshotDir, `moggate_${season}_activity_${snapshotStamp}.json`);
const envFile = path.join(projectRoot, ".env.local");

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([^#][^=]+?)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map((match) => [match[1].trim(), match[2].trim()])
  );
}

const env = readEnv(envFile);
const swid = env.ESPN_SWID;
const espnS2 = env.ESPN_S2;

if (!swid || !espnS2) {
  console.error("Missing ESPN_SWID or ESPN_S2 in .env.local.");
  process.exit(1);
}

const views = [
  "mDraftDetail",
  "mSettings",
  "mTeam",
  "mRoster",
  "mMatchup",
  "mMatchupScore",
  "mSchedule",
  "mStandings",
  "mStatus",
  "kona_player_info"
];

const query = views.map((view) => `view=${encodeURIComponent(view)}`).join("&");
const leagueUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?${query}`;
const activityUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}/communication/?view=kona_league_communication`;
const activityFilter = {
  topics: {
    filterType: { value: ["ACTIVITY_TRANSACTIONS"] },
    limit: 1000,
    limitPerMessageSet: { value: 1000 },
    filterIncludeMessageTypeIds: { value: [178, 180, 179, 239, 181, 244] },
    sortMessageDate: {
      sortPriority: 1,
      sortAsc: false
    }
  }
};

console.log(`Downloading Moggate ${season} JSON...`);
const response = await fetch(leagueUrl, {
  headers: {
    accept: "application/json",
    cookie: `SWID=${swid}; espn_s2=${espnS2}`,
    "user-agent": "Mozilla/5.0"
  }
});

if (!response.ok) {
  throw new Error(`ESPN request failed with ${response.status} ${response.statusText}.`);
}

const data = await response.json();
if (data.id !== leagueId || data.seasonId !== season) {
  throw new Error(`Downloaded JSON did not match league ${leagueId} season ${season}.`);
}

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
console.log(`Saved ${outputFile}`);
fs.mkdirSync(snapshotDir, { recursive: true });
fs.writeFileSync(snapshotFile, JSON.stringify(data, null, 2));
console.log(`Saved weekly snapshot ${snapshotFile}`);

console.log(`Downloading Moggate ${season} trade/activity JSON...`);
const activityResponse = await fetch(activityUrl, {
  headers: {
    accept: "application/json",
    cookie: `SWID=${swid}; espn_s2=${espnS2}`,
    "user-agent": "Mozilla/5.0",
    "x-fantasy-filter": JSON.stringify(activityFilter)
  }
});

if (!activityResponse.ok) {
  throw new Error(`ESPN activity request failed with ${activityResponse.status} ${activityResponse.statusText}.`);
}

const activityData = await activityResponse.json();
fs.writeFileSync(activityFile, JSON.stringify(activityData, null, 2));
console.log(`Saved ${activityFile}`);
fs.writeFileSync(activitySnapshotFile, JSON.stringify(activityData, null, 2));
console.log(`Saved weekly activity snapshot ${activitySnapshotFile}`);
