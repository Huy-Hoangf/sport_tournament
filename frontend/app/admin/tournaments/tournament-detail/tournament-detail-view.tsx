import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  FileDown,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useEffect } from "react";
import { apiRequest } from "../../../api";
import { MatchEditor } from "../../matches/match-editor";
import { PredictionHistory } from "../../matches/predictions";
import type { LeaderboardEntry } from "../../leaderboard/types";
import { ScoringRulesView } from "./scoring-rules-tab";
import { StageStrip } from "./stage-strip";
import { TeamsTab } from "./teams-tab";
import {
  DashboardPanelTitle,
  DashboardSourceBadge,
  DashboardStatusBadge,
  MatchTeams,
} from "../../shared/dashboard-ui";
import type { MatchRow, TournamentRow, TournamentStage } from "../types";
import {
  formatDateOnly,
  formatDateTime,
  formatScore,
  formatShortTime,
  getTournamentDateRange,
  isFinishedStatus,
} from "../utils";

const stagesByFormat: Record<NonNullable<TournamentRow["format"]>, string[]> = {
  ROUND_ROBIN: ["League Schedule", "Final Table"],
  KNOCKOUT: ["Round of 16", "Quarter Finals", "Semi Finals", "Final"],
  GROUP_AND_KNOCKOUT: [
    "Group Stage",
    "Round of 16",
    "Quarter Finals",
    "Semi Finals",
    "Final",
  ],
  CUSTOM: ["Custom Stage"],
};

const formatLabels: Record<NonNullable<TournamentRow["format"]>, string> = {
  ROUND_ROBIN: "Round Robin",
  KNOCKOUT: "Knockout",
  GROUP_AND_KNOCKOUT: "Group + Knockout",
  CUSTOM: "Custom Format",
};
export function TournamentDetailView({
  tournament,
  matches,
  isTodayScope,
  onBack,
  onUnavailableFeature,
  canManage,
  onOpenStageMatches,
}: {
  tournament: TournamentRow;
  matches: MatchRow[];
  isTodayScope: boolean;
  onBack: () => void;
  onUnavailableFeature: () => void;
  canManage: boolean;
  onOpenStageMatches: (stage: TournamentStage) => void;
}) {
  const [loadedMatches, setLoadedMatches] = useState<MatchRow[] | null>(null);
  const [predictionCount, setPredictionCount] = useState(0);
  const [leaderboardResult, setLeaderboardResult] = useState<{
    tournamentId: number;
    entries: LeaderboardEntry[];
    error: boolean;
  } | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const activeMatches = loadedMatches ?? matches;
  const sortedMatches = [...activeMatches].sort(
    (first, second) =>
      new Date(first.scheduledTime).getTime() -
      new Date(second.scheduledTime).getTime(),
  );
  const finishedMatches = sortedMatches
    .filter((match) => isFinishedStatus(match.status))
    .slice()
    .reverse();
  const upcomingMatches = sortedMatches.filter(
    (match) =>
      match.status === "PENDING" &&
      now !== null &&
      new Date(match.scheduledTime).getTime() > now,
  );
  const visibleLeaderboard =
    leaderboardResult?.tournamentId === tournament.id
      ? leaderboardResult
      : null;
  const completedCount = finishedMatches.length;
  const progress = activeMatches.length
    ? Math.round((completedCount / activeMatches.length) * 100)
    : 0;
  const dateRange = getTournamentDateRange(sortedMatches);
  const firstUpcoming = upcomingMatches[0];
  const schedulePageSize = 8;
  const [importOpen, setImportOpen] = useState(false);
  const [schedulePage, setSchedulePage] = useState(1);
  const [activeTab, setActiveTab] = useState("Overview");
  const [matchImportMessage, setMatchImportMessage] = useState("");
  const [stages, setStages] = useState<TournamentStage[]>([]);
  const tournamentFormat = tournament.format ?? "ROUND_ROBIN";
  const fallbackStages = stagesByFormat[tournamentFormat].map(
    (name, index) => ({
      id: -(index + 1),
      tournamentId: tournament.id,
      name,
      sortOrder: index + 1,
      correctPoints: 1,
      exactScoreBonus: 0,
      isKnockout: name !== "Group Stage" && name !== "League Schedule",
    }),
  );
  const stageItems = stages.length ? stages : fallbackStages;
  const scheduleTotalPages = Math.max(
    1,
    Math.ceil(sortedMatches.length / schedulePageSize),
  );
  const activeSchedulePage = Math.min(schedulePage, scheduleTotalPages);
  const schedulePaginationItems = getCompactPageItems(
    activeSchedulePage,
    scheduleTotalPages,
  );
  const scheduleStart = (activeSchedulePage - 1) * schedulePageSize;
  const visibleScheduleMatches = sortedMatches.slice(
    scheduleStart,
    scheduleStart + schedulePageSize,
  );
  const emptyScheduleMessage = isTodayScope
    ? `${tournament.name} has no matches scheduled today.`
    : "No schedule has been imported for this tournament.";

  useEffect(() => {
    const initialTick = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiRequest<{ total: number }>(`/predictions?tournamentId=${tournament.id}`)
      .then((data) => {
        if (isMounted) setPredictionCount(data.total);
      })
      .catch(() => {
        if (isMounted) setPredictionCount(0);
      });

    apiRequest<TournamentStage[]>(`/stages?tournamentId=${tournament.id}`)
      .then((data) => {
        if (isMounted) {
          setStages(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStages([]);
        }
      });

    apiRequest<LeaderboardEntry[]>(`/leaderboard?tournamentId=${tournament.id}`)
      .then((entries) => {
        if (isMounted) {
          setLeaderboardResult({ tournamentId: tournament.id, entries, error: false });
        }
      })
      .catch(() => {
        if (isMounted) {
          setLeaderboardResult({ tournamentId: tournament.id, entries: [], error: true });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [tournament.id]);

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

        <div className="grid gap-5 lg:grid-cols-[minmax(300px,0.85fr)_minmax(420px,1.35fr)_200px] lg:items-start">
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
                <Trophy size={15} /> {activeMatches.length.toLocaleString()} Matches
              </span>
              <span className="inline-flex items-center gap-2">
                <Zap size={15} /> {predictionCount.toLocaleString()} Predictions
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={15} /> {dateRange}
              </span>
            </div>
          </div>

          <StageStrip
            stages={stageItems}
            formatLabel={
              tournamentFormat === "CUSTOM"
                ? (tournament.customFormat?.name ?? formatLabels.CUSTOM)
                : formatLabels[tournamentFormat]
            }
            onOpenStageMatches={onOpenStageMatches}
          />

          {canManage ? (
            <div>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex min-h-[54px] items-center justify-center gap-4 border border-[#3a4d54] bg-[#162b32] px-5 py-3 text-center text-xs font-black uppercase tracking-[0.08em] text-[#84d8e8] transition hover:border-[#84d8e8] hover:bg-[#1b343d]"
              >
                <FileDown size={20} />
                Import List Match
              </button>
              {matchImportMessage && (
                <p className="mt-2 max-w-[230px] text-xs font-bold text-[#84d8e8]">
                  {matchImportMessage}
                </p>
              )}
            </div>
          ) : (
            <div className="inline-flex min-h-[54px] items-center justify-center border border-[#3a4d54] bg-[#0d252d] px-5 py-3 text-center text-xs font-black uppercase tracking-[0.08em] text-[#789098]">
              View Only
            </div>
          )}
        </div>

        <div className="mt-7 flex flex-wrap gap-5 border-b border-[#3a4d54]">
          {["Overview", "Teams", "Predictions", "Scoring Rules"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`pb-4 text-xs font-black uppercase tracking-[0.08em] ${
                activeTab === tab
                  ? "border-b-2 border-[#84d8e8] text-[#84d8e8]"
                  : "text-[#9fb2b8] transition hover:text-[#84d8e8]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Scoring Rules" ? (
        <ScoringRulesView tournament={tournament} canManage={canManage} />
      ) : activeTab === "Predictions" ? (
        <PredictionHistory key={tournament.id} tournamentId={tournament.id} />
      ) : activeTab === "Teams" ? (
        <TeamsTab
          tournament={tournament}
          matches={activeMatches}
          canManage={canManage}
          onUnavailableFeature={onUnavailableFeature}
        />
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
                    <p className="text-3xl font-black text-white">
                      {progress}%
                    </p>
                    <p className="text-xs font-bold uppercase text-[#dce8eb]">
                      Progress
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-6 text-xl font-black text-white">
                {completedCount} of {activeMatches.length} Matches Completed
              </p>
              <p className="mt-3 text-lg leading-relaxed text-[#c8d6db]">
                {firstUpcoming
                  ? `Next match starts ${formatDateTime(firstUpcoming.scheduledTime)}.`
                  : now === null
                    ? "Loading schedule…"
                  : activeMatches.length > 0
                    ? "No future matches are scheduled."
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
                    {now === null
                      ? "Loading upcoming matches…"
                      : activeMatches.length > 0
                        ? "No future matches are scheduled."
                        : emptyScheduleMessage}
                  </p>
                )}
              </div>
            </section>

            <section className="overflow-hidden border border-[#3a4d54] bg-[#0d252d]">
              <DashboardPanelTitle
                title="Recent Results"
                right={finishedMatches.length ? "Auto-synced" : undefined}
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
              <DashboardPanelTitle
                title="Leaderboard Top 3"
              />
              <div className="space-y-4 p-5">
                {visibleLeaderboard?.entries.slice(0, 3).map((entry, index) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between border border-[#243c43] bg-[#10242b] p-4 ${
                      index === 0 ? "border-l-4 border-l-[#84d8e8]" : ""
                    }`}
                  >
                    <div>
                      <p className="text-xs font-black uppercase text-[#84d8e8]">
                        Rank {String(index + 1).padStart(2, "0")}
                      </p>
                      <p className="mt-1 font-black text-white">
                        {entry.fullName}
                      </p>
                    </div>
                    <span className="text-lg font-black text-[#dce8eb]">
                      {entry.totalPoints}
                    </span>
                  </div>
                ))}
                {!visibleLeaderboard && (
                  <p className="py-8 text-center text-[#9fb2b8]">Loading leaderboard…</p>
                )}
                {visibleLeaderboard?.error && (
                  <p role="alert" className="py-8 text-center text-[#ffb4a8]">
                    Cannot load leaderboard.
                  </p>
                )}
                {visibleLeaderboard && !visibleLeaderboard.error &&
                  visibleLeaderboard.entries.length === 0 && (
                    <p className="py-8 text-center text-[#9fb2b8]">
                      No predictions yet.
                    </p>
                  )}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSchedulePage((page) => Math.max(1, page - 1))
                      }
                      disabled={activeSchedulePage === 1}
                      className="h-9 border border-[#3a4d54] px-3 text-xs font-black text-white transition hover:border-[#84d8e8] hover:text-[#84d8e8] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Prev
                    </button>
                    {schedulePaginationItems.map((page, index) =>
                      page === "ellipsis" ? (
                        <span
                          key={`ellipsis-${index}`}
                          className="grid h-9 min-w-9 place-items-center text-xs font-black text-[#789098]"
                        >
                          ...
                        </span>
                      ) : (
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
                    <button
                      type="button"
                      onClick={() =>
                        setSchedulePage((page) =>
                          Math.min(scheduleTotalPages, page + 1),
                        )
                      }
                      disabled={activeSchedulePage === scheduleTotalPages}
                      className="h-9 border border-[#3a4d54] px-3 text-xs font-black text-white transition hover:border-[#84d8e8] hover:text-[#84d8e8] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
      {importOpen && (
        <MatchEditor
          importing
          tournamentId={tournament.id}
          onClose={() => setImportOpen(false)}
          onSaved={() => {
            setMatchImportMessage("Import complete. Match schedule refreshed.");
            apiRequest<MatchRow[]>(`/matches?tournamentId=${tournament.id}`)
              .then(setLoadedMatches)
              .catch((error) => setMatchImportMessage(error.message));
          }}
        />
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
        <p className="font-bold text-white">
          {formatDateTime(match.scheduledTime)}
        </p>
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#789098] lg:hidden">
          Prediction Lock
        </p>
        <p className="font-bold text-[#dce8eb]">
          {formatDateTime(match.deadline)}
        </p>
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

function getCompactPageItems(activePage: number, totalPages: number) {
  const pages = new Set([1, totalPages]);

  for (let page = activePage - 1; page <= activePage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }

  const sortedPages = [...pages].sort((first, second) => first - second);
  const items: Array<number | "ellipsis"> = [];

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];

    if (previousPage !== undefined && page - previousPage > 1) {
      items.push("ellipsis");
    }

    items.push(page);
  });

  return items;
}
