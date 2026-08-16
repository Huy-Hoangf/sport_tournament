import {
  DashboardActivityIcon,
  DashboardPanelTitle,
} from "../shared/dashboard-ui";
import type { ActivityRow } from "../tournaments/types";
import { formatRelative } from "../tournaments/utils";

export function RecentActivityPanel({
  activities,
}: {
  activities: ActivityRow[];
}) {
  return (
    <aside className="overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d]">
      <DashboardPanelTitle title="Recent Activity" />
      <div className="min-h-[420px] space-y-6 p-6">
        {activities.map((activity) => (
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
        {activities.length === 0 && (
          <p className="pt-12 text-center text-[#9fb2b8]">
            No recent activity in database.
          </p>
        )}
      </div>
    </aside>
  );
}
