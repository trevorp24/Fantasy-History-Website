import assert from "node:assert/strict";
import { test } from "node:test";
import { scheduleWeek } from "../lib/stats/schedule-week.mjs";

const matchups = [
  { week: 8, completed: true },
  { week: 9, completed: false },
  { week: 9, completed: false },
  { week: 10, completed: false }
];

test("uses ESPN's current week even when the last finished week is earlier", () => {
  assert.equal(scheduleWeek({ currentMatchupPeriod: 9, matchups }), 9);
});

test("keeps ESPN's current week after games finish until ESPN advances it", () => {
  assert.equal(scheduleWeek({ currentMatchupPeriod: 9, matchups: matchups.map((row) => ({ ...row, completed: true })) }), 9);
});

test("falls back to the first unfinished week for exports without a current period", () => {
  assert.equal(scheduleWeek({ matchups }), 9);
  assert.equal(scheduleWeek({ currentMatchupPeriod: 99, matchups }), 9);
});

test("keeps partially finished weeks, completed seasons, and empty exports valid", () => {
  assert.equal(scheduleWeek({ matchups: [{ week: 9, completed: true }, { week: 9, completed: false }, { week: 10, completed: false }] }), 9);
  assert.equal(scheduleWeek({ matchups: matchups.map((row) => ({ ...row, completed: true })) }), 10);
  assert.equal(scheduleWeek({ matchups: [] }), 1);
});
