"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Pencil,
  Search,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { apiRequest } from "../../api";
import { AdminSelect } from "../shared/admin-select";
import {
  DashboardSourceBadge,
  DashboardStatusBadge,
  DashboardStatCard,
  MatchTeams,
} from "../shared/dashboard-ui";
import type { MatchRow } from "../tournament/types";
import { formatDateTime, formatScore, isFinishedStatus } from "../tournament/utils";

export type MatchesInitialFilter = {
  tournamentId?: number;
  stageId?: number;
  tournamentName?: string;
  stageName?: string;
};

export default function MatchesView({
  initialFilter,
  canManage,
  onUnavailableFeature,
}: {
  initialFilter?: MatchesInitialFilter;
  canManage: boolean;
  onUnavailableFeature: () => void;
}) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const filteredMatches = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return matches.filter((match) => {
      const matchesStatus =
        status === "ALL" || match.status.toUpperCase() === status;
      const matchesQuery =
        !keyword ||
        `${match.homeName} ${match.awayName} ${match.tournamentName} ${match.stageName}`
          .toLowerCase()
          .includes(keyword);

      return matchesStatus && matchesQuery;
    });
  }, [matches, query, status]);

  const todayCount = matches.filter((match) => {
    const matchDate = new Date(match.scheduledTime);
    const today = new Date();
    return matchDate.toDateString() === today.toDateString();
  }).length;
  const pendingCount = matches.filter(
    (match) => !isFinishedStatus(match.status),
  ).length;
  const finishedCount = matches.filter((match) =>
    isFinishedStatus(match.status),
  ).length;

  useEffect(() => {
    const params = new URLSearchParams();

    if (initialFilter?.tournamentId) {
      params.set("tournamentId", String(initialFilter.tournamentId));
    }

    if (initialFilter?.stageId) {
      params.set("stageId", String(initialFilter.stageId));
    }

    apiRequest<MatchRow[]>(`/matches${params.size ? `?${params}` : ""}`)
      .then((data) => {
        setMatches(data);
        setNotice("");
      })
      .catch((error) => {
        setNotice(error instanceof Error ? error.message : "Cannot load matches.");
      })
      .finally(() => setIsLoading(false));
  }, [initialFilter?.stageId, initialFilter?.tournamentId]);

  return (
    <div className="px-4 py-6 sm:px-6 xl:px-8 xl:py-9">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[34px] font-black leading-none text-white">
            Matches
          </h2>
          {(initialFilter?.tournamentName || initialFilter?.stageName) && (
            <p className="mt-3 text-sm font-bold text-[#9fb2b8]">
              {initialFilter.tournamentName ?? "All tournaments"}
              {initialFilter.stageName ? ` / ${initialFilter.stageName}` : ""}
            </p>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={onUnavailableFeature}
            className="h-12 rounded bg-[#84d8e8] px-6 font-black text-[#06161b]"
          >
            + Add Match
          </button>
        )}
      </div>

      <section className="mb-5 grid gap-3 xl:grid-cols-[minmax(280px,1fr)_180px_180px]">
        <label className="flex h-12 min-w-0 items-center gap-3 border border-[#3a4d54] bg-[#06161b] px-4 text-[#9fb2b8] focus-within:border-[#84d8e8]">
          <Search size={18} className="shrink-0 text-[#84d8e8]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search team or tournament..."
            className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-[#789098]"
          />
        </label>
        <AdminSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: "ALL", label: "All Status" },
            { value: "PENDING", label: "Pending" },
            { value: "LIVE", label: "Live" },
            { value: "FINISHED", label: "Finished" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
          ariaLabel="Filter matches by status"
        />
        <div className="flex h-12 items-center justify-center border border-[#3a4d54] bg-[#14272e] text-xs font-black uppercase tracking-[0.08em] text-[#84d8e8]">
          {filteredMatches.length} matches
        </div>
      </section>

      <section className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <DashboardStatCard title="Today" value={todayCount} icon={<CalendarDays size={21} />} />
        <DashboardStatCard title="Pending" value={pendingCount} icon={<Users size={21} />} />
        <DashboardStatCard title="Finished" value={finishedCount} icon={<Trophy size={21} />} />
      </section>

      <section className="overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d]">
        <div className="hidden grid-cols-[minmax(260px,1.35fr)_minmax(180px,0.8fr)_180px_120px_120px_110px] border-b border-[#3a4d54] bg-[#14272e] px-5 py-4 text-xs font-black uppercase tracking-[0.08em] text-[#84d8e8] lg:grid">
          <span>Match</span>
          <span>Tournament</span>
          <span>Time</span>
          <span>Status</span>
          <span>Score</span>
          <span>{canManage ? "Action" : "Source"}</span>
        </div>
        <div className="divide-y divide-[#243c43]">
          {filteredMatches.map((match) => (
            <article
              key={match.id}
              className="grid gap-4 px-5 py-5 text-sm lg:grid-cols-[minmax(260px,1.35fr)_minmax(180px,0.8fr)_180px_120px_120px_110px] lg:items-center"
            >
              <MatchTeams match={match} />
              <div className="min-w-0">
                <p className="truncate font-black text-white">
                  {match.tournamentName}
                </p>
                <p className="mt-1 truncate text-xs font-bold text-[#84d8e8]">
                  {match.stageName ?? "Stage TBD"}
                </p>
              </div>
              <p className="font-bold text-[#dce8eb]">
                {formatDateTime(match.scheduledTime)}
              </p>
              <DashboardStatusBadge status={match.status} />
              <p className="font-black text-white">{formatScore(match)}</p>
              <div className="flex items-center gap-2">
                <DashboardSourceBadge source={match.source} />
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={onUnavailableFeature}
                      title="Edit match"
                      className="grid h-9 w-9 place-items-center border border-[#3a4d54] text-[#84d8e8] hover:border-[#84d8e8]"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={onUnavailableFeature}
                      title="Delete match"
                      className="grid h-9 w-9 place-items-center border border-[#3a4d54] text-[#ff8a8a] hover:border-[#ff8a8a]"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
          {!isLoading && filteredMatches.length === 0 && (
            <p className="px-6 py-16 text-center text-sm font-bold text-[#9fb2b8]">
              No matches found.
            </p>
          )}
          {isLoading && (
            <p className="px-6 py-16 text-center text-sm font-bold text-[#9fb2b8]">
              Loading matches...
            </p>
          )}
        </div>
      </section>
      {notice && <p className="mt-4 text-sm font-bold text-[#ff8a8a]">{notice}</p>}
    </div>
  );
}
