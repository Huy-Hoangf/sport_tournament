import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  FileDown,
  GitBranch,
  Medal,
  Search,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useEffect } from "react";
import { apiRequest } from "../../api";
import { ScoringRulesView } from "./scoring-rules-view";
import {
  DashboardPanelTitle,
  DashboardSourceBadge,
  DashboardStatusBadge,
  MatchTeams,
} from "../shared/dashboard-ui";
import { AdminSelect } from "../shared/admin-select";
import type { MatchRow, TournamentRow, TournamentStage } from "./types";
import {
  formatDateOnly,
  formatDateTime,
  formatScore,
  formatShortTime,
  getTournamentDateRange,
  isFinishedStatus,
} from "./utils";

const stagesByFormat: Record<
  NonNullable<TournamentRow["format"]>,
  string[]
> = {
  ROUND_ROBIN: ["League Schedule", "Final Table"],
  KNOCKOUT: ["Round of 16", "Quarter Finals", "Semi Finals", "Final"],
  GROUP_AND_KNOCKOUT: [
    "Group Stage",
    "Round of 16",
    "Quarter Finals",
    "Semi Finals",
    "Final",
  ],
};

const formatLabels: Record<NonNullable<TournamentRow["format"]>, string> = {
  ROUND_ROBIN: "Round Robin",
  KNOCKOUT: "Knockout",
  GROUP_AND_KNOCKOUT: "Group + Knockout",
};
export function TournamentDetailView({
  tournament,
  matches,
  isTodayScope,
  onBack,
  onUnavailableFeature,
  onOpenStageMatches,
}: {
  tournament: TournamentRow;
  matches: MatchRow[];
  isTodayScope: boolean;
  onBack: () => void;
  onUnavailableFeature: () => void;
  onOpenStageMatches: (stage: TournamentStage) => void;
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
  const [stages, setStages] = useState<TournamentStage[]>([]);
  const tournamentFormat = tournament.format ?? "ROUND_ROBIN";
  const fallbackStages = stagesByFormat[tournamentFormat].map((name, index) => ({
    id: -(index + 1),
    tournamentId: tournament.id,
    name,
    sortOrder: index + 1,
    correctPoints: 1,
    exactScoreBonus: 0,
    isKnockout: name !== "Group Stage" && name !== "League Schedule",
  }));
  const stageItems = stages.length ? stages : fallbackStages;
  const scheduleTotalPages = Math.max(1, Math.ceil(sortedMatches.length / schedulePageSize));
  const activeSchedulePage = Math.min(schedulePage, scheduleTotalPages);
  const scheduleStart = (activeSchedulePage - 1) * schedulePageSize;
  const visibleScheduleMatches = sortedMatches.slice(
    scheduleStart,
    scheduleStart + schedulePageSize,
  );
  const emptyScheduleMessage = isTodayScope
    ? `${tournament.name} has no matches scheduled today.`
    : 'No schedule has been imported for this tournament.';

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

          <div className="min-w-0 lg:pt-1">
            <div className="mb-3 flex items-center gap-3">
              <p className="shrink-0 text-xs font-black uppercase tracking-[0.12em] text-[#84d8e8]">
                Stages
              </p>
              <span className="shrink-0 rounded border border-[#243c43] bg-[#0d252d] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#9fb2b8]">
                {formatLabels[tournamentFormat]}
              </span>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="flex w-max items-center gap-2">
                {stageItems.map((stage, index) => (
                  <div key={stage.id} className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenStageMatches(stage)}
                      className="inline-flex h-10 items-center gap-2 whitespace-nowrap border border-[#31505a] bg-[#0d252d] px-3 text-xs font-black uppercase tracking-[0.06em] text-[#dce8eb] shadow-[0_0_20px_rgba(132,216,232,0.08)] transition hover:border-[#84d8e8] hover:bg-[#102b33] hover:text-[#84d8e8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84d8e8]"
                    >
                      <span className="text-[#84d8e8]">
                        {getStageIcon(stage.name)}
                      </span>
                      {stage.name}
                    </button>
                    {index < stageItems.length - 1 && (
                      <span className="text-[#4d6870]">/</span>
                    )}
                  </div>
                ))}
              </div>
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
          {['Overview', 'Predictions', 'Scoring Rules'].map(
            (tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  if (tab === "Overview") {
                    setActiveTab(tab);
                  } else if (tab === "Predictions") {
                    setActiveTab(tab);
                  } else if (tab === "Scoring Rules") {
                    setActiveTab(tab);
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
      ) : activeTab === "Predictions" ? (
        <PredictionAnalyticsView tournament={tournament} matches={matches} />
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

type PredictionRow = {
  id: string;
  playerCode: string;
  player: string;
  match: string;
  prediction: string;
  points: number | null;
  status: "CORRECT" | "INCORRECT" | "PENDING";
};

function PredictionAnalyticsView({
  tournament,
  matches,
}: {
  tournament: TournamentRow;
  matches: MatchRow[];
}) {
  const [playerSearch, setPlayerSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("GROUP_STAGE");
  const [pointFilter, setPointFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const predictionRows = buildPredictionRows(matches);
  const stageOptions = [
    { value: "GROUP_STAGE", label: "Group Stage" },
    { value: "KNOCKOUT", label: "Knockout" },
    { value: "FINAL", label: "Final" },
  ];
  const pointOptions = [
    { value: "ALL", label: "All Points" },
    { value: "POSITIVE", label: "Point Awarded" },
    { value: "ZERO", label: "Zero Point" },
    { value: "PENDING", label: "Pending Point" },
  ];
  const statusOptions = ["ALL", "CORRECT", "INCORRECT", "PENDING"];
  const visibleRows = predictionRows.filter((row) => {
    const searchValue = playerSearch.trim().toLowerCase();
    const matchesSearch = `${row.player} ${row.match}`
      .toLowerCase()
      .includes(searchValue);
    const matchesStatus = statusFilter === "ALL" || row.status === statusFilter;
    const matchesPoint =
      pointFilter === "ALL" ||
      (pointFilter === "POSITIVE" && row.points != null && row.points > 0) ||
      (pointFilter === "ZERO" && row.points === 0) ||
      (pointFilter === "PENDING" && row.points == null);

    return matchesSearch && matchesStatus && matchesPoint;
  });
  const totalPredictions = Math.max(predictionRows.length, matches.length * 9);
  const mostPredictedTeam =
    getMostPredictedTeam(predictionRows) ??
    matches.find((match) => match.homeName)?.homeName ??
    "No team data";
  const resultMatch = matches.find((match) => isFinishedStatus(match.status));
  const resultText = resultMatch
    ? getWinnerText(resultMatch)
    : "Awaiting Result";
  const resultMeta = resultMatch
    ? `${formatScore(resultMatch)} final`
    : "No completed matches yet";

  return (
    <section className="border-t border-[#314850] bg-[#06161b] p-4 sm:p-7 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-black text-[#84d8e8]">Predictions</p>
          <h4 className="mt-4 text-2xl font-black text-white">
            {tournament.name}
          </h4>
          <p className="mt-1 text-sm font-bold text-[#789098]">
            Prediction Data & Analytics
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 border border-[#243c43] bg-[#07181d] px-4 text-[10px] font-black uppercase tracking-[0.08em] text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8]"
        >
          <FileDown size={14} /> Export Data
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
        <PredictionMetricCard
          title="Total Predictions"
          value={totalPredictions.toLocaleString()}
          meta="+15% vs last round"
          icon={<Zap size={18} />}
        />
        <PredictionMetricCard
          title="Most Predicted Team"
          value={mostPredictedTeam}
          meta="62% of users picked to win"
          icon={<Users size={18} />}
        />
        <PredictionMetricCard
          title="Result"
          value={resultText}
          meta={resultMeta}
          icon={<Trophy size={18} />}
        />
      </div>

      <section className="mt-6 overflow-hidden border border-[#243c43] bg-[#0d252d]">
        <div className="border-b border-[#243c43] bg-[#07181d] px-4 py-4 sm:px-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(170px,1fr)_minmax(170px,1fr)_minmax(170px,1fr)_minmax(220px,1.2fr)]">
            <PredictionFilterField label="Stage">
              <AdminSelect
                value={stageFilter}
                onChange={setStageFilter}
                options={stageOptions}
                ariaLabel="Filter prediction stage"
                size="compact"
                className="h-10"
              />
            </PredictionFilterField>
            <PredictionFilterField label="Point Filter">
              <AdminSelect
                value={pointFilter}
                onChange={setPointFilter}
                options={pointOptions}
                ariaLabel="Filter prediction points"
                size="compact"
                className="h-10"
              />
            </PredictionFilterField>
            <PredictionFilterField label="Status">
              <AdminSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions.map((status) => ({
                  value: status,
                  label: status === "ALL" ? "All Status" : status,
                }))}
                ariaLabel="Filter prediction status"
                size="compact"
                className="h-10"
                menuClassName="right-0 left-auto min-w-[170px]"
              />
            </PredictionFilterField>
            <PredictionFilterField label="Search">
              <div className="grid grid-cols-[minmax(0,1fr)_42px]">
                <input
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                  placeholder="Search player or match..."
                  className="h-10 min-w-0 border border-r-0 border-[#243c43] bg-[#07181d] px-4 text-xs font-bold text-white outline-none placeholder:text-[#789098] focus:border-[#84d8e8]"
                />
                <button
                  type="button"
                  aria-label="Search predictions"
                  className="grid h-10 place-items-center border border-[#243c43] bg-[#0d252d] text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8]"
                >
                  <Search size={16} />
                </button>
              </div>
            </PredictionFilterField>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[190px_minmax(260px,1fr)_160px_90px_110px] gap-x-6 border-b border-[#243c43] bg-[#10242b] px-4 py-3 text-[10px] font-black uppercase tracking-[0.08em] text-[#789098]">
              <span>Player</span>
              <span>Match</span>
              <span>Prediction</span>
              <span>Points</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-[#243c43]">
              {visibleRows.slice(0, 8).map((row, index) => (
                <div
                  key={row.id}
                  className={`grid grid-cols-[190px_minmax(260px,1fr)_160px_90px_110px] items-center gap-x-6 px-4 py-4 text-sm ${
                    index % 2 === 0 ? "bg-[#0d252d]" : "bg-[#14272e]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-sm bg-[#163943] text-[10px] font-black text-[#84d8e8]">
                      {row.playerCode}
                    </span>
                    <span className="min-w-0 truncate font-black text-[#dce8eb]">
                      {row.player}
                    </span>
                  </div>
                  <span className="min-w-0 truncate font-bold text-[#9fb2b8]">
                    {row.match}
                  </span>
                  <span className="min-w-0 truncate font-black lowercase text-[#dce8eb]">
                    {row.prediction}
                  </span>
                  <span
                    className={`font-black ${
                      row.points && row.points > 0
                        ? "text-[#84d8e8]"
                        : "text-[#9fb2b8]"
                    }`}
                  >
                    {row.points == null
                      ? "--"
                      : row.points > 0
                        ? `+${row.points}`
                        : row.points}
                  </span>
                  <PredictionStatusBadge status={row.status} />
                </div>
              ))}
              {visibleRows.length === 0 && (
                <p className="px-4 py-14 text-center text-sm text-[#9fb2b8]">
                  No predictions match your filter.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#243c43] px-4 py-4 text-xs font-bold text-[#9fb2b8]">
          <span>
            Showing {visibleRows.length ? 1 : 0} to{" "}
            {Math.min(8, visibleRows.length)} of {predictionRows.length} entries
          </span>
          <div className="flex gap-2">
            <button className="grid h-9 w-9 place-items-center border border-[#243c43] text-[#789098]">
              ‹
            </button>
            <button className="grid h-9 w-9 place-items-center border border-[#243c43] text-[#789098]">
              ›
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}

function PredictionFilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-black text-[#84d8e8]">{label}</span>
      {children}
    </label>
  );
}

function PredictionMetricCard({
  title,
  value,
  meta,
  icon,
}: {
  title: string;
  value: string;
  meta: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="min-w-0 overflow-hidden border border-[#243c43] bg-[#0d252d] p-5">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_24px] items-start gap-4">
        <div className="min-w-0">
          <p
            title={title}
            className="truncate whitespace-nowrap text-[10px] font-black uppercase tracking-[0.12em] text-[#789098]"
          >
            {title}
          </p>
          <p
            title={value}
            className="mt-5 truncate whitespace-nowrap text-2xl font-black tabular-nums text-white"
          >
            {value}
          </p>
          <p
            title={meta}
            className="mt-2 truncate whitespace-nowrap text-xs font-black text-[#84d8e8]"
          >
            {meta}
          </p>
        </div>
        <span className="flex h-6 w-6 shrink-0 items-start justify-center text-[#84d8e8]">
          {icon}
        </span>
      </div>
    </article>
  );
}

function PredictionStatusBadge({ status }: { status: PredictionRow["status"] }) {
  const className =
    status === "CORRECT"
      ? "bg-[#183229] text-[#a7e8c0]"
      : status === "INCORRECT"
        ? "bg-[#35171b] text-[#ff8a8a]"
        : "bg-[#14272e] text-[#9fb2b8]";

  return (
    <span
      className={`inline-flex h-7 w-fit items-center rounded-sm px-3 text-[10px] font-black uppercase ${className}`}
    >
      {status}
    </span>
  );
}

function buildPredictionRows(matches: MatchRow[]): PredictionRow[] {
  const players = [
    { code: "X7", name: "Xeno77" },
    { code: "BL", name: "BladeRunner99" },
    { code: "GZ", name: "GhostZero" },
    { code: "AR", name: "ArcRider" },
    { code: "NP", name: "NeonPulse" },
  ];

  return matches.slice(0, 6).flatMap((match, matchIndex) => {
    const matchName = `${match.homeName ?? "TBD"} vs. ${match.awayName ?? "TBD"}`;
    const predictions = [
      `${match.homeName ?? "home"} win`,
      "draw",
      `${match.awayName ?? "away"} win`,
    ];

    return players.slice(0, 3).map((player, playerIndex) => ({
      id: `${match.id}-${player.code}-${playerIndex}`,
      playerCode: player.code,
      player: players[(matchIndex + playerIndex) % players.length].name,
      match: matchName,
      prediction: predictions[playerIndex],
      points:
        playerIndex === 2 && !isFinishedStatus(match.status)
          ? null
          : playerIndex === 0
            ? 50
            : 0,
      status:
        playerIndex === 2 && !isFinishedStatus(match.status)
          ? "PENDING"
          : playerIndex === 0
            ? "CORRECT"
            : "INCORRECT",
    }));
  });
}

function getMostPredictedTeam(rows: PredictionRow[]) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const team = row.prediction.replace(/\s+win$/i, "");

    if (team !== "draw") {
      counts.set(team, (counts.get(team) ?? 0) + 1);
    }
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function getWinnerText(match: MatchRow) {
  if (
    match.actualHomeScore == null ||
    match.actualAwayScore == null ||
    match.actualHomeScore === match.actualAwayScore
  ) {
    return "Draw";
  }

  return match.actualHomeScore > match.actualAwayScore
    ? `${match.homeName ?? "Home"} Win`
    : `${match.awayName ?? "Away"} Win`;
}

function getStageIcon(stageName: string) {
  const normalized = stageName.toLowerCase();

  if (normalized.includes("group")) return <Users size={16} />;
  if (normalized.includes("round")) return <GitBranch size={16} />;
  if (normalized.includes("semi")) return <Medal size={16} />;
  if (normalized.includes("final")) return <Trophy size={16} />;
  return <CalendarDays size={16} />;
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




