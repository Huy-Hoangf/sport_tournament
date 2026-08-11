"use client";

import AdminDashboardContent from "../admin-dashboard-content";

export default function TournamentView({
  isAdmin,
  refreshKey,
}: {
  isAdmin: boolean;
  refreshKey: number;
}) {
  return (
    <AdminDashboardContent
      isAdmin={isAdmin}
      refreshKey={refreshKey}
      view="tournaments"
    />
  );
}

