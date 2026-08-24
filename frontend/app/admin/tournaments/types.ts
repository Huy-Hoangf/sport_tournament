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
  format?: TournamentFormat;
  customFormat?: CustomTournamentFormat | null;
  status: string;
  visibility: "PUBLIC" | "PRIVATE";
  startDate?: string | null;
  endDate?: string | null;
  teams: number;
  matches: number;
  source: string;
};

export type TournamentStage = {
  id: number;
  tournamentId: number;
  name: string;
  sortOrder: number;
  correctPoints: number;
  exactScoreBonus: number;
  isKnockout: boolean;
};

export type TournamentFormat =
  | "GROUP_AND_KNOCKOUT"
  | "ROUND_ROBIN"
  | "KNOCKOUT"
  | "CUSTOM";

export type CustomStageType =
  | "GROUP_STAGE"
  | "ROUND_ROBIN"
  | "QUARTERFINAL"
  | "SEMIFINAL"
  | "FINAL"
  | "PLAYOFFS"
  | "SWISS_STAGE";

export type CustomTournamentStage = {
  id: string;
  type: CustomStageType;
  label: string;
  teamsIn: number;
  teamsAdvance: number;
  matchFormat: "BO1" | "BO3" | "BO5";
  tieBreakers: string[];
  predictionLockHours: number;
};

export type CustomTournamentFormat = {
  name: string;
  stages: CustomTournamentStage[];
};

export type TournamentForm = {
  name: string;
  sportType: "FOOTBALL" | "F1" | "LOL" | "OTHER";
  format: TournamentFormat;
  customFormat: CustomTournamentFormat | null;
  status: "UPCOMING" | "ONGOING" | "COMPLETE";
  visibility: "PUBLIC" | "PRIVATE";
  startDate: string;
  endDate: string;
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
  matches?: number;
  nextMatchAt?: string | null;
};

export type ImportSport = "FOOTBALL" | "F1" | "LOL";
export type SyncSport = "FOOTBALL" | "F1";
export type TournamentStatusFilter =
  | "ALL"
  | "ONGOING"
  | "UPCOMING"
  | "COMPLETE";

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
  stageId?: number;
  stageName?: string;
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
