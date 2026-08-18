import { AlertTriangle, CalendarDays, Trophy, Users } from "lucide-react";
import { DashboardStatCard } from "../shared/dashboard-ui";
import type { DashboardData } from "../tournaments/types";

export function DashboardStatGrid({
  stats,
  isAdmin,
  alignWithActivityRail = false,
  onOpenAttentionDetails,
}: {
  stats: DashboardData["stats"];
  isAdmin: boolean;
  alignWithActivityRail?: boolean;
  onOpenAttentionDetails: () => void;
}) {
  if (isAdmin && alignWithActivityRail) {
    return (
      <section className="mb-5 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_390px] xl:gap-5">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 xl:gap-5">
          <DashboardStatCard
            title="Active Tournaments"
            value={stats.activeTournaments}
            icon={<Trophy size={22} />}
          />
          <DashboardStatCard
            title="Total Players"
            value={stats.totalPlayers}
            icon={<Users size={22} />}
          />
          <DashboardStatCard
            title="Today Matches"
            value={stats.upcomingMatches}
            icon={<CalendarDays size={22} />}
          />
        </div>
        <DashboardStatCard
          tone="warning"
          title="Attention Needed"
          value={stats.attentionNeeded}
          icon={<AlertTriangle size={24} />}
          onClick={onOpenAttentionDetails}
        />
      </section>
    );
  }

  const gridClassName = isAdmin
    ? "mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5 2xl:gap-6"
    : "mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 xl:gap-5 2xl:gap-6";

  return (
    <section className={gridClassName}>
      <DashboardStatCard
        title="Active Tournaments"
        value={stats.activeTournaments}
        icon={<Trophy size={22} />}
      />
      <DashboardStatCard
        title="Total Players"
        value={stats.totalPlayers}
        icon={<Users size={22} />}
      />
      <DashboardStatCard
        title="Today Matches"
        value={stats.upcomingMatches}
        icon={<CalendarDays size={22} />}
      />
      {isAdmin && (
        <DashboardStatCard
          tone="warning"
          title="Attention Needed"
          value={stats.attentionNeeded}
          icon={<AlertTriangle size={24} />}
          onClick={onOpenAttentionDetails}
        />
      )}
    </section>
  );
}
