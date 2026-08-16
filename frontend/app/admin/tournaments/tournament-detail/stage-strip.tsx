import { CalendarDays, GitBranch, Medal, Trophy, Users } from "lucide-react";
import type { TournamentStage } from "../types";

export function StageStrip({
  stages,
  formatLabel,
  onOpenStageMatches,
}: {
  stages: TournamentStage[];
  formatLabel: string;
  onOpenStageMatches: (stage: TournamentStage) => void;
}) {
  return (
    <div className="min-w-0 lg:pt-1">
      <div className="mb-3 flex items-center gap-3">
        <p className="shrink-0 text-xs font-black uppercase tracking-[0.12em] text-[#84d8e8]">
          Stages
        </p>
        <span className="shrink-0 rounded border border-[#243c43] bg-[#0d252d] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#9fb2b8]">
          {formatLabel}
        </span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex w-max items-center gap-2">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenStageMatches(stage)}
                className="inline-flex h-10 items-center gap-2 whitespace-nowrap border border-[#31505a] bg-[#0d252d] px-3 text-xs font-black uppercase tracking-[0.06em] text-[#dce8eb] shadow-[0_0_20px_rgba(132,216,232,0.08)] transition hover:border-[#84d8e8] hover:bg-[#102b33] hover:text-[#84d8e8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84d8e8]"
              >
                <span className="text-[#84d8e8]">
                  {getStageIcon(stage.name)}
                </span>
                {stage.name}
              </button>
              {index < stages.length - 1 && (
                <span className="text-[#4d6870]">/</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getStageIcon(stageName: string) {
  const normalized = stageName.toLowerCase();

  if (normalized.includes("group")) return <Users size={16} />;
  if (normalized.includes("round")) return <GitBranch size={16} />;
  if (normalized.includes("semi")) return <Medal size={16} />;
  if (normalized.includes("final")) return <Trophy size={16} />;
  return <CalendarDays size={16} />;
}
