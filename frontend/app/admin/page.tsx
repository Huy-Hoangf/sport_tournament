"use client";

import { apiRequest, type CurrentUser } from "../api";
import { logoutAll, readCurrentUser } from "../auth-sync";
import NoticeBanner, { type Notice } from "../notice-banner";
import DashboardView from "./dashboard/dashboard-view";
import { AdminShell } from "./layout/admin-shell";
import { RecentActivityDrawer } from "./layout/recent-activity-drawer";
import MatchesView, { type MatchesInitialFilter } from "./matches/matches-view";
import { PlayerModals, type PlayerModalType } from "./players/player-modals";
import { PlayersView } from "./players/players-view";
import TournamentView from "./tournaments/tournament-management-view";
import type { ActivityRow } from "./tournaments/types";
import { PLAYERS_PER_PAGE } from "./lib/constants";
import { canRenameUser } from "./lib/permissions";
import { mapUserToPlayer, parsePlayersFromRows } from "./lib/player-utils";
import type {
  AdminView,
  BackendUser,
  CreateUserResponse,
  ImportedPlayer,
  Player,
} from "./types/player";
import { type StatusFilter } from "./admin-player-components";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

type RecentActivityResponse = {
  recentActivity?: ActivityRow[];
};

export default function AdminPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeView, setActiveView] = useState<AdminView>("dashboard");
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [matchesInitialFilter, setMatchesInitialFilter] =
    useState<MatchesInitialFilter>({});
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
  const [openModal, setOpenModal] = useState<PlayerModalType>(null);
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
      setActiveView("dashboard");

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
    if (!isSuperAdmin) {
      showNotice("Only super admin can delete all players.");
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
    if (!isSuperAdmin) {
      showNotice("Only super admin can delete all players.");
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
    if (view === "matches") {
      setMatchesInitialFilter({});
    }
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
      <AdminShell
        activeView={activeView}
        currentUser={currentUser}
        isAdmin={isAdmin}
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        onLogout={logout}
        onOpenChangePassword={() => {
          setOpenModal("changePassword");
          setIsMobileMenuOpen(false);
        }}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onOpenRecentActivity={() => void openRecentActivityPanel()}
        onOpenView={openAdminView}
        onUnavailableLeaderboard={() => showNotice("this feature is not ready")}
      >
        {activeView === "dashboard" ? (
          <DashboardView
            isAdmin={isAdmin}
            refreshKey={dashboardRefreshKey}
            onOpenTournamentManagement={() => setActiveView("tournaments")}
            onOpenMatches={(filters) => {
              setMatchesInitialFilter(filters);
              setActiveView("matches");
            }}
          />
        ) : activeView === "tournaments" ? (
          <TournamentView
            isAdmin={isAdmin}
            refreshKey={dashboardRefreshKey}
            onOpenMatches={(filters) => {
              setMatchesInitialFilter(filters);
              setActiveView("matches");
            }}
          />
        ) : activeView === "matches" ? (
          <MatchesView
            initialFilter={matchesInitialFilter}
            canManage={isAdmin}
            onUnavailableFeature={() => showNotice("this feature is not ready")}
          />
        ) : (
          <PlayersView
            activeCount={activeCount}
            currentPage={currentPage}
            currentSafePage={currentSafePage}
            currentUser={currentUser}
            isLoading={isLoading}
            isNameSearchOpen={isNameSearchOpen}
            isSuperAdmin={isSuperAdmin}
            nameSearch={nameSearch}
            openDeleteAllPlayersConfirmation={openDeleteAllPlayersConfirmation}
            openDeletePlayerConfirmation={openDeletePlayerConfirmation}
            openPlayerActionId={openPlayerActionId}
            paginatedPlayers={paginatedPlayers}
            players={players}
            promotePlayerToAdmin={promotePlayerToAdmin}
            setCurrentPage={setCurrentPage}
            setIsNameSearchOpen={setIsNameSearchOpen}
            setNameSearch={setNameSearch}
            setNewUserRole={setNewUserRole}
            setOpenModal={setOpenModal}
            setOpenPlayerActionId={setOpenPlayerActionId}
            setRenameEmail={setRenameEmail}
            setRenameFullName={setRenameFullName}
            setRenameRole={setRenameRole}
            setSelectedPlayer={setSelectedPlayer}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
            totalPages={totalPages}
            tournamentEntries={tournamentEntries}
            visiblePlayers={visiblePlayers}
          />
        )}
      </AdminShell>

      {openRecentActivity && (
        <RecentActivityDrawer
          activities={recentActivity}
          isLoading={isLoadingRecentActivity}
          onClose={() => setOpenRecentActivity(false)}
        />
      )}

      <PlayerModals
        openModal={openModal}
        setOpenModal={setOpenModal}
        fullName={fullName}
        setFullName={setFullName}
        email={email}
        setEmail={setEmail}
        newUserRole={newUserRole}
        setNewUserRole={setNewUserRole}
        isLoading={isLoading}
        isSuperAdmin={isSuperAdmin}
        players={players}
        selectedPlayer={selectedPlayer}
        setSelectedPlayer={setSelectedPlayer}
        renameFullName={renameFullName}
        setRenameFullName={setRenameFullName}
        renameEmail={renameEmail}
        setRenameEmail={setRenameEmail}
        renameRole={renameRole}
        setRenameRole={setRenameRole}
        importFileName={importFileName}
        setImportFileName={setImportFileName}
        importPlayers={importPlayers}
        setImportPlayers={setImportPlayers}
        currentPassword={currentPassword}
        setCurrentPassword={setCurrentPassword}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        createPlayer={createPlayer}
        handleImportFile={handleImportFile}
        importPlayersFromList={importPlayersFromList}
        changePassword={changePassword}
        renamePlayer={renamePlayer}
        changePlayerStatus={changePlayerStatus}
        deletePlayer={deletePlayer}
        deleteAllPlayers={deleteAllPlayers}
      />
    </main>
  );
}
