"use client";

import { apiRequest } from "../api";
import NoticeBanner, { type Notice } from "../notice-banner";
import { useCallback, useEffect, useState } from "react";
import { AdminSelect } from "./shared/admin-select";
import {
  DashboardActionButton,
  DashboardActivityIcon,
  DashboardPanelTitle,
  DashboardStatusBadge,
  DashboardStatCard,
} from "./shared/dashboard-ui";
import { TournamentInput, TournamentSelect } from "./tournament/form-controls";
import {
  F1MeetingGroup,
  FootballCompetitionGroup,
  LolCompetitionGroup,
} from "./tournament/import-groups";
import { TournamentDetailView } from "./tournament/tournament-detail-view";
import { TournamentManagementTable } from "./tournament/tournament-management-table";
import type {
  DashboardData,
  F1MeetingOption,
  FootballCompetitionOption,
  ImportSport,
  LolCompetitionOption,
  SyncSport,
  TournamentForm,
  TournamentRow,
} from "./tournament/types";
import {
  formatRelative,
  getF1MeetingPhase,
  getFootballCompetitionPhase,
  getFootballLeagueKey,
  getImportSportLabel,
  getLolCompetitionPhase,
  getTournamentGroups,
  normalizeStatus,
} from "./tournament/utils";
import {
  AlertTriangle,
  CalendarDays,
  Cloud,
  FileDown,
  Plus,
  RefreshCw,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react";

// Dashboard auto-refresh matches the earlier API budget rule: one refresh every 14.4 minutes.
const DASHBOARD_REFRESH_MS = 14.4 * 60 * 1000;

const emptyTournamentForm: TournamentForm = {
  name: "",
  status: "UPCOMING",
  visibility: "PUBLIC",
};

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
}: {
  isAdmin: boolean;
  refreshKey: number;
  view?: "dashboard" | "tournaments";
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
      status: normalizeStatus(tournament.status),
      visibility: tournament.visibility ?? "PUBLIC",
    });
    setOpenTournamentForm(true);
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
    Boolean(editingTournamentId) && tournamentForm.status === "ACTIVE";

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
                value={tournamentSearch}
                onChange={(event) => setTournamentSearch(event.target.value)}
                placeholder="Search tournaments by name, source, or ID..."
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
          onBack={() => setSelectedTournamentId(null)}
          onUnavailableFeature={() =>
            showNotice("this feature not available", "info")
          }
        />
      ) : (
        <>
      {!isTournamentView && (
        <>
          <section className="mb-5 rounded border border-[#3a4d54] bg-[#0d252d] p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center bg-[#143942] text-[#84d8e8]">
                <Cloud size={23} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black uppercase text-[#84d8e8]">
                  API Status:{" "}
                  {dashboard.apiStatus.connected ? "Connected" : "Offline"}
                </p>
                <p className="mt-1 text-sm text-[#9fb2b8]">
                  {dashboard.apiStatus.provider} - Last sync:{" "}
                  {formatRelative(dashboard.apiStatus.lastSync)}
                </p>
              </div>
              <div className="bg-[#14272e] px-4 py-2 text-xs font-black uppercase text-[#c4d3d8]">
                ID: {dashboard.apiStatus.externalId}
              </div>
              <button
                onClick={() => void loadDashboard()}
                title="Refresh dashboard"
                className="text-[#dce8eb]"
              >
                <RefreshCw
                  size={20}
                  className={isLoading ? "animate-spin" : ""}
                />
              </button>
            </div>
          </section>

          <section className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 xl:gap-6">
            <DashboardStatCard
              title="Active Tournaments"
              value={dashboard.stats.activeTournaments}
              icon={<Trophy size={22} />}
            />
            <DashboardStatCard
              title="Total Players"
              value={dashboard.stats.totalPlayers}
              icon={<Users size={22} />}
            />
            <DashboardStatCard
              title="Today Matches"
              value={dashboard.stats.upcomingMatches}
              
              icon={<CalendarDays size={22} />}
            />
            {isAdmin && (
              <DashboardStatCard
                tone="warning"
                title="Attention Needed"
                value={dashboard.stats.attentionNeeded}
                icon={<AlertTriangle size={24} />}
                onClick={() => setOpenAttentionDetails(true)}
              />
            )}
          </section>
        </>
      )}

      <div
        className={`grid min-w-0 gap-5 ${
          isTournamentView ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_390px]"
        }`}
      >
        <div className="space-y-5">
          {tournamentGroups.map((group) => (
            <TournamentManagementTable
              key={group.sportType}
              title={isTournamentView ? group.title : `Today ${group.title}`}
              total={group.total}
              tournaments={group.tournaments}
              emptyMessage={group.emptyMessage}
              tournamentMatches={dashboard.tournamentMatches}
              selectedTournamentId={selectedTournamentId}
              onSelectTournament={setSelectedTournamentId}
              isAdmin={isAdmin}
                  onEditTournament={openEditTournament}
              onDeleteTournament={setTournamentToDelete}
            />
          ))}
        </div>

        {!isTournamentView && (
          <aside className="overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d]">
            <DashboardPanelTitle title="Recent Activity" />
            <div className="min-h-[420px] space-y-6 p-6">
              {dashboard.recentActivity.map((activity) => (
                <div key={activity.id} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#143942] text-[#84d8e8]">
                    <DashboardActivityIcon type={activity.type} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#dce8eb]">
                      {activity.message}
                    </p>
                    <p className="mt-2 text-xs uppercase text-[#789098]">
                      {formatRelative(activity.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              {dashboard.recentActivity.length === 0 && (
                <p className="pt-12 text-center text-[#9fb2b8]">
                  No recent activity in database.
                </p>
              )}
            </div>
          </aside>
        )}
      </div>
        </>
      )}

      {isAdmin && openAttentionDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <section className="w-full max-w-[720px] overflow-hidden rounded border border-[#8b7133] bg-[#0d252d] shadow-2xl">
            <header className="flex items-center justify-between border-b border-[#3a4d54] bg-[#14272e] px-6 py-5">
              <div>
                <h3 className="text-xl font-black uppercase text-[#f4c95d]">
                  Players Needing Attention
                </h3>
                <p className="mt-2 text-sm text-[#9fb2b8]">
                  {dashboard.stats.inactivePlayers} inactive,{" "}
                  {dashboard.stats.pendingPlayers} pending players
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenAttentionDetails(false)}
                className="flex h-10 w-10 items-center justify-center text-[#dce8eb] transition hover:text-white"
                aria-label="Close attention details"
                title="Close"
              >
                <X size={20} />
              </button>
            </header>

            <div className="max-h-[480px] overflow-y-auto">
              {dashboard.inactivePlayers.map((player) => (
                <div
                  key={player.id}
                  className="grid gap-4 border-b border-[#243c43] px-6 py-5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_150px]"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#213740] text-[#84d8e8]">
                      <Users size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-black text-white">
                        {player.fullName}
                      </p>
                      <p className="mt-1 truncate text-sm text-[#b9c8cc]">
                        {player.email}
                      </p>
                      <p className="mt-2 text-xs uppercase text-[#789098]">
                        {player.memberCode || "No member ID"} - Updated{" "}
                        {formatRelative(player.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center sm:justify-end">
                    <DashboardStatusBadge status={player.status} />
                  </div>
                </div>
              ))}
              {dashboard.inactivePlayers.length === 0 && (
                <div className="px-6 py-16 text-center text-[#9fb2b8]">
                  All players are active.
                </div>
              )}
            </div>

            <footer className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[#3a4d54] bg-[#10242b] px-6 py-4 text-xs font-bold uppercase text-[#9fb2b8]">
              <span>
                Pending predictions: {dashboard.stats.pendingPredictions}
              </span>
              <span>Sync warnings: {dashboard.stats.warningMatches}</span>
            </footer>
          </section>
        </div>
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
                options={["UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"]}
                onChange={(value) =>
                  setTournamentForm((form) => ({
                    ...form,
                    status: value as TournamentForm["status"],
                  }))
                }
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
            {isActiveTournamentEdit && (
              <p className="mt-1 text-xs font-bold text-[#84d8e8]">
                Active tournaments lock name and visibility. Change status first
                to edit those fields.
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
          <div className="w-full max-w-[460px] rounded border border-[#ff6b6b99] bg-[#0d252d] p-7 shadow-2xl">
            <h3 className="text-2xl font-black text-[#ff6b6b]">
              Delete Tournament
            </h3>
            <p className="mt-4 text-base font-bold text-white">
              Are you sure you want to delete <span className="text-[#ff8a8a]">{tournamentToDelete.name}</span>
            </p>
            <p className="mt-2 text-sm text-[#9fb2b8]">
              This action cannot be undone. All matches, predictions and related data will be permanently deleted.
            </p>
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



