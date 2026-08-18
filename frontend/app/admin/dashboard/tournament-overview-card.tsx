import type React from "react";
import { Gamepad2, Pencil, Trash2, Trophy, Users } from "lucide-react";
import {
  DashboardSourceBadge,
  DashboardStatusBadge,
} from "../shared/dashboard-ui";
import type { MatchRow, TournamentRow } from "../tournaments/types";
import { formatDateTime, normalizeSportType } from "../tournaments/utils";

export function DashboardTournamentCard({
  tournament,
  matches,
  isAdmin,
  onSelectTournament,
  onEditTournament,
  onDeleteTournament,
}: {
  tournament: TournamentRow;
  matches: MatchRow[];
  isAdmin: boolean;
  onSelectTournament: React.Dispatch<React.SetStateAction<number | null>>;
  onEditTournament: (tournament: TournamentRow) => void;
  onDeleteTournament: (tournament: TournamentRow) => void;
}) {
  const sportMeta = getSportMeta(getTournamentSportFilterValue(tournament));
  const nextMatch = getNextTournamentMatch(matches);
  const nextMatchLabel = nextMatch
    ? `${nextMatch.homeName ?? "TBD"} vs ${nextMatch.awayName ?? "TBD"}`
    : "Schedule TBD";
  const nextMatchTime = nextMatch
    ? formatDateTime(nextMatch.scheduledTime)
    : "No upcoming match";
  const deleteAllowed = canDeleteTournament(tournament);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelectTournament(tournament.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectTournament(tournament.id);
        }
      }}
      className="grid cursor-pointer gap-4 rounded border border-[#2c4750] bg-[#0b2027] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[#84d8e8] hover:bg-[#102d35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84d8e8] xl:grid-cols-[112px_minmax(190px,1fr)_90px_110px_minmax(180px,1fr)_110px_112px] xl:items-center"
      aria-label={`Open ${tournament.name} tournament details`}
    >
      <div className="flex h-[96px] w-[96px] items-center justify-center rounded border border-[#3a4d54] bg-[#102d35] text-[#84d8e8]">
        {sportMeta.largeIcon}
      </div>

      <div className="min-w-0">
        <h4
          title={tournament.name}
          className="truncate text-2xl font-black text-white"
        >
          {tournament.name}
        </h4>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-black ${sportMeta.badgeClass}`}
          >
            {sportMeta.icon}
            {sportMeta.label}
          </span>
          <DashboardStatusBadge status={tournament.status} />
        </div>
      </div>

      <MetricBlock label="Teams" value={tournament.teams} />
      <MetricBlock label="Matches Today" value={tournament.matches} />

      <div className="min-w-0 border-[#29444d] xl:border-l xl:pl-6">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#9fb2b8]">
          Next Match
        </p>
        <p
          title={nextMatchLabel}
          className="mt-2 truncate text-base font-black text-white"
        >
          {nextMatchLabel}
        </p>
        <p className="mt-2 truncate text-xs font-bold text-[#9fb2b8]">
          {nextMatchTime}
        </p>
      </div>

      <div className="min-w-0 border-[#29444d] xl:border-l xl:pl-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#9fb2b8]">
          Source
        </p>
        <DashboardSourceBadge source={tournament.source} />
      </div>

      <div className="grid gap-2">
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEditTournament(tournament);
              }}
              className="flex h-9 items-center justify-center gap-2 rounded border border-[#3a4d54] bg-[#102d35] px-3 text-xs font-black text-[#84d8e8] transition hover:border-[#84d8e8]"
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteTournament(tournament);
              }}
              disabled={!deleteAllowed}
              title={
                deleteAllowed
                  ? "Delete tournament"
                  : "Only completed tournaments can be deleted"
              }
              className="flex h-9 items-center justify-center gap-2 rounded border border-[#5d3037] bg-[#2a1115] px-3 text-xs font-black text-[#ff8a8a] transition hover:border-[#ff8a8a] disabled:cursor-not-allowed disabled:border-[#3a4d54] disabled:bg-[#10242b] disabled:text-[#789098]"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function canDeleteTournament(tournament: TournamentRow) {
  return tournament.status.toUpperCase() === "COMPLETE";
}

function MetricBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 border-[#29444d] xl:border-l xl:pl-6">
      <p className="text-[28px] font-black leading-none text-white tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="mt-2 text-xs font-bold text-[#9fb2b8]">{label}</p>
    </div>
  );
}

function getNextTournamentMatch(matches: MatchRow[]) {
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

function getTournamentSportFilterValue(tournament: TournamentRow) {
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

export function getSportMeta(sportType: string) {
  const normalized = sportType.toUpperCase();

  if (normalized === "LOL") {
    return {
      label: "League of Legends",
      icon: <Gamepad2 size={14} />,
      largeIcon: <Gamepad2 size={40} />,
      badgeClass: "bg-[#2b2050] text-[#d8c7ff]",
    };
  }

  if (normalized === "F1") {
    return {
      label: "F1",
      icon: <FlagIcon />,
      largeIcon: <FlagIcon size={42} />,
      badgeClass: "bg-[#35171b] text-[#ff8a8a]",
    };
  }

  if (normalized === "OTHER") {
    return {
      label: "Other Sports",
      icon: <Users size={14} />,
      largeIcon: <Users size={40} />,
      badgeClass: "bg-[#203940] text-[#dce8eb]",
    };
  }

  return {
    label: "Football",
    icon: <Trophy size={14} />,
    largeIcon: <Trophy size={42} />,
    badgeClass: "bg-[#143943] text-[#84d8e8]",
  };
}

export function FlagIcon({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center font-black leading-none"
      style={{ width: size, height: size, fontSize: Math.max(10, size - 4) }}
    >
      F1
    </span>
  );
}
