import type { MatchRow, TournamentRow } from "../tournaments/types";

export function getVotingClosedReason(
  match: Pick<MatchRow, "status" | "deadline" | "source" | "predictionLocked">,
  tournament: Pick<TournamentRow, "visibility" | "sportType">,
  now: number | null,
): string | null {
  if (tournament.sportType === "F1" || match.source === "OPENF1") {
    return "1X2 voting unavailable for F1";
  }
  if (tournament.visibility !== "PUBLIC")
    return "Private tournament · voting unavailable";
  if (now === null) return "Loading voting status…";
  const deadline = Date.parse(match.deadline);
  if (
    match.predictionLocked ||
    match.status !== "PENDING" ||
    !Number.isFinite(deadline) ||
    now >= deadline
  ) {
    return "Voting closed";
  }
  return null;
}
