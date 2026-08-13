"use client";

import AdminDashboardContent from "../admin-dashboard-content";

export default function DashboardView({
  isAdmin,
  refreshKey,
  onOpenTournamentManagement,
  onOpenMatches,
}: {
  isAdmin: boolean;
  refreshKey: number;
  onOpenTournamentManagement: () => void;
  onOpenMatches: (filters: {
    tournamentId?: number;
    stageId?: number;
    tournamentName?: string;
    stageName?: string;
  }) => void;
}) {
  return (
    <AdminDashboardContent
      isAdmin={isAdmin}
      refreshKey={refreshKey}
      view="dashboard"
      onOpenTournamentManagement={onOpenTournamentManagement}
      onOpenMatches={onOpenMatches}
    />
  );
}
