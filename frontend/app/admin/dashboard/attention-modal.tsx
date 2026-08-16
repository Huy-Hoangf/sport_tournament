import { Users, X } from "lucide-react";
import { DashboardStatusBadge } from "../shared/dashboard-ui";
import type { DashboardData } from "../tournaments/types";
import { formatRelative } from "../tournaments/utils";

export function AttentionModal({
  dashboard,
  onClose,
}: {
  dashboard: DashboardData;
  onClose: () => void;
}) {
  return (
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
            onClick={onClose}
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
                    {player.memberCode || "No member ID"} - Updated{" "}
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
          <span>Pending predictions: {dashboard.stats.pendingPredictions}</span>
          <span>Sync warnings: {dashboard.stats.warningMatches}</span>
        </footer>
      </section>
    </div>
  );
}
