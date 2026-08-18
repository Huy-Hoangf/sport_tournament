"use client";

import { apiRequest } from "../api";
import NoticeBanner, { type Notice } from "../notice-banner";
import { useCallback, useEffect, useState } from "react";
import { AdminSelect } from "./shared/admin-select";
import { DashboardActionButton } from "./shared/dashboard-ui";
import {
  DashboardTournamentOverview,
  getTournamentDashboardPriority,
  getTournamentSportFilterValue,
} from "./dashboard/dashboard-overview";
import { ApiStatusBanner } from "./dashboard/api-status-banner";
import { AttentionModal } from "./dashboard/attention-modal";
import { DashboardStatGrid } from "./dashboard/dashboard-stat-grid";
import { RecentActivityPanel } from "./dashboard/recent-activity-panel";
import { TournamentInput, TournamentSelect } from "./tournaments/form-controls";
import {
  F1MeetingGroup,
  FootballCompetitionGroup,
  LolCompetitionGroup,
} from "./tournaments/import-groups";
import { TournamentDetailView } from "./tournaments/tournament-detail/tournament-detail-view";
import { TournamentManagementTable } from "./tournaments/tournament-table";
import type {
  DashboardData,
  F1MeetingOption,
  FootballCompetitionOption,
  ImportSport,
  MatchRow,
  LolCompetitionOption,
  SyncSport,
  TournamentForm,
  TournamentRow,
} from "./tournaments/types";
import {
  getF1MeetingPhase,
  getFootballCompetitionPhase,
  getFootballLeagueKey,
  getImportSportLabel,
  getLolCompetitionPhase,
  getTournamentGroups,
  normalizeStatus,
} from "./tournaments/utils";
import { FileDown, Plus, RefreshCw, Search } from "lucide-react";

// Dashboard auto-refresh matches the earlier API budget rule: one refresh every 14.4 minutes.
const DASHBOARD_REFRESH_MS = 14.4 * 60 * 1000;

const emptyTournamentForm: TournamentForm = {
  name: "",
  sportType: "FOOTBALL",
  format: "ROUND_ROBIN",
  status: "UPCOMING",
  visibility: "PUBLIC",
  startDate: "",
  endDate: "",
};

const sportTypeOptions = [
  { value: "FOOTBALL", label: "Football" },
  { value: "F1", label: "Formula 1" },
  { value: "LOL", label: "League of Legends" },
  { value: "OTHER", label: "Other Sports" },
] satisfies Array<{ value: TournamentForm["sportType"]; label: string }>;

const tournamentFormatOptions = [
  { value: "ROUND_ROBIN", label: "Round Robin" },
  { value: "KNOCKOUT", label: "Knockout" },
  { value: "GROUP_AND_KNOCKOUT", label: "Group + Knockout" },
] satisfies Array<{ value: TournamentForm["format"]; label: string }>;

const emptyDashboard: DashboardData = {
  apiStatus: {
    connected: false,
    provider: "Football Data API v4 + OpenF1",
    lastSync: null,
    externalId: "LOCAL",
  },
  stats: {
    activeTournaments: 0,
    totalPlayers: 0,
    upcomingMatches: 0,
    attentionNeeded: 0,
    pendingPredictions: 0,
    warningMatches: 0,
    inactivePlayers: 0,
    pendingPlayers: 0,
  },
  tournaments: [],
  tournamentMatches: [],
  upcomingSchedule: [],
  recentActivity: [],
  inactivePlayers: [],
};

export default function AdminDashboardContent({
  isAdmin,
  refreshKey,
  view = "dashboard",
  onOpenTournamentManagement,
  onOpenMatches,
}: {
  isAdmin: boolean;
  refreshKey: number;
  view?: "dashboard" | "tournaments";
  onOpenTournamentManagement?: () => void;
  onOpenMatches?: (filters: {
    tournamentId?: number;
    stageId?: number;
    tournamentName?: string;
    stageName?: string;
  }) => void;
}) {
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [openTournamentForm, setOpenTournamentForm] = useState(false);
  const [openImportApiModal, setOpenImportApiModal] = useState(false);
  const [openSyncApiModal, setOpenSyncApiModal] = useState(false);
  const [confirmResetApiData, setConfirmResetApiData] = useState(false);
  const [openAttentionDetails, setOpenAttentionDetails] = useState(false);
  const [footballCompetitions, setFootballCompetitions] = useState<
    FootballCompetitionOption[]
  >([]);
  const [selectedFootballLeagueKeys, setSelectedFootballLeagueKeys] = useState<
    string[]
  >([]);
  const [importSport, setImportSport] = useState<ImportSport | null>(null);
  const [f1Meetings, setF1Meetings] = useState<F1MeetingOption[]>([]);
  const [selectedF1MeetingKeys, setSelectedF1MeetingKeys] = useState<number[]>(
    [],
  );
  const [lolCompetitions, setLolCompetitions] = useState<
    LolCompetitionOption[]
  >([]);
  const [selectedLolCompetitionKeys, setSelectedLolCompetitionKeys] = useState<
    string[]
  >([]);
  const [isLoadingCompetitions, setIsLoadingCompetitions] = useState(false);
  const [editingTournamentId, setEditingTournamentId] = useState<number | null>(
    null,
  );
  const [tournamentToDelete, setTournamentToDelete] =
    useState<TournamentRow | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<
    number | null
  >(null);
  const [tournamentSearch, setTournamentSearch] = useState("");
  const [dashboardSportFilter, setDashboardSportFilter] = useState("ALL");
  const [tournamentForm, setTournamentForm] =
    useState<TournamentForm>(emptyTournamentForm);
  const isTournamentView = view === "tournaments";

  const showNotice = useCallback(
    (message: string, tone: Notice["tone"] = "info") => {
      setNotice({ message, tone });
    },
    [],
  );

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await apiRequest<DashboardData>(
        // Dashboard shows today only; tournament management needs the full list.
        `/dashboard?scope=${isTournamentView ? "all" : "today"}`,
      );
      setDashboard({
        ...data,
        inactivePlayers: data.inactivePlayers ?? [],
      });
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Cannot load dashboard.",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isTournamentView, showNotice]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDashboard();
    });
  }, [loadDashboard, refreshKey]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadDashboard();
    }, DASHBOARD_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  async function syncSportsApi(sport: SyncSport) {
    if (!isAdmin) {
      showNotice("Only admin can sync API data.", "error");
      return;
    }

    setIsMutating(true);

    try {
      if (sport === "FOOTBALL") {
        const result = await apiRequest<{
          competitions: number;
          matches: number;
          error: string | null;
        }>("/dashboard/sync/football", { method: "POST" });
        showNotice(
          [
            `Football: ${result.competitions} competitions, ${result.matches} matches`,
            result.error ? `Football note: ${result.error}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          result.error ? "info" : "success",
        );
      } else {
        const result = await apiRequest<{
          meetings: number;
          sessions: number;
          error: string | null;
        }>("/dashboard/sync/f1", { method: "POST" });
        showNotice(
          [
            `F1: ${result.meetings} meetings, ${result.sessions} sessions`,
            result.error ? `F1 note: ${result.error}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          result.error ? "info" : "success",
        );
      }

      setOpenSyncApiModal(false);
      await loadDashboard();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "API sync failed.",
        "error",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function resetImportedApiData() {
    if (!isAdmin) {
      showNotice("Only admin can reset API data.", "error");
      return;
    }

    setIsMutating(true);

    try {
      const result = await apiRequest<{
        deletedTournaments: number;
        deletedMatches: number;
      }>("/dashboard/api-data", { method: "DELETE" });
      showNotice(
        `Deleted ${result.deletedTournaments} API tournaments and ${result.deletedMatches} matches.`,
        "success",
      );
      setConfirmResetApiData(false);
      setOpenSyncApiModal(false);
      await loadDashboard();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Cannot reset API data.",
        "error",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function openImportApi() {
    if (!isAdmin) {
      showNotice("Only admin can import API data.", "error");
      return;
    }

    setOpenImportApiModal(true);
    setSelectedFootballLeagueKeys([]);
    setSelectedF1MeetingKeys([]);
    setSelectedLolCompetitionKeys([]);
    setImportSport(null);
  }

  async function loadImportOptions(sport: ImportSport) {
    setIsLoadingCompetitions(true);

    try {
      if (sport === "F1") {
        const meetings = await apiRequest<F1MeetingOption[]>(
          "/dashboard/f1-meetings",
        );
        setF1Meetings(meetings);
        return;
      }

      if (sport === "LOL") {
        const competitions = await apiRequest<LolCompetitionOption[]>(
          "/dashboard/lol-competitions",
        );
        setLolCompetitions(competitions);
        return;
      }

      const competitions = await apiRequest<FootballCompetitionOption[]>(
        "/dashboard/football-competitions",
      );
      setFootballCompetitions(competitions);
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : `Cannot load ${getImportSportLabel(sport)} competitions.`,
        "error",
      );
    } finally {
      setIsLoadingCompetitions(false);
    }
  }

  function toggleFootballLeague(competition: FootballCompetitionOption) {
    const key = getFootballLeagueKey(competition);

    setSelectedFootballLeagueKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((item) => item !== key)
        : [...currentKeys, key],
    );
  }

  function toggleF1Meeting(meeting: F1MeetingOption) {
    setSelectedF1MeetingKeys((currentKeys) =>
      currentKeys.includes(meeting.id)
        ? currentKeys.filter((item) => item !== meeting.id)
        : [...currentKeys, meeting.id],
    );
  }

  function toggleLolCompetition(competition: LolCompetitionOption) {
    setSelectedLolCompetitionKeys((currentKeys) =>
      currentKeys.includes(competition.id)
        ? currentKeys.filter((item) => item !== competition.id)
        : [...currentKeys, competition.id],
    );
  }

  function toggleAllFootballLeagues() {
    const allKeys = footballCompetitions.map((competition) =>
      getFootballLeagueKey(competition),
    );

    setSelectedFootballLeagueKeys((currentKeys) =>
      allKeys.length > 0 && currentKeys.length === allKeys.length
        ? []
        : allKeys,
    );
  }

  function toggleAllImportItems() {
    if (importSport === "F1") {
      const allKeys = f1Meetings.map((meeting) => meeting.id);
      setSelectedF1MeetingKeys((currentKeys) =>
        allKeys.length > 0 && currentKeys.length === allKeys.length
          ? []
          : allKeys,
      );
      return;
    }

    if (importSport === "LOL") {
      const allKeys = lolCompetitions.map((competition) => competition.id);
      setSelectedLolCompetitionKeys((currentKeys) =>
        allKeys.length > 0 && currentKeys.length === allKeys.length
          ? []
          : allKeys,
      );
      return;
    }

    toggleAllFootballLeagues();
  }

  async function importSelectedApiItems() {
    if (!isAdmin) {
      showNotice("Only admin can import API data.", "error");
      return;
    }

    if (importSport === "F1") {
      await importSelectedF1Meetings();
      return;
    }

    if (importSport === "LOL") {
      await importSelectedLolCompetitions();
      return;
    }

    if (importSport === "FOOTBALL") {
      await importSelectedFootballLeagues();
      return;
    }

    showNotice("Choose a sport before importing.", "error");
  }

  async function importSelectedFootballLeagues() {
    const selectedLeagues = footballCompetitions
      .filter((competition) =>
        selectedFootballLeagueKeys.includes(getFootballLeagueKey(competition)),
      )
      .map((competition) => ({
        id: competition.id,
        season: competition.season,
        name: competition.name,
        start: competition.start,
        end: competition.end,
        current: competition.current,
      }));

    if (selectedLeagues.length === 0) {
      showNotice("Choose at least one ongoing competition to import.", "error");
      return;
    }

    setIsMutating(true);

    try {
      const result = await apiRequest<{
        competitions: number;
        matches: number;
        error: string | null;
      }>("/dashboard/sync-football", {
        method: "POST",
        body: JSON.stringify({ leagues: selectedLeagues }),
      });
      setOpenImportApiModal(false);
      await loadDashboard();
      showNotice(
        [
          `Imported ${result.competitions} football competitions and ${result.matches} matches.`,
          result.error ? `Football note: ${result.error}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        result.error ? "info" : "success",
      );
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Football import failed.",
        "error",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function importSelectedF1Meetings() {
    if (selectedF1MeetingKeys.length === 0) {
      showNotice("Choose at least one F1 meeting to import.", "error");
      return;
    }

    setIsMutating(true);

    try {
      const result = await apiRequest<{
        meetings: number;
        sessions: number;
        error: string | null;
      }>("/dashboard/sync-f1", {
        method: "POST",
        body: JSON.stringify({ meetingKeys: selectedF1MeetingKeys }),
      });
      setOpenImportApiModal(false);
      await loadDashboard();
      showNotice(
        [
          `Imported ${result.meetings} F1 meetings and ${result.sessions} sessions.`,
          result.error ? `F1 note: ${result.error}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        result.error ? "info" : "success",
      );
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "F1 import failed.",
        "error",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function importSelectedLolCompetitions() {
    if (selectedLolCompetitionKeys.length === 0) {
      showNotice(
        "Choose at least one League of Legends competition to import.",
        "error",
      );
      return;
    }

    setIsMutating(true);

    try {
      const result = await apiRequest<{
        competitions: number;
        matches: number;
        error: string | null;
      }>("/dashboard/sync-lol", {
        method: "POST",
        body: JSON.stringify({ competitionIds: selectedLolCompetitionKeys }),
      });
      setOpenImportApiModal(false);
      await loadDashboard();
      showNotice(
        [
          `Imported ${result.competitions} LoL competitions and ${result.matches} matches.`,
          result.error ? `LoL note: ${result.error}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        result.error ? "info" : "success",
      );
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "LoL import failed.",
        "error",
      );
    } finally {
      setIsMutating(false);
    }
  }

  function openCreateTournament() {
    setEditingTournamentId(null);
    setTournamentForm(emptyTournamentForm);
    setOpenTournamentForm(true);
  }

  function openEditTournament(tournament: TournamentRow) {
    setEditingTournamentId(tournament.id);
    setTournamentForm({
      name: tournament.name,
      sportType:
        tournament.sportType === "F1" ||
        tournament.sportType === "LOL" ||
        tournament.sportType === "OTHER"
          ? tournament.sportType
          : "FOOTBALL",
      format: tournament.format ?? "ROUND_ROBIN",
      status: normalizeStatus(tournament.status),
      visibility: tournament.visibility ?? "PUBLIC",
      startDate: toDateInputValue(tournament.startDate),
      endDate: toDateInputValue(tournament.endDate),
    });
    setOpenTournamentForm(true);
  }

  function requestDeleteTournament(tournament: TournamentRow) {
    if (!isAdmin) {
      showNotice("Only admin can delete tournaments.", "error");
      return;
    }

    if (!canDeleteTournament(tournament)) {
      showNotice("Only completed tournaments can be deleted.", "error");
      return;
    }

    setTournamentToDelete(tournament);
  }

  const ongoingFootballCompetitions = footballCompetitions.filter(
    (competition) => getFootballCompetitionPhase(competition) === "ongoing",
  );
  const upcomingFootballCompetitions = footballCompetitions.filter(
    (competition) => getFootballCompetitionPhase(competition) === "upcoming",
  );
  const ongoingF1Meetings = f1Meetings.filter(
    (meeting) => getF1MeetingPhase(meeting) === "ongoing",
  );
  const upcomingF1Meetings = f1Meetings.filter(
    (meeting) => getF1MeetingPhase(meeting) === "upcoming",
  );
  const ongoingLolCompetitions = lolCompetitions.filter(
    (competition) => getLolCompetitionPhase(competition) === "ongoing",
  );
  const upcomingLolCompetitions = lolCompetitions.filter(
    (competition) => getLolCompetitionPhase(competition) === "upcoming",
  );
  const selectedImportCount =
    importSport === "F1"
      ? selectedF1MeetingKeys.length
      : importSport === "LOL"
        ? selectedLolCompetitionKeys.length
        : importSport === "FOOTBALL"
          ? selectedFootballLeagueKeys.length
          : 0;
  const importItemCount =
    importSport === "F1"
      ? f1Meetings.length
      : importSport === "LOL"
        ? lolCompetitions.length
        : importSport === "FOOTBALL"
          ? footballCompetitions.length
          : 0;
  const allImportItemsSelected =
    importItemCount > 0 && selectedImportCount === importItemCount;
  const searchedTournaments = dashboard.tournaments.filter((tournament) => {
    const keyword = tournamentSearch.trim().toLowerCase();

    if (!keyword) {
      return true;
    }

    return (
      tournament.name.toLowerCase().includes(keyword) ||
      String(tournament.id).includes(keyword) ||
      (tournament.source ?? "").toLowerCase().includes(keyword)
    );
  });
  const tournamentGroups = getTournamentGroups(searchedTournaments);
  const dashboardOverviewTournaments = isTournamentView
    ? []
    : searchedTournaments
        .filter((tournament) => {
          const sportType = getTournamentSportFilterValue(tournament);
          const matchesSport =
            dashboardSportFilter === "ALL" ||
            sportType === dashboardSportFilter;

          return matchesSport;
        })
        .sort((first, second) => {
          const firstPriority = getTournamentDashboardPriority(first);
          const secondPriority = getTournamentDashboardPriority(second);

          if (firstPriority !== secondPriority) {
            return firstPriority - secondPriority;
          }

          return first.name.localeCompare(second.name);
        });
  const dashboardEmptyGroups = getTournamentGroups(dashboard.tournaments).filter(
    (group) => group.total === 0,
  );
  const selectedTournament =
    dashboard.tournaments.find(
      (tournament) => tournament.id === selectedTournamentId,
    ) ?? null;
  const selectedTournamentMatches = selectedTournament
    ? dashboard.tournamentMatches.filter(
        (match) => match.tournamentId === selectedTournament.id,
      )
    : [];
  const pageTitle = selectedTournament
    ? "Tournament Details"
    : isTournamentView
      ? "Tournament Management"
      : "Dashboard";
  const editingTournament =
    editingTournamentId == null
      ? null
      : dashboard.tournaments.find(
          (tournament) => tournament.id === editingTournamentId,
        ) ?? null;
  const isActiveTournamentEdit =
    Boolean(editingTournamentId) && tournamentForm.status === "ONGOING";

  async function saveTournament() {
    if (!isAdmin) {
      showNotice("Only admin can save tournaments.", "error");
      return;
    }

    const effectiveTournamentName =
      isActiveTournamentEdit && editingTournament
        ? editingTournament.name
        : tournamentForm.name;

    if (!effectiveTournamentName.trim()) {
      showNotice("Tournament name is required.", "error");
      return;
    }

    setIsMutating(true);

    try {
      if (editingTournamentId) {
        const payload =
          isActiveTournamentEdit && editingTournament
            ? {
                ...tournamentForm,
                name: editingTournament.name,
                visibility: editingTournament.visibility,
                sportType:
                  editingTournament.sportType === "F1" ||
                  editingTournament.sportType === "LOL" ||
                  editingTournament.sportType === "OTHER"
                    ? editingTournament.sportType
                    : "FOOTBALL",
                format: editingTournament.format ?? "ROUND_ROBIN",
              }
            : tournamentForm;

        await apiRequest(`/tournaments/admin/${editingTournamentId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showNotice("Tournament updated successfully.", "success");
      } else {
        await apiRequest("/tournaments/admin", {
          method: "POST",
          body: JSON.stringify(tournamentForm),
        });
        showNotice("Tournament created successfully.", "success");
      }

      setOpenTournamentForm(false);
      setEditingTournamentId(null);
      await loadDashboard();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Cannot save tournament.",
        "error",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function deleteTournament(tournament: TournamentRow) {
    if (!isAdmin) {
      showNotice("Only admin can delete tournaments.", "error");
      return;
    }

    if (!canDeleteTournament(tournament)) {
      showNotice("Only completed tournaments can be deleted.", "error");
      return;
    }

    setIsMutating(true);

    try {
      await apiRequest(`/tournaments/admin/${tournament.id}`, {
        method: "DELETE",
      });
      showNotice(`${tournament.name} deleted successfully.`, "success");
      setTournamentToDelete(null);
      await loadDashboard();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Cannot delete tournament.",
        "error",
      );
    } finally {
      setIsMutating(false);
    }
  }

  function exportTournamentData(tournament: TournamentRow) {
    const matches = dashboard.tournamentMatches.filter(
      (match) => match.tournamentId === tournament.id,
    );

    exportTournamentPdf(tournament, matches);
    showNotice(`${tournament.name} exported successfully.`, "success");
  }

  return (
    <div className="px-4 py-6 sm:px-6 xl:px-8 xl:py-9">
      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />
      <div className="mb-8 grid gap-6 xl:grid-cols-[1fr_auto] xl:items-start">
        <div>
          <h2 className="text-[28px] font-black leading-none text-white sm:text-[34px]">
            {pageTitle}
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end xl:gap-4">
          {isAdmin && isTournamentView && !selectedTournament ? (
            <>
              <DashboardActionButton
                icon={<RefreshCw size={18} />}
                label={isMutating ? "Syncing..." : "Reset API"}
                onClick={() => setOpenSyncApiModal(true)}
              />
              <DashboardActionButton
                icon={<FileDown size={18} />}
                label={isMutating ? "Importing..." : "Import API"}
                onClick={() => void openImportApi()}
              />
              <button
                onClick={openCreateTournament}
                className="flex h-[56px] items-center justify-center gap-3 rounded bg-[#84d8e8] px-5 text-base font-black text-[#06161b] sm:h-[62px] sm:px-8 sm:text-lg"
              >
                <Plus size={22} />
                Create Tournament
              </button>
            </>
          ) : !isAdmin ? (
            <div className="rounded border border-[#3a4d54] bg-[#0d252d] px-5 py-4 text-center text-sm font-bold text-[#9fb2b8]">
              View-only access
            </div>
          ) : null}
        </div>
      </div>

      {isTournamentView && !selectedTournament && (
        <section className="mb-5 rounded border border-[#3a4d54] bg-[#0d252d] p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(280px,1fr)_220px]">
            <label className="flex h-12 items-center gap-3 border border-[#3a4d54] bg-[#06161b] px-4 text-[#9fb2b8] focus-within:border-[#84d8e8]">
              <Search size={18} className="shrink-0 text-[#84d8e8]" />
              <input
                type="search"
                value={tournamentSearch}
                onChange={(event) => setTournamentSearch(event.target.value)}
                placeholder="Search tournaments by name, source, or ID..."
                autoComplete="off"
                name="tournament-management-search"
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-[#789098]"
              />
            </label>
            <div className="flex h-12 items-center justify-center border border-[#3a4d54] bg-[#14272e] text-xs font-black uppercase tracking-[0.08em] text-[#84d8e8]">
              {searchedTournaments.length} tournaments
            </div>
          </div>
        </section>
      )}

      {selectedTournament ? (
        <TournamentDetailView
          tournament={selectedTournament}
          matches={selectedTournamentMatches}
          isTodayScope={!isTournamentView}
          onBack={() => {
            setSelectedTournamentId(null);
            if (!isTournamentView) {
              onOpenTournamentManagement?.();
            }
          }}
          onUnavailableFeature={() =>
            showNotice("this feature not available", "info")
          }
          canManage={isAdmin}
          onOpenStageMatches={(stage) =>
            onOpenMatches?.({
              tournamentId: selectedTournament.id,
              stageId: stage.id > 0 ? stage.id : undefined,
              tournamentName: selectedTournament.name,
              stageName: stage.name,
            })
          }
        />
      ) : (
        <>
      <div
        className={`grid min-w-0 items-start gap-5 ${
          isTournamentView ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_390px]"
        }`}
      >
        <div className="space-y-5">
          {!isTournamentView && (
            <>
              <ApiStatusBanner
                apiStatus={dashboard.apiStatus}
                isLoading={isLoading}
                onRefresh={() => void loadDashboard()}
              />

              <DashboardStatGrid
                stats={dashboard.stats}
                isAdmin={isAdmin}
                onOpenAttentionDetails={() => setOpenAttentionDetails(true)}
              />
            </>
          )}

          {isTournamentView ? (
            tournamentGroups.map((group) => (
              <TournamentManagementTable
                key={group.sportType}
                title={group.title}
                total={group.total}
                tournaments={group.tournaments}
                emptyMessage={group.emptyMessage}
                tournamentMatches={dashboard.tournamentMatches}
                selectedTournamentId={selectedTournamentId}
                onSelectTournament={setSelectedTournamentId}
                isAdmin={isAdmin}
                onEditTournament={openEditTournament}
                onDeleteTournament={requestDeleteTournament}
              />
            ))
          ) : (
            <DashboardTournamentOverview
              tournaments={dashboardOverviewTournaments}
              allTournamentsCount={searchedTournaments.length}
              matches={dashboard.tournamentMatches}
              emptyGroups={dashboardEmptyGroups}
              search={tournamentSearch}
              sportFilter={dashboardSportFilter}
              isAdmin={isAdmin}
              onSearchChange={setTournamentSearch}
              onSportFilterChange={setDashboardSportFilter}
              onSelectTournament={setSelectedTournamentId}
              onEditTournament={openEditTournament}
              onDeleteTournament={requestDeleteTournament}
            />
          )}
        </div>

        {!isTournamentView && (
          <RecentActivityPanel activities={dashboard.recentActivity} />
        )}
      </div>
        </>
      )}

      {isAdmin && openAttentionDetails && (
        <AttentionModal
          dashboard={dashboard}
          onClose={() => setOpenAttentionDetails(false)}
        />
      )}

      {openSyncApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-[520px] rounded border border-[#3a4d54] bg-[#0d252d] p-7 shadow-2xl">
            <h3 className="text-2xl font-black text-[#84d8e8]">
              Reset API Data
            </h3>
            <p className="mt-2 text-sm text-[#9fb2b8]">
              Choose one data source. Dashboard refreshes never call external
              APIs.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => void syncSportsApi("FOOTBALL")}
                disabled={isMutating}
                className="rounded border border-[#84d8e8] bg-[#143942] px-5 py-5 text-left disabled:opacity-60"
              >
                <span className="block font-black text-white">Football</span>
                <span className="mt-2 block text-xs text-[#9fb2b8]">
                  Uses API-SPORTS Football quota
                </span>
              </button>
              <button
                onClick={() => void syncSportsApi("F1")}
                disabled={isMutating}
                className="rounded border border-[#3a4d54] bg-[#14272e] px-5 py-5 text-left disabled:opacity-60"
              >
                <span className="block font-black text-white">Formula 1</span>
                <span className="mt-2 block text-xs text-[#9fb2b8]">
                  Uses OpenF1, not API-SPORTS quota
                </span>
              </button>
            </div>
            <button
              onClick={() => {
                setOpenSyncApiModal(false);
                setConfirmResetApiData(true);
              }}
              disabled={isMutating}
              className="mt-4 w-full rounded border border-[#ff6b6b99] bg-[#35171b] px-5 py-4 text-left transition hover:border-[#ff6b6b] disabled:opacity-60"
            >
              <span className="block font-black text-[#ff8a8a]">
                Delete all imported API data
              </span>
              <span className="mt-2 block text-xs text-[#f0b4b4]">
                Clears old API tournaments and matches without calling any API.
              </span>
            </button>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setOpenSyncApiModal(false)}
                disabled={isMutating}
                className="h-11 rounded border border-white/10 px-6 font-bold text-zinc-200 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmResetApiData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-[500px] rounded border border-[#ff6b6b99] bg-[#0d252d] p-7 shadow-2xl">
            <h3 className="text-2xl font-black text-[#ff6b6b]">
              Delete Imported API Data
            </h3>
            <p className="mt-4 text-sm leading-6 text-[#d7e2e5]">
              This deletes all API matches, their tournaments, teams, stages and
              predictions. Empty tournaments left by the old importer are also
              removed. Players and populated manual tournaments are kept.
            </p>
            <p className="mt-3 text-sm font-bold text-[#ff8a8a]">
              This action cannot be undone.
            </p>
            <div className="mt-7 flex justify-end gap-3">
              <button
                onClick={() => setConfirmResetApiData(false)}
                disabled={isMutating}
                className="h-12 rounded border border-white/10 px-6 font-bold text-zinc-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void resetImportedApiData()}
                disabled={isMutating}
                className="h-12 rounded border border-[#ff8a8a] bg-[#d94747] px-6 font-black text-white transition hover:bg-[#ef5757] disabled:opacity-60"
              >
                {isMutating ? "Deleting..." : "Delete API Data"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openImportApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-[760px] rounded border border-[#3a4d54] bg-[#0d252d] p-7 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-[#84d8e8]">
                  Import API Competitions
                </h3>
                <p className="mt-2 text-sm text-[#9fb2b8]">
                  Choose a sport, then import ongoing or upcoming competitions.
                </p>
              </div>
              <button
                onClick={() => setOpenImportApiModal(false)}
                className="text-2xl leading-none text-[#9fb2b8] transition hover:text-white"
                title="Close import modal"
              >
                —
              </button>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9fb2b8]">
                Sport
              </span>
              <AdminSelect
                value={importSport ?? ""}
                options={[
                  { value: "", label: "Choose sport" },
                  { value: "FOOTBALL", label: "Football" },
                  { value: "F1", label: "F1" },
                  { value: "LOL", label: "League of Legends" },
                ]}
                onChange={(nextValue) => {
                  if (!nextValue) {
                    setImportSport(null);
                    return;
                  }
                  const nextSport = nextValue as ImportSport;
                  setImportSport(nextSport);
                  void loadImportOptions(nextSport);
                }}
                ariaLabel="Choose sport to import"
                className="w-full"
              />
            </label>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={toggleAllImportItems}
                disabled={isLoadingCompetitions || importItemCount === 0}
                className="h-11 rounded border border-[#84d8e8] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#84d8e8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {allImportItemsSelected ? "Clear all" : "Select all"}{" "}
                {importSport === "F1" ? "meetings" : "competitions"}
              </button>
              <span className="text-sm font-bold text-[#9fb2b8]">
                {selectedImportCount} selected
              </span>
            </div>

            <div className="max-h-[390px] overflow-y-auto rounded border border-[#243c43]">
              {isLoadingCompetitions ? (
                <div className="flex h-[180px] items-center justify-center text-sm font-bold text-[#9fb2b8]">
                  Loading competitions...
                </div>
              ) : (
                <div>
                  {!importSport ? (
                    <div className="flex h-[180px] items-center justify-center text-sm font-bold text-[#9fb2b8]">
                      Choose a sport to load competitions.
                    </div>
                  ) : importSport === "FOOTBALL" ? (
                    <>
                      <FootballCompetitionGroup
                        title="Ongoing"
                        competitions={ongoingFootballCompetitions}
                        selectedKeys={selectedFootballLeagueKeys}
                        onToggle={toggleFootballLeague}
                      />
                      <FootballCompetitionGroup
                        title="Upcoming"
                        competitions={upcomingFootballCompetitions}
                        selectedKeys={selectedFootballLeagueKeys}
                        onToggle={toggleFootballLeague}
                      />
                    </>
                  ) : importSport === "F1" ? (
                    <>
                      <F1MeetingGroup
                        title="Ongoing"
                        meetings={ongoingF1Meetings}
                        selectedKeys={selectedF1MeetingKeys}
                        onToggle={toggleF1Meeting}
                      />
                      <F1MeetingGroup
                        title="Upcoming"
                        meetings={upcomingF1Meetings}
                        selectedKeys={selectedF1MeetingKeys}
                        onToggle={toggleF1Meeting}
                      />
                    </>
                  ) : (
                    <>
                      <LolCompetitionGroup
                        title="Ongoing"
                        competitions={ongoingLolCompetitions}
                        selectedKeys={selectedLolCompetitionKeys}
                        onToggle={toggleLolCompetition}
                      />
                      <LolCompetitionGroup
                        title="Upcoming"
                        competitions={upcomingLolCompetitions}
                        selectedKeys={selectedLolCompetitionKeys}
                        onToggle={toggleLolCompetition}
                      />
                    </>
                  )}
                  {importSport && importItemCount === 0 && (
                    <div className="flex h-[180px] items-center justify-center text-sm font-bold text-[#9fb2b8]">
                      No ongoing or upcoming items found for this sport.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-7 flex justify-end gap-3">
              <button
                onClick={() => setOpenImportApiModal(false)}
                disabled={isMutating}
                className="h-12 rounded border border-white/10 px-6 font-bold text-zinc-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void importSelectedApiItems()}
                disabled={isMutating || selectedImportCount === 0}
                className="h-12 rounded bg-[#84d8e8] px-6 font-black text-[#06161b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMutating ? "Importing..." : "Import Selected"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openTournamentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-[560px] rounded border border-[#3a4d54] bg-[#0d252d] p-7 shadow-2xl">
            <h3 className="mb-5 text-2xl font-black text-[#84d8e8]">
              {editingTournamentId ? "Edit Tournament" : "Create Tournament"}
            </h3>
            <TournamentInput
              label="Tournament Name"
              value={tournamentForm.name}
              onChange={(value) =>
                setTournamentForm((form) => ({ ...form, name: value }))
              }
              disabled={isActiveTournamentEdit}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TournamentSelect
                label="Status"
                value={tournamentForm.status}
                options={["UPCOMING", "ONGOING", "COMPLETE"]}
                onChange={(value) =>
                  setTournamentForm((form) => ({
                    ...form,
                    status: value as TournamentForm["status"],
                  }))
                }
                disabled
              />
              <TournamentSelect
                label="Visibility"
                value={tournamentForm.visibility}
                options={["PUBLIC", "PRIVATE"]}
                onChange={(value) =>
                  setTournamentForm((form) => ({
                    ...form,
                    visibility: value as TournamentForm["visibility"],
                  }))
                }
                disabled={isActiveTournamentEdit}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TournamentInput
                label="Start Date"
                type="date"
                value={tournamentForm.startDate}
                onChange={(value) =>
                  setTournamentForm((form) => {
                    const nextForm = { ...form, startDate: value };

                    return {
                      ...nextForm,
                      status: calculateTournamentFormStatus(nextForm),
                    };
                  })
                }
              />
              <TournamentInput
                label="End Date"
                type="date"
                value={tournamentForm.endDate}
                onChange={(value) =>
                  setTournamentForm((form) => {
                    const nextForm = { ...form, endDate: value };

                    return {
                      ...nextForm,
                      status: calculateTournamentFormStatus(nextForm),
                    };
                  })
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="mb-4 block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9fb2b8]">
                  Sport Type
                </span>
                <AdminSelect
                  value={tournamentForm.sportType}
                  options={sportTypeOptions}
                  onChange={(value) =>
                    setTournamentForm((form) => ({
                      ...form,
                      sportType: value as TournamentForm["sportType"],
                    }))
                  }
                  ariaLabel="Tournament sport type"
                  className="w-full"
                  disabled={isActiveTournamentEdit}
                />
              </label>
              <label className="mb-4 block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9fb2b8]">
                  Format
                </span>
                <AdminSelect
                  value={tournamentForm.format}
                  options={tournamentFormatOptions}
                  onChange={(value) =>
                    setTournamentForm((form) => ({
                      ...form,
                      format: value as TournamentForm["format"],
                    }))
                  }
                  ariaLabel="Tournament format"
                  className="w-full"
                  disabled={isActiveTournamentEdit}
                />
              </label>
            </div>
            {isActiveTournamentEdit && (
              <p className="mt-1 text-xs font-bold text-[#84d8e8]">
                Ongoing tournaments lock name, visibility, sport type and
                format. Status is calculated from start and end date.
              </p>
            )}
            <div className="mt-7 flex justify-end gap-3">
              <button
                onClick={() => setOpenTournamentForm(false)}
                className="h-12 rounded border border-white/10 px-6 font-bold text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveTournament()}
                disabled={isMutating}
                className="h-12 rounded bg-[#84d8e8] px-6 font-black text-[#06161b] disabled:opacity-60"
              >
                {isMutating ? "Saving..." : "Save Tournament"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tournamentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-[520px] rounded border border-[#ff6b6b99] bg-[#0d252d] p-7 shadow-2xl">
            <h3 className="text-2xl font-black text-[#ff6b6b]">
              Delete Tournament
            </h3>
            <p className="mt-4 text-base font-bold text-white">
              Are you sure you want to delete{" "}
              <span className="text-[#ff8a8a]">{tournamentToDelete.name}</span>?
            </p>
            <p className="mt-2 text-sm text-[#9fb2b8]">
              This action cannot be undone. All matches, predictions and related
              data will be permanently deleted.
            </p>
            <div className="mt-5 rounded border border-[#3a4d54] bg-[#07181d] p-4">
              <p className="text-sm font-black text-white">
                Do you want export this tournament data?
              </p>
              <p className="mt-2 text-xs font-bold text-[#9fb2b8]">
                Export creates a PDF backup before you delete the completed
                tournament.
              </p>
              <button
                type="button"
                onClick={() => exportTournamentData(tournamentToDelete)}
                disabled={isMutating}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded border border-[#84d8e8] bg-[#102d35] px-4 text-xs font-black uppercase tracking-[0.08em] text-[#84d8e8] transition hover:bg-[#173742] disabled:opacity-60"
              >
                <FileDown size={15} />
                Export PDF
              </button>
            </div>
            <div className="mt-7 flex justify-end gap-3">
              <button
                onClick={() => setTournamentToDelete(null)}
                disabled={isMutating}
                className="h-12 rounded border border-white/10 px-6 font-bold text-zinc-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void deleteTournament(tournamentToDelete)}
                disabled={isMutating}
                className="h-12 rounded border border-[#ff8a8a] bg-[#d94747] px-6 font-black text-white transition hover:bg-[#ef5757] disabled:opacity-60"
              >
                {isMutating ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function canDeleteTournament(tournament: TournamentRow) {
  return normalizeStatus(tournament.status) === "COMPLETE";
}

function toDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function calculateTournamentFormStatus(
  form: Pick<TournamentForm, "startDate" | "endDate" | "status">,
): TournamentForm["status"] {
  const now = new Date();
  const start = form.startDate ? new Date(`${form.startDate}T00:00:00`) : null;
  const end = form.endDate ? new Date(`${form.endDate}T23:59:59`) : null;

  if (end && end < now) {
    return "COMPLETE";
  }

  if (start && start > now) {
    return "UPCOMING";
  }

  if (start || end) {
    return "ONGOING";
  }

  return form.status;
}

function exportTournamentPdf(tournament: TournamentRow, matches: MatchRow[]) {
  const lines = [
    "Tournament Export",
    "",
    `Name: ${tournament.name}`,
    `Sport: ${tournament.sportType ?? "FOOTBALL"}`,
    `Format: ${tournament.format ?? "ROUND_ROBIN"}`,
    `Status: ${tournament.status}`,
    `Visibility: ${tournament.visibility}`,
    `Teams: ${tournament.teams}`,
    `Matches: ${matches.length}`,
    `Source: ${tournament.source}`,
    `Exported At: ${new Date().toLocaleString()}`,
    "",
    "Matches",
    ...matches.map((match, index) => {
      const score =
        match.actualHomeScore == null || match.actualAwayScore == null
          ? "-"
          : `${match.actualHomeScore}-${match.actualAwayScore}`;

      return `${index + 1}. ${match.homeName ?? "TBD"} vs ${
        match.awayName ?? "TBD"
      } | ${new Date(match.scheduledTime).toLocaleString()} | ${
        match.status
      } | ${score}`;
    }),
  ];
  const pdfContent = createSimplePdf(lines);
  const blob = new Blob([pdfContent], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${slugifyFileName(tournament.name)}-export.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createSimplePdf(lines: string[]) {
  const pageLines = chunkLines(lines, 42);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const pageObjectIds: number[] = [];
  const fontObjectId = 3;

  pageLines.forEach((page, index) => {
    const pageObjectId = 4 + index * 2;
    const contentObjectId = pageObjectId + 1;
    const stream = [
      "BT",
      "/F1 11 Tf",
      "50 790 Td",
      ...page.flatMap((line, lineIndex) => [
        lineIndex === 0 ? "" : "0 -17 Td",
        `(${escapePdfText(line)}) Tj`,
      ]),
      "ET",
    ]
      .filter(Boolean)
      .join("\n");

    pageObjectIds.push(pageObjectId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function chunkLines(lines: string[], size: number) {
  const chunks: string[][] = [];

  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }

  return chunks.length ? chunks : [["No tournament data."]];
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function slugifyFileName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tournament"
  );
}


