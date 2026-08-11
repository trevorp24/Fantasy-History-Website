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
  console.log(`${year}: teams=${data.teams?.length ?? 0}, matchups=${data.schedule?.length ?? 0}, draftPicks=${data.draftDetail?.picks?.length ?? 0}`);
}
