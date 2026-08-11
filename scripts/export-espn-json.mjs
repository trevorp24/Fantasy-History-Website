import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const season = Number(process.argv.find((arg) => arg.startsWith("--season="))?.split("=")[1] ?? 2026);
const leagueId = Number(process.argv.find((arg) => arg.startsWith("--leagueId="))?.split("=")[1] ?? 69640845);
const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.split("=").slice(1).join("=");
const outputFile = outputArg ? path.resolve(projectRoot, outputArg) : path.join(projectRoot, "data", "raw", `moggate_${season}.json`);
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
const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?${query}`;

console.log(`Downloading Moggate ${season} JSON...`);
const response = await fetch(url, {
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
