import { X } from "lucide-react";
import { DashboardActivityIcon } from "../shared/dashboard-ui";
import type { ActivityRow } from "../tournaments/types";
import { formatRelative } from "../lib/format";

export function RecentActivityDrawer({
  activities,
  isLoading,
  onClose,
}: {
  activities: ActivityRow[];
  isLoading: boolean;
  onClose: () => void;
}) {
  return (
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
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#3a4d54] text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8]"
            aria-label="Close recent activity"
            title="Close"
          >
            <X size={20} />
          </button>
        </header>

        <div className="max-h-[520px] overflow-y-auto p-5">
          {isLoading ? (
            <p className="py-12 text-center text-sm font-bold text-[#9fb2b8]">
              Loading recent activity...
            </p>
          ) : activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => (
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
  );
}
