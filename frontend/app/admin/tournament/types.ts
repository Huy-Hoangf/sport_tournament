export type DashboardData = {
  apiStatus: {
    connected: boolean;
    provider: string;
    lastSync: string | null;
    externalId: string;
  };
  stats: {
    activeTournaments: number;
    totalPlayers: number;
    upcomingMatches: number;
    attentionNeeded: number;
    pendingPredictions: number;
    warningMatches: number;
    inactivePlayers: number;
    pendingPlayers: number;
  };
  tournaments: TournamentRow[];
  tournamentMatches: MatchRow[];
  upcomingSchedule: MatchRow[];
  recentActivity: ActivityRow[];
  inactivePlayers: InactivePlayerRow[];
};

export type TournamentRow = {
  id: number;
  name: string;
  sportType?: string;
  status: string;
  visibility: "PUBLIC" | "PRIVATE";
  teams: number;
  matches: number;
  source: string;
};

export type TournamentForm = {
  name: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  visibility: "PUBLIC" | "PRIVATE";
};

export type FootballCompetitionOption = {
  id: number;
  name: string;
  country: string;
  season: number;
  start: string | null;
  end: string | null;
  current: boolean;
  type: string;
};

export type ImportSport = "FOOTBALL" | "F1" | "LOL";
export type SyncSport = "FOOTBALL" | "F1";
export type TournamentStatusFilter =
  | "ALL"
  | "ACTIVE"
  | "UPCOMING"
  | "COMPLETED";

export type F1MeetingOption = {
  id: number;
  name: string;
  country: string;
  circuit: string;
  start: string;
  end: string;
  current: boolean;
};

export type LolCompetitionOption = {
  id: string;
  name: string;
  region: string;
  start: string | null;
  nextMatchAt: string | null;
  current: boolean;
  matches: number;
};

export type MatchRow = {
  id: number;
  tournamentId?: number;
  homeName?: string;
  awayName?: string;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  encounter: string;
  tournamentName: string;
  scheduledTime: string;
  deadline: string;
  source: string;
  status: string;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
};

export type ActivityRow = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

export type InactivePlayerRow = {
  id: number;
  memberCode: string;
  fullName: string;
  email: string;
  status: string;
  updatedAt: string;
};

