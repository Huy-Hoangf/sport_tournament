import { AlertTriangle, CalendarDays, Trophy, Users } from "lucide-react";
import { DashboardStatCard } from "../shared/dashboard-ui";
import type { DashboardData } from "../tournaments/types";

export function DashboardStatGrid({
  stats,
  isAdmin,
  onOpenAttentionDetails,
}: {
  stats: DashboardData["stats"];
  isAdmin: boolean;
  onOpenAttentionDetails: () => void;
}) {
  return (
    <section className="mb-5 grid grid-cols-2 gap-3 md:gap-4 2xl:grid-cols-4 2xl:gap-6">
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
