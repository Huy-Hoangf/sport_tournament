import { useState } from "react";
import { navigate, type TournamentTab } from "../../workspace/navigation";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useEffect } from "react";
import { apiRequest } from "../../../lib/api/client";
import { loadAllMatchPages } from "../../matches/load-tournament-matches";
import { MatchEditor } from "../../matches/match-editor";
import { PredictionHistory } from "../../matches/predictions";
import { InlineVotePanel, type MyPrediction, type PersonalPredictionResult } from "../../matches/inline-vote-panel";
import { getVotingClosedReason } from "../../matches/voting-availability";
import type { LeaderboardEntry } from "../../leaderboard/types";
import { ScoringRulesView } from "./scoring-rules-tab";
import { StageStrip } from "./stage-strip";
import { TeamsTab } from "./teams-tab";
import { TeamImportDialog } from "./team-import-dialog";
import { TournamentSetup } from "./tournament-setup";
import {
  DashboardPanelTitle,
  DashboardStatusBadge,
  DashboardSourceBadge,
  MatchTeams,
} from "../../../components/ui/dashboard-ui";
import type { MatchRow, TournamentRow, TournamentStage } from "../types";
import {
  formatDateTime,
  formatScore,
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
  activeTab,
  onTabChange,
  matches,
  isTodayScope,
  onBack,
  onUnavailableFeature,
  canManage,
  onOpenStageMatches,
}: {
  tournament: TournamentRow;
  activeTab: TournamentTab;
  onTabChange: (tab: TournamentTab) => void;
  matches: MatchRow[];
  isTodayScope: boolean;
  onBack: () => void;
  onUnavailableFeature: () => void;
  canManage: boolean;
  onOpenStageMatches: (stage: TournamentStage) => void;
}) {
  const [loadedMatches, setLoadedMatches] = useState<MatchRow[] | null>(null);
  const [predictionCount, setPredictionCount] = useState(0);
  const [predictionRefresh, setPredictionRefresh] = useState(0);
  const [personalPredictions, setPersonalPredictions] = useState<PersonalPredictionResult | null>(null);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleRetry, setScheduleRetry] = useState(0);
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
  const votingOpen = upcomingMatches.some((match) => !getVotingClosedReason(match, tournament, now));
  const schedulePageSize = 8;
  const [importOpen, setImportOpen] = useState(false);
  const [teamImportOpen, setTeamImportOpen] = useState(false);
  const [teamImportResult, setTeamImportResult] = useState<{ count: number; tournamentId: number } | null>(null);
  const [matchEditorOpen, setMatchEditorOpen] = useState(false);
  const [openTeamRegistration, setOpenTeamRegistration] = useState(false);
  const [setupCounts, setSetupCounts] = useState<{ tournamentId: number; teamCount: number | null; matchCount: number | null } | null>(null);
  const [schedulePage, setSchedulePage] = useState(1);
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
  const emptyScheduleMessage = isTodayScope && !loadedMatches
    ? `${tournament.name} has no matches scheduled today.`
    : "No schedule has been imported for this tournament.";

  useEffect(() => {
    const initialTick = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
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

    return () => { isMounted = false; };
  }, [tournament.id, predictionRefresh]);

  useEffect(() => {
    let active = true;
    loadAllMatchPages((page) => apiRequest<{ items: MatchRow[]; total: number }>(
      `/matches/page?tournamentId=${tournament.id}&page=${page}&pageSize=100`,
    )).then((items) => {
      if (active) { setLoadedMatches(items); setScheduleError(""); }
    }).catch(() => {
      if (active) setScheduleError("Cannot load the full schedule. Please try again.");
    });
    return () => { active = false; };
  }, [tournament.id, scheduleRetry]);

  useEffect(() => {
    let isMounted = true;

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

  useEffect(() => {
    if (!canManage || activeTab !== "Overview") return;
    let active = true;
    Promise.allSettled([
      apiRequest<Array<{ id: number }>>(`/teams?tournamentId=${tournament.id}`),
      apiRequest<{ total: number }>(`/matches/page?tournamentId=${tournament.id}&page=1&pageSize=1`),
    ]).then(([teams, matchesResult]) => {
      if (active) setSetupCounts({
        tournamentId: tournament.id,
        teamCount: teams.status === "fulfilled" ? teams.value.length : null,
        matchCount: matchesResult.status === "fulfilled" ? matchesResult.value.total : null,
      });
    });
    return () => { active = false; };
  }, [activeTab, canManage, tournament.id, loadedMatches, teamImportResult]);

  const teamCount = setupCounts?.tournamentId === tournament.id ? setupCounts.teamCount : null;

  return (
    <section className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#243c43] pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-1 rounded border border-[#3a4d54] bg-[#0d252d] px-3 text-xs font-bold uppercase text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8]">
            <ChevronLeft size={15} /> Back
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#b7d2d8]">Tournament detail</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded px-3 py-2 text-xs font-bold ${votingOpen ? "bg-[#12382e] text-[#a7e8c0]" : "bg-[#14272e] text-[#b6cbd1]"}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {now === null ? "Loading voting status…" : votingOpen ? "1X2 voting open" : "No voting open"}
          </span>
          {canManage && <button type="button" onClick={() => setImportOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded border border-[#3a4d54] bg-[#0d252d] px-3 text-xs font-black uppercase text-[#84d8e8] transition hover:border-[#84d8e8] hover:text-white">
            <FileDown size={15} /> Import list match
          </button>}
        </div>
      </div>

      <div className="rounded border border-[#3a4d54] bg-[#0d252d] px-4 py-5 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <DashboardStatusBadge status={tournament.status} />
          <h2 className="min-w-0 break-words text-2xl font-black text-white">{tournament.name}</h2>
          <span className="rounded bg-[#203940] px-2 py-1 text-[10px] font-bold uppercase text-[#dce8eb]">{tournament.customFormat?.name || formatLabels[tournamentFormat]}</span>
          <DashboardSourceBadge source={tournament.source} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-[#b6cbd1]">
          <span className="inline-flex items-center gap-2"><Users size={14} className="text-[#84d8e8]" /> {tournament.teams.toLocaleString()} Teams</span>
          <span className="inline-flex items-center gap-2"><Trophy size={14} className="text-[#84d8e8]" /> {(loadedMatches?.length ?? tournament.matches).toLocaleString()} Matches</span>
          <span className="inline-flex items-center gap-2 text-[#f4c95d]"><Zap size={14} /> {predictionCount.toLocaleString()} Predictions · 1X2</span>
          <span className="inline-flex items-center gap-2"><CalendarDays size={14} /> {dateRange}</span>
        </div>
        <details className="mt-3 min-w-0 text-xs font-bold text-[#b6cbd1]">
          <summary className="w-fit cursor-pointer py-2 hover:text-[#84d8e8]">Stages · {tournament.customFormat?.name || formatLabels[tournamentFormat]}</summary>
          <StageStrip stages={stageItems} formatLabel={tournament.customFormat?.name || formatLabels[tournamentFormat]} onOpenStageMatches={onOpenStageMatches} />
        </details>
        <nav aria-label="Tournament sections" className="mt-2 flex flex-wrap gap-x-5 border-b border-[#243c43]">
          {(["Overview", "Teams", "Predictions", "Scoring Rules"] as TournamentTab[]).map((tab) => (
            <button key={tab} type="button" onClick={() => onTabChange(tab)} aria-current={activeTab === tab ? "page" : undefined} className={`min-h-11 border-b-2 text-xs font-black uppercase tracking-[0.06em] transition ${activeTab === tab ? "border-[#84d8e8] text-[#84d8e8]" : "border-transparent text-[#b6cbd1] hover:text-[#84d8e8]"}`}>
              {tab}{tab === "Teams" && ` (${teamCount ?? tournament.teams})`}
              {tab === "Predictions" && <span className="ml-2 rounded bg-[#143943] px-1.5 py-0.5 text-[10px] text-[#84d8e8]">1X2</span>}
            </button>
          ))}
        </nav>
        {canManage && activeTab === "Overview" && <TournamentSetup
          teamCount={teamCount}
          matchCount={setupCounts?.tournamentId === tournament.id ? setupCounts.matchCount : null}
          onManageTeams={() => { setOpenTeamRegistration(true); onTabChange("Teams"); }}
          canRegisterTeam={tournament.status.toUpperCase() === "UPCOMING"}
          onCreateMatch={() => setMatchEditorOpen(true)}
          onImportTeams={() => setTeamImportOpen(true)}
        />}
        {teamImportResult?.tournamentId === tournament.id && <p role="status" className="mt-3 text-xs font-bold text-[#84d8e8]">
          {teamImportResult.count} {teamImportResult.count === 1 ? "team" : "teams"} imported.
        </p>}
        {matchImportMessage && <p role="status" className="mt-3 text-xs font-bold text-[#84d8e8]">{matchImportMessage}</p>}
      </div>

      {activeTab === "Scoring Rules" ? (
        <ScoringRulesView tournament={tournament} canManage={canManage} />
      ) : activeTab === "Predictions" ? (
        <PredictionHistory key={tournament.id} tournamentId={tournament.id} refresh={predictionRefresh} />
      ) : activeTab === "Teams" ? (
        <TeamsTab
          tournament={tournament}
          matches={activeMatches}
          canManage={canManage}
          onUnavailableFeature={onUnavailableFeature}
          openRegistration={openTeamRegistration}
          onRegistrationOpened={() => setOpenTeamRegistration(false)}
          onCreateMatch={() => { onTabChange("Overview"); setMatchEditorOpen(true); }}
        />
      ) : (
        <>
          {scheduleError && <div role="alert" className="mx-4 mt-4 rounded border border-[#5d3037] p-3 text-sm text-[#ffb4a8]">
            {scheduleError} <button type="button" onClick={() => setScheduleRetry((value) => value + 1)} className="ml-2 min-h-10 underline">Try again</button>
          </div>}
          <div className="grid items-start gap-5 md:grid-cols-[minmax(210px,0.8fr)_minmax(0,2fr)]">
            <div className="space-y-5">
              <section aria-labelledby="season-progress-title" className="overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d] p-5 text-center">
                <div className="flex items-center justify-between">
                  <h2 id="season-progress-title" className="text-xs font-black uppercase tracking-[0.06em] text-[#b6cbd1]">Season progress</h2>
                  <Trophy aria-hidden="true" size={14} className="text-[#84d8e8]" />
                </div>
                <div role="progressbar" aria-label="Completed matches" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="relative mx-auto mt-4 grid h-36 w-36 place-items-center">
                  <svg aria-hidden="true" viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90">
                    <circle cx="60" cy="60" r="48" fill="none" stroke="#203841" strokeWidth="9" />
                    <circle cx="60" cy="60" r="48" fill="none" stroke="#84d8e8" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${progress * 3.016} 301.6`} />
                  </svg>
                  <div><p className="text-3xl font-black tabular-nums text-white">{progress}%</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#b6cbd1]">Progress</p></div>
                </div>
                <p className="mt-4 text-sm font-black text-white">
                  {completedCount} of {activeMatches.length} Matches Completed
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#c8d6db]">
                  {firstUpcoming
                    ? `Next match starts ${formatDateTime(firstUpcoming.scheduledTime)}.`
                    : now === null
                      ? "Loading schedule…"
                    : activeMatches.length > 0
                      ? "No future matches are scheduled."
                      : emptyScheduleMessage}
                </p>
              </section>

              <section className="overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d]">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-5">
                  <h2 className="text-xs font-black uppercase tracking-[0.08em]">Recent Results</h2>
                  {finishedMatches.length > 0 && <span className="text-[10px] font-bold uppercase text-[#84d8e8]">Auto-synced</span>}
                </div>
                <div className="space-y-3 p-4">
                  {finishedMatches.slice(0, 3).map((match) => (
                    <ResultMatchRow key={match.id} match={match}
                      prediction={personalPredictions?.items.find((prediction) => prediction.matchId === match.id)}
                      predictionState={personalPredictions === null ? "loading" : personalPredictions.error ? "error" : "ready"}
                    />
                  ))}
                  {finishedMatches.length === 0 && (
                    <p className="py-12 text-center text-[#9fb2b8]">
                      No completed results found.
                    </p>
                  )}
                </div>
              </section>

            </div>
            <div className="order-first min-w-0 space-y-5 md:order-none">
              <InlineVotePanel key={tournament.id} tournament={tournament} matches={upcomingMatches} now={now}
                onPredictionsLoaded={setPersonalPredictions}
                onViewAll={() => navigate({ view: "matches", matchFilters: { tournamentId: tournament.id, tournamentName: tournament.name } })}
                onSaved={() => setPredictionRefresh((value) => value + 1)} />

              <section className="@container min-w-0 overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d]">
                <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-5">
                  <h2 className="text-xs font-black uppercase tracking-[0.06em] text-white">Leaderboard Top 3 <span className="ml-1 font-normal normal-case tracking-normal text-[#b6cbd1]">· Tournament predictions</span></h2>
                  <button type="button" onClick={() => navigate({ view: "leaderboard", tournamentId: tournament.id })} className="inline-flex min-h-10 items-center gap-1 text-xs font-bold text-[#84d8e8] hover:text-white">View full leaderboard <ChevronRight size={14} /></button>
                </header>
                <div className="grid gap-3 p-4 @min-[40rem]:grid-cols-3">
                  {visibleLeaderboard?.entries.slice(0, 3).map((entry, index) => (
                    <div
                      key={entry.userId}
                      className={`flex min-w-0 items-center gap-3 rounded border bg-[#091d24] p-3 ${index === 0 ? "border-[#88713a]" : "border-[#243c43]"}`}
                    >
                      <span className={`text-lg font-black ${index === 0 ? "text-[#f4c95d]" : index === 1 ? "text-[#dce8eb]" : "text-[#efb078]"}`}>#{index + 1}</span>
                      <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#3a4d54] bg-[#203940] text-xs font-bold text-[#dce8eb]">{entry.fullName.trim().split(/\s+/).map((part) => part[0]).slice(-2).join("")}</span>
                      <div className="min-w-0">
                        <p title={entry.fullName} className="truncate text-sm font-black text-white">
                          {entry.fullName}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#84d8e8]">{entry.totalPoints} pts <span className="font-normal text-[#b6cbd1]">({entry.correctPredictions}/{entry.totalPredictions} correct)</span></p>
                      </div>
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
          </div>

          <details className="rounded border border-[#3a4d54] bg-[#0d252d] p-4 sm:p-5">
            <summary className="cursor-pointer py-2 text-sm font-black uppercase tracking-[0.06em] text-[#b7d2d8] hover:text-[#84d8e8]">Full match schedule · {sortedMatches.length} matches</summary>
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
          </details>
        </>
      )}
      {teamImportOpen && canManage && tournament.status.toUpperCase() === "UPCOMING" && (
        <TeamImportDialog
          key={tournament.id}
          tournamentId={tournament.id}
          onClose={() => setTeamImportOpen(false)}
          onImported={(count) => {
            setTeamImportResult({ count, tournamentId: tournament.id });
            setTeamImportOpen(false);
          }}
        />
      )}
      {importOpen && (
        <MatchEditor
          importing
          tournamentId={tournament.id}
          onClose={() => setImportOpen(false)}
          onSaved={() => {
            setMatchImportMessage("Import complete. Match schedule refreshed.");
            loadAllMatchPages((page) => apiRequest<{ items: MatchRow[]; total: number }>(`/matches/page?tournamentId=${tournament.id}&page=${page}&pageSize=100`))
              .then(setLoadedMatches)
              .catch((error) => setMatchImportMessage(error.message));
          }}
        />
      )}
      {matchEditorOpen && (
        <MatchEditor
          tournamentId={tournament.id}
          onClose={() => setMatchEditorOpen(false)}
          onSaved={() => {
            loadAllMatchPages((page) => apiRequest<{ items: MatchRow[]; total: number }>(`/matches/page?tournamentId=${tournament.id}&page=${page}&pageSize=100`))
              .then(setLoadedMatches)
              .catch((error) => setMatchImportMessage(error.message));
          }}
        />
      )}
    </section>
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

export function ResultMatchRow({ match, prediction, predictionState = "ready" }: {
  match: MatchRow;
  prediction?: MyPrediction;
  predictionState?: "loading" | "error" | "ready";
}) {
  const outcomeLabel = prediction?.outcome === "DRAW" ? "Draw" : prediction?.outcome === "HOME_WIN" ? "Home (1)" : "Away (2)";
  let result = "No prediction";
  let resultColor = "text-[#b6cbd1]";
  if (predictionState === "loading") {
    result = "Loading prediction…";
  } else if (predictionState === "error") {
    result = "Prediction unavailable";
  } else if (prediction?.status === "CORRECT") {
    result = `Correct · ${outcomeLabel}${prediction.points != null ? ` (+${prediction.points} pts)` : ""}`;
    resultColor = "text-[#a7e8c0]";
  } else if (prediction?.status === "INCORRECT") {
    result = `Incorrect · ${outcomeLabel}`;
    resultColor = "text-[#ffb4a8]";
  } else if (prediction) {
    result = `Awaiting points · ${outcomeLabel}`;
  }
  return (
    <article className="min-w-0 rounded border border-[#243c43] bg-[#091d24] p-3 text-xs">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 font-bold text-white">
        <span title={match.homeName ?? "TBD"} className="truncate">{match.homeName ?? "TBD"}</span>
        <span className="rounded bg-[#143943] px-1.5 py-1 font-black tabular-nums text-[#84d8e8]">{formatScore(match)}</span>
        <span title={match.awayName ?? "TBD"} className="truncate text-right">{match.awayName ?? "TBD"}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#243c43] pt-2 text-[10px]">
        <span className="font-bold uppercase text-[#b6cbd1]">Final (FT)</span>
        <span className={`inline-flex items-center gap-1 ${resultColor}`}>
          {predictionState === "ready" && prediction?.status === "CORRECT" && <Check aria-hidden="true" size={11} />}{result}
        </span>
      </div>
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
