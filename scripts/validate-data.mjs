import fs from "node:fs";
import path from "node:path";

const rawDir = path.join(process.cwd(), "data", "raw");
const expected = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

for (const year of expected) {
  const file = path.join(rawDir, `moggate_${year}.json`);
  if (!fs.existsSync(file)) {
    console.log(`${year}: missing (${file})`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const activityFile = path.join(rawDir, `moggate_${year}_activity.json`);
  const activity = fs.existsSync(activityFile) ? JSON.parse(fs.readFileSync(activityFile, "utf8")) : undefined;
  const tradeTopics = activity?.topics?.filter((topic) => topic.messages?.some((message) => message.messageTypeId === 244))?.length ?? 0;
  const addDropTopicTypes = new Set([178, 179, 180, 181, 239]);
  const addDropTopics = activity?.topics?.filter((topic) => topic.messages?.some((message) => addDropTopicTypes.has(message.messageTypeId)))?.length ?? 0;
  const weeklyPlayerScores = (data.schedule ?? []).reduce((sum, matchup) =>
    sum +
    (matchup.home?.rosterForCurrentScoringPeriod?.entries?.length ?? 0) +
    (matchup.away?.rosterForCurrentScoringPeriod?.entries?.length ?? 0), 0);
  const activityLabel = activity ? `, tradeTopics=${tradeTopics}, addDropTopics=${addDropTopics}` : "";
  console.log(`${year}: teams=${data.teams?.length ?? 0}, matchups=${data.schedule?.length ?? 0}, draftPicks=${data.draftDetail?.picks?.length ?? 0}, weeklyRosterEntries=${weeklyPlayerScores}${activityLabel}`);
}
