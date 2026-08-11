import type React from "react";
import { Trophy, Users, Zap } from "lucide-react";
import type { MatchRow } from "../tournament/types";
import { formatScore } from "../tournament/utils";
export function DashboardActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-[56px] items-center justify-center gap-3 rounded border border-[#3a4d54] bg-[#0d252d] px-5 text-base font-black text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8] sm:h-[62px] sm:px-7 sm:text-lg"
    >
      {icon}
      {label}
    </button>
  );
}

export function DashboardStatCard({
  title,
  value,
  icon,
  tone = "normal",
  onClick,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone?: "normal" | "warning";
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            className={`text-sm font-black uppercase tracking-[0.1em] ${
              tone === "warning" ? "text-[#f4c95d]" : "text-[#c8d6db]"
            }`}
          >
            {title}
          </h3>
          <p
            className={`mt-2 text-[36px] font-black leading-none ${
              tone === "warning" ? "text-[#f4c95d]" : "text-white"
            }`}
          >
            {value.toLocaleString()}
          </p>
        </div>
        <div
          className={`flex h-[54px] w-[49px] items-center justify-center rounded ${
            tone === "warning"
              ? "bg-[#302713] text-[#f4c95d]"
              : "bg-[#213740] text-white"
          }`}
        >
          {icon}
        </div>
      </div>
    </>
  );

  const className = `h-[144px] w-full rounded border bg-[#0d252d] px-6 py-6 text-left shadow-[0_2px_0_rgba(255,255,255,0.08)] ${
    tone === "warning" ? "border-[#8b7133]" : "border-[#3a4d54]"
  }`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} cursor-pointer transition hover:border-[#f4c95d] hover:bg-[#102d35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84d8e8]`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export function DashboardPanelTitle({
  title,
  icon,
  right,
}: {
  title: string;
  icon?: React.ReactNode;
  right?: string;
}) {
  return (
    <div className="flex min-h-[65px] flex-col gap-3 border-b border-[#3a4d54] bg-[#14272e] px-4 py-4 sm:flex-row sm:items-center sm:px-6">
      <h2 className="min-w-0 flex-1 text-sm font-black uppercase tracking-[0.08em] text-[#d5e0e3]">
        {title}
      </h2>
      {icon && (
        <div className="flex w-full text-[#dce8eb] sm:w-[170px] sm:shrink-0 sm:justify-center">
          {icon}
        </div>
      )}
      {right && (
        <span className="w-full text-left text-xs font-black uppercase text-[#84d8e8] sm:w-[170px] sm:shrink-0 sm:text-right">
          {right}
        </span>
      )}
    </div>
  );
}

export function MatchTeams({ match }: { match: MatchRow }) {
  const score = formatScore(match);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 font-black text-white">
      <div className="flex min-w-0 items-center gap-2">
        <TeamLogo
          name={match.homeName ?? "Home team"}
          src={match.homeLogoUrl}
        />
        <span className="min-w-0 truncate">{match.homeName ?? "TBD"}</span>
      </div>
      <span
        className={`shrink-0 rounded-sm px-2 py-1 text-xs uppercase ${
          score === "-"
            ? "text-[#84d8e8]"
            : "bg-[#183229] text-[#a7e8c0]"
        }`}
      >
        {score === "-" ? "vs" : score}
      </span>
      <div className="flex min-w-0 items-center justify-end gap-2 text-right">
        <span className="min-w-0 truncate">{match.awayName ?? "TBD"}</span>
        <TeamLogo
          name={match.awayName ?? "Away team"}
          src={match.awayLogoUrl}
        />
      </div>
    </div>
  );
}

export function TeamLogo({ name, src }: { name: string; src?: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (!src) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#31505a] bg-[#143943] text-[11px] text-[#84d8e8]">
        {initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${name} logo`}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-7 w-7 shrink-0 rounded bg-white/90 object-contain p-0.5"
    />
  );
}
export function DashboardStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const className =
    normalized === "ACTIVE" || normalized === "LIVE"
      ? "border-l-2 border-white bg-[#162b32] text-white"
      : normalized === "UPCOMING" || normalized === "PENDING"
        ? "border-l-2 border-[#f4c95d] bg-[#302713] text-[#ffe8a3]"
        : normalized === "COMPLETED" || normalized === "FINISHED"
          ? "bg-[#183229] text-[#a7e8c0]"
          : "bg-[#35171b] text-[#ff8a8a]";

  return (
    <span
      className={`inline-flex h-[27px] items-center px-3 text-xs font-black uppercase ${className}`}
    >
      {normalized}
    </span>
  );
}

export function DashboardSourceBadge({ source }: { source: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-sm bg-[#203940] px-2 py-1 text-xs font-black uppercase text-[#dce8eb]">
      {source || "MANUAL"}
    </span>
  );
}

export function DashboardActivityIcon({ type }: { type: string }) {
  if (type === "user") {
    return <Users size={14} />;
  }

  if (type === "match") {
    return <Zap size={14} />;
  }

  return <Trophy size={14} />;
}



