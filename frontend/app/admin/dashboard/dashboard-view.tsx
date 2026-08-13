"use client";

import AdminDashboardContent from "../admin-dashboard-content";

export default function DashboardView({
  isAdmin,
  refreshKey,
  onOpenTournamentManagement,
}: {
  isAdmin: boolean;
  refreshKey: number;
  onOpenTournamentManagement: () => void;
}) {
  return (
    <AdminDashboardContent
      isAdmin={isAdmin}
      refreshKey={refreshKey}
      view="dashboard"
      onOpenTournamentManagement={onOpenTournamentManagement}
    />
  );
}
