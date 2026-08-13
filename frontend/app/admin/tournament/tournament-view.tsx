"use client";

import AdminDashboardContent from "../admin-dashboard-content";

export default function TournamentView({
  isAdmin,
  refreshKey,
  onOpenMatches,
}: {
  isAdmin: boolean;
  refreshKey: number;
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
      view="tournaments"
      onOpenMatches={onOpenMatches}
    />
  );
}
