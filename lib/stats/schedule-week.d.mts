import type { Season } from "../domain/types";

export function scheduleWeek(season?: Pick<Season, "currentMatchupPeriod" | "matchups">): number;
