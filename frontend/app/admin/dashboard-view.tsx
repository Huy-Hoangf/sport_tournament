"use client";

import AdminDashboardContent from "./admin-dashboard-content";

export default function DashboardView({
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
      view="dashboard"
    />
  );
}
