import type { MatchRow } from "../tournaments/types";

export function getNextTournamentMatch(matches: MatchRow[], now = Date.now()) {
  return matches
    .filter((match) => {
      const time = new Date(match.scheduledTime).getTime();
      return Number.isFinite(time) && time >= now;
    })
    .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())[0] ?? null;
}
