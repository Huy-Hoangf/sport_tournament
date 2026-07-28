"use client";

import { apiRequest } from "../api";
import NoticeBanner, { type Notice } from "../notice-banner";
import type React from "react";
import { Fragment, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Cloud,
  FileDown,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

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
  };
  tournaments: TournamentRow[];
  tournamentMatches: MatchRow[];
  upcomingSchedule: MatchRow[];
  recentActivity: ActivityRow[];
};

type TournamentRow = {
  id: number;
  name: string;
  sportType?: string;
  status: string;
  players: number;
  matches: number;
  source: string;
};

type TournamentForm = {
  name: string;
  sportType: "FOOTBALL" | "F1" | "ESPORTS";
  format: "ROUND_ROBIN" | "GROUP_AND_KNOCKOUT" | "KNOCKOUT";
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
  encounter: string;
  tournamentName: string;
  scheduledTime: string;
  deadline: string;
  source: string;
  status: string;
};

type ActivityRow = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

const emptyTournamentForm: TournamentForm = {
  name: "",
  sportType: "FOOTBALL",
  format: "ROUND_ROBIN",
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
  },
  tournaments: [],
  tournamentMatches: [],
  upcomingSchedule: [],
  recentActivity: [],
};

export default function AdminDashboardContent({
  isAdmin,
  refreshKey,
}: {
  isAdmin: boolean;
  refreshKey: number;
}) {
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [openTournamentForm, setOpenTournamentForm] = useState(false);
  const [openImportApiModal, setOpenImportApiModal] = useState(false);
  const [openSyncApiModal, setOpenSyncApiModal] = useState(false);
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
  const [tournamentForm, setTournamentForm] =
    useState<TournamentForm>(emptyTournamentForm);

  const showNotice = useCallback(
    (message: string, tone: Notice["tone"] = "info") => {
      setNotice({ message, tone });
    },
    [],
  );

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await apiRequest<DashboardData>("/dashboard");
      setDashboard(data);
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Cannot load dashboard.",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  }, [showNotice]);

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

  function selectOngoingFootballLeagues() {
    setSelectedFootballLeagueKeys(
      footballCompetitions
        .filter(
          (competition) =>
            getFootballCompetitionPhase(competition) === "ongoing",
        )
        .map((competition) => getFootballLeagueKey(competition)),
    );
  }

  function selectOngoingImportItems() {
    if (importSport === "F1") {
      setSelectedF1MeetingKeys(
        f1Meetings
          .filter((meeting) => getF1MeetingPhase(meeting) === "ongoing")
          .map((meeting) => meeting.id),
      );
      return;
    }

    if (importSport === "LOL") {
      setSelectedLolCompetitionKeys(
        lolCompetitions
          .filter(
            (competition) => getLolCompetitionPhase(competition) === "ongoing",
          )
          .map((competition) => competition.id),
      );
      return;
    }

    selectOngoingFootballLeagues();
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
        tournament.sportType === "F1"
          ? "F1"
          : normalizeSportType(tournament.sportType) === "ESPORTS"
            ? "ESPORTS"
            : "FOOTBALL",
      format: "ROUND_ROBIN",
      status: normalizeStatus(tournament.status),
      visibility: "PUBLIC",
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
  const tournamentGroups = getTournamentGroups(dashboard.tournaments);

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
    <div className="px-8 py-9">
      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h2 className="text-[34px] font-black leading-none text-white">
            Dashboard
          </h2>
          <p className="mt-3 text-[16px] text-[#adbdc2]">
            Welcome back. System is running within optimal parameters.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-4">
          {isAdmin ? (
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
                className="flex h-[62px] items-center gap-3 rounded bg-[#84d8e8] px-8 text-lg font-black text-[#06161b]"
              >
                <Plus size={22} />
                Create Tournament
              </button>
            </>
          ) : (
            <div className="rounded border border-[#3a4d54] bg-[#0d252d] px-5 py-4 text-sm font-bold text-[#9fb2b8]">
              View-only access
            </div>
          )}
        </div>
      </div>

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
            <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </section>

      <section className="mb-5 grid grid-cols-4 gap-6">
        <DashboardStatCard
          title="Active Tournaments"
          value={dashboard.stats.activeTournaments}
          note="Live in database"
          icon={<Trophy size={22} />}
        />
        <DashboardStatCard
          title="Total Players"
          value={dashboard.stats.totalPlayers}
          note="Registered players"
          icon={<Users size={22} />}
        />
        <DashboardStatCard
          title="Upcoming Matches"
          value={dashboard.stats.upcomingMatches}
          note="From now onward"
          icon={<CalendarDays size={22} />}
        />
        <DashboardStatCard
          tone="danger"
          title="Attention Needed"
          value={dashboard.stats.attentionNeeded}
          note={`${dashboard.stats.inactivePlayers} inactive, ${dashboard.stats.pendingPredictions} pending`}
          icon={<AlertTriangle size={24} />}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-5">
          {tournamentGroups.map((group) => (
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
                ×
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
                onClick={selectOngoingImportItems}
                disabled={isLoadingCompetitions || importItemCount === 0}
                className="h-11 rounded border border-[#84d8e8] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#84d8e8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Select ongoing{" "}
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
                label="Sport"
                value={tournamentForm.sportType}
                options={["FOOTBALL", "F1", "ESPORTS"]}
                onChange={(value) =>
                  setTournamentForm((form) => ({
                    ...form,
                    sportType: value as TournamentForm["sportType"],
                  }))
                }
              />
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
                label="Format"
                value={tournamentForm.format}
                options={["ROUND_ROBIN", "GROUP_AND_KNOCKOUT", "KNOCKOUT"]}
                onChange={(value) =>
                  setTournamentForm((form) => ({
                    ...form,
                    format: value as TournamentForm["format"],
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
          <div className="w-full max-w-[460px] rounded border border-[#6b4440] bg-[#0d252d] p-7 shadow-2xl">
            <h3 className="text-2xl font-black text-[#ffab9e]">
              Delete Tournament
            </h3>
            <p className="mt-4 text-base font-bold text-white">
              Delete This Tournament
            </p>
            <p className="mt-2 text-sm text-[#9fb2b8]">
              {tournamentToDelete.name}
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
                className="h-12 rounded bg-[#ffab9e] px-6 font-black text-[#2b1414] disabled:opacity-60"
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
      className="flex h-[62px] items-center gap-3 rounded border border-[#3a4d54] bg-[#0d252d] px-7 text-lg font-black text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8]"
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
  return (
    <section className="overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d]">
      <DashboardPanelTitle
        title={title}
        icon={<Filter size={17} />}
        right={total > 5 ? `Showing 5 of ${total}` : `${total} total`}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed text-left">
          <thead className="h-[65px] border-b border-[#3a4d54] bg-[#14272e] text-xs uppercase tracking-[0.08em] text-[#d5e0e3]">
            <tr>
              <th className="px-6 py-4">Tournament Name</th>
              <th className="w-28 px-4 py-4">Sport</th>
              <th className="w-32 px-4 py-4">Status</th>
              <th className="w-24 px-4 py-4">Players</th>
              <th className="w-24 px-4 py-4">Matches</th>
              <th className="w-44 px-4 py-4">Source</th>
              <th className="w-28 px-4 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map((tournament) => {
              const isSelected = selectedTournamentId === tournament.id;
              const matches = tournamentMatches.filter(
                (match) => match.tournamentId === tournament.id,
              );

              return (
                <Fragment key={tournament.id}>
                  <tr
                    onClick={() =>
                      onSelectTournament((currentId) =>
                        currentId === tournament.id ? null : tournament.id,
                      )
                    }
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
                      {tournament.players.toLocaleString()}
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
                            className="text-[#ffab9e] transition hover:text-white"
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
                  {isSelected && (
                    <tr className="border-b border-[#243c43] bg-[#092127]">
                      <td colSpan={7} className="p-0">
                        <TournamentMatchDetails
                          tournament={tournament}
                          matches={matches}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {tournaments.length === 0 && (
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

function TournamentMatchDetails({
  tournament,
  matches,
}: {
  tournament: TournamentRow;
  matches: MatchRow[];
}) {
  const isF1 = tournament.sportType === "F1";

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.08em] text-[#84d8e8]">
            {tournament.name} Details
          </h3>
          <p className="mt-2 text-sm text-[#9fb2b8]">
            <span className="font-black uppercase text-white">
              {tournament.sportType ?? "FOOTBALL"}
            </span>{" "}
            / {tournament.status} / Source: {tournament.source || "MANUAL"}
          </p>
        </div>
        <span className="text-xs font-black uppercase text-[#84d8e8]">
          {matches.length} {matches.length === 1 ? "match" : "matches"}
        </span>
      </div>

      <div className="overflow-x-auto rounded border border-[#243c43]">
        <table className="w-full min-w-[860px] table-fixed text-left">
          <thead className="h-[54px] border-b border-[#3a4d54] bg-[#14272e] text-xs uppercase tracking-[0.08em] text-[#d5e0e3]">
            <tr>
              <th className="px-5 py-3">
                {isF1 ? "Session / Circuit" : "Teams / Players"}
              </th>
              <th className="w-48 px-4 py-3">
                {isF1 ? "Session Time" : "Match Time"}
              </th>
              <th className="w-48 px-4 py-3">Prediction Lock</th>
              <th className="w-40 px-4 py-3">Source</th>
              <th className="w-32 px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr
                key={match.id}
                className="h-[64px] border-b border-[#243c43] bg-[#0d252d] text-sm last:border-b-0"
              >
                <td className="px-5 font-black text-white">
                  {isF1 ? (
                    <div>
                      <p>{match.homeName ?? match.encounter}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[#9fb2b8]">
                        Circuit: {match.awayName ?? "TBD"}
                      </p>
                    </div>
                  ) : (
                    match.encounter
                  )}
                </td>
                <td className="px-4 text-white">
                  {formatDateTime(match.scheduledTime)}
                </td>
                <td className="px-4 text-white">
                  {formatDateTime(match.deadline)}
                </td>
                <td className="px-4">
                  <DashboardSourceBadge source={match.source} />
                </td>
                <td className="px-4">
                  <DashboardStatusBadge status={match.status} />
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="h-[96px] bg-[#0d252d] text-center text-[#9fb2b8]"
                >
                  No matches found for this tournament.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardStatCard({
  title,
  value,
  note,
  icon,
  tone = "normal",
}: {
  title: string;
  value: number;
  note: string;
  icon: React.ReactNode;
  tone?: "normal" | "danger";
}) {
  return (
    <div
      className={`h-[144px] rounded border bg-[#0d252d] px-6 py-6 shadow-[0_2px_0_rgba(255,255,255,0.08)] ${
        tone === "danger" ? "border-[#6b4440]" : "border-[#3a4d54]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            className={`text-sm font-black uppercase tracking-[0.1em] ${
              tone === "danger" ? "text-[#ffab9e]" : "text-[#c8d6db]"
            }`}
          >
            {title}
          </h3>
          <p
            className={`mt-2 text-[36px] font-black leading-none ${
              tone === "danger" ? "text-[#ffab9e]" : "text-white"
            }`}
          >
            {value.toLocaleString()}
          </p>
          <p className="mt-4 text-xs font-bold text-white">{note}</p>
        </div>
        <div className="flex h-[54px] w-[49px] items-center justify-center rounded bg-[#213740] text-white">
          {icon}
        </div>
      </div>
    </div>
  );
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
    <div className="flex h-[65px] items-center justify-between border-b border-[#3a4d54] bg-[#14272e] px-6">
      <h2 className="text-sm font-black uppercase tracking-[0.08em] text-[#d5e0e3]">
        {title}
      </h2>
      {icon && <div className="text-[#dce8eb]">{icon}</div>}
      {right && (
        <button className="text-xs font-black uppercase text-[#84d8e8]">
          {right}
        </button>
      )}
    </div>
  );
}

function DashboardStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const className =
    normalized === "ACTIVE" || normalized === "LIVE"
      ? "border-l-2 border-white bg-[#162b32] text-white"
      : normalized === "UPCOMING" || normalized === "PENDING"
        ? "bg-[#1c3037] text-[#dce8eb]"
        : normalized === "COMPLETED" || normalized === "FINISHED"
          ? "bg-[#183229] text-[#a7e8c0]"
          : "bg-[#2b1414] text-[#ffab9e]";

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
      tournaments: football.slice(0, 5),
      emptyMessage: "No football tournaments found in database.",
    },
    {
      sportType: "F1",
      title: "F1 Tournaments",
      total: f1.length,
      tournaments: f1.slice(0, 5),
      emptyMessage: "No F1 tournaments found in database.",
    },
    {
      sportType: "LOL",
      title: "League of Legends Tournaments",
      total: lol.length,
      tournaments: lol.slice(0, 5),
      emptyMessage: "No League of Legends tournaments found in database.",
    },
    {
      sportType: "OTHER",
      title: "Other Sports Tournaments",
      total: otherSports.length,
      tournaments: otherSports.slice(0, 5),
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

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
