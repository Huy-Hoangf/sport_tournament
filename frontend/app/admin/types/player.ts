export type AdminView = "dashboard" | "tournaments" | "matches" | "players";

export type BackendUser = {
  id: number;
  memberCode: string | null;
  fullName: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "PLAYER";
  status?: "ACTIVE" | "INACTIVE" | "PENDING";
  eventsCount?: number;
  createdAt?: string;
};

export type PlayerStatus = "ACTIVE" | "INACTIVE" | "PENDING";

export type Player = {
  id: string;
  memberCode: string;
  fullName: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "PLAYER";
  rank: "ELITE" | "PRO" | "ROOKIE";
  points: number;
  status: PlayerStatus;
  events: number;
};

export type CreateUserResponse = {
  message: string;
  user: BackendUser & {
    defaultPassword: string;
  };
};

export type ImportedPlayer = {
  fullName: string;
  email: string;
};
