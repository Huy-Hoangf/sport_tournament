import type { ReactNode } from "react";
import type { CurrentUser } from "../../api";
import type { AdminView } from "../types/player";
import { MenuItem } from "../admin-player-components";
import {
  BarChart3,
  Bell,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Settings,
  Trophy,
  Users,
  X,
} from "lucide-react";

export function AdminShell({
  activeView,
  children,
  currentUser,
  isAdmin,
  isMobileMenuOpen,
  onCloseMobileMenu,
  onLogout,
  onOpenChangePassword,
  onOpenMobileMenu,
  onOpenRecentActivity,
  onOpenView,
  onUnavailableLeaderboard,
}: {
  activeView: AdminView;
  children: ReactNode;
  currentUser: CurrentUser | null;
  isAdmin: boolean;
  isMobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
  onLogout: () => void;
  onOpenChangePassword: () => void;
  onOpenMobileMenu: () => void;
  onOpenRecentActivity: () => void;
  onOpenView: (view: AdminView) => void;
  onUnavailableLeaderboard: () => void;
}) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#3c5056] bg-[#07181d]/95 px-4 py-3 backdrop-blur xl:hidden">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_92px] items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="flex h-11 w-11 items-center justify-center rounded border border-[#3a4d54] bg-[#0d252d] text-[#dce8eb]"
            aria-label="Open navigation menu"
          >
            <span className="block h-4 w-5 border-y-2 border-current before:block before:h-[2px] before:translate-y-[5px] before:bg-current" />
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
              onClick={onOpenRecentActivity}
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
            onClick={onCloseMobileMenu}
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
                onClick={onCloseMobileMenu}
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

            <AdminNav
              activeView={activeView}
              isAdmin={isAdmin}
              onOpenView={onOpenView}
              onUnavailableLeaderboard={onUnavailableLeaderboard}
            />

            <div className="mt-auto border-t border-[#3c5056] p-5">
              <button
                onClick={onOpenChangePassword}
                className="mb-5 flex w-full items-center gap-4 text-lg text-[#e2edf0]"
              >
                <Settings size={21} />
                Change Password
              </button>
              <button
                onClick={onLogout}
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
              onClick={onOpenRecentActivity}
              title="Notifications"
              className="flex h-9 w-9 items-center justify-center text-[#d9e5e7] transition hover:text-[#84d8e8]"
            >
              <Bell size={21} />
            </button>
          </div>
        </div>

        <AdminNav
          activeView={activeView}
          isAdmin={isAdmin}
          onOpenView={onOpenView}
          onUnavailableLeaderboard={onUnavailableLeaderboard}
        />

        <div className="hidden xl:mt-auto xl:block xl:border-t xl:border-[#3c5056] xl:p-6">
          <button
            onClick={onOpenChangePassword}
            className="mb-7 flex items-center gap-4 text-xl text-[#e2edf0]"
          >
            <Settings size={21} />
            Setting
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-4 text-xl text-[#ff8a8a] transition hover:text-[#ffb0b0]"
          >
            <LogOut size={21} />
            Logout
          </button>
        </div>
      </aside>

      <section className="min-h-screen bg-[#06161b] xl:ml-[260px]">
        {children}
      </section>
    </>
  );
}

function AdminNav({
  activeView,
  isAdmin,
  onOpenView,
  onUnavailableLeaderboard,
}: {
  activeView: AdminView;
  isAdmin: boolean;
  onOpenView: (view: AdminView) => void;
  onUnavailableLeaderboard: () => void;
}) {
  return (
    <nav className="mt-6 flex overflow-x-auto text-sm font-bold xl:mt-8 xl:block xl:space-y-2 xl:overflow-visible">
      <MenuItem
        active={activeView === "dashboard"}
        icon={<LayoutDashboard size={21} />}
        label="Dashboard"
        onClick={() => onOpenView("dashboard")}
      />
      <MenuItem
        active={activeView === "tournaments"}
        icon={<Trophy size={21} />}
        label="Tournaments"
        onClick={() => onOpenView("tournaments")}
      />
      <MenuItem
        active={activeView === "matches"}
        icon={<Gamepad2 size={21} />}
        label="Matches"
        onClick={() => onOpenView("matches")}
      />
      {isAdmin && (
        <MenuItem
          active={activeView === "players"}
          icon={<Users size={18} />}
          label="Players"
          onClick={() => onOpenView("players")}
        />
      )}
      <MenuItem
        icon={<BarChart3 size={21} />}
        label="Leaderboard"
        onClick={onUnavailableLeaderboard}
      />
    </nav>
  );
}
