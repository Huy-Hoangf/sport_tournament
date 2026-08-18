import type React from "react";
import { Gamepad2, Search, ShieldCheck, Trophy, Users } from "lucide-react";
import type { MatchRow, TournamentRow } from "../tournaments/types";
import { normalizeSportType } from "../tournaments/utils";
import {
  DashboardTournamentCard,
  FlagIcon,
  getSportMeta,
} from "./tournament-overview-card";

type EmptyTournamentGroup = {
  sportType: string;
  title: string;
  total: number;
  tournaments: TournamentRow[];
  emptyMessage: string;
};

export function DashboardTournamentOverview({
  tournaments,
  allTournamentsCount,
  matches,
  emptyGroups,
  search,
  sportFilter,
  isAdmin,
  onSearchChange,
  onSportFilterChange,
  onSelectTournament,
  onEditTournament,
  onDeleteTournament,
}: {
  tournaments: TournamentRow[];
  allTournamentsCount: number;
  matches: MatchRow[];
  emptyGroups: EmptyTournamentGroup[];
  search: string;
  sportFilter: string;
  isAdmin: boolean;
  onSearchChange: (value: string) => void;
  onSportFilterChange: (value: string) => void;
  onSelectTournament: React.Dispatch<React.SetStateAction<number | null>>;
  onEditTournament: (tournament: TournamentRow) => void;
  onDeleteTournament: (tournament: TournamentRow) => void;
}) {
  const sportOptions = [
    { value: "ALL", label: "All Sports", icon: <ShieldCheck size={15} /> },
    { value: "FOOTBALL", label: "Football", icon: <Trophy size={15} /> },
    { value: "F1", label: "F1", icon: <FlagIcon /> },
    { value: "LOL", label: "League of Legends", icon: <Gamepad2 size={15} /> },
    { value: "OTHER", label: "Other", icon: <Users size={15} /> },
  ];

  return (
    <section className="overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d]">
      <header className="border-b border-[#3a4d54] bg-[#10242b] px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-white">
              Tournament Overview
            </h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[#84d8e8]">
              {tournaments.length} shown / {allTournamentsCount} total
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 2xl:grid-cols-[minmax(240px,1fr)_auto]">
          <label className="flex h-11 min-w-0 items-center gap-3 rounded border border-[#3a4d54] bg-[#06161b] px-4 text-[#9fb2b8] focus-within:border-[#84d8e8]">
            <Search size={17} className="shrink-0 text-[#84d8e8]" />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search tournaments..."
              autoComplete="off"
              name="dashboard-tournament-search"
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-[#789098]"
            />
          </label>
          <div className="flex min-w-0 flex-wrap gap-2">
            {sportOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSportFilterChange(option.value)}
                className={`flex h-11 min-w-0 items-center justify-center gap-2 rounded border px-4 text-xs font-black transition ${
                  sportFilter === option.value
                    ? "border-[#84d8e8] bg-[#143943] text-[#84d8e8]"
                    : "border-[#3a4d54] bg-[#0d252d] text-[#dce8eb] hover:border-[#84d8e8] hover:text-[#84d8e8]"
                }`}
              >
                {option.icon}
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="space-y-3 p-4">
        {tournaments.map((tournament) => (
          <DashboardTournamentCard
            key={tournament.id}
            tournament={tournament}
            matches={matches.filter(
              (match) => match.tournamentId === tournament.id,
            )}
            isAdmin={isAdmin}
            onSelectTournament={onSelectTournament}
            onEditTournament={onEditTournament}
            onDeleteTournament={onDeleteTournament}
          />
        ))}

        {tournaments.length === 0 && (
          <div className="rounded border border-dashed border-[#3a4d54] px-6 py-14 text-center">
            <p className="font-black text-white">No tournaments match this view.</p>
            <p className="mt-2 text-sm text-[#9fb2b8]">
              Try another sport, status, or search keyword.
            </p>
          </div>
        )}

        {emptyGroups.length > 0 && (
          <div className="flex flex-wrap gap-3 rounded border border-dashed border-[#3a4d54] bg-[#0a1d23] p-4">
            {emptyGroups.slice(0, 4).map((group) => (
              <div
                key={group.sportType}
                className="flex min-h-12 min-w-[220px] flex-1 items-center justify-center gap-3 rounded border border-[#243c43] bg-[#0d252d] px-4 py-3 text-center"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#3a4d54] bg-[#143942] text-[#84d8e8]">
                  {getSportMeta(group.sportType).icon}
                </span>
                <p className="text-sm font-bold text-[#dce8eb]">
                  No {getSportMeta(group.sportType).label} tournaments
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function getNextTournamentMatch(matches: MatchRow[]) {
  const now = Date.now();
  const sortedMatches = [...matches].sort(
    (first, second) =>
      new Date(first.scheduledTime).getTime() -
      new Date(second.scheduledTime).getTime(),
  );
  const upcoming = sortedMatches.find((match) => {
    const timestamp = new Date(match.scheduledTime).getTime();

    return Number.isFinite(timestamp) && timestamp >= now;
  });

  return upcoming ?? sortedMatches[0] ?? null;
}

export function getTournamentDashboardPriority(tournament: TournamentRow) {
  const status = tournament.status.toUpperCase();

  if (status === "ONGOING" || status === "ACTIVE") {
    return 0;
  }

  if (status === "UPCOMING") {
    return 1;
  }

  if (status === "COMPLETE" || status === "COMPLETED") {
    return 2;
  }

  return 3;
}

export function getTournamentSportFilterValue(tournament: TournamentRow) {
  if (
    tournament.source?.toUpperCase() === "CITO_LOL" ||
    normalizeSportType(tournament.sportType) === "LOL"
  ) {
    return "LOL";
  }

  const sportType = normalizeSportType(tournament.sportType);

  if (sportType === "FOOTBALL" || sportType === "F1") {
    return sportType;
  }

  return "OTHER";
}
