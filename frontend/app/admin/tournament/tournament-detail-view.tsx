import { useState } from "react";
import { CalendarDays, ChevronLeft, FileDown, Trophy, Users, Zap } from "lucide-react";
import { ScoringRulesView } from "./scoring-rules-view";
import {
  DashboardPanelTitle,
  DashboardSourceBadge,
  DashboardStatusBadge,
  MatchTeams,
} from "../shared/dashboard-ui";
import type { MatchRow, TournamentRow } from "./types";
import {
  formatDateOnly,
  formatDateTime,
  formatScore,
  formatShortTime,
  getTournamentDateRange,
  isFinishedStatus,
} from "./utils";
export function TournamentDetailView({
  tournament,
  matches,
  isTodayScope,
  onBack,
  onUnavailableFeature,
}: {
  tournament: TournamentRow;
  matches: MatchRow[];
  isTodayScope: boolean;
  onBack: () => void;
  onUnavailableFeature: () => void;
}) {
  const sortedMatches = [...matches].sort(
    (first, second) =>
      new Date(first.scheduledTime).getTime() -
      new Date(second.scheduledTime).getTime(),
  );
  const finishedMatches = sortedMatches
    .filter((match) => isFinishedStatus(match.status))
    .slice()
    .reverse();
  const upcomingMatches = sortedMatches.filter(
    (match) => !isFinishedStatus(match.status),
  );
  const completedCount = finishedMatches.length;
  const progress = matches.length
    ? Math.round((completedCount / matches.length) * 100)
    : 0;
  const dateRange = getTournamentDateRange(sortedMatches);
  const firstUpcoming = upcomingMatches[0];
  const schedulePageSize = 8;
  const [schedulePage, setSchedulePage] = useState(1);
  const [activeTab, setActiveTab] = useState("Overview");
  const scheduleTotalPages = Math.max(1, Math.ceil(sortedMatches.length / schedulePageSize));
  const activeSchedulePage = Math.min(schedulePage, scheduleTotalPages);
  const scheduleStart = (activeSchedulePage - 1) * schedulePageSize;
  const visibleScheduleMatches = sortedMatches.slice(
    scheduleStart,
    scheduleStart + schedulePageSize,
  );
  const emptyScheduleMessage = isTodayScope
    ? `Gi?i ${tournament.name} không có l?ch thi đ?u hôm nay.`
    : 'No schedule has been imported for this tournament.';

  return (
    <section className="min-w-0 overflow-hidden rounded border border-[#3a4d54] bg-[#07181d] bg-[radial-gradient(circle_at_1px_1px,rgba(132,216,232,0.08)_1px,transparent_0)] [background-size:24px_24px]">
      <div className="border-b border-[#314850] px-4 py-5 sm:px-7 lg:px-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 border border-[#3a4d54] bg-[#0d252d] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8]"
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <p className="text-base font-black uppercase tracking-[0.06em] text-[#b7d2d8]">
            Tournaments Detail
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 border-l-4 border-[#84d8e8] bg-[#14272e] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#dce8eb] shadow-[0_0_24px_rgba(132,216,232,0.12)]">
                <span className="h-2 w-2 rounded-full bg-[#84d8e8]" />
                {tournament.status}
              </span>
              <h3 className="min-w-0 break-words text-2xl font-black text-white">
                {tournament.name}
              </h3>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-black text-[#dce8eb]">
              <span className="inline-flex items-center gap-2">
                <Users size={15} /> {tournament.teams.toLocaleString()} Teams
              </span>
              <span className="inline-flex items-center gap-2">
                <Trophy size={15} /> {matches.length.toLocaleString()} Matches
              </span>
              <span className="inline-flex items-center gap-2">
                <Zap size={15} /> {Math.max(matches.length * 3, 0).toLocaleString()} Predictions
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={15} /> {dateRange}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onUnavailableFeature}
            className="inline-flex min-h-[54px] items-center justify-center gap-4 border border-[#3a4d54] bg-[#162b32] px-5 py-3 text-center text-xs font-black uppercase tracking-[0.08em] text-[#84d8e8] transition hover:border-[#84d8e8] hover:bg-[#1b343d]"
          >
            <FileDown size={20} />
            Import Match
          </button>
        </div>

        <div className="mt-7 flex flex-wrap gap-5 border-b border-[#3a4d54]">
          {['Overview', 'Predictions', 'Stages', 'Scoring Rules'].map(
            (tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  if (tab === "Overview") {
                    setActiveTab(tab);
                  } else if (tab === "Scoring Rules") {
                    setActiveTab(tab);
                  } else {
                    onUnavailableFeature();
                  }
                }}
                className={`pb-4 text-xs font-black uppercase tracking-[0.08em] ${
                  activeTab === tab
                    ? 'border-b-2 border-[#84d8e8] text-[#84d8e8]'
                    : 'text-[#9fb2b8] transition hover:text-[#84d8e8]'
                }`}
              >
                {tab}
              </button>
            ),
          )}
        </div>
      </div>

      {activeTab === "Scoring Rules" ? (
        <ScoringRulesView tournament={tournament} />
      ) : (
      <>
      <div className="grid gap-5 p-4 sm:p-7 lg:grid-cols-[360px_minmax(0,1fr)] lg:p-8">
        <section className="relative overflow-hidden border border-[#3a4d54] bg-[#0d252d] p-6 text-center">
          <Trophy
            aria-hidden="true"
            className="absolute right-5 top-5 text-[#27414a]"
            size={64}
          />
          <div
            className="mx-auto grid h-48 w-48 place-items-center rounded-full"
            style={{
              background: `conic-gradient(#84d8e8 ${progress * 3.6}deg, #203841 0deg)`,
            }}
          >
            <div className="grid h-36 w-36 place-items-center rounded-full bg-[#0d252d]">
              <div>
                <p className="text-3xl font-black text-white">{progress}%</p>
                <p className="text-xs font-bold uppercase text-[#dce8eb]">
                  Progress
                </p>
              </div>
            </div>
          </div>
          <p className="mt-6 text-xl font-black text-white">
            {completedCount} of {matches.length} Matches Completed
          </p>
          <p className="mt-3 text-lg leading-relaxed text-[#c8d6db]">
            {firstUpcoming
              ? `Next match starts ${formatDateTime(firstUpcoming.scheduledTime)}.`
              : matches.length > 0
                ? 'All imported matches are completed.'
                : emptyScheduleMessage}
          </p>
        </section>

        <section className="overflow-hidden border border-[#3a4d54] bg-[#0d252d]">
          <DashboardPanelTitle
            title="Upcoming Matches"
            right={`${upcomingMatches.length} total`}
          />
          <div className="divide-y divide-[#243c43]">
            {upcomingMatches.slice(0, 3).map((match) => (
              <CompactMatchRow key={match.id} match={match} />
            ))}
            {upcomingMatches.length === 0 && (
              <p className="px-6 py-16 text-center text-[#9fb2b8]">
                {emptyScheduleMessage}
              </p>
            )}
          </div>
        </section>

        <section className="overflow-hidden border border-[#3a4d54] bg-[#0d252d]">
          <DashboardPanelTitle
            title="Recent Results"
            right={finishedMatches.length ? 'Auto-synced' : undefined}
          />
          <div className="space-y-4 p-5">
            {finishedMatches.slice(0, 3).map((match) => (
              <ResultMatchRow key={match.id} match={match} />
            ))}
            {finishedMatches.length === 0 && (
              <p className="py-12 text-center text-[#9fb2b8]">
                No completed results found.
              </p>
            )}
          </div>
        </section>

        <section className="overflow-hidden border border-[#3a4d54] bg-[#0d252d]">
          <DashboardPanelTitle title="Leaderboard Top 3" right="View Full" />
          <div className="space-y-4 p-5">
            {['Rank 01', 'Rank 02', 'Rank 03'].map((rank, index) => (
              <div
                key={rank}
                className={`flex items-center justify-between border border-[#243c43] bg-[#10242b] p-4 ${
                  index === 0 ? 'border-l-4 border-l-[#84d8e8]' : ''
                }`}
              >
                <div>
                  <p className="text-xs font-black uppercase text-[#84d8e8]">
                    {rank}
                  </p>
                  <p className="mt-1 font-black text-white">No player data</p>
                </div>
                <span className="text-lg font-black text-[#dce8eb]">0</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="border-t border-[#314850] p-4 sm:p-7 lg:p-8">
        <DashboardPanelTitle
          title="Full Match Schedule"
          right={
            sortedMatches.length > 0
              ? `Showing ${scheduleStart + 1}-${Math.min(
                  scheduleStart + schedulePageSize,
                  sortedMatches.length,
                )} of ${sortedMatches.length}`
              : undefined
          }
        />
        <div className="overflow-hidden border-x border-b border-[#3a4d54] bg-[#0d252d]">
          <div className="hidden grid-cols-[minmax(220px,1.4fr)_180px_180px_120px_120px] border-b border-[#3a4d54] bg-[#14272e] px-5 py-4 text-xs font-black uppercase tracking-[0.08em] text-[#dce8eb] lg:grid">
            <span>Teams</span>
            <span>Match Time</span>
            <span>Prediction Lock</span>
            <span>Score</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-[#243c43]">
            {visibleScheduleMatches.map((match) => (
              <ScheduleMatchRow key={match.id} match={match} />
            ))}
            {visibleScheduleMatches.length === 0 && (
              <p className="px-6 py-14 text-center text-[#9fb2b8]">
                {emptyScheduleMessage}
              </p>
            )}
          </div>
          {sortedMatches.length > schedulePageSize && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#243c43] px-4 py-4">
              <p className="text-xs font-black uppercase text-[#9fb2b8]">
                Page {activeSchedulePage} of {scheduleTotalPages}
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: scheduleTotalPages }, (_, index) => index + 1).map(
                  (page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setSchedulePage(page)}
                      className={`h-9 min-w-9 border px-3 text-xs font-black transition ${
                        page === activeSchedulePage
                          ? "border-[#84d8e8] bg-[#84d8e8] text-[#06161b]"
                          : "border-[#3a4d54] text-white hover:border-[#84d8e8] hover:text-[#84d8e8]"
                      }`}
                    >
                      {page}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </section>
      </>
      )}
    </section>
  );
}
function CompactMatchRow({ match }: { match: MatchRow }) {
  return (
    <article className="grid gap-4 px-5 py-5 sm:grid-cols-[120px_minmax(0,1fr)_120px] sm:items-center">
      <div>
        <p className="text-xs font-black uppercase text-[#789098]">
          {formatDateOnly(match.scheduledTime)}
        </p>
        <p className="mt-1 text-lg font-black text-white">
          {formatShortTime(match.scheduledTime)}
        </p>
      </div>
      <div className="min-w-0">
        <MatchTeams match={match} />
      </div>
      <div className="sm:text-right">
        <DashboardSourceBadge source={match.source} />
      </div>
    </article>
  );
}

function ScheduleMatchRow({ match }: { match: MatchRow }) {
  return (
    <article className="grid gap-4 px-5 py-5 text-sm lg:grid-cols-[minmax(220px,1.4fr)_180px_180px_120px_120px] lg:items-center">
      <div className="min-w-0">
        <MatchTeams match={match} />
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#789098] lg:hidden">
          Match Time
        </p>
        <p className="font-bold text-white">{formatDateTime(match.scheduledTime)}</p>
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#789098] lg:hidden">
          Prediction Lock
        </p>
        <p className="font-bold text-[#dce8eb]">{formatDateTime(match.deadline)}</p>
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#789098] lg:hidden">
          Score
        </p>
        <p className="font-black text-white">{formatScore(match)}</p>
      </div>
      <DashboardStatusBadge status={match.status} />
    </article>
  );
}

function ResultMatchRow({ match }: { match: MatchRow }) {
  return (
    <article className="grid gap-3 rounded border border-[#243c43] bg-[#10242b] p-4 text-center sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] sm:items-center">
      <div className="font-black text-white">{match.homeName ?? "TBD"}</div>
      <div>
        <p className="text-xl font-black text-[#84d8e8]">
          {formatScore(match)}
        </p>
        <p className="mt-1 text-xs font-black uppercase text-[#9fb2b8]">
          Final
        </p>
      </div>
      <div className="font-black text-white">{match.awayName ?? "TBD"}</div>
    </article>
  );
}




