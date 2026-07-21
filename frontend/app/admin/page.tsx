"use client";

import { logoutAll } from "../auth-sync";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Pencil,
  Search,
  Settings,
  SlidersHorizontal,
  TerminalSquare,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

const ADMIN_EMAIL = "son.vu@twenty-tech.com";
const DEFAULT_PASSWORD = "123456";

type Player = {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: "PLAYER";
  rank: "ELITE" | "PRO" | "ROOKIE";
  points: number;
  status: "ACTIVE" | "BANNED" | "PENDING";
};

const demoPlayers: Player[] = [
  {
    id: "829-X01-22",
    fullName: "Alex \"Neon\" VanHousen",
    email: "a.neon@cybercrystal.io",
    password: DEFAULT_PASSWORD,
    role: "PLAYER",
    rank: "ELITE",
    points: 1248500,
    status: "ACTIVE",
  },
  {
    id: "114-Z45-09",
    fullName: "Sarah \"Blade\" Connor",
    email: "s.connor@mainframe.com",
    password: DEFAULT_PASSWORD,
    role: "PLAYER",
    rank: "PRO",
    points: 842100,
    status: "ACTIVE",
  },
  {
    id: "000-ERR-XX",
    fullName: "Unknown_Hacker_99",
    email: "shadow@deepweb.net",
    password: DEFAULT_PASSWORD,
    role: "PLAYER",
    rank: "ROOKIE",
    points: 0,
    status: "BANNED",
  },
  {
    id: "554-A90-11",
    fullName: "Elena \"Pulse\" Rodriguez",
    email: "e.rod@neocity.global",
    password: DEFAULT_PASSWORD,
    role: "PLAYER",
    rank: "PRO",
    points: 512300,
    status: "PENDING",
  },
];

export default function AdminPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [openModal, setOpenModal] = useState<"createUser" | "createUserFromList" | null>(null);

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

    if (!currentUser || currentUser.role !== "ADMIN") {
      router.push("/login");
      return;
    }

    const savedPlayers = JSON.parse(localStorage.getItem("users") || "[]");

    if (savedPlayers.length > 0) {
      setPlayers(savedPlayers);
    } else {
      setPlayers(demoPlayers);
      localStorage.setItem("users", JSON.stringify(demoPlayers));
    }
  }, [router]);

  const activeCount = useMemo(
    () => players.filter((player) => player.status === "ACTIVE").length,
    [players]
  );
  useEffect(() => {
  function handleStorage(event: StorageEvent) {
        if (event.key === "logoutEvent" || event.key === "currentUser") {
        const currentUser = localStorage.getItem("currentUser");

        if (!currentUser) {
            router.push("/login");
        }
        }
    }

        window.addEventListener("storage", handleStorage);

        return () => {
            window.removeEventListener("storage", handleStorage);
        };
    }, [router]);

  function createPlayer() {
    if (!fullName.trim() || !email.trim()) {
      alert("Vui lòng nhập tên và email.");
      return;
    }

    if (email.trim().toLowerCase() === ADMIN_EMAIL) {
      alert("Không được tạo thêm admin.");
      return;
    }

    const existed = players.some(
      (player) => player.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (existed) {
      alert("Email này đã tồn tại.");
      return;
    }

    const newPlayer: Player = {
      id: Date.now().toString().slice(-3) + "-NEW-01",
      fullName: fullName.trim(),
      email: email.trim(),
      password: DEFAULT_PASSWORD,
      role: "PLAYER",
      rank: "ROOKIE",
      points: 0,
      status: "ACTIVE",
    };

    const nextPlayers = [newPlayer, ...players];
    setPlayers(nextPlayers);
    localStorage.setItem("users", JSON.stringify(nextPlayers));

    setFullName("");
    setEmail("");

    alert("Tạo người chơi thành công. Mật khẩu mặc định là 123456.");
  }

  function logout() {
    logoutAll();
    router.push("/login");
  }

  return (
    <main className="auth-page min-h-screen bg-[#0c1111] text-zinc-200">
      <aside className="fixed left-0 top-0 flex h-screen w-[320px] flex-col border-r border-[#263333] bg-[#070d0d] px-5 py-8">
        <h1 className="mb-7 text-[25px] font-black tracking-[-0.08em] text-[#8ed8ec]">
          GOALCRYSTAL
        </h1>

        <div className="mb-14 rounded-lg border border-[#273838] bg-[#121919] p-4">
          <div className="flex items-center gap-4">
            <div className="h-[52px] w-[52px] rounded border border-[#2e4b53] bg-[#12323a]" />
            <div>
              <p className="font-black text-[#8ed8ec]">Son Vu</p>
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-300">
                Administrator
              </p>
            </div>
          </div>
        </div>

        <nav className="space-y-3 text-[20px]">
          <MenuItem icon={<LayoutDashboard size={22} />} label="Dashboard" />
          <MenuItem active icon={<Users size={22} />} label="Player Management" />
          <MenuItem icon={<TrendingUp size={22} />} label="Predictions" />
          <MenuItem icon={<BarChart3 size={22} />} label="User Metrics" />
          <MenuItem icon={<TerminalSquare size={22} />} label="System Logs" />
        </nav>

        <div className="mt-auto border-t border-white/10 pt-8">
          <button className="mb-8 h-[52px] w-full rounded bg-[#8ed8ec] text-lg font-black text-[#102026]">
            Export Report
          </button>

          <button className="mb-7 flex items-center gap-4 px-5 text-xl text-zinc-300">
            <HelpCircle size={22} />
            Support
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-4 px-5 text-xl text-[#ffb3ab]"
          >
            <LogOut size={22} />
            Logout
          </button>
        </div>
      </aside>

      <section className="ml-[320px] min-h-screen">
        <header className="flex h-[100px] items-center justify-between border-b border-[#263333] px-10">
          <div className="flex items-center gap-8 text-xl font-semibold uppercase tracking-[0.24em]">
            <span className="h-8 w-px bg-white/10" />
            <span className="border-b-2 border-[#8ed8ec] pb-3 text-[#bdeeff]">
              Players
            </span>
            <span className="text-zinc-400">Tournaments</span>
            <span className="text-zinc-400">Settings</span>
          </div>

          <div className="flex items-center gap-8 text-zinc-300">
            <Bell size={28} />
            <Settings size={30} />
          </div>
        </header>

        <div className="px-10 py-10">
          <div className="mb-10 flex items-start justify-between">
            <div>
              <h2 className="text-[24px] text-zinc-100">Player Directory</h2>
              <p className="text-[21px] text-zinc-300">
                Total active users:{" "}
                <span className="font-black text-[#8ed8ec]">12,842</span>{" "}
                registered in the system.
              </p>
            </div>
            
            <div className="mb-10 flex items-start justify-between gap-20">
                <button
              onClick={() => setOpenModal("createUser")}
              className="flex h-[62px] items-center gap-3 rounded bg-[#8ed8ec] px-8 text-xl font-black text-[#102026]"
            >
              <UserPlus size={27} />
              Add Player
            </button>
            <button
              onClick={() => setOpenModal("createUserFromList")}
              className="flex h-[62px] items-center gap-3 rounded bg-[#8ed8ec] px-8 text-xl font-black text-[#102026]"
            >
              <UserPlus size={27} />
              Add Player From List
            </button>
            </div>
          </div>

          <div className="mb-10 grid grid-cols-4 gap-5">
            <StatCard title="Total Players" value="24,592" accent="cyan" icon={<Users />} />
            <StatCard title="Active Now" value={activeCount.toLocaleString()} accent="cyan" icon={<Zap />} />
            <StatCard title="New Today" value="142" accent="orange" icon={<UserPlus />} />
            <StatCard title="Total Predictions" value="482.1k" accent="gray" icon={<TrendingUp />} />
          </div>

          <div className="mb-8 flex h-[92px] items-center gap-5 rounded-lg border border-[#293636] bg-[#141a1a] px-6">
            <div className="flex h-[48px] w-[470px] items-center gap-3 rounded border border-[#2b3838] bg-[#101616] px-4 text-zinc-500">
              <Search size={26} />
              <span className="text-lg">Search by name, email, or UID...</span>
            </div>

            <span className="text-xl uppercase tracking-[0.12em]">Status:</span>
            <button className="h-[48px] rounded border border-[#2b3838] px-6">
              All Status
            </button>

            <span className="text-xl uppercase tracking-[0.12em]">Tier:</span>
            <button className="h-[48px] rounded border border-[#2b3838] px-6">
              All Tiers
            </button>

            <button className="ml-auto flex items-center gap-3 text-xl">
              <SlidersHorizontal size={26} />
              Advanced Filters
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#293636] bg-[#111717]">
            <table className="w-full">
              <thead className="h-[72px] bg-[#1d2222] text-left text-xl uppercase tracking-[0.16em] text-zinc-300">
                <tr>
                  <th className="px-8">Player</th>
                  <th>Email</th>
                  <th>Rank</th>
                  <th>Points</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {players.map((player, index) => (
                  <tr key={player.id} className="h-[118px] border-t border-white/5">
                    <td className="px-8">
                      <div className="flex items-center gap-4">
                        <div className="h-[50px] w-[50px] rounded border border-[#31505a] bg-[#102d35]" />
                        <div>
                          <p className="text-xl font-black text-zinc-100">
                            {player.fullName}
                          </p>
                          <p className="text-xs text-zinc-300">UID: {player.id}</p>
                        </div>
                      </div>
                    </td>

                    <td className="text-lg text-zinc-300">{player.email}</td>
                    <td>
                      <RankBadge rank={player.rank} />
                    </td>
                    <td className="text-xl font-black text-[#8ed8ec]">
                      {player.points.toLocaleString()}
                    </td>
                    <td>
                      <StatusBadge status={player.status} />
                    </td>
                    <td>
                      <div className="flex gap-5">
                        <Eye size={23} />
                        <Pencil size={23} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex h-[102px] items-center justify-between border-t border-white/5 px-8">
              <p className="text-xl uppercase tracking-[0.12em] text-zinc-300">
                Showing 1 to {players.length} of 12,842 players
              </p>

              <div className="flex items-center gap-2">
                <PageButton>
                  <ChevronLeft size={22} />
                </PageButton>
                <PageButton active>1</PageButton>
                <PageButton>2</PageButton>
                <PageButton>3</PageButton>
                <span className="px-2">...</span>
                <PageButton>120</PageButton>
                <PageButton>
                  <ChevronRight size={22} />
                </PageButton>
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-[#263333] py-5 text-center text-xs uppercase tracking-[0.18em] text-zinc-400">
          GOALCRYSTAL Infrastructure V4.2.0-Stable | Core Node: North-Alpha
        </footer>
      </section>

            {openModal === "createUser" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="w-[520px] rounded-lg border border-[#8ed8ec55] bg-[#101818] p-7 shadow-[0_0_50px_rgba(142,216,236,0.18)]">
            <h2 className="mb-6 text-2xl font-black text-[#8ed8ec]">
                New Player
            </h2>

            <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Name"
                className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
            />

            <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
            />

            <p className="mb-6 text-sm text-zinc-400">
                Default Password: 123456
            </p>

            <div className="flex justify-end gap-3">
                <button
                onClick={() => setOpenModal(null)}
                className="h-[46px] rounded border border-white/10 px-5 text-zinc-300"
                >
                Cancel
                </button>

                <button
                onClick={createPlayer}
                className="h-[46px] rounded bg-[#8ed8ec] px-5 font-black text-[#102026]"
                >
                Create User
                </button>
            </div>
            </div>
        </div>
        )}

        {openModal === "createUserFromList" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="w-[520px] rounded-lg border border-[#8ed8ec55] bg-[#101818] p-7 shadow-[0_0_50px_rgba(142,216,236,0.18)]">
            <h2 className="mb-4 text-2xl font-black text-[#8ed8ec]">
                Add Player From List
            </h2>

            <p className="mb-6 text-base text-zinc-400">
                Import From Excel
            </p>

            <div className="flex justify-end gap-3">
                <button
                onClick={() => setOpenModal(null)}
                className="h-[46px] rounded border border-white/10 px-5 text-zinc-300"
                >
                Cancel
                </button>

                <button
                onClick={() => {
                    alert("this feature is not available");
                    setOpenModal(null);
                }}
                className="h-[46px] rounded bg-[#8ed8ec] px-5 font-black text-[#102026]"
                >
                Import
                </button>
            </div>
            </div>
        </div>
        )}
    </main>
  );
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
      className={`flex h-[60px] items-center gap-4 rounded px-5 ${
        active
          ? "border-r-2 border-[#8ed8ec] bg-[#162323] text-[#9ddff2]"
          : "text-zinc-300"
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
  icon,
  accent,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: "cyan" | "orange" | "gray";
}) {
  const accentClass =
    accent === "orange"
      ? "border-l-[#ffb36b] text-[#ffb36b]"
      : accent === "gray"
        ? "border-l-zinc-500 text-zinc-400"
        : "border-l-[#8ed8ec] text-[#8ed8ec]";

  return (
    <div className={`h-[180px] rounded-lg border border-[#293636] border-l-4 bg-[#141a1a] p-7 ${accentClass}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl uppercase tracking-[0.12em] text-zinc-300">
          {title}
        </h3>
        <div className={accentClass}>{icon}</div>
      </div>
      <p className="mb-4 text-2xl font-black text-zinc-100">{value}</p>
      <p className="text-sm text-[#9ddff2]">↗ +12% from last month</p>
    </div>
  );
}

function RankBadge({ rank }: { rank: Player["rank"] }) {
  const className =
    rank === "ELITE"
      ? "border-[#8a5a31] bg-[#3b291b] text-[#ffb36b]"
      : rank === "PRO"
        ? "border-[#50636a] text-zinc-200"
        : "border-zinc-600 bg-zinc-700/50 text-zinc-200";

  return (
    <span className={`rounded border px-4 py-1 text-xs font-black ${className}`}>
      {rank}
    </span>
  );
}

function StatusBadge({ status }: { status: Player["status"] }) {
  const className =
    status === "ACTIVE"
      ? "border-[#6bbfd7] text-[#9ddff2] shadow-[0_0_18px_rgba(142,216,236,0.35)]"
      : status === "BANNED"
        ? "border-[#ff9b91] text-[#ffb3ab] shadow-[0_0_18px_rgba(255,155,145,0.25)]"
        : "border-[#ffb36b] text-[#ffc285]";

  return (
    <span className={`rounded-full border px-4 py-2 text-sm font-black ${className}`}>
      • {status}
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
      className={`flex h-[50px] min-w-[42px] items-center justify-center rounded border border-white/10 px-3 text-lg ${
        active ? "bg-[#8ed8ec] font-black text-[#102026]" : "text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}