"use client";

import { apiRequest } from "../api";
import NoticeBanner, { type Notice } from "../notice-banner";
import type React from "react";
import { Fragment, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Cloud,
  FileDown,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";

// Dashboard auto-refresh matches the earlier API budget rule: one refresh every 14.4 minutes.
const DASHBOARD_REFRESH_MS = 14.4 * 60 * 1000;

type DashboardData = {
  apiStatus: {
    connected: boolean;
    provider: string;
    lastSync: string | null;
    externalId: string;
  };
  stats: {
    activeTournaments: number;
    totalPlayers: number;
    upcomingMatches: number;
    attentionNeeded: number;
    pendingPredictions: number;
    warningMatches: number;
    inactivePlayers: number;
    pendingPlayers: number;
  };
  tournaments: TournamentRow[];
  tournamentMatches: MatchRow[];
  upcomingSchedule: MatchRow[];
  recentActivity: ActivityRow[];
  inactivePlayers: InactivePlayerRow[];
};

type TournamentRow = {
  id: number;
  name: string;
  sportType?: string;
  status: string;
  visibility: "PUBLIC" | "PRIVATE";
  teams: number;
  matches: number;
  source: string;
};

type TournamentForm = {
  name: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  visibility: "PUBLIC" | "PRIVATE";
};

type FootballCompetitionOption = {
  id: number;
  name: string;
  country: string;
  season: number;
  start: string | null;
  end: string | null;
  current: boolean;
  type: string;
};

type ImportSport = "FOOTBALL" | "F1" | "LOL";
type SyncSport = "FOOTBALL" | "F1";
type TournamentStatusFilter = "ALL" | "ACTIVE" | "UPCOMING" | "COMPLETED";

type F1MeetingOption = {
  id: number;
  name: string;
  country: string;
  circuit: string;
  start: string;
  end: string;
  current: boolean;
};

type LolCompetitionOption = {
  id: string;
  name: string;
  region: string;
  start: string | null;
  nextMatchAt: string | null;
  current: boolean;
  matches: number;
};

type MatchRow = {
  id: number;
  tournamentId?: number;
  homeName?: string;
  awayName?: string;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  encounter: string;
  tournamentName: string;
  scheduledTime: string;
  deadline: string;
  source: string;
  status: string;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
};

type ActivityRow = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

type InactivePlayerRow = {
  id: number;
  memberCode: string;
  fullName: string;
  email: string;
  status: string;
  updatedAt: string;
};

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
  const pageTitle = isTournamentView ? "Tournament Management" : "Dashboard";
  const pageDescription = isTournamentView
    ? "Oversee competition life cycles, participant metrics, and scheduling parameters."
    : "Showing tournaments and matches scheduled for today.";

  async function saveTournament() {
    if (!isAdmin) {
      showNotice("Only admin can save tournaments.", "error");
      return;
    }

    if (!tournamentForm.name.trim()) {
      showNotice("Tournament name is required.", "error");
      return;
    }

    setIsMutating(true);

    try {
      if (editingTournamentId) {
        await apiRequest(`/tournaments/admin/${editingTournamentId}`, {
          method: "PATCH",
          body: JSON.stringify(tournamentForm),
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
          <p className="mt-3 text-[16px] text-[#adbdc2]">
            {pageDescription}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end xl:gap-4">
          {isAdmin && isTournamentView ? (
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

      {isTournamentView && (
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

          <section
            className={`mb-5 grid gap-4 sm:grid-cols-2 xl:gap-6 ${
              isAdmin ? "xl:grid-cols-4" : "xl:grid-cols-3"
            }`}
          >
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

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
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
                        {player.memberCode || "No member ID"} Â· Updated{" "}
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
                Ă—
              </button>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9fb2b8]">
                Sport
              </span>
              <select
                value={importSport ?? ""}
                onChange={(event) => {
                  if (!event.target.value) {
                    setImportSport(null);
                    return;
                  }
                  const nextSport = event.target.value as ImportSport;
                  setImportSport(nextSport);
                  void loadImportOptions(nextSport);
                }}
                className="h-12 w-full rounded border border-[#3a4d54] bg-[#070d0d] px-4 font-black uppercase tracking-[0.08em] text-white outline-none focus:border-[#84d8e8]"
              >
                <option value="">Choose sport</option>
                <option value="FOOTBALL">Football</option>
                <option value="F1">F1</option>
                <option value="LOL">League of Legends</option>
              </select>
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
              />
            </div>
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

function TournamentInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9fb2b8]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded border border-white/10 bg-[#070d0d] px-4 font-bold text-white outline-none focus:border-[#84d8e8]"
      />
    </label>
  );
}

function TournamentSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9fb2b8]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded border border-white/10 bg-[#070d0d] px-4 font-bold text-white outline-none focus:border-[#84d8e8]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function DashboardActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-[56px] items-center justify-center gap-3 rounded border border-[#3a4d54] bg-[#0d252d] px-5 text-base font-black text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8] sm:h-[62px] sm:px-7 sm:text-lg"
    >
      {icon}
      {label}
    </button>
  );
}

function TournamentManagementTable({
  title,
  total,
  tournaments,
  emptyMessage,
  tournamentMatches,
  selectedTournamentId,
  onSelectTournament,
  isAdmin,
  onEditTournament,
  onDeleteTournament,
}: {
  title: string;
  total: number;
  tournaments: TournamentRow[];
  emptyMessage: string;
  tournamentMatches: MatchRow[];
  selectedTournamentId: number | null;
  onSelectTournament: React.Dispatch<React.SetStateAction<number | null>>;
  isAdmin: boolean;
  onEditTournament: (tournament: TournamentRow) => void;
  onDeleteTournament: (tournament: TournamentRow) => void;
}) {
  const pageSize = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] =
    useState<TournamentStatusFilter>("ALL");
  const filteredTournaments = tournaments.filter((tournament) => {
    const status = tournament.status.toUpperCase();

    if (statusFilter === "ALL") {
      return true;
    }

    if (statusFilter === "COMPLETED") {
      return status === "COMPLETED" || status === "CANCELLED";
    }

    return status === statusFilter;
  });
  const filteredTotal = filteredTournaments.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const firstVisibleIndex = (activePage - 1) * pageSize;
  // Keep each tournament table paginated so iPad/mobile layouts do not clip long imported lists.
  const visibleTournaments = filteredTournaments.slice(
    firstVisibleIndex,
    firstVisibleIndex + pageSize,
  );
  const pageNumbers = Array.from(
    { length: totalPages },
    (_, index) => index + 1,
  );

  function changePage(page: number) {
    const nextPage = Math.min(Math.max(page, 1), totalPages);

    if (nextPage === activePage) {
      return;
    }

    setCurrentPage(nextPage);
    onSelectTournament(null);
  }

  function changeStatusFilter(filter: TournamentStatusFilter) {
    setStatusFilter(filter);
    setCurrentPage(1);
    onSelectTournament(null);
  }

  return (
    <section className="overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d]">
      <DashboardPanelTitle
        title={title}
        icon={
          <label className="relative block w-full min-w-[150px] sm:w-[150px]">
            <Filter
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#84d8e8]"
            />
            <select
              value={statusFilter}
              onChange={(event) =>
                changeStatusFilter(event.target.value as TournamentStatusFilter)
              }
              aria-label={`Filter ${title} by status`}
              className="h-9 w-full appearance-none border border-[#3a4d54] bg-[#0d252d] pl-9 pr-3 text-xs font-black uppercase text-[#dce8eb] outline-none transition focus:border-[#84d8e8]"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Ongoing</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </label>
        }
        right={
          filteredTotal > 0
            ? `Showing ${firstVisibleIndex + 1}-${Math.min(
                firstVisibleIndex + pageSize,
                filteredTotal,
              )} of ${filteredTotal}${statusFilter === "ALL" ? "" : ` / ${total}`}`
            : statusFilter === "ALL"
              ? "0 total"
              : `0 of ${total}`
        }
      />
      <div className="divide-y divide-[#243c43] xl:hidden">
        {visibleTournaments.map((tournament) => {
          const matches = tournamentMatches.filter(
            (match) => match.tournamentId === tournament.id,
          );

          return (
            <article key={tournament.id} className="bg-[#0d252d]">
              <button
                type="button"
                onClick={() => onSelectTournament(tournament.id)}
                className={`w-full px-4 py-4 text-left transition ${
                  selectedTournamentId === tournament.id
                    ? "bg-[#12333c]"
                    : "hover:bg-[#102d35]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#143942] text-[#84d8e8]">
                    <ShieldCheck size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-base font-black text-white">
                      {tournament.name}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[#07181d] px-2 py-1 text-xs font-black uppercase text-[#dce8eb]">
                        {tournament.sportType ?? "FOOTBALL"}
                      </span>
                      <DashboardStatusBadge status={tournament.status} />
                      <DashboardSourceBadge source={tournament.source} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded border border-[#243c43] bg-[#07181d] p-3">
                    <p className="uppercase tracking-[0.08em] text-[#789098]">
                      Teams
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {tournament.teams.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded border border-[#243c43] bg-[#07181d] p-3">
                    <p className="uppercase tracking-[0.08em] text-[#789098]">
                      Matches
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {tournament.matches.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded border border-[#243c43] bg-[#07181d] p-3">
                    <p className="uppercase tracking-[0.08em] text-[#789098]">
                      Details
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {matches.length}
                    </p>
                  </div>
                </div>
              </button>

              {isAdmin && (
                <div className="flex items-center gap-2 border-t border-[#243c43] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onEditTournament(tournament)}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded border border-[#3a4d54] text-sm font-black text-[#84d8e8] transition hover:border-[#84d8e8] hover:text-white"
                  >
                    <Pencil size={16} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTournament(tournament)}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded border border-[#ff6b6b99] bg-[#35171b] text-sm font-black text-[#ff8a8a] transition hover:border-[#ff6b6b] hover:text-[#ffb0b0]"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              )}

            </article>
          );
        })}

        {visibleTournaments.length === 0 && (
          <div className="px-4 py-10 text-center text-[#9fb2b8]">
            {emptyMessage}
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[980px] table-fixed text-left">
          <thead className="h-[65px] border-b border-[#3a4d54] bg-[#14272e] text-xs uppercase tracking-[0.08em] text-[#d5e0e3]">
            <tr>
              <th className="px-6 py-4">Tournament Name</th>
              <th className="w-28 px-4 py-4">Sport</th>
              <th className="w-32 px-4 py-4">Status</th>
              <th className="w-24 px-4 py-4">Teams</th>
              <th className="w-24 px-4 py-4">Matches</th>
              <th className="w-44 px-4 py-4">Source</th>
              <th className="w-28 px-4 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleTournaments.map((tournament) => {
              const isSelected = selectedTournamentId === tournament.id;

              return (
                <Fragment key={tournament.id}>
                  <tr
                    onClick={() => onSelectTournament(tournament.id)}
                    className={`h-[73px] cursor-pointer border-b border-[#243c43] text-sm transition hover:bg-[#102d35] ${
                      isSelected ? "bg-[#12333c]" : ""
                    }`}
                  >
                    <td className="px-6 font-black text-white">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center bg-[#143942] text-[#84d8e8]">
                          <ShieldCheck size={17} />
                        </span>
                        <span className="min-w-0 truncate">
                          {tournament.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 text-white">
                      {tournament.sportType ?? "FOOTBALL"}
                    </td>
                    <td className="px-4">
                      <DashboardStatusBadge status={tournament.status} />
                    </td>
                    <td className="px-4 text-white">
                      {tournament.teams.toLocaleString()}
                    </td>
                    <td className="px-4 text-white">
                      {tournament.matches.toLocaleString()}
                    </td>
                    <td className="px-4">
                      <DashboardSourceBadge source={tournament.source} />
                    </td>
                    <td
                      className="px-4"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {isAdmin ? (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => onEditTournament(tournament)}
                            className="text-[#84d8e8] transition hover:text-white"
                            title="Edit tournament"
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            onClick={() => onDeleteTournament(tournament)}
                            className="text-[#ff6b6b] transition hover:text-[#ff9b9b]"
                            title="Delete tournament"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs uppercase text-[#789098]">
                          Details
                        </span>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {visibleTournaments.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="h-[104px] text-center text-[#9fb2b8]"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex min-h-[64px] flex-wrap items-center justify-between gap-4 border-t border-[#3a4d54] bg-[#10242b] px-6 py-3">
          <span className="text-xs font-black uppercase text-[#9fb2b8]">
            Page {activePage} of {totalPages}
          </span>
          <nav
            aria-label={`${title} pagination`}
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              onClick={() => changePage(activePage - 1)}
              disabled={activePage === 1}
              aria-label="Previous page"
              title="Previous page"
              className="flex h-9 w-9 items-center justify-center border border-[#3a4d54] text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={17} />
            </button>
            {pageNumbers.map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => changePage(page)}
                aria-label={`Page ${page}`}
                aria-current={page === activePage ? "page" : undefined}
                className={`flex h-9 min-w-9 items-center justify-center border px-2 text-xs font-black transition ${
                  page === activePage
                    ? "border-[#84d8e8] bg-[#84d8e8] text-[#06161b]"
                    : "border-[#3a4d54] text-[#dce8eb] hover:border-[#84d8e8] hover:text-[#84d8e8]"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => changePage(activePage + 1)}
              disabled={activePage === totalPages}
              aria-label="Next page"
              title="Next page"
              className="flex h-9 w-9 items-center justify-center border border-[#3a4d54] text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={17} />
            </button>
          </nav>
        </div>
      )}
    </section>
  );
}

function FootballCompetitionGroup({
  title,
  competitions,
  selectedKeys,
  onToggle,
}: {
  title: "Ongoing" | "Upcoming";
  competitions: FootballCompetitionOption[];
  selectedKeys: string[];
  onToggle: (competition: FootballCompetitionOption) => void;
}) {
  if (competitions.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#243c43] bg-[#14272e] px-4 py-3">
        <h4 className="text-xs font-black uppercase tracking-[0.12em] text-[#84d8e8]">
          {title}
        </h4>
        <span className="text-xs font-black uppercase text-[#9fb2b8]">
          {competitions.length} competitions
        </span>
      </div>
      <div className="divide-y divide-[#243c43]">
        {competitions.map((competition) => {
          const key = getFootballLeagueKey(competition);
          const checked = selectedKeys.includes(key);
          const phase = getFootballCompetitionPhase(competition);

          return (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-4 px-4 py-4 transition hover:bg-[#102d35]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(competition)}
                className="h-4 w-4 accent-[#84d8e8]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  {competition.name}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[#9fb2b8]">
                  {competition.country} / {competition.type} / Season{" "}
                  {competition.season}
                </p>
                <p className="mt-1 text-xs text-[#789098]">
                  {formatDateOnly(competition.start)} -{" "}
                  {formatDateOnly(competition.end)}
                </p>
              </div>
              <span className="shrink-0 rounded bg-[#162b32] px-3 py-1 text-xs font-black uppercase text-[#84d8e8]">
                {phase}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function F1MeetingGroup({
  title,
  meetings,
  selectedKeys,
  onToggle,
}: {
  title: "Ongoing" | "Upcoming";
  meetings: F1MeetingOption[];
  selectedKeys: number[];
  onToggle: (meeting: F1MeetingOption) => void;
}) {
  if (meetings.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#243c43] bg-[#14272e] px-4 py-3">
        <h4 className="text-xs font-black uppercase tracking-[0.12em] text-[#84d8e8]">
          {title}
        </h4>
        <span className="text-xs font-black uppercase text-[#9fb2b8]">
          {meetings.length} meetings
        </span>
      </div>
      <div className="divide-y divide-[#243c43]">
        {meetings.map((meeting) => {
          const checked = selectedKeys.includes(meeting.id);
          const phase = getF1MeetingPhase(meeting);

          return (
            <label
              key={meeting.id}
              className="flex cursor-pointer items-center gap-4 px-4 py-4 transition hover:bg-[#102d35]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(meeting)}
                className="h-4 w-4 accent-[#84d8e8]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  {meeting.name}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[#9fb2b8]">
                  {meeting.country} / Circuit: {meeting.circuit}
                </p>
                <p className="mt-1 text-xs text-[#789098]">
                  {formatDateOnly(meeting.start)} -{" "}
                  {formatDateOnly(meeting.end)}
                </p>
              </div>
              <span className="shrink-0 rounded bg-[#162b32] px-3 py-1 text-xs font-black uppercase text-[#84d8e8]">
                {phase}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function LolCompetitionGroup({
  title,
  competitions,
  selectedKeys,
  onToggle,
}: {
  title: "Ongoing" | "Upcoming";
  competitions: LolCompetitionOption[];
  selectedKeys: string[];
  onToggle: (competition: LolCompetitionOption) => void;
}) {
  if (competitions.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#243c43] bg-[#14272e] px-4 py-3">
        <h4 className="text-xs font-black uppercase tracking-[0.12em] text-[#84d8e8]">
          {title}
        </h4>
        <span className="text-xs font-black uppercase text-[#9fb2b8]">
          {competitions.length} competitions
        </span>
      </div>
      <div className="divide-y divide-[#243c43]">
        {competitions.map((competition) => {
          const checked = selectedKeys.includes(competition.id);
          const phase = getLolCompetitionPhase(competition);

          return (
            <label
              key={competition.id}
              className="flex cursor-pointer items-center gap-4 px-4 py-4 transition hover:bg-[#102d35]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(competition)}
                className="h-4 w-4 accent-[#84d8e8]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  {competition.name}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[#9fb2b8]">
                  {competition.region} / {competition.matches} matches
                </p>
                <p className="mt-1 text-xs text-[#789098]">
                  Next match: {formatDateTime(competition.nextMatchAt)}
                </p>
              </div>
              <span className="shrink-0 rounded bg-[#162b32] px-3 py-1 text-xs font-black uppercase text-[#84d8e8]">
                {phase}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function TournamentDetailView({
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
  const scheduleTotalPages = Math.max(1, Math.ceil(sortedMatches.length / schedulePageSize));
  const activeSchedulePage = Math.min(schedulePage, scheduleTotalPages);
  const scheduleStart = (activeSchedulePage - 1) * schedulePageSize;
  const visibleScheduleMatches = sortedMatches.slice(
    scheduleStart,
    scheduleStart + schedulePageSize,
  );
  const emptyScheduleMessage = isTodayScope
    ? `Giải ${tournament.name} không có lịch thi đấu hôm nay.`
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
            (tab, index) => (
              <button
                key={tab}
                type="button"
                onClick={index === 0 ? undefined : onUnavailableFeature}
                className={`pb-4 text-xs font-black uppercase tracking-[0.08em] ${
                  index === 0
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

function DashboardStatCard({
  title,
  value,
  icon,
  tone = "normal",
  onClick,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone?: "normal" | "warning";
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            className={`text-sm font-black uppercase tracking-[0.1em] ${
              tone === "warning" ? "text-[#f4c95d]" : "text-[#c8d6db]"
            }`}
          >
            {title}
          </h3>
          <p
            className={`mt-2 text-[36px] font-black leading-none ${
              tone === "warning" ? "text-[#f4c95d]" : "text-white"
            }`}
          >
            {value.toLocaleString()}
          </p>
        </div>
        <div
          className={`flex h-[54px] w-[49px] items-center justify-center rounded ${
            tone === "warning"
              ? "bg-[#302713] text-[#f4c95d]"
              : "bg-[#213740] text-white"
          }`}
        >
          {icon}
        </div>
      </div>
    </>
  );

  const className = `h-[144px] w-full rounded border bg-[#0d252d] px-6 py-6 text-left shadow-[0_2px_0_rgba(255,255,255,0.08)] ${
    tone === "warning" ? "border-[#8b7133]" : "border-[#3a4d54]"
  }`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} cursor-pointer transition hover:border-[#f4c95d] hover:bg-[#102d35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84d8e8]`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function DashboardPanelTitle({
  title,
  icon,
  right,
}: {
  title: string;
  icon?: React.ReactNode;
  right?: string;
}) {
  return (
    <div className="flex min-h-[65px] flex-col gap-3 border-b border-[#3a4d54] bg-[#14272e] px-4 py-4 sm:flex-row sm:items-center sm:px-6">
      <h2 className="min-w-0 flex-1 text-sm font-black uppercase tracking-[0.08em] text-[#d5e0e3]">
        {title}
      </h2>
      {icon && (
        <div className="flex w-full text-[#dce8eb] sm:w-[170px] sm:shrink-0 sm:justify-center">
          {icon}
        </div>
      )}
      {right && (
        <span className="w-full text-left text-xs font-black uppercase text-[#84d8e8] sm:w-[170px] sm:shrink-0 sm:text-right">
          {right}
        </span>
      )}
    </div>
  );
}

function MatchTeams({ match }: { match: MatchRow }) {
  const score = formatScore(match);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 font-black text-white">
      <div className="flex min-w-0 items-center gap-2">
        <TeamLogo
          name={match.homeName ?? "Home team"}
          src={match.homeLogoUrl}
        />
        <span className="min-w-0 truncate">{match.homeName ?? "TBD"}</span>
      </div>
      <span
        className={`shrink-0 rounded-sm px-2 py-1 text-xs uppercase ${
          score === "-"
            ? "text-[#84d8e8]"
            : "bg-[#183229] text-[#a7e8c0]"
        }`}
      >
        {score === "-" ? "vs" : score}
      </span>
      <div className="flex min-w-0 items-center justify-end gap-2 text-right">
        <span className="min-w-0 truncate">{match.awayName ?? "TBD"}</span>
        <TeamLogo
          name={match.awayName ?? "Away team"}
          src={match.awayLogoUrl}
        />
      </div>
    </div>
  );
}

function TeamLogo({ name, src }: { name: string; src?: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (!src) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#31505a] bg-[#143943] text-[11px] text-[#84d8e8]">
        {initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${name} logo`}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-7 w-7 shrink-0 rounded bg-white/90 object-contain p-0.5"
    />
  );
}
function DashboardStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const className =
    normalized === "ACTIVE" || normalized === "LIVE"
      ? "border-l-2 border-white bg-[#162b32] text-white"
      : normalized === "UPCOMING" || normalized === "PENDING"
        ? "border-l-2 border-[#f4c95d] bg-[#302713] text-[#ffe8a3]"
        : normalized === "COMPLETED" || normalized === "FINISHED"
          ? "bg-[#183229] text-[#a7e8c0]"
          : "bg-[#35171b] text-[#ff8a8a]";

  return (
    <span
      className={`inline-flex h-[27px] items-center px-3 text-xs font-black uppercase ${className}`}
    >
      {normalized}
    </span>
  );
}

function DashboardSourceBadge({ source }: { source: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-sm bg-[#203940] px-2 py-1 text-xs font-black uppercase text-[#dce8eb]">
      {source || "MANUAL"}
    </span>
  );
}

function DashboardActivityIcon({ type }: { type: string }) {
  if (type === "user") {
    return <Users size={14} />;
  }

  if (type === "match") {
    return <Zap size={14} />;
  }

  return <Trophy size={14} />;
}

function normalizeStatus(status: string): TournamentForm["status"] {
  const normalized = status.toUpperCase();

  if (
    normalized === "UPCOMING" ||
    normalized === "ACTIVE" ||
    normalized === "COMPLETED" ||
    normalized === "CANCELLED"
  ) {
    return normalized;
  }

  return "UPCOMING";
}

function getTournamentGroups(tournaments: TournamentRow[]) {
  const football = tournaments.filter(
    (tournament) =>
      normalizeSportType(tournament.sportType) === "FOOTBALL" &&
      !isLolTournament(tournament),
  );
  const f1 = tournaments.filter(
    (tournament) => normalizeSportType(tournament.sportType) === "F1",
  );
  const lol = tournaments.filter(isLolTournament);
  const otherSports = tournaments.filter((tournament) => {
    const sportType = normalizeSportType(tournament.sportType);

    return (
      sportType !== "FOOTBALL" &&
      sportType !== "F1" &&
      !isLolTournament(tournament)
    );
  });

  return [
    {
      sportType: "FOOTBALL",
      title: "Football Tournaments",
      total: football.length,
      tournaments: football,
      emptyMessage: "No football tournaments found in database.",
    },
    {
      sportType: "F1",
      title: "F1 Tournaments",
      total: f1.length,
      tournaments: f1,
      emptyMessage: "No F1 tournaments found in database.",
    },
    {
      sportType: "LOL",
      title: "League of Legends Tournaments",
      total: lol.length,
      tournaments: lol,
      emptyMessage: "No League of Legends tournaments found in database.",
    },
    {
      sportType: "OTHER",
      title: "Other Sports Tournaments",
      total: otherSports.length,
      tournaments: otherSports,
      emptyMessage: "No other sports tournaments found in database.",
    },
  ];
}

function normalizeSportType(sportType: string | undefined) {
  return (sportType || "FOOTBALL").toUpperCase();
}

function isLolTournament(tournament: TournamentRow) {
  return (
    tournament.source?.toUpperCase() === "CITO_LOL" ||
    normalizeSportType(tournament.sportType) === "LOL"
  );
}

function getFootballLeagueKey(competition: FootballCompetitionOption) {
  return `${competition.id}:${competition.season}`;
}

function getFootballCompetitionPhase(competition: FootballCompetitionOption) {
  const now = new Date();
  const start = competition.start ? new Date(competition.start) : null;
  const end = competition.end ? new Date(competition.end) : null;

  if ((!start || start <= now) && (!end || end >= now)) {
    return "ongoing";
  }

  return "upcoming";
}

function getF1MeetingPhase(meeting: F1MeetingOption) {
  const now = new Date();
  const start = new Date(meeting.start);
  const end = new Date(meeting.end);

  if (start <= now && end >= now) {
    return "ongoing";
  }

  return "upcoming";
}

function getLolCompetitionPhase(competition: LolCompetitionOption) {
  if (competition.current) {
    return "ongoing";
  }

  return "upcoming";
}

function getImportSportLabel(sport: ImportSport) {
  if (sport === "F1") {
    return "F1";
  }

  if (sport === "LOL") {
    return "League of Legends";
  }

  return "football";
}

function formatDateOnly(value: string | null) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatShortTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTournamentDateRange(matches: MatchRow[]) {
  const timestamps = matches
    .map((match) => new Date(match.scheduledTime).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp))
    .sort((first, second) => first - second);

  if (timestamps.length === 0) {
    return "Schedule TBD";
  }

  return `${formatDateOnly(new Date(timestamps[0]).toISOString())} - ${formatDateOnly(
    new Date(timestamps[timestamps.length - 1]).toISOString(),
  )}`;
}

function isFinishedStatus(status: string) {
  const normalizedStatus = status.toUpperCase();

  return (
    normalizedStatus === "FINISHED" ||
    normalizedStatus === "COMPLETED" ||
    normalizedStatus === "FT"
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatScore(match: MatchRow) {
  if (match.actualHomeScore === null || match.actualAwayScore === null) {
    return "-";
  }

  return `${match.actualHomeScore} - ${match.actualAwayScore}`;
}

function formatRelative(value: string | null) {
  if (!value) {
    return "No sync yet";
  }

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();

  if (Number.isNaN(diffMs)) {
    return "Unknown";
  }

  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) {
    return `${minutes} minutes ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} hours ago`;
  }

  return `${Math.round(hours / 24)} days ago`;
}



