"use client";

import { apiRequest, type CurrentUser } from "../api";
import { logoutAll, readCurrentUser } from "../auth-sync";
import NoticeBanner, { type Notice } from "../notice-banner";
import DashboardView from "./dashboard/dashboard-view";
import { AdminSelect } from "./shared/admin-select";
import { DashboardActivityIcon } from "./shared/dashboard-ui";
import TournamentView from "./tournament/tournament-view";
import type { ActivityRow } from "./tournament/types";
import { formatRelative } from "./tournament/utils";
import {
  MenuItem,
  Modal,
  ModalActions,
  PageButton,
  StatCard,
  StatusBadge,
  StatusFilterSelect,
  type PlayerStatus,
  type StatusFilter,
} from "./admin-player-components";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreVertical,
  Pencil,
  Search,
  Settings,
  ShieldPlus,
  SlidersHorizontal,
  Trophy,
  Trash2,
  UserPlus,
  Users,
  Wifi,
  X,
} from "lucide-react";

type BackendUser = {
  id: number;
  memberCode: string | null;
  fullName: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "PLAYER";
  status?: "ACTIVE" | "INACTIVE" | "PENDING";
  eventsCount?: number;
  createdAt?: string;
};

type Player = {
  id: string;
  memberCode: string;
  fullName: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "PLAYER";
  rank: "ELITE" | "PRO" | "ROOKIE";
  points: number;
  status: PlayerStatus;
  events: number;
};

type CreateUserResponse = {
  message: string;
  user: BackendUser & {
    defaultPassword: string;
  };
};

type ImportedPlayer = {
  fullName: string;
  email: string;
};

type RecentActivityResponse = {
  recentActivity?: ActivityRow[];
};

type AdminView = 'dashboard' | 'tournaments' | 'players';

const PLAYERS_PER_PAGE = 7;
const COMPANY_EMAIL_DOMAIN = "@tech.com";

export default function AdminPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeView, setActiveView] = useState<AdminView>("dashboard");
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"ADMIN" | "PLAYER">("PLAYER");
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNameSearchOpen, setIsNameSearchOpen] = useState(false);
  const [openPlayerActionId, setOpenPlayerActionId] = useState<string | null>(
    null,
  );
  const [nameSearch, setNameSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [renameFullName, setRenameFullName] = useState("");
  const [renameEmail, setRenameEmail] = useState("");
  const [renameRole, setRenameRole] = useState<"ADMIN" | "PLAYER">("PLAYER");
  const [importFileName, setImportFileName] = useState("");
  const [importPlayers, setImportPlayers] = useState<ImportedPlayer[]>([]);
  const [openModal, setOpenModal] = useState<
    | "createUser"
    | "createUserFromList"
    | "changePassword"
    | "renamePlayer"
    | "changeStatus"
    | "deletePlayer"
    | "deleteAllPlayers"
    | null
  >(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [openRecentActivity, setOpenRecentActivity] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityRow[]>([]);
  const [isLoadingRecentActivity, setIsLoadingRecentActivity] =
    useState(false);
  const isAdmin =
    currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const showNotice = useCallback((message: string, tone: Notice["tone"] = "info") => {
    setNotice({ message, tone });
  }, []);

  const fetchPlayers = useCallback(async () => {
    try {
      const users = await apiRequest<BackendUser[]>("/users");
      setPlayers(users.map(mapUserToPlayer));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Cannot load users.");
    }
  }, [showNotice]);

  function refreshDashboard() {
    setDashboardRefreshKey((key) => key + 1);
  }

  useEffect(() => {
    const currentUser = readCurrentUser() as CurrentUser | null;

    if (!currentUser) {
      router.push("/login");
      return;
    }

    queueMicrotask(() => {
      setCurrentUser(currentUser);
      setActiveView(currentUser.role === "PLAYER" ? "dashboard" : "players");

      if (currentUser.role !== "PLAYER") {
        void fetchPlayers();
      }
    });

    function handleStorage(event: StorageEvent) {
      if (event.key === "logoutEvent" || event.key === "currentUser") {
        if (!localStorage.getItem("currentUser")) {
          router.push("/login");
        }
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchPlayers, router]);

  const activeCount = useMemo(
    () => players.filter((player) => player.status === "ACTIVE").length,
    [players],
  );
  const tournamentEntries = useMemo(
    () => players.reduce((total, player) => total + player.events, 0),
    [players],
  );
  const visiblePlayers = useMemo(() => {
    const keyword = nameSearch.trim().toLowerCase();
    const statusFilteredPlayers =
      statusFilter === "ALL"
        ? players
        : players.filter((player) => player.status === statusFilter);

    if (!keyword) {
      return statusFilteredPlayers;
    }

    return statusFilteredPlayers.filter((player) => {
      const normalizedKeyword = keyword.replace(/^id[-_\s]*/i, "");

      return (
        player.fullName.toLowerCase().includes(keyword) ||
        player.email.toLowerCase().includes(keyword) ||
        player.memberCode.toLowerCase().includes(keyword) ||
        player.memberCode.toLowerCase().includes(normalizedKeyword) ||
        player.id.toLowerCase().includes(normalizedKeyword)
      );
    });
  }, [nameSearch, players, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(visiblePlayers.length / PLAYERS_PER_PAGE));
  const currentSafePage = Math.min(currentPage, totalPages);
  const paginatedPlayers = visiblePlayers.slice(
    (currentSafePage - 1) * PLAYERS_PER_PAGE,
    currentSafePage * PLAYERS_PER_PAGE,
  );

  async function createPlayer() {
    if (!isAdmin) {
      showNotice("Only admin can create players.");
      return;
    }

    if (!fullName.trim() || !email.trim()) {
      showNotice("Please enter name and email.");
      return;
    }

    if (newUserRole === "ADMIN" && !isSuperAdmin) {
      showNotice("Only the super admin can create administrator accounts.");
      return;
    }

    setIsLoading(true);

    try {
      const data = await apiRequest<CreateUserResponse>("/users/admin/create", {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          role: newUserRole,
        }),
      });

      showNotice(
        `User created successfully. Default password: ${data.user.defaultPassword}`,
      );
      setFullName("");
      setEmail("");
      setNewUserRole("PLAYER");
      setOpenModal(null);
      await fetchPlayers();
      refreshDashboard();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Create user failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function renamePlayer() {
    if (!selectedPlayer) {
      return;
    }

    if (!isAdmin) {
      showNotice("Only admin can update users.");
      return;
    }

    if (!canRenameUser(selectedPlayer, currentUser)) {
      showNotice("You cannot update this administrator account.");
      return;
    }

    if (!renameFullName.trim()) {
      showNotice("Please enter a new player name.");
      return;
    }

    if (!renameEmail.trim()) {
      showNotice("Please enter player email.");
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest<{ message: string; user: BackendUser }>(
        `/users/admin/${selectedPlayer.id}/rename`,
        {
          method: "PATCH",
          body: JSON.stringify({
            fullName: renameFullName.trim(),
            email: renameEmail.trim().toLowerCase(),
            role: renameRole,
          }),
        },
      );

      showNotice("User updated successfully.");
      setSelectedPlayer(null);
      setRenameFullName("");
      setRenameEmail("");
      setRenameRole("PLAYER");
      setOpenModal(null);
      await fetchPlayers();
      refreshDashboard();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Update player failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function promotePlayerToAdmin(player: Player) {
    if (!isSuperAdmin) {
      showNotice("Only the super admin can add administrator accounts.");
      return;
    }

    if (player.role !== "PLAYER") {
      showNotice("This user is already an administrator.");
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest<{ message: string; user: BackendUser }>(
        `/users/admin/${player.id}/rename`,
        {
          method: "PATCH",
          body: JSON.stringify({
            fullName: player.fullName,
            email: player.email,
            role: "ADMIN",
          }),
        },
      );

      showNotice(`${player.fullName} promoted to admin successfully.`);
      setOpenPlayerActionId(null);
      await fetchPlayers();
      refreshDashboard();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Promote user failed.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleImportFile(file: File | null) {
    if (!file) {
      setImportFileName("");
      setImportPlayers([]);
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const preferredSheet =
        workbook.SheetNames.find((sheetName) => sheetName.includes("Dự đoán")) ??
        workbook.SheetNames[0];
      const worksheet = workbook.Sheets[preferredSheet];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        blankrows: false,
      });
      const imported = parsePlayersFromRows(rows, players);

      setImportFileName(file.name);
      setImportPlayers(imported);

      if (imported.length === 0) {
        showNotice("Cannot find player names in this Excel file.");
      }
    } catch {
      showNotice("Cannot read this Excel file.");
      setImportFileName("");
      setImportPlayers([]);
    }
  }

  async function importPlayersFromList() {
    if (!isAdmin) {
      showNotice("Only admin can import players.");
      return;
    }

    if (importPlayers.length === 0) {
      showNotice("Please choose an Excel file first.");
      return;
    }

    setIsLoading(true);

    let successCount = 0;
    const failedRows: string[] = [];

    for (const player of importPlayers) {
      try {
        await apiRequest<CreateUserResponse>("/users/admin/create", {
          method: "POST",
          body: JSON.stringify(player),
        });
        successCount += 1;
      } catch (error) {
        failedRows.push(
          `${player.fullName}: ${
            error instanceof Error ? error.message : "Import failed"
          }`,
        );
      }
    }

    setIsLoading(false);
    await fetchPlayers();

    if (failedRows.length > 0) {
      showNotice(
        `Imported ${successCount}/${importPlayers.length} players.\nFailed:\n${failedRows.join(
          "\n",
        )}`,
      );
      return;
    }

    showNotice(`Imported ${successCount} players. Default password: 123456`);
    setImportFileName("");
    setImportPlayers([]);
    setOpenModal(null);
  }

  function openDeletePlayerConfirmation(player: Player) {
    if (!isAdmin) {
      showNotice("Only admin can delete players.");
      return;
    }

    if (player.role !== "PLAYER") {
      showNotice("Cannot delete the admin account.");
      return;
    }

    setSelectedPlayer(player);
    setOpenModal("deletePlayer");
  }

  async function deletePlayer() {
    if (!selectedPlayer) {
      return;
    }

    const player = selectedPlayer;
    setIsLoading(true);

    try {
      await apiRequest<{ message: string }>(`/users/admin/${player.id}`, {
        method: "DELETE",
      });

      showNotice("Player deleted successfully.");
      setOpenModal(null);
      setSelectedPlayer(null);
      await fetchPlayers();
      refreshDashboard();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Delete player failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function openDeleteAllPlayersConfirmation() {
    if (!isAdmin) {
      showNotice("Only admin can delete players.");
      return;
    }

    const playerCount = players.filter((player) => player.role === "PLAYER").length;

    if (playerCount === 0) {
      showNotice("There are no players to delete.");
      return;
    }

    setOpenModal("deleteAllPlayers");
  }

  async function deleteAllPlayers() {
    if (!isAdmin) {
      showNotice("Only admin can delete players.");
      return;
    }

    setIsLoading(true);

    try {
      const data = await apiRequest<{
        message: string;
        deletedCount: number;
      }>("/users/admin/all", {
        method: "DELETE",
      });

      showNotice(`Deleted ${data.deletedCount} players.`);
      setOpenModal(null);
      setCurrentPage(1);
      await fetchPlayers();
      refreshDashboard();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Delete all players failed.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function changePlayerStatus(status: Player["status"]) {
    if (!selectedPlayer) {
      return;
    }

    if (!isAdmin) {
      showNotice("Only admin can change player status.");
      return;
    }

    if (selectedPlayer.role !== "PLAYER") {
      showNotice("Cannot change the admin account status.");
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest<{ message: string; user: BackendUser }>(
        `/users/admin/${selectedPlayer.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );

      showNotice("Player status updated successfully.");
      setSelectedPlayer(null);
      setOpenModal(null);
      await fetchPlayers();
      refreshDashboard();
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Change player status failed.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function changePassword() {
    const currentUser = readCurrentUser() as CurrentUser | null;

    if (!currentUser) {
      router.push("/login");
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotice("Please fill all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotice("Confirm password does not match.");
      return;
    }

    try {
      await apiRequest<{ message: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          email: currentUser.email,
          currentPassword,
          newPassword,
        }),
      });

      showNotice("Password changed successfully.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOpenModal(null);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Change password failed.");
    }
  }

  function logout() {
    logoutAll();
    router.push("/login");
  }

  function openAdminView(view: AdminView) {
    setActiveView(view);
    setIsMobileMenuOpen(false);
    setOpenPlayerActionId(null);
  }

  async function openRecentActivityPanel() {
    setOpenRecentActivity(true);
    setIsLoadingRecentActivity(true);

    try {
      const data = await apiRequest<RecentActivityResponse>(
        "/dashboard?scope=today",
      );
      setRecentActivity(data.recentActivity ?? []);
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Cannot load recent activity.",
      );
    } finally {
      setIsLoadingRecentActivity(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#06161b] text-[#d9e5e7]">
      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />
      <header className="sticky top-0 z-40 border-b border-[#3c5056] bg-[#07181d]/95 px-4 py-3 backdrop-blur xl:hidden">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_92px] items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded border border-[#3a4d54] bg-[#0d252d] text-[#dce8eb]"
            aria-label="Open navigation menu"
          >
            <Menu size={23} />
          </button>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-lg font-black uppercase tracking-[0.04em] text-[#84d8e8]">
              TWENTY-TECH
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9fb2b8]">
              A game for company
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void openRecentActivityPanel()}
              className="flex h-11 w-11 items-center justify-center rounded border border-[#3a4d54] bg-[#0d252d] text-[#dce8eb]"
              aria-label="Notifications"
            >
              <Bell size={20} />
            </button>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-[#41636d] bg-[#143942] text-sm font-black uppercase text-[#84d8e8]">
              {currentUser?.fullName?.trim().charAt(0) || "A"}
            </div>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="relative flex h-full w-[min(320px,86vw)] flex-col overflow-y-auto border-r border-[#3c5056] bg-[#0d252d] shadow-2xl">
            <div className="flex items-start justify-between gap-4 px-5 py-5">
              <div>
                <h1 className="text-base font-black uppercase leading-4 tracking-[0.08em] text-white">
                  TWENTY
                  <br />
                  TECH
                </h1>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#9fb2b8]">
                  A GAME FOR COMPANY
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded border border-[#3a4d54] text-[#dce8eb]"
                aria-label="Close navigation menu"
              >
                <X size={21} />
              </button>
            </div>

            <div className="mx-5 flex items-center justify-between border-y border-[#3c5056] py-4">
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase text-white">
                  {currentUser?.fullName ?? "Admin_01"}
                </p>
                <p className="text-[10px] uppercase text-[#c4d3d8]">Online</p>
              </div>
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center border border-[#41636d] bg-[#143942] text-sm font-black uppercase text-[#84d8e8]">
                {currentUser?.fullName?.trim().charAt(0) || "A"}
              </div>
            </div>

            <nav className="mt-5 space-y-2 text-sm font-bold">
              <MenuItem active={activeView === "dashboard"} icon={<LayoutDashboard size={21} />} label="Dashboard" onClick={() => openAdminView("dashboard")} />
              <MenuItem active={activeView === "tournaments"} icon={<Trophy size={21} />} label="Tournaments" onClick={() => openAdminView("tournaments")} />
              <MenuItem icon={<Gamepad2 size={21} />} label="Matches" onClick={() => showNotice("this feature is not ready")} />
              {isAdmin && (
                <MenuItem active={activeView === "players"} icon={<Users size={18} />} label="Players" onClick={() => openAdminView("players")} />
              )}
              <MenuItem icon={<BarChart3 size={21} />} label="Leaderboard" onClick={() => showNotice("this feature is not ready")} />
            </nav>

            <div className="mt-auto border-t border-[#3c5056] p-5">
              <button
                onClick={() => {
                  setOpenModal("changePassword");
                  setIsMobileMenuOpen(false);
                }}
                className="mb-5 flex w-full items-center gap-4 text-lg text-[#e2edf0]"
              >
                <Settings size={21} />
                Setting
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-4 text-lg text-[#ff8a8a]"
              >
                <LogOut size={21} />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden border-b border-[#3c5056] bg-[#0d252d] xl:fixed xl:left-0 xl:top-0 xl:flex xl:h-screen xl:w-[260px] xl:flex-col xl:border-b-0 xl:border-r">
        <div className="px-6 pt-8">
          <h1 className="text-sm font-black uppercase leading-3 tracking-[0.08em] text-white">
            TWENTY
            <br />
            TECH
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#9fb2b8]">
            A GAME FOR COMPANY
          </p>

          <div className="mt-6 flex items-center justify-between border-y border-[#3c5056] py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 text-right">
                <p className="max-w-[105px] truncate text-xs font-black uppercase text-white">
                  {currentUser?.fullName ?? "Admin_01"}
                </p>
                <p className="text-[10px] uppercase text-[#c4d3d8]">Online</p>
              </div>
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center border border-[#41636d] bg-[#143942] text-sm font-black uppercase text-[#84d8e8]">
                {currentUser?.fullName?.trim().charAt(0) || "A"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void openRecentActivityPanel()}
              title="Notifications"
              className="flex h-9 w-9 items-center justify-center text-[#d9e5e7] transition hover:text-[#84d8e8]"
            >
              <Bell size={21} />
            </button>
          </div>
        </div>

        <nav className="mt-6 flex overflow-x-auto text-sm font-bold xl:mt-8 xl:block xl:space-y-2 xl:overflow-visible">
          <MenuItem active={activeView === "dashboard"} icon={<LayoutDashboard size={21} />} label="Dashboard" onClick={() => openAdminView("dashboard")} />
          <MenuItem active={activeView === "tournaments"} icon={<Trophy size={21} />} label="Tournaments" onClick={() => openAdminView("tournaments")} />
          <MenuItem icon={<Gamepad2 size={21} />} label="Matches" onClick={() => showNotice("this feature is not ready")} />
          {isAdmin && (
            <MenuItem active={activeView === "players"} icon={<Users size={18} />} label="Players" onClick={() => openAdminView("players")} />
          )}
          <MenuItem icon={<BarChart3 size={21} />} label="Leaderboard" onClick={() => showNotice("this feature is not ready")} />
        </nav>

        <div className="hidden xl:mt-auto xl:block xl:border-t xl:border-[#3c5056] xl:p-6">
          <button
            onClick={() => setOpenModal("changePassword")}
            className="mb-7 flex items-center gap-4 text-xl text-[#e2edf0]"
          >
            <Settings size={21} />
            Setting
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-4 text-xl text-[#ff8a8a] transition hover:text-[#ffb0b0]"
          >
            <LogOut size={21} />
            Logout
          </button>
        </div>
      </aside>

      <section className="min-h-screen bg-[#06161b] xl:ml-[260px]">
        {activeView === "dashboard" ? (
          <DashboardView isAdmin={isAdmin} refreshKey={dashboardRefreshKey} />
        ) : activeView === "tournaments" ? (
          <TournamentView isAdmin={isAdmin} refreshKey={dashboardRefreshKey} />
        ) : (
        <div className="px-4 py-6 sm:px-6 xl:px-8 xl:py-9">
          <div className="mb-8 grid gap-6 xl:grid-cols-[1fr_auto] xl:items-start">
            <div>
              <h2 className="text-[28px] font-black leading-none text-white sm:text-[34px]">
                Player Management
              </h2>
              <p className="mt-3 text-[16px] text-[#adbdc2]">
                Track, edit, and manage the system member directory.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end xl:gap-4">
              <button
                onClick={() => {
                  setNewUserRole("PLAYER");
                  setOpenPlayerActionId(null);
                  setOpenModal("createUser");
                }}
                className="flex h-[56px] items-center justify-center gap-3 rounded bg-[#84d8e8] px-5 text-base font-black text-[#06161b] sm:h-[62px] sm:px-8 sm:text-lg"
              >
                <UserPlus size={27} />
                Add Player
              </button>
              <button
                onClick={() => {
                  setOpenPlayerActionId(null);
                  setOpenModal("createUserFromList");
                }}
                className="flex h-[56px] items-center justify-center gap-3 rounded bg-[#84d8e8] px-5 text-base font-black text-[#06161b] sm:h-[62px] sm:px-8 sm:text-lg"
              >
                <UserPlus size={27} />
                Add Player From List
              </button>
              <button
                onClick={openDeleteAllPlayersConfirmation}
                disabled={isLoading}
                className="flex h-[56px] items-center justify-center gap-3 rounded border border-[#ff6b6b99] bg-[#35171b] px-5 text-base font-black text-[#ff8a8a] transition hover:border-[#ff6b6b] hover:bg-[#421b20] disabled:opacity-60 sm:h-[62px] sm:px-6 sm:text-lg"
              >
                <Trash2 size={24} />
                Delete All Players
              </button>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 xl:gap-6">
            <StatCard
              title="Total Players"
              value={players.length.toLocaleString()}
              icon={<Users size={22} />}
            />
            <StatCard
              title="Active Now"
              value={activeCount.toLocaleString()}
              icon={<Wifi size={22} />}
              meter
            />
            <StatCard
              title="Tournament Entries"
              value={tournamentEntries.toLocaleString()}
              detail="Tournament Avalible"
              icon={<Trophy size={24} />}
            />
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <StatusFilterSelect
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
            />
            <button
              onClick={() => setIsNameSearchOpen((isOpen) => !isOpen)}
              className={`flex h-[35px] w-[43px] items-center justify-center rounded border border-[#3a4d54] text-[#e3eef0] ${
                isNameSearchOpen ? "bg-[#1b3a43]" : "bg-[#0d252d]"
              }`}
              title="Search by name"
            >
              <SlidersHorizontal size={22} />
            </button>
          </div>

          {isNameSearchOpen && (
            <div className="mb-6 flex h-[52px] w-full max-w-[430px] items-center gap-3 rounded border border-[#3a4d54] bg-[#0d252d] px-4 text-[#e3eef0]">
              <Search size={20} />
              <input
                value={nameSearch}
                onChange={(event) => {
                  setNameSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by name, email, or ID..."
                className="h-full flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-[#789098]"
              />
              {nameSearch && (
                <button
                  onClick={() => {
                    setNameSearch("");
                    setCurrentPage(1);
                  }}
                  className="text-xs font-black uppercase tracking-[0.12em] text-[#84d8e8]"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <div className="mb-4 space-y-3 xl:hidden">
            {paginatedPlayers.map((player) => (
              <article
                key={player.id}
                className="rounded border border-[#3a4d54] bg-[#0d252d] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#35535c] bg-[#123641] text-sm font-black uppercase text-[#84d8e8]">
                    {player.fullName.trim().charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-white">
                      {player.fullName}
                    </p>
                    <p className="mt-1 truncate text-xs text-[#9fb2b8]">
                      {player.email}
                    </p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#d4e3e6]">
                      {player.role === "SUPER_ADMIN"
                        ? "Super Administrator"
                        : player.role === "ADMIN"
                          ? "Administrator"
                          : "Member"}
                    </p>
                  </div>
                  <div className="relative shrink-0">
                    {player.role === "PLAYER" && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenPlayerActionId((currentId) =>
                            currentId === player.id ? null : player.id,
                          )
                        }
                        className="flex h-10 w-10 items-center justify-center rounded border border-[#3a4d54] text-[#dce8eb]"
                        aria-label={`Open actions for ${player.fullName}`}
                        aria-expanded={openPlayerActionId === player.id}
                      >
                        <MoreVertical size={19} />
                      </button>
                    )}
                    {player.role === "PLAYER" &&
                      openPlayerActionId === player.id && (
                        <div className="absolute right-0 top-12 z-20 w-[210px] rounded border border-[#3a4d54] bg-[#0d252d] p-2 shadow-2xl">
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => void promotePlayerToAdmin(player)}
                              disabled={isLoading}
                              className="flex w-full items-center gap-3 rounded px-3 py-3 text-left text-sm font-black text-[#84d8e8] transition hover:bg-[#143942] disabled:opacity-60"
                            >
                              <ShieldPlus size={18} />
                              Add Admin
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPlayer(player);
                              setOpenPlayerActionId(null);
                              setOpenModal("changeStatus");
                            }}
                            className="flex w-full items-center gap-3 rounded px-3 py-3 text-left text-sm font-black text-[#dce8eb] transition hover:bg-[#143942] hover:text-[#84d8e8]"
                          >
                            <SlidersHorizontal size={18} />
                            Change Status
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeletePlayerConfirmation(player)}
                            className="flex w-full items-center gap-3 rounded px-3 py-3 text-left text-sm font-black text-[#ff8a8a] transition hover:bg-[#35171b]"
                          >
                            <Trash2 size={18} />
                            Delete Player
                          </button>
                        </div>
                      )}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded border border-[#243c43] bg-[#07181d] p-3">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#789098]">
                      Member ID
                    </p>
                    <p className="mt-1 truncate font-black text-white">
                      {player.memberCode}
                    </p>
                  </div>
                  <div className="rounded border border-[#243c43] bg-[#07181d] p-3">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#789098]">
                      Status
                    </p>
                    <div className="mt-1">
                      <StatusBadge status={player.status} />
                    </div>
                  </div>
                  <div className="rounded border border-[#243c43] bg-[#07181d] p-3">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#789098]">
                      Events
                    </p>
                    <p className="mt-1 font-black text-white">
                      {player.events.toString().padStart(2, "0")}
                    </p>
                  </div>
                </div>

                {canRenameUser(player, currentUser) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlayer(player);
                      setRenameFullName(player.fullName);
                      setRenameEmail(player.email);
                      setRenameRole(
                        player.role === "ADMIN" ? "ADMIN" : "PLAYER",
                      );
                      setOpenModal("renamePlayer");
                    }}
                    className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded border border-[#3a4d54] text-sm font-black text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8]"
                  >
                    <Pencil size={17} />
                    Edit User
                  </button>
                )}
              </article>
            ))}

            {visiblePlayers.length === 0 && (
              <div className="rounded border border-[#3a4d54] bg-[#0d252d] px-4 py-10 text-center text-[#9fb2b8]">
                No users found.
              </div>
            )}

            {visiblePlayers.length > 0 && (
              <div className="flex flex-col gap-3 rounded border border-[#3a4d54] bg-[#0d252d] px-4 py-4 text-xs uppercase text-white">
                <p>
                  Showing{" "}
                  {(currentSafePage - 1) * PLAYERS_PER_PAGE + 1}-
                  {Math.min(
                    currentSafePage * PLAYERS_PER_PAGE,
                    visiblePlayers.length,
                  )}{" "}
                  of {visiblePlayers.length}
                </p>

                <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
                  <PageButton
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentSafePage === 1}
                  >
                    <ChevronLeft size={15} />
                  </PageButton>
                  {Array.from(
                    { length: totalPages },
                    (_, index) => index + 1,
                  ).map((page) => (
                    <PageButton
                      key={page}
                      active={page === currentSafePage}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </PageButton>
                  ))}
                  <PageButton
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1),
                      )
                    }
                    disabled={currentSafePage === totalPages}
                  >
                    <ChevronRight size={15} />
                  </PageButton>
                </div>
              </div>
            )}
          </div>

          <div className="hidden overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d] shadow-[0_0_0_1px_rgba(255,255,255,0.02)] xl:block">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] table-fixed">
              <thead className="h-[65px] border-b border-[#3a4d54] bg-[#14272e] text-xs uppercase tracking-[0.08em] text-[#d5e0e3]">
                <tr>
                  <th className="w-[48px] px-4 text-left">
                    <span className="block h-4 w-4 border border-[#3d535a]" />
                  </th>
                  <th className="w-[190px] text-left">User</th>
                  <th className="w-[220px] text-left">Email</th>
                  <th className="w-[120px] text-left">Member ID</th>
                  <th className="w-[125px] text-left">Status</th>
                  <th className="w-[90px] text-left">Events</th>
                  <th className="w-[150px] text-left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedPlayers.map((player) => (
                  <tr
                    key={player.id}
                    className="h-[73px] border-b border-[#243c43] text-sm last:border-b-0"
                  >
                    <td className="px-4">
                      <span className="block h-4 w-4 rounded-[2px] border border-[#3d535a]" />
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-[40px] w-[40px] border border-[#35535c] bg-[#123641]" />
                        <div>
                          <p className="text-[15px] font-black text-white">
                            {player.fullName}
                          </p>
                          <p className="text-[10px] font-black uppercase text-[#d4e3e6]">
                            {player.role === "SUPER_ADMIN"
                              ? "Super Administrator"
                              : player.role === "ADMIN"
                                ? "Administrator"
                              : player.rank === "ELITE"
                                ? "Elite Level"
                                : "MEMBER"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-[13px] text-white">
                      {player.email}
                    </td>
                    <td className="text-[13px] text-white">
                      {player.memberCode}
                    </td>
                    <td>
                      <StatusBadge status={player.status} />
                    </td>
                    <td className="text-[17px] text-white">
                      {player.events.toString().padStart(2, "0")}
                    </td>
                    <td>
                      <div className="relative flex items-center gap-5 text-[#dce8eb]">
                        {canRenameUser(player, currentUser) && (
                          <button
                            onClick={() => {
                              setSelectedPlayer(player);
                              setRenameFullName(player.fullName);
                              setRenameEmail(player.email);
                              setRenameRole(
                                player.role === "ADMIN" ? "ADMIN" : "PLAYER",
                              );
                              setOpenModal("renamePlayer");
                            }}
                            title="Edit user name and email"
                            className="transition hover:text-[#84d8e8]"
                          >
                            <Pencil size={18} />
                          </button>
                        )}
                        {player.role === "PLAYER" && (
                          <>
                            <button
                              onClick={() => openDeletePlayerConfirmation(player)}
                              title="Delete player"
                              className="text-[#ff6b6b] transition hover:text-[#ff9b9b]"
                            >
                              <Trash2 size={18} />
                            </button>
                            <button
                              onClick={() =>
                                setOpenPlayerActionId((currentId) =>
                                  currentId === player.id ? null : player.id,
                                )
                              }
                              title="More actions"
                              aria-expanded={openPlayerActionId === player.id}
                              className="transition hover:text-[#84d8e8]"
                            >
                              <MoreVertical size={18} />
                            </button>
                            {openPlayerActionId === player.id && (
                              <div className="absolute right-4 top-8 z-20 w-[190px] rounded border border-[#3a4d54] bg-[#0d252d] p-2 shadow-2xl">
                                {isSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => void promotePlayerToAdmin(player)}
                                    disabled={isLoading}
                                    className="flex w-full items-center gap-3 rounded px-3 py-3 text-left text-sm font-black text-[#84d8e8] transition hover:bg-[#143942] disabled:opacity-60"
                                  >
                                    <ShieldPlus size={18} />
                                    Add Admin
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPlayer(player);
                                    setOpenPlayerActionId(null);
                                    setOpenModal("changeStatus");
                                  }}
                                  className="flex w-full items-center gap-3 rounded px-3 py-3 text-left text-sm font-black text-[#dce8eb] transition hover:bg-[#143942] hover:text-[#84d8e8]"
                                >
                                  <SlidersHorizontal size={18} />
                                  Change Status
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {visiblePlayers.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="h-[120px] text-center text-[#9fb2b8]"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            <div className="flex min-h-[65px] flex-col gap-3 px-4 py-4 text-xs uppercase text-white sm:flex-row sm:items-center sm:justify-between sm:py-0">
              <p>
                Showing{" "}
                {visiblePlayers.length > 0
                  ? (currentSafePage - 1) * PLAYERS_PER_PAGE + 1
                  : 0}
                -
                {Math.min(currentSafePage * PLAYERS_PER_PAGE, visiblePlayers.length)}{" "}
                of {visiblePlayers.length}
              </p>

              <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
                <PageButton
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentSafePage === 1}
                >
                  <ChevronLeft size={15} />
                </PageButton>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                  (page) => (
                    <PageButton
                      key={page}
                      active={page === currentSafePage}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </PageButton>
                  ),
                )}
                <PageButton
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentSafePage === totalPages}
                >
                  <ChevronRight size={15} />
                </PageButton>
              </div>
            </div>
          </div>
        </div>
        )}
      </section>

      {openRecentActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <section className="w-full max-w-[560px] overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d] shadow-2xl">
            <header className="flex items-center justify-between gap-4 border-b border-[#3a4d54] bg-[#14272e] px-5 py-4">
              <div>
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">
                  Recent Activity
                </h2>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[#84d8e8]">
                  Latest system updates
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenRecentActivity(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#3a4d54] text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8]"
                aria-label="Close recent activity"
                title="Close"
              >
                <X size={20} />
              </button>
            </header>

            <div className="max-h-[520px] overflow-y-auto p-5">
              {isLoadingRecentActivity ? (
                <p className="py-12 text-center text-sm font-bold text-[#9fb2b8]">
                  Loading recent activity...
                </p>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <article
                      key={activity.id}
                      className="flex gap-4 rounded border border-[#243c43] bg-[#07181d] px-4 py-4"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#143942] text-[#84d8e8]">
                        <DashboardActivityIcon type={activity.type} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-6 text-[#dce8eb]">
                          {activity.message}
                        </p>
                        <p className="mt-2 text-xs font-black uppercase tracking-[0.08em] text-[#789098]">
                          {formatRelative(activity.createdAt)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="py-12 text-center text-sm font-bold text-[#9fb2b8]">
                  No recent activity in database.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {openModal === "createUser" && (
        <Modal title={newUserRole === "ADMIN" ? "New Admin" : "New Player"}>
          <p className="mb-4 text-sm font-black uppercase tracking-[0.12em] text-[#8ed8ec]">
            Account role: {newUserRole === "ADMIN" ? "Administrator" : "Player"}
          </p>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Name"
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={`name${COMPANY_EMAIL_DOMAIN}`}
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <p className="mb-6 text-sm text-zinc-400">Default Password</p>

          <ModalActions
            cancel={() => {
              setNewUserRole("PLAYER");
              setOpenModal(null);
            }}
            confirm={createPlayer}
            confirmText={isLoading ? "Creating..." : "Create User"}
            disabled={isLoading}
          />
        </Modal>
      )}

      {openModal === "createUserFromList" && (
        <Modal title="Add Player From List">
          <label className="mb-4 flex min-h-[92px] cursor-pointer flex-col items-center justify-center rounded border border-dashed border-[#8ed8ec66] bg-[#070d0d] px-4 text-center text-zinc-300 transition hover:border-[#8ed8ec]">
            <span className="text-sm font-black uppercase tracking-[0.16em] text-[#8ed8ec]">
              Choose Excel File
            </span>
            <span className="mt-2 text-sm text-zinc-500">
              {importFileName || ".xlsx with name/full name/ho ten/email"}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                void handleImportFile(event.target.files?.[0] ?? null);
              }}
            />
          </label>

          <p className="mb-3 text-sm text-zinc-400">
            If email is empty, it will be generated from player name
            {COMPANY_EMAIL_DOMAIN}.
          </p>

          {importPlayers.length > 0 && (
            <div className="mb-6 max-h-[190px] overflow-auto rounded border border-white/10 bg-[#070d0d]">
              <div className="border-b border-white/10 px-4 py-3 text-sm font-black text-[#8ed8ec]">
                Preview: {importPlayers.length} players
              </div>
              {importPlayers.slice(0, 6).map((player) => (
                <div
                  key={player.email}
                  className="border-b border-white/5 px-4 py-3 text-sm last:border-b-0"
                >
                  <p className="font-black text-white">{player.fullName}</p>
                  <p className="text-zinc-400">{player.email}</p>
                </div>
              ))}
            </div>
          )}

          <ModalActions
            cancel={() => {
              setImportFileName("");
              setImportPlayers([]);
              setOpenModal(null);
            }}
            confirm={importPlayersFromList}
            confirmText={isLoading ? "Importing..." : "Import"}
            disabled={isLoading}
          />
        </Modal>
      )}

      {openModal === "changePassword" && (
        <Modal title="Change Password">
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Current password"
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password"
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm new password"
            className="mb-6 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <ModalActions
            cancel={() => setOpenModal(null)}
            confirm={changePassword}
            confirmText="Save Password"
          />
        </Modal>
      )}

      {openModal === "renamePlayer" && (
        <Modal title="Edit User">
          <p className="mb-3 text-sm text-zinc-400">
            {selectedPlayer?.email}
          </p>

          <input
            value={renameFullName}
            onChange={(event) => setRenameFullName(event.target.value)}
            placeholder="New user name"
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <input
            value={renameEmail}
            onChange={(event) => setRenameEmail(event.target.value)}
            placeholder={`name${COMPANY_EMAIL_DOMAIN}`}
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          {isSuperAdmin && selectedPlayer?.role !== "SUPER_ADMIN" && (
            <label className="mb-6 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#8ed8ec]">
                Account role
              </span>
              <AdminSelect
                value={renameRole}
                options={[
                  { value: "PLAYER", label: "Player" },
                  { value: "ADMIN", label: "Administrator" },
                ]}
                onChange={(nextValue) =>
                  setRenameRole(nextValue as "ADMIN" | "PLAYER")
                }
                ariaLabel="Account role"
                className="w-full"
              />
            </label>
          )}

          <ModalActions
            cancel={() => {
              setSelectedPlayer(null);
              setRenameFullName("");
              setRenameEmail("");
              setRenameRole("PLAYER");
              setOpenModal(null);
            }}
            confirm={renamePlayer}
            confirmText={isLoading ? "Saving..." : "Save User"}
            disabled={isLoading}
          />
        </Modal>
      )}

      {openModal === "changeStatus" && (
        <Modal title="Change Player Status">
          <p className="mb-5 text-sm text-zinc-400">
            {selectedPlayer?.fullName} - {selectedPlayer?.email}
          </p>

          <div className="mb-6 grid gap-3">
            {(["ACTIVE", "INACTIVE", "PENDING"] as Player["status"][]).map(
              (status) => (
                <button
                  key={status}
                  onClick={() => void changePlayerStatus(status)}
                  disabled={isLoading}
                  className={`flex h-[50px] items-center justify-between rounded border px-4 text-left font-black uppercase tracking-[0.12em] transition disabled:opacity-60 ${
                    selectedPlayer?.status === status
                      ? "border-[#8ed8ec] bg-[#17343b] text-[#8ed8ec]"
                      : "border-white/10 bg-[#070d0d] text-zinc-200 hover:border-[#8ed8ec66]"
                  }`}
                >
                  <span>{status}</span>
                  {selectedPlayer?.status === status && (
                    <span className="text-xs">CURRENT</span>
                  )}
                </button>
              ),
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                setSelectedPlayer(null);
                setOpenModal(null);
              }}
              disabled={isLoading}
              className="h-[46px] rounded border border-white/10 px-5 text-zinc-300 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {openModal === "deletePlayer" && selectedPlayer && (
        <Modal title="Delete Player" tone="danger">
          <p className="text-base font-bold text-white">
            Do you want to delete this player?
          </p>
          <div className="my-5 rounded border border-[#ff6b6b66] bg-[#35171b] px-4 py-4">
            <p className="font-black text-[#ff8a8a]">
              {selectedPlayer.fullName}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {selectedPlayer.email} · {selectedPlayer.memberCode}
            </p>
          </div>
          <p className="mb-6 text-sm text-zinc-400">
            This action cannot be undone.
          </p>
          <ModalActions
            cancel={() => {
              setOpenModal(null);
              setSelectedPlayer(null);
            }}
            confirm={() => void deletePlayer()}
            confirmText={isLoading ? "Deleting..." : "Delete"}
            disabled={isLoading}
            danger
          />
        </Modal>
      )}

      {openModal === "deleteAllPlayers" && (
        <Modal title="Delete All Players" tone="danger">
          <p className="text-base font-bold text-white">
            Do you want to delete all players?
          </p>
          <p className="my-5 rounded border border-[#ff6b6b66] bg-[#35171b] px-4 py-4 text-sm text-[#ff8a8a]">
            {players.filter((player) => player.role === "PLAYER").length} player
            accounts will be deleted. The admin account will be kept.
          </p>
          <p className="mb-6 text-sm text-zinc-400">
            This action cannot be undone.
          </p>
          <ModalActions
            cancel={() => setOpenModal(null)}
            confirm={() => void deleteAllPlayers()}
            confirmText={isLoading ? "Deleting..." : "Delete All"}
            disabled={isLoading}
            danger
          />
        </Modal>
      )}
    </main>
  );
}

function canRenameUser(
  user: Player,
  currentUser: CurrentUser | null,
) {
  if (!currentUser || currentUser.role === "PLAYER") {
    return false;
  }

  if (user.role === "SUPER_ADMIN") {
    return false;
  }

  if (currentUser.role === "SUPER_ADMIN") {
    return true;
  }

  return user.role === "PLAYER" || Number(user.id) === currentUser.id;
}

function mapUserToPlayer(user: BackendUser): Player {
  return {
    id: String(user.id),
    memberCode: user.memberCode ?? `GC-${String(user.id).padStart(4, "0")}`,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    rank: user.role === "PLAYER" ? "ROOKIE" : "ELITE",
    points: 0,
    status: user.status ?? "ACTIVE",
    events: user.eventsCount ?? 0,
  };
}

function parsePlayersFromRows(
  rows: unknown[][],
  existingPlayers: Player[],
): ImportedPlayer[] {
  const usedEmails = new Set(
    existingPlayers.map((player) => player.email.toLowerCase()),
  );
  const usedNames = new Set(
    existingPlayers.map((player) => normalizePlayerName(player.fullName)),
  );
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const value = normalizeHeader(cell);
      return isEmailHeader(value) || isNameHeader(value);
    }),
  );
  const importedPlayers: ImportedPlayer[] = [];

  if (headerIndex >= 0) {
    const headers = rows[headerIndex].map(normalizeHeader);
    const nameColumn = headers.findIndex(isNameHeader);
    const emailColumn = headers.findIndex(isEmailHeader);

    if (nameColumn < 0) {
      return collectPlayersFromBestNameColumn(rows, usedNames, usedEmails);
    }

    for (const row of rows.slice(headerIndex + 1)) {
      const fullName = readCell(row[nameColumn]);

      if (!looksLikePlayerName(fullName)) {
        continue;
      }

      const normalizedName = normalizePlayerName(fullName);

      if (usedNames.has(normalizedName)) {
        continue;
      }

      const rawEmail = emailColumn >= 0 ? readCell(row[emailColumn]) : "";
      const email = buildImportEmail(fullName, rawEmail, usedEmails);

      if (!email) {
        continue;
      }

      usedNames.add(normalizedName);
      importedPlayers.push({ fullName, email });
    }

    return importedPlayers;
  }

  return collectPlayersFromBestNameColumn(rows, usedNames, usedEmails);
}

function collectPlayersFromBestNameColumn(
  rows: unknown[][],
  usedNames: Set<string>,
  usedEmails: Set<string>,
): ImportedPlayer[] {
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  let bestColumn = 0;
  let bestScore = 0;

  for (let column = 0; column < columnCount; column += 1) {
    const score = rows.reduce((total, row) => {
      const value = readCell(row[column]);
      return total + (looksLikePlayerName(value) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestColumn = column;
      bestScore = score;
    }
  }

  const importedPlayers: ImportedPlayer[] = [];

  for (const row of rows) {
    const fullName = readCell(row[bestColumn]);

    if (!looksLikePlayerName(fullName)) {
      continue;
    }

    const normalizedName = normalizePlayerName(fullName);

    if (usedNames.has(normalizedName)) {
      continue;
    }

    const email = buildImportEmail(fullName, "", usedEmails);

    if (!email) {
      continue;
    }

    usedNames.add(normalizedName);
    importedPlayers.push({ fullName, email });
  }

  return importedPlayers;
}

function isNameHeader(header: string) {
  return [
    "name",
    "full name",
    "fullname",
    "player",
    "player name",
    "member",
    "member name",
    "user",
    "user name",
    "username",
    "ho ten",
    "ho va ten",
    "hoten",
    "ten",
    "ten nguoi choi",
    "nguoi choi",
    "ten nhan vien",
    "nhan vien",
    "ten thanh vien",
    "thanh vien",
  ].includes(header);
}

function isEmailHeader(header: string) {
  return ["email", "mail", "e-mail", "gmail", "company email"].includes(
    header,
  );
}

function looksLikePlayerName(value: string) {
  if (!value || value.length < 2 || value.includes("@")) {
    return false;
  }

  const normalized = normalizeHeader(value);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const punctuationCount = (value.match(/[.!?:;,/\\|()[\]{}]/g) ?? []).length;
  const blockedValues = new Set([
    "name",
    "full name",
    "player",
    "email",
    "mail",
    "stt",
    "no",
    "id",
    "ma",
    "member id",
    "ho ten",
    "ten",
    "nguoi choi",
    "toan bo nhan vien",
    "chon doi",
    "cau thu xinh",
  ]);

  if (blockedValues.has(normalized) || /^\d+$/.test(normalized)) {
    return false;
  }

  if (
    value.length > 48 ||
    wordCount > 6 ||
    punctuationCount > 1 ||
    normalized.includes("khong can biet") ||
    normalized.includes("chon doi") ||
    normalized.includes("du doan") ||
    normalized.includes("minigame") ||
    normalized.includes("world cup") ||
    normalized.includes("cau thu xinh") ||
    normalized.includes("hop ly")
  ) {
    return false;
  }

  return /[a-zA-Z\u00C0-\u1EF9]/.test(value);
}

function buildImportEmail(
  fullName: string,
  rawEmail: string,
  usedEmails: Set<string>,
) {
  const normalizedRawEmail = rawEmail.trim().toLowerCase();
  const generatedLocalPart = slugifyName(fullName) || "player";
  let email = normalizedRawEmail;

  if (email) {
    const [localPart] = email.split("@");
    email = email.endsWith(COMPANY_EMAIL_DOMAIN)
      ? email
      : `${localPart || generatedLocalPart}${COMPANY_EMAIL_DOMAIN}`;

    if (usedEmails.has(email)) {
      return null;
    }

    usedEmails.add(email);
    return email;
  }

  const localPart = generatedLocalPart;
  email = `${localPart}${COMPANY_EMAIL_DOMAIN}`;

  if (usedEmails.has(email)) {
    return null;
  }

  usedEmails.add(email);
  return email;
}

function normalizePlayerName(name: string) {
  return slugifyName(name);
}

function slugifyName(name: string) {
  const withoutVietnameseD = name.replace(/đ/g, "d").replace(/Đ/g, "D");
  const normalized = withoutVietnameseD
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const words = normalized
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words.join(".");
}

function normalizeHeader(value: unknown) {
  return readCell(value)
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function readCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}
