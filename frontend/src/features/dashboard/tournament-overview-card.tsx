import type React from "react";
import {
  ArrowRight,
  Gamepad2,
  Pencil,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import {
  DashboardSourceBadge,
  DashboardStatusBadge,
} from "../../components/ui/dashboard-ui";
import type { MatchRow, TournamentRow } from "../tournaments/types";
import { formatDateTime, normalizeSportType } from "../tournaments/utils";
import { getNextTournamentMatch } from "./next-tournament-match";

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
  const hasVotingToday = (tournament.votableMatchesToday ?? 0) > 0;

  return (
    <article
      className={`flex min-w-0 flex-col rounded-lg border p-5 transition ${
        hasVotingToday
          ? "border-[#84d8e8] bg-[#102d35] shadow-[0_0_18px_rgba(132,216,232,0.12)]"
          : "border-[#243c43] bg-[#091c22] saturate-50 hover:saturate-100 focus-within:saturate-100"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={
            "inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-black " +
            sportMeta.badgeClass
          }
        >
          {sportMeta.icon} {sportMeta.label}
        </span>
        <DashboardStatusBadge status={tournament.status} />
      </div>
      <p className={`mt-3 text-xs font-bold ${hasVotingToday ? "text-[#84d8e8]" : "text-[#9fb2b8]"}`}>
        {hasVotingToday
          ? `${tournament.votableMatchesToday} matches open for voting today`
          : "No voting open today"}
      </p>
      <div className="my-5 flex min-w-0 items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[#3a4d54] bg-[#102d35] text-[#84d8e8]">
          {sportMeta.largeIcon}
        </div>
        <div className="min-w-0">
          <h4 className="break-words text-xl font-black text-white">
            <button
              type="button"
              onClick={() => onSelectTournament(tournament.id)}
              className="text-left hover:text-[#84d8e8]"
            >
              {tournament.name}
            </button>
          </h4>
          <div className="mt-2">
            <DashboardSourceBadge source={tournament.source} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 border-y border-[#29444d] py-3 text-sm">
        <p className="font-bold text-[#9fb2b8]">
          <span className="mr-2 text-lg text-[#84d8e8]">
            {tournament.teams}
          </span>
          Teams
        </p>
        <p className="font-bold text-[#9fb2b8]">
          <span className="mr-2 text-lg text-[#84d8e8]">
            {tournament.matches}
          </span>
          Matches Today
        </p>
      </div>
      <div className="flex-1 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#9fb2b8]">
          Next Match
        </p>
        <p className="mt-1 break-words text-sm font-black text-white">
          {nextMatchLabel}
        </p>
        <p className="mt-1 text-xs font-bold text-[#9fb2b8]">{nextMatchTime}</p>
      </div>
      <button
        type="button"
        onClick={() => onSelectTournament(tournament.id)}
        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded border px-4 py-3 text-sm font-black transition ${
          hasVotingToday
            ? "border-[#84d8e8] bg-[#84d8e8] text-[#06161b] hover:bg-[#a6e5ef]"
            : "border-[#3a4d54] bg-[#10242b] text-[#9fb2b8] hover:text-white"
        }`}
      >
        {hasVotingToday ? "Enter Tournament & Vote" : "View Tournament"}
        <ArrowRight aria-hidden="true" size={17} />
      </button>
      {isAdmin && (
        <div className="mt-3 flex gap-2 border-t border-[#29444d] pt-3">
          <button
            type="button"
            onClick={() => onEditTournament(tournament)}
            className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded border border-[#3a4d54] text-xs font-bold text-[#84d8e8] hover:border-[#84d8e8]"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            type="button"
            onClick={() => onDeleteTournament(tournament)}
            disabled={!deleteAllowed}
            title={
              deleteAllowed
                ? "Delete tournament"
                : "Only completed tournaments can be deleted"
            }
            className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded border border-[#5d3037] text-xs font-bold text-[#ff8a8a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </article>
  );
}

function canDeleteTournament(tournament: TournamentRow) {
  return tournament.status.toUpperCase() === "COMPLETE";
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
