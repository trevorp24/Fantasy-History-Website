import fs from "node:fs";
import path from "node:path";
import { DraftPick } from "@/lib/domain/types";

type RecapPick = {
  overall: number;
  playerName: string;
  position?: string;
  proTeam?: string;
};

const recapDir = path.join(process.cwd(), "data", "draft-recaps");

function parsePlayerLine(line: string) {
  const match = line.match(/^(.+)\s+([A-Za-z]{2,4}),\s*([A-Za-z/]+)$/);
  if (!match) {
    return { playerName: line };
  }
  return {
    playerName: match[1].trim(),
    proTeam: match[2].trim(),
    position: match[3].trim()
  };
}

export function loadDraftRecap(year: number, teamsPerRound: number): Map<number, RecapPick> {
  const file = path.join(recapDir, `moggate_${year}_draft_recap.txt`);
  const picks = new Map<number, RecapPick>();
  if (!fs.existsSync(file)) return picks;

  const lines = fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

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
    picks.set(overall, { overall, ...parsePlayerLine(playerLine) });
    index += 2;
  }

  return picks;
}

export function applyDraftRecap(picks: DraftPick[], year: number): DraftPick[] {
  const teamsPerRound = Math.max(...picks.map((pick) => pick.roundPick ?? 0), 0);
  const recap = loadDraftRecap(year, teamsPerRound || 14);
  if (!recap.size) return picks;

  return picks.map((pick) => {
    if (!pick.overall) return pick;
    const recapPick = recap.get(pick.overall);
    if (!recapPick) return pick;
    return {
      ...pick,
      playerName: recapPick.playerName,
      position: recapPick.position ?? pick.position,
      proTeam: recapPick.proTeam ?? pick.proTeam
    };
  });
}
