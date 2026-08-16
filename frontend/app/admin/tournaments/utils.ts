import type { FootballCompetitionOption, F1MeetingOption, ImportSport, LolCompetitionOption, MatchRow, TournamentForm, TournamentRow } from "./types";
export function normalizeStatus(status: string): TournamentForm["status"] {
  const normalized = status.toUpperCase();

  if (
    normalized === "UPCOMING" ||
    normalized === "ACTIVE" ||
    normalized === "COMPLETED" ||
    normalized === "CANCELLED"
  ) {
    return normalized;
  }

  return "UPCOMING";
}

export function getTournamentGroups(tournaments: TournamentRow[]) {
  const football = tournaments.filter(
    (tournament) =>
      normalizeSportType(tournament.sportType) === "FOOTBALL" &&
      !isLolTournament(tournament),
  );
  const f1 = tournaments.filter(
    (tournament) => normalizeSportType(tournament.sportType) === "F1",
  );
  const lol = tournaments.filter(isLolTournament);
  const otherSports = tournaments.filter((tournament) => {
    const sportType = normalizeSportType(tournament.sportType);

    return (
      sportType !== "FOOTBALL" &&
      sportType !== "F1" &&
      !isLolTournament(tournament)
    );
  });

  return [
    {
      sportType: "FOOTBALL",
      title: "Football Tournaments",
      total: football.length,
      tournaments: football,
      emptyMessage: "No football tournaments found in database.",
    },
    {
      sportType: "F1",
      title: "F1 Tournaments",
      total: f1.length,
      tournaments: f1,
      emptyMessage: "No F1 tournaments found in database.",
    },
    {
      sportType: "LOL",
      title: "League of Legends Tournaments",
      total: lol.length,
      tournaments: lol,
      emptyMessage: "No League of Legends tournaments found in database.",
    },
    {
      sportType: "OTHER",
      title: "Other Sports Tournaments",
      total: otherSports.length,
      tournaments: otherSports,
      emptyMessage: "No other sports tournaments found in database.",
    },
  ];
}

export function normalizeSportType(sportType: string | undefined) {
  return (sportType || "FOOTBALL").toUpperCase();
}

export function isLolTournament(tournament: TournamentRow) {
  return (
    tournament.source?.toUpperCase() === "CITO_LOL" ||
    normalizeSportType(tournament.sportType) === "LOL"
  );
}

export function getFootballLeagueKey(competition: FootballCompetitionOption) {
  return `${competition.id}:${competition.season}`;
}

export function getFootballCompetitionPhase(competition: FootballCompetitionOption) {
  const now = new Date();
  const start = competition.start ? new Date(competition.start) : null;
  const end = competition.end ? new Date(competition.end) : null;

  if ((!start || start <= now) && (!end || end >= now)) {
    return "ongoing";
  }

  return "upcoming";
}

export function getF1MeetingPhase(meeting: F1MeetingOption) {
  const now = new Date();
  const start = new Date(meeting.start);
  const end = new Date(meeting.end);

  if (start <= now && end >= now) {
    return "ongoing";
  }

  return "upcoming";
}

export function getLolCompetitionPhase(competition: LolCompetitionOption) {
  if (competition.current) {
    return "ongoing";
  }

  return "upcoming";
}

export function getImportSportLabel(sport: ImportSport) {
  if (sport === "F1") {
    return "F1";
  }

  if (sport === "LOL") {
    return "League of Legends";
  }

  return "football";
}

export function formatDateOnly(value: string | null) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function formatShortTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getTournamentDateRange(matches: MatchRow[]) {
  const timestamps = matches
    .map((match) => new Date(match.scheduledTime).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp))
    .sort((first, second) => first - second);

  if (timestamps.length === 0) {
    return "Schedule TBD";
  }

  return `${formatDateOnly(new Date(timestamps[0]).toISOString())} - ${formatDateOnly(
    new Date(timestamps[timestamps.length - 1]).toISOString(),
  )}`;
}

export function isFinishedStatus(status: string) {
  const normalizedStatus = status.toUpperCase();

  return (
    normalizedStatus === "FINISHED" ||
    normalizedStatus === "COMPLETED" ||
    normalizedStatus === "FT"
  );
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatScore(match: MatchRow) {
  if (match.actualHomeScore === null || match.actualAwayScore === null) {
    return "-";
  }

  return `${match.actualHomeScore} - ${match.actualAwayScore}`;
}

export function formatRelative(value: string | null) {
  if (!value) {
    return "No sync yet";
  }

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();

  if (Number.isNaN(diffMs)) {
    return "Unknown";
  }

  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) {
    return `${minutes} minutes ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} hours ago`;
  }

  return `${Math.round(hours / 24)} days ago`;
}





