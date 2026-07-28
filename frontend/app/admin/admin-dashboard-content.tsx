"use client";

import { apiRequest } from "../api";
import NoticeBanner, { type Notice } from "../notice-banner";
import type React from "react";
import { Fragment, useEffect, useState } from "react";
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
  sportType: "FOOTBALL" | "F1";
  format: "ROUND_ROBIN" | "GROUP_AND_KNOCKOUT" | "KNOCKOUT";
  status: "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  visibility: "PUBLIC" | "PRIVATE";
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
  const [editingTournamentId, setEditingTournamentId] = useState<number | null>(
    null,
  );
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(
    null,
  );
  const [tournamentForm, setTournamentForm] =
    useState<TournamentForm>(emptyTournamentForm);

  useEffect(() => {
    void loadDashboard();
  }, [refreshKey]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadDashboard();
    }, DASHBOARD_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, []);

  async function loadDashboard() {
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
  }

  function showNotice(message: string, tone: Notice["tone"] = "info") {
    setNotice({ message, tone });
  }

  async function syncSportsApi() {
    if (!isAdmin) {
      showNotice("Only admin can sync API data.", "error");
      return;
    }

    setIsMutating(true);

    try {
      const result = await apiRequest<{
        football?: { competitions: number; matches: number; error: string | null };
        f1?: { meetings: number; sessions: number; error: string | null };
      }>("/dashboard/sync", {
        method: "POST",
      });
      await loadDashboard();
      showNotice(
        [
          `Football: ${result.football?.competitions ?? 0} competitions, ${
            result.football?.matches ?? 0
          } matches`,
          `F1: ${result.f1?.meetings ?? 0} meetings, ${
            result.f1?.sessions ?? 0
          } sessions`,
          result.football?.error ? `Football note: ${result.football.error}` : "",
          result.f1?.error ? `F1 note: ${result.f1.error}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        "success",
      );
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "API sync failed.", "error");
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
      sportType: tournament.sportType === "F1" ? "F1" : "FOOTBALL",
      format: "ROUND_ROBIN",
      status: normalizeStatus(tournament.status),
      visibility: "PUBLIC",
    });
    setOpenTournamentForm(true);
  }

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
              onClick={syncSportsApi}
            />
            <DashboardActionButton
              icon={<FileDown size={18} />}
              label={isMutating ? "Importing..." : "Import API"}
              onClick={syncSportsApi}
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
        <section className="overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d]">
          <DashboardPanelTitle
            title="Tournament Management"
            icon={<Filter size={17} />}
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
                {dashboard.tournaments.map((tournament) => {
                  const isSelected = selectedTournamentId === tournament.id;
                  const matches = dashboard.tournamentMatches.filter(
                    (match) => match.tournamentId === tournament.id,
                  );

                  return (
                    <Fragment key={tournament.id}>
                      <tr
                        onClick={() =>
                          setSelectedTournamentId((currentId) =>
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
                                onClick={() => openEditTournament(tournament)}
                                className="text-[#84d8e8] transition hover:text-white"
                                title="Edit tournament"
                              >
                                <Pencil size={17} />
                              </button>
                              <button
                                onClick={() => void deleteTournament(tournament)}
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
                {dashboard.tournaments.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="h-[120px] text-center text-[#9fb2b8]"
                    >
                      No tournaments found in database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

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

      <section className="mt-14 overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d]">
        <DashboardPanelTitle title="Upcoming Schedule" right="View All Matches" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] table-fixed text-left">
            <thead className="h-[65px] border-b border-[#3a4d54] bg-[#14272e] text-xs uppercase tracking-[0.08em] text-[#d5e0e3]">
              <tr>
                <th className="px-6 py-4">Match Encounter</th>
                <th className="px-4 py-4">Tournament</th>
                <th className="px-4 py-4">Kick-off Time</th>
                <th className="px-4 py-4">Source</th>
                <th className="px-4 py-4">Deadline</th>
                <th className="px-4 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.upcomingSchedule.map((match) => (
                <tr
                  key={match.id}
                  className="h-[65px] border-b border-[#243c43] text-sm last:border-b-0"
                >
                  <td className="px-6 font-black text-white">
                    {match.encounter}
                  </td>
                  <td className="px-4 text-white">{match.tournamentName}</td>
                  <td className="px-4 text-white">
                    {formatDate(match.scheduledTime)}
                  </td>
                  <td className="px-4">
                    <DashboardSourceBadge source={match.source} />
                  </td>
                  <td className="px-4 text-white">
                    {formatDate(match.deadline)}
                  </td>
                  <td className="px-4">
                    <DashboardStatusBadge status={match.status} />
                  </td>
                </tr>
              ))}
              {dashboard.upcomingSchedule.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="h-[110px] text-center text-[#9fb2b8]"
                  >
                    No upcoming matches found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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
                options={["FOOTBALL", "F1"]}
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
                <td colSpan={5} className="h-[96px] bg-[#0d252d] text-center text-[#9fb2b8]">
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
