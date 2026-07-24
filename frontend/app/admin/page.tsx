"use client";

import { apiRequest, type CurrentUser } from "../api";
import { logoutAll, readCurrentUser } from "../auth-sync";
import NoticeBanner, { type Notice } from "../notice-banner";
import AdminDashboardContent from "./admin-dashboard-content";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  MoreVertical,
  Pencil,
  Search,
  Settings,
  SlidersHorizontal,
  Trophy,
  Trash2,
  UserPlus,
  Users,
  Wifi,
} from "lucide-react";

type BackendUser = {
  id: number;
  memberCode: string | null;
  fullName: string;
  email: string;
  role: "ADMIN" | "PLAYER";
  status?: "ACTIVE" | "INACTIVE" | "PENDING";
  eventsCount?: number;
  createdAt?: string;
};

type Player = {
  id: string;
  memberCode: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "PLAYER";
  rank: "ELITE" | "PRO" | "ROOKIE";
  points: number;
  status: "ACTIVE" | "INACTIVE" | "PENDING";
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

type AdminView = 'dashboard' | 'players';

const PLAYERS_PER_PAGE = 5;
const COMPANY_EMAIL_DOMAIN = "@twenty-tech.com";

export default function AdminPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeView, setActiveView] = useState<AdminView>("players");
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isNameSearchOpen, setIsNameSearchOpen] = useState(false);
  const [nameSearch, setNameSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [renameFullName, setRenameFullName] = useState("");
  const [renameEmail, setRenameEmail] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importPlayers, setImportPlayers] = useState<ImportedPlayer[]>([]);
  const [openModal, setOpenModal] = useState<
    | "createUser"
    | "createUserFromList"
    | "changePassword"
    | "renamePlayer"
    | "changeStatus"
    | null
  >(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const isAdmin = currentUser?.role === "ADMIN";

  function showNotice(message: string, tone: Notice["tone"] = "info") {
    setNotice({ message, tone });
  }

  function refreshDashboard() {
    setDashboardRefreshKey((key) => key + 1);
  }

  useEffect(() => {
    const currentUser = readCurrentUser() as CurrentUser | null;

    if (!currentUser || currentUser.role !== "ADMIN") {
      router.push("/login");
      return;
    }

    setCurrentUser(currentUser);
    void fetchPlayers();

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
  }, [router]);

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

    if (!keyword) {
      return players;
    }

    return players.filter((player) => {
      const normalizedKeyword = keyword.replace(/^id[-_\s]*/i, "");

      return (
        player.fullName.toLowerCase().includes(keyword) ||
        player.email.toLowerCase().includes(keyword) ||
        player.memberCode.toLowerCase().includes(keyword) ||
        player.memberCode.toLowerCase().includes(normalizedKeyword) ||
        player.id.toLowerCase().includes(normalizedKeyword)
      );
    });
  }, [nameSearch, players]);
  const totalPages = Math.max(1, Math.ceil(visiblePlayers.length / PLAYERS_PER_PAGE));
  const currentSafePage = Math.min(currentPage, totalPages);
  const paginatedPlayers = visiblePlayers.slice(
    (currentSafePage - 1) * PLAYERS_PER_PAGE,
    currentSafePage * PLAYERS_PER_PAGE,
  );

  async function fetchPlayers() {
    try {
      const users = await apiRequest<BackendUser[]>("/users");
      setPlayers(users.map(mapUserToPlayer));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Cannot load users.");
    }
  }

  async function createPlayer() {
    if (!isAdmin) {
      showNotice("Only admin can create players.");
      return;
    }

    if (!fullName.trim() || !email.trim()) {
      showNotice("Please enter name and email.");
      return;
    }

    setIsLoading(true);

    try {
      const data = await apiRequest<CreateUserResponse>("/users/admin/create", {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
        }),
      });

      showNotice(
        `User created successfully. Default password: ${data.user.defaultPassword}`,
      );
      setFullName("");
      setEmail("");
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

    if (currentUser?.role !== "ADMIN") {
      showNotice("Only admin can rename players.");
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
          }),
        },
      );

      showNotice("Player updated successfully.");
      setSelectedPlayer(null);
      setRenameFullName("");
      setRenameEmail("");
      setOpenModal(null);
      await fetchPlayers();
      refreshDashboard();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Update player failed.");
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

  async function deletePlayer(player: Player) {
    if (currentUser?.role !== "ADMIN") {
      showNotice("Only admin can delete players.");
      return;
    }

    if (player.role === "ADMIN") {
      showNotice("Cannot delete the admin account.");
      return;
    }

    const confirmed = window.confirm(
      `Delete player "${player.fullName}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest<{ message: string }>(`/users/admin/${player.id}`, {
        method: "DELETE",
      });

      showNotice("Player deleted successfully.");
      await fetchPlayers();
      refreshDashboard();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Delete player failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteAllPlayers() {
    if (currentUser?.role !== "ADMIN") {
      showNotice("Only admin can delete players.");
      return;
    }

    const playerCount = players.filter((player) => player.role === "PLAYER").length;

    if (playerCount === 0) {
      showNotice("There are no players to delete.");
      return;
    }

    const confirmed = window.confirm(
      `Delete all ${playerCount} players? The admin account will be kept.`,
    );

    if (!confirmed) {
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

    if (currentUser?.role !== "ADMIN") {
      showNotice("Only admin can change player status.");
      return;
    }

    if (selectedPlayer.role === "ADMIN") {
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

  return (
    <main className="min-h-screen bg-[#06161b] text-[#d9e5e7]">
      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />
      <aside className="fixed left-0 top-0 flex h-screen w-[260px] flex-col border-r border-[#3c5056] bg-[#0d252d]">
        <div className="px-6 pt-8">
          <h1 className="text-sm font-black uppercase leading-3 tracking-[0.08em] text-white">
            TWENTY
            <br />
            TECH
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#9fb2b8]">
            A GAME FOR COMPANY
          </p>
        </div>

        <nav className="mt-14 space-y-2 text-sm font-bold">
          <MenuItem active={activeView === "dashboard"} icon={<LayoutDashboard size={21} />} label="Dashboard" onClick={() => setActiveView("dashboard")} />
          <MenuItem icon={<Trophy size={21} />} label="Tournaments" onClick={() => showNotice("this feature is not ready")} />
          <MenuItem icon={<Gamepad2 size={21} />} label="Matches" onClick={() => showNotice("this feature is not ready")} />
          <MenuItem active={activeView === "players"} icon={<Users size={18} />} label="Players" onClick={() => setActiveView("players")} />
          <MenuItem icon={<BarChart3 size={21} />} label="Leaderboard" onClick={() => showNotice("this feature is not ready")} />
        </nav>

        <div className="mt-auto border-t border-[#3c5056] p-6">
          <button className="mb-8 h-[53px] w-full rounded bg-[#84d8e8] text-sm font-black text-[#06161b]">
            Export Report
          </button>

          <button
            onClick={() => setOpenModal("changePassword")}
            className="mb-7 flex items-center gap-4 text-xl text-[#e2edf0]"
          >
            <Settings size={21} />
            Setting
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-4 text-xl text-[#ffab9e]"
          >
            <LogOut size={21} />
            Logout
          </button>
        </div>
      </aside>

      <section className="ml-[260px] min-h-screen bg-[#06161b]">
        <header className="flex h-[88px] items-center border-b border-[#3c5056] px-8">
          <div className="w-[190px] text-[25px] font-black uppercase leading-8 text-white">
            {activeView === "dashboard" ? "DASHBOARD" : "PLAYERS"}
          </div>

          <div className="ml-auto flex items-center gap-7">
            <Bell size={22} />
            <div className="hidden h-10 w-px bg-[#3c5056] md:block" />
            <div className="flex items-center gap-3 border-l border-[#3c5056] pl-6">
              <div className="text-right">
                <p className="text-xs font-black uppercase text-white">
                  {currentUser?.fullName ?? "Admin_01"}
                </p>
                <p className="text-[10px] uppercase text-[#c4d3d8]">Online</p>
              </div>
              <div className="h-[42px] w-[42px] border border-[#41636d] bg-[#143942]" />
            </div>
          </div>
        </header>

        {activeView === "dashboard" ? (
          <AdminDashboardContent isAdmin={isAdmin} refreshKey={dashboardRefreshKey} />
        ) : (
        <div className="px-8 py-9">
          <div className="mb-8 flex items-start justify-between gap-6">
            <div>
              <h2 className="text-[34px] font-black leading-none text-white">
                Player Management
              </h2>
              <p className="mt-3 text-[16px] text-[#adbdc2]">
                Track, edit, and manage the system member directory.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-4">
              <button
                onClick={() => setOpenModal("createUser")}
                className="flex h-[62px] items-center gap-3 rounded bg-[#84d8e8] px-8 text-lg font-black text-[#06161b]"
              >
                <UserPlus size={27} />
                Add Player
              </button>
              <button
                onClick={() => setOpenModal("createUserFromList")}
                className="flex h-[62px] items-center gap-3 rounded bg-[#84d8e8] px-8 text-lg font-black text-[#06161b]"
              >
                <UserPlus size={27} />
                Add Player From List
              </button>
              <button
                onClick={() => void deleteAllPlayers()}
                disabled={isLoading}
                className="flex h-[62px] items-center gap-3 rounded border border-[#ffab9e66] bg-[#2b1414] px-6 text-lg font-black text-[#ffab9e] transition hover:border-[#ffab9e] disabled:opacity-60"
              >
                <Trash2 size={24} />
                Delete All Players
              </button>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-3 gap-6">
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

          <div className="mb-6 flex items-center gap-3">
            <FilterButton label="Status: All" />
            <FilterButton label="Tournament: All" />
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
            <div className="mb-6 flex h-[52px] max-w-[430px] items-center gap-3 rounded border border-[#3a4d54] bg-[#0d252d] px-4 text-[#e3eef0]">
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

          <div className="overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <table className="w-full table-fixed">
              <thead className="h-[65px] border-b border-[#3a4d54] bg-[#14272e] text-xs uppercase tracking-[0.08em] text-[#d5e0e3]">
                <tr>
                  <th className="w-[48px] px-4 text-left">
                    <span className="block h-4 w-4 border border-[#3d535a]" />
                  </th>
                  <th className="w-[190px] text-left">Player</th>
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
                            {player.role === "ADMIN"
                              ? "Administrator"
                              : player.rank === "ELITE"
                                ? "Elite Level"
                                : "Pro Member"}
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
                      <div className="flex items-center gap-5 text-[#dce8eb]">
                        <button
                          onClick={() => {
                            if (!isAdmin) {
                              showNotice("Only admin can rename players.");
                              return;
                            }

                            if (player.role === "ADMIN") {
                              showNotice("Cannot rename the admin account.");
                              return;
                            }

                            setSelectedPlayer(player);
                            setRenameFullName(player.fullName);
                            setRenameEmail(player.email);
                            setOpenModal("renamePlayer");
                          }}
                          title="Rename player"
                          className="transition hover:text-[#84d8e8]"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => void deletePlayer(player)}
                          title="Delete player"
                          className="transition hover:text-[#ffab9e]"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button
                          onClick={() => {
                            if (!isAdmin) {
                              showNotice("Only admin can change player status.");
                              return;
                            }

                            if (player.role === "ADMIN") {
                              showNotice("Cannot change the admin account status.");
                              return;
                            }

                            setSelectedPlayer(player);
                            setOpenModal("changeStatus");
                          }}
                          title="Change status"
                          className="transition hover:text-[#84d8e8]"
                        >
                          <MoreVertical size={18} />
                        </button>
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

            <div className="flex h-[65px] items-center justify-between px-4 text-xs uppercase text-white">
              <p>
                Showing{" "}
                {visiblePlayers.length > 0
                  ? (currentSafePage - 1) * PLAYERS_PER_PAGE + 1
                  : 0}
                -
                {Math.min(currentSafePage * PLAYERS_PER_PAGE, visiblePlayers.length)}{" "}
                of {visiblePlayers.length}
              </p>

              <div className="flex items-center gap-2">
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

      {openModal === "createUser" && (
        <Modal title="New Player">
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Name"
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@twenty-tech.com"
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <p className="mb-6 text-sm text-zinc-400">Default Password</p>

          <ModalActions
            cancel={() => setOpenModal(null)}
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
        <Modal title="Rename Player">
          <p className="mb-3 text-sm text-zinc-400">
            {selectedPlayer?.email}
          </p>

          <input
            value={renameFullName}
            onChange={(event) => setRenameFullName(event.target.value)}
            placeholder="New player name"
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <input
            value={renameEmail}
            onChange={(event) => setRenameEmail(event.target.value)}
            placeholder="name@twenty-tech.com"
            className="mb-6 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <ModalActions
            cancel={() => {
              setSelectedPlayer(null);
              setRenameFullName("");
              setRenameEmail("");
              setOpenModal(null);
            }}
            confirm={renamePlayer}
            confirmText={isLoading ? "Saving..." : "Save Player"}
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
    </main>
  );
}

function mapUserToPlayer(user: BackendUser): Player {
  return {
    id: String(user.id),
    memberCode: user.memberCode ?? `GC-${String(user.id).padStart(4, "0")}`,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    rank: user.role === "ADMIN" ? "ELITE" : "ROOKIE",
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

function MenuItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[49px] w-full items-center gap-4 px-6 text-left tracking-[0.03em] ${
        active
          ? "border-l-4 border-[#e9feff] bg-[#263b43] text-white"
          : "text-[#d7e4e8]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
function StatCard({
  title,
  value,
  detail,
  icon,
  meter,
}: {
  title: string;
  value: string;
  detail?: string;
  icon: React.ReactNode;
  meter?: boolean;
}) {
  return (
    <div className="h-[144px] rounded border border-[#3a4d54] bg-[#0d252d] px-6 py-6 shadow-[0_2px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.1em] text-[#c8d6db]">
            {title}
          </h3>
          <p className="mt-2 text-[36px] font-black leading-none text-white">
            {value}
          </p>
        </div>
        <div className="flex h-[54px] w-[49px] items-center justify-center rounded bg-[#213740] text-white">
          {icon}
        </div>
      </div>

      {meter ? (
        <div className="mt-6 h-[4px] w-[118px] rounded bg-[#203940]">
          <div className="h-full w-[62px] rounded bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
        </div>
      ) : (
        <p className="mt-4 text-xs font-bold text-white">{detail}</p>
      )}
    </div>
  );
}

function FilterButton({ label }: { label: string }) {
  return (
    <button className="flex h-[35px] w-[244px] items-center justify-between rounded border border-[#3a4d54] bg-[#0d252d] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#dce8eb]">
      {label}
      <ChevronDown size={16} />
    </button>
  );
}

function StatusBadge({ status }: { status: Player["status"] }) {
  const className =
    status === "ACTIVE"
      ? "border-l-2 border-white bg-[#162b32] text-white"
      : status === "INACTIVE"
        ? "bg-[#334149] text-[#cbd7db]"
        : "border-l-2 border-white bg-[#1c3037] text-[#dce8eb]";

  return (
    <span
      className={`inline-flex h-[27px] items-center px-3 text-xs font-black uppercase ${className}`}
    >
      {status}
    </span>
  );
}

function PageButton({
  children,
  active,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-[32px] min-w-[32px] items-center justify-center border border-[#3a4d54] text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-[#a2ecf5] text-[#06161b]" : "bg-[#0d252d] text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[520px] rounded-lg border border-[#8ed8ec55] bg-[#101818] p-7 shadow-[0_0_50px_rgba(142,216,236,0.18)]">
        <h2 className="mb-6 text-2xl font-black text-[#8ed8ec]">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  cancel,
  confirm,
  confirmText,
  disabled,
}: {
  cancel: () => void;
  confirm: () => void;
  confirmText: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3">
      <button
        onClick={cancel}
        className="h-[46px] rounded border border-white/10 px-5 text-zinc-300"
      >
        Cancel
      </button>

      <button
        onClick={confirm}
        disabled={disabled}
        className="h-[46px] rounded bg-[#8ed8ec] px-5 font-black text-[#102026] disabled:opacity-60"
      >
        {confirmText}
      </button>
    </div>
  );
}





