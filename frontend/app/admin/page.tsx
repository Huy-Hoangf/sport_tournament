"use client";

import { apiRequest, type CurrentUser } from "../api";
import { logoutAll, readCurrentUser } from "../auth-sync";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  MoreVertical,
  Pencil,
  Search,
  Settings,
  SlidersHorizontal,
  Trophy,
  UserPlus,
  UserRound,
  Users,
  Wifi,
} from "lucide-react";

type BackendUser = {
  id: number;
  fullName: string;
  email: string;
  role: "ADMIN" | "PLAYER";
  eventsCount?: number;
  createdAt?: string;
};

type Player = {
  id: string;
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

export default function AdminPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUser] = useState<CurrentUser | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return readCurrentUser() as CurrentUser | null;
  });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isNameSearchOpen, setIsNameSearchOpen] = useState(false);
  const [nameSearch, setNameSearch] = useState("");
  const [openModal, setOpenModal] = useState<
    "createUser" | "createUserFromList" | "changePassword" | null
  >(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const currentUser = readCurrentUser() as CurrentUser | null;

    if (!currentUser || currentUser.role !== "ADMIN") {
      router.push("/login");
      return;
    }

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

    return players.filter((player) =>
      player.fullName.toLowerCase().includes(keyword),
    );
  }, [nameSearch, players]);

  async function fetchPlayers() {
    try {
      const users = await apiRequest<BackendUser[]>("/users");
      setPlayers(users.map(mapUserToPlayer));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Cannot load users.");
    }
  }

  async function createPlayer() {
    if (!fullName.trim() || !email.trim()) {
      alert("Please enter name and email.");
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

      alert(
        `User created successfully. Default password: ${data.user.defaultPassword}`,
      );
      setFullName("");
      setEmail("");
      setOpenModal(null);
      await fetchPlayers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Create user failed.");
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
      alert("Please fill all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Confirm password does not match.");
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

      alert("Password changed successfully.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOpenModal(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Change password failed.");
    }
  }

  function logout() {
    logoutAll();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-[#06161b] text-[#d9e5e7]">
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
          <MenuItem icon={<LayoutDashboard size={21} />} label="Dashboard" />
          <MenuItem icon={<Trophy size={21} />} label="Tournaments" />
          <MenuItem icon={<Gamepad2 size={21} />} label="Matches" />
          <MenuItem active icon={<Users size={18} />} label="Players" />
          <MenuItem icon={<BarChart3 size={21} />} label="Leaderboard" />
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
            DASHBOARD
          </div>

          <div className="mx-auto flex h-[34px] w-[320px] items-center gap-2 rounded border border-[#3a4d54] bg-[#0d252d] px-3 text-[#c4d3d8]">
            <Search size={20} />
            <span className="text-xs font-black uppercase tracking-[0.14em]">
              Search system...
            </span>
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

            <div className="flex gap-5">
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
                onChange={(event) => setNameSearch(event.target.value)}
                placeholder="Search by player name..."
                className="h-full flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-[#789098]"
              />
              {nameSearch && (
                <button
                  onClick={() => setNameSearch("")}
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
                {visiblePlayers.map((player, index) => (
                  <tr
                    key={player.id}
                    className="h-[73px] border-b border-[#243c43] text-sm last:border-b-0"
                  >
                    <td className="px-4">
                      <span
                        className={`block h-4 w-4 rounded-[2px] border ${
                          index === 2 || index === 3
                            ? "border-[#e5feff] bg-[#e5feff]"
                            : "border-[#3d535a]"
                        }`}
                      />
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
                      ID-{player.id.padStart(4, "0")}-GC
                    </td>
                    <td>
                      <StatusBadge status={player.status} />
                    </td>
                    <td className="text-[17px] text-white">
                      {player.events.toString().padStart(2, "0")}
                    </td>
                    <td>
                      <div className="flex items-center gap-5 text-[#dce8eb]">
                        <UserRound size={18} />
                        <Pencil size={18} />
                        <CirclePlus size={18} />
                        <MoreVertical size={18} />
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
                Showing {visiblePlayers.length > 0 ? 1 : 0}-
                {visiblePlayers.length} of {players.length}
              </p>

              <div className="flex items-center gap-2">
                <PageButton>
                  <ChevronLeft size={15} />
                </PageButton>
                <PageButton active>1</PageButton>
                <PageButton>2</PageButton>
                <PageButton>3</PageButton>
                <span className="px-2 text-[#b9c9ce]">...</span>
                <PageButton>245</PageButton>
                <PageButton>
                  <ChevronRight size={15} />
                </PageButton>
              </div>
            </div>
          </div>
        </div>
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
          <p className="mb-6 text-base text-zinc-400">Import From Excel</p>

          <ModalActions
            cancel={() => setOpenModal(null)}
            confirm={() => {
              alert("this feature is not available");
              setOpenModal(null);
            }}
            confirmText="Import"
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
    </main>
  );
}

function mapUserToPlayer(user: BackendUser): Player {
  return {
    id: String(user.id),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    rank: user.role === "ADMIN" ? "ELITE" : "ROOKIE",
    points: 0,
    status: user.role === "ADMIN" ? "ACTIVE" : "ACTIVE",
    events: user.eventsCount ?? 0,
  };
}

function MenuItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex h-[49px] items-center gap-4 px-6 tracking-[0.03em] ${
        active
          ? "border-l-4 border-[#e9feff] bg-[#263b43] text-white"
          : "text-[#d7e4e8]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </div>
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
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      className={`flex h-[32px] min-w-[32px] items-center justify-center border border-[#3a4d54] text-xs ${
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
