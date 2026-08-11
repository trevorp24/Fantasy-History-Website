import fs from "node:fs";
import path from "node:path";
import { LeagueData, Manager, Season } from "@/lib/domain/types";
import { AVAILABLE_EXPORT_YEARS, EXPECTED_YEARS } from "@/lib/espn/constants";
import { missingSeason, parseEspnRosterMoveActivity, parseEspnSeason } from "@/lib/espn/parser";
import { applyDraftRecap } from "@/lib/data/draftRecaps";
import { calculateLeague } from "@/lib/stats/calculate";

const rawDir = path.join(process.cwd(), "data", "raw");

function loadRawSeason(year: number): { season: Season; managers: Manager[] } | undefined {
  const sourceFile = `moggate_${year}.json`;
  const fullPath = path.join(rawDir, sourceFile);
  if (!fs.existsSync(fullPath)) return undefined;
  const raw = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  const parsed = parseEspnSeason(raw, year, sourceFile);
  parsed.season.draftPicks = applyDraftRecap(parsed.season.draftPicks, year);
  const activityPath = path.join(rawDir, `moggate_${year}_activity.json`);
  if (fs.existsSync(activityPath)) {
    const activityRaw = JSON.parse(fs.readFileSync(activityPath, "utf8"));
    parsed.season.rosterMoves = parseEspnRosterMoveActivity(activityRaw, year, parsed.season, raw);
  }
  return parsed;
}

export function loadLeagueData(): LeagueData {
  const managerMap = new Map<string, Manager>();
  const seasons: Season[] = [];
  const backfillYears: number[] = [];

  for (const year of EXPECTED_YEARS) {
    const parsed = AVAILABLE_EXPORT_YEARS.includes(year as typeof AVAILABLE_EXPORT_YEARS[number])
      ? loadRawSeason(year)
      : undefined;
    if (parsed) {
      for (const manager of parsed.managers) managerMap.set(manager.id, manager);
      seasons.push(parsed.season);
    } else {
      seasons.push(missingSeason(year));
      backfillYears.push(year);
    }
  }

  return calculateLeague(Array.from(managerMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)), seasons, backfillYears);
}

export function formatPct(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/^0/, "");
}

export function formatPoints(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
