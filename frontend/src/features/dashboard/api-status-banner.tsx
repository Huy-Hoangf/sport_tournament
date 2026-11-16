import { Cloud, RefreshCw } from "lucide-react";
import type { DashboardData } from "../tournaments/types";
import { formatRelative } from "../tournaments/utils";

export function ApiStatusBanner({
  apiStatus,
  isLoading,
  onRefresh,
}: {
  apiStatus: DashboardData["apiStatus"];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="mb-5 rounded border border-[#3a4d54] bg-[#0d252d] p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center bg-[#143942] text-[#84d8e8]">
          <Cloud size={23} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black uppercase text-[#84d8e8]">
            API Status: {apiStatus.connected ? "Connected" : "Offline"}
          </p>
          <p className="mt-1 text-sm text-[#9fb2b8]">
            {apiStatus.provider} - Last sync:{" "}
            {formatRelative(apiStatus.lastSync)}
          </p>
        </div>
        <div className="bg-[#14272e] px-4 py-2 text-xs font-black uppercase text-[#c4d3d8]">
          ID: {apiStatus.externalId}
        </div>
        <button
          onClick={onRefresh}
          title="Refresh dashboard"
          className="text-[#dce8eb]"
        >
          <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>
    </section>
  );
}
