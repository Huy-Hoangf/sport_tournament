import type React from "react";
import type { CurrentUser } from "../../api";
import {
  PageButton,
  StatCard,
  StatusBadge,
  StatusFilterSelect,
  type StatusFilter,
} from "../admin-player-components";
import { PLAYERS_PER_PAGE } from "../lib/constants";
import { canRenameUser } from "../lib/permissions";
import type { Player } from "../types/player";
import type { PlayerModalType } from "./player-modals";
import {
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Search,
  ShieldPlus,
  SlidersHorizontal,
  Trophy,
  Trash2,
  UserPlus,
  Users,
  Wifi,
} from "lucide-react";

export function PlayersView({
  activeCount,
  currentPage,
  currentSafePage,
  currentUser,
  isLoading,
  isNameSearchOpen,
  isSuperAdmin,
  nameSearch,
  openDeleteAllPlayersConfirmation,
  openDeletePlayerConfirmation,
  openPlayerActionId,
  paginatedPlayers,
  players,
  promotePlayerToAdmin,
  setCurrentPage,
  setIsNameSearchOpen,
  setNameSearch,
  setNewUserRole,
  setOpenModal,
  setOpenPlayerActionId,
  setRenameEmail,
  setRenameFullName,
  setRenameRole,
  setSelectedPlayer,
  setStatusFilter,
  statusFilter,
  totalPages,
  tournamentEntries,
  visiblePlayers,
}: {
  activeCount: number;
  currentPage: number;
  currentSafePage: number;
  currentUser: CurrentUser | null;
  isLoading: boolean;
  isNameSearchOpen: boolean;
  isSuperAdmin: boolean;
  nameSearch: string;
  openDeleteAllPlayersConfirmation: () => void;
  openDeletePlayerConfirmation: (player: Player) => void;
  openPlayerActionId: string | null;
  paginatedPlayers: Player[];
  players: Player[];
  promotePlayerToAdmin: (player: Player) => void | Promise<void>;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setIsNameSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setNameSearch: (value: string) => void;
  setNewUserRole: (role: "ADMIN" | "PLAYER") => void;
  setOpenModal: (modal: PlayerModalType) => void;
  setOpenPlayerActionId: React.Dispatch<React.SetStateAction<string | null>>;
  setRenameEmail: (value: string) => void;
  setRenameFullName: (value: string) => void;
  setRenameRole: (role: "ADMIN" | "PLAYER") => void;
  setSelectedPlayer: (player: Player | null) => void;
  setStatusFilter: (value: StatusFilter) => void;
  statusFilter: StatusFilter;
  totalPages: number;
  tournamentEntries: number;
  visiblePlayers: Player[];
}) {
  return (
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
          {isSuperAdmin && (
            <button
              onClick={openDeleteAllPlayersConfirmation}
              disabled={isLoading}
              className="flex h-[56px] items-center justify-center gap-3 rounded border border-[#ff6b6b99] bg-[#35171b] px-5 text-base font-black text-[#ff8a8a] transition hover:border-[#ff6b6b] hover:bg-[#421b20] disabled:opacity-60 sm:h-[62px] sm:px-6 sm:text-lg"
            >
              <Trash2 size={24} />
              Delete All Players
            </button>
          )}
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
          <PlayerCard
            key={player.id}
            currentUser={currentUser}
            isLoading={isLoading}
            isSuperAdmin={isSuperAdmin}
            openDeletePlayerConfirmation={openDeletePlayerConfirmation}
            openPlayerActionId={openPlayerActionId}
            player={player}
            promotePlayerToAdmin={promotePlayerToAdmin}
            setOpenModal={setOpenModal}
            setOpenPlayerActionId={setOpenPlayerActionId}
            setRenameEmail={setRenameEmail}
            setRenameFullName={setRenameFullName}
            setRenameRole={setRenameRole}
            setSelectedPlayer={setSelectedPlayer}
          />
        ))}

        {visiblePlayers.length === 0 && (
          <div className="rounded border border-[#3a4d54] bg-[#0d252d] px-4 py-10 text-center text-[#9fb2b8]">
            No users found.
          </div>
        )}

        {visiblePlayers.length > 0 && (
          <PlayersPagination
            currentSafePage={currentSafePage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            visiblePlayers={visiblePlayers}
          />
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
                <PlayerTableRow
                  key={player.id}
                  currentUser={currentUser}
                  isLoading={isLoading}
                  isSuperAdmin={isSuperAdmin}
                  openDeletePlayerConfirmation={openDeletePlayerConfirmation}
                  openPlayerActionId={openPlayerActionId}
                  player={player}
                  promotePlayerToAdmin={promotePlayerToAdmin}
                  setOpenModal={setOpenModal}
                  setOpenPlayerActionId={setOpenPlayerActionId}
                  setRenameEmail={setRenameEmail}
                  setRenameFullName={setRenameFullName}
                  setRenameRole={setRenameRole}
                  setSelectedPlayer={setSelectedPlayer}
                />
              ))}

              {visiblePlayers.length === 0 && (
                <tr>
                  <td colSpan={7} className="h-[120px] text-center text-[#9fb2b8]">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PlayersPagination
          currentPage={currentPage}
          currentSafePage={currentSafePage}
          desktop
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
          visiblePlayers={visiblePlayers}
        />
      </div>
    </div>
  );
}

function PlayerCard(props: PlayerActionProps & { player: Player }) {
  const { currentUser, player, setOpenModal, setRenameEmail, setRenameFullName, setRenameRole, setSelectedPlayer } = props;

  return (
    <article className="rounded border border-[#3a4d54] bg-[#0d252d] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#35535c] bg-[#123641] text-sm font-black uppercase text-[#84d8e8]">
          {player.fullName.trim().charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-white">{player.fullName}</p>
          <p className="mt-1 truncate text-xs text-[#9fb2b8]">{player.email}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#d4e3e6]">
            {player.role === "SUPER_ADMIN"
              ? "Super Administrator"
              : player.role === "ADMIN"
                ? "Administrator"
                : "Member"}
          </p>
        </div>
        <PlayerActionMenu {...props} triggerSize={19} />
      </div>

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
        <InfoTile label="Member ID" value={player.memberCode} />
        <div className="rounded border border-[#243c43] bg-[#07181d] p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#789098]">
            Status
          </p>
          <div className="mt-1">
            <StatusBadge status={player.status} />
          </div>
        </div>
        <InfoTile label="Events" value={player.events.toString().padStart(2, "0")} />
      </div>

      {canRenameUser(player, currentUser) && (
        <button
          type="button"
          onClick={() => {
            setSelectedPlayer(player);
            setRenameFullName(player.fullName);
            setRenameEmail(player.email);
            setRenameRole(player.role === "ADMIN" ? "ADMIN" : "PLAYER");
            setOpenModal("renamePlayer");
          }}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded border border-[#3a4d54] text-sm font-black text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8]"
        >
          <Pencil size={17} />
          Edit User
        </button>
      )}
    </article>
  );
}

function PlayerTableRow(props: PlayerActionProps & { player: Player }) {
  const { currentUser, player, setOpenModal, setRenameEmail, setRenameFullName, setRenameRole, setSelectedPlayer } = props;

  return (
    <tr className="h-[73px] border-b border-[#243c43] text-sm last:border-b-0">
      <td className="px-4">
        <span className="block h-4 w-4 rounded-[2px] border border-[#3d535a]" />
      </td>
      <td>
        <div className="flex items-center gap-3">
          <div className="h-[40px] w-[40px] border border-[#35535c] bg-[#123641]" />
          <div>
            <p className="text-[15px] font-black text-white">{player.fullName}</p>
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
      <td className="text-[13px] text-white">{player.email}</td>
      <td className="text-[13px] text-white">{player.memberCode}</td>
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
                setRenameRole(player.role === "ADMIN" ? "ADMIN" : "PLAYER");
                setOpenModal("renamePlayer");
              }}
              title="Edit user name and email"
              className="transition hover:text-[#84d8e8]"
            >
              <Pencil size={18} />
            </button>
          )}
          <PlayerActionMenu {...props} triggerSize={18} table />
        </div>
      </td>
    </tr>
  );
}

function PlayerActionMenu({
  isLoading,
  isSuperAdmin,
  openDeletePlayerConfirmation,
  openPlayerActionId,
  player,
  promotePlayerToAdmin,
  setOpenModal,
  setOpenPlayerActionId,
  setSelectedPlayer,
  table = false,
  triggerSize,
}: PlayerActionProps & { table?: boolean; triggerSize: number }) {
  if (player.role !== "PLAYER") {
    return null;
  }

  return (
    <div className="relative shrink-0">
      {table && (
        <button
          onClick={() => openDeletePlayerConfirmation(player)}
          title="Delete player"
          className="mr-5 text-[#ff6b6b] transition hover:text-[#ff9b9b]"
        >
          <Trash2 size={18} />
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          setOpenPlayerActionId((currentId) =>
            currentId === player.id ? null : player.id,
          )
        }
        className={
          table
            ? "transition hover:text-[#84d8e8]"
            : "flex h-10 w-10 items-center justify-center rounded border border-[#3a4d54] text-[#dce8eb]"
        }
        aria-label={`Open actions for ${player.fullName}`}
        aria-expanded={openPlayerActionId === player.id}
        title="More actions"
      >
        <MoreVertical size={triggerSize} />
      </button>
      {openPlayerActionId === player.id && (
        <div
          className={
            table
              ? "absolute right-4 top-8 z-20 w-[190px] rounded border border-[#3a4d54] bg-[#0d252d] p-2 shadow-2xl"
              : "absolute right-0 top-12 z-20 w-[210px] rounded border border-[#3a4d54] bg-[#0d252d] p-2 shadow-2xl"
          }
        >
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
          {!table && (
            <button
              type="button"
              onClick={() => openDeletePlayerConfirmation(player)}
              className="flex w-full items-center gap-3 rounded px-3 py-3 text-left text-sm font-black text-[#ff8a8a] transition hover:bg-[#35171b]"
            >
              <Trash2 size={18} />
              Delete Player
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#243c43] bg-[#07181d] p-3">
      <p className="text-[10px] uppercase tracking-[0.08em] text-[#789098]">
        {label}
      </p>
      <p className="mt-1 truncate font-black text-white">{value}</p>
    </div>
  );
}

function PlayersPagination({
  currentSafePage,
  desktop = false,
  setCurrentPage,
  totalPages,
  visiblePlayers,
}: {
  currentPage?: number;
  currentSafePage: number;
  desktop?: boolean;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  visiblePlayers: Player[];
}) {
  if (visiblePlayers.length === 0 && !desktop) {
    return null;
  }

  return (
    <div
      className={
        desktop
          ? "flex min-h-[65px] flex-col gap-3 px-4 py-4 text-xs uppercase text-white sm:flex-row sm:items-center sm:justify-between sm:py-0"
          : "flex flex-col gap-3 rounded border border-[#3a4d54] bg-[#0d252d] px-4 py-4 text-xs uppercase text-white"
      }
    >
      <p>
        Showing{" "}
        {visiblePlayers.length > 0
          ? (currentSafePage - 1) * PLAYERS_PER_PAGE + 1
          : 0}
        -{Math.min(currentSafePage * PLAYERS_PER_PAGE, visiblePlayers.length)} of{" "}
        {visiblePlayers.length}
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
  );
}

type PlayerActionProps = {
  currentUser: CurrentUser | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  openDeletePlayerConfirmation: (player: Player) => void;
  openPlayerActionId: string | null;
  player: Player;
  promotePlayerToAdmin: (player: Player) => void | Promise<void>;
  setOpenModal: (modal: PlayerModalType) => void;
  setOpenPlayerActionId: React.Dispatch<React.SetStateAction<string | null>>;
  setRenameEmail: (value: string) => void;
  setRenameFullName: (value: string) => void;
  setRenameRole: (role: "ADMIN" | "PLAYER") => void;
  setSelectedPlayer: (player: Player | null) => void;
};
