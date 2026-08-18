import type React from "react";
import { Trophy, Users, Zap } from "lucide-react";
import type { MatchRow } from "../tournaments/types";
import { formatScore } from "../tournaments/utils";
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
    <div className="grid h-full min-w-0 grid-cols-[minmax(0,1fr)_54px] items-start gap-4">
      <div className="min-w-0">
        <h3
          title={title}
          className={`truncate whitespace-nowrap text-[12px] font-black uppercase leading-5 tracking-[0.08em] min-[1500px]:text-[13px] ${
            tone === "warning" ? "text-[#f4c95d]" : "text-[#c8d6db]"
          }`}
        >
          {title}
        </h3>
        <p
          className={`mt-4 whitespace-nowrap text-[34px] font-black leading-none tabular-nums min-[1500px]:text-[36px] ${
            tone === "warning" ? "text-[#f4c95d]" : "text-white"
          }`}
        >
          {value.toLocaleString()}
        </p>
      </div>
      <div
        className={`flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded ${
          tone === "warning"
            ? "bg-[#302713] text-[#f4c95d]"
            : "bg-[#213740] text-white"
        }`}
      >
        {icon}
      </div>
    </div>
  );

  const className = `h-[144px] min-w-0 overflow-hidden rounded border bg-[#0d252d] px-5 py-6 text-left shadow-[0_2px_0_rgba(255,255,255,0.08)] min-[1500px]:px-6 ${
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
  const homeName = match.homeName ?? "TBD";
  const awayName = match.awayName ?? "TBD";

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_54px_minmax(0,1fr)] items-center gap-3 font-black text-white">
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <TeamLogo
          name={match.homeName ?? "Home team"}
          src={match.homeLogoUrl}
        />
        <span title={homeName} className="min-w-0 truncate whitespace-nowrap">
          {homeName}
        </span>
      </div>
      <span
        title={score === "-" ? "Versus" : score}
        className={`flex h-7 w-[54px] shrink-0 items-center justify-center rounded-sm px-2 py-1 text-center text-xs uppercase tabular-nums ${
          score === "-"
            ? "text-[#84d8e8]"
            : "bg-[#183229] text-[#a7e8c0]"
        }`}
      >
        {score === "-" ? "vs" : score}
      </span>
      <div className="flex min-w-0 items-center justify-end gap-2 overflow-hidden text-right">
        <span title={awayName} className="min-w-0 truncate whitespace-nowrap">
          {awayName}
        </span>
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
  const rawStatus = status.toUpperCase();
  const normalized =
    rawStatus === "ACTIVE" || rawStatus === "LIVE"
      ? "ONGOING"
      : rawStatus === "COMPLETED" ||
          rawStatus === "FINISHED" ||
          rawStatus === "CANCELLED" ||
          rawStatus === "CANCELED"
        ? "COMPLETE"
        : rawStatus;
  const className =
    normalized === "ONGOING"
      ? "border-l-2 border-white bg-[#162b32] text-white"
      : normalized === "UPCOMING" || normalized === "PENDING"
        ? "border-l-2 border-[#f4c95d] bg-[#302713] text-[#ffe8a3]"
        : normalized === "COMPLETE"
          ? "bg-[#183229] text-[#a7e8c0]"
          : "bg-[#35171b] text-[#ff8a8a]";

  return (
    <span
      className={`inline-flex h-[27px] items-center whitespace-nowrap px-3 text-xs font-black uppercase ${className}`}
    >
      {normalized}
    </span>
  );
}

export function DashboardSourceBadge({ source }: { source: string }) {
  const label = source || "MANUAL";

  return (
    <span
      title={label}
      className="inline-flex max-w-full items-center truncate whitespace-nowrap rounded-sm bg-[#203940] px-2 py-1 text-xs font-black uppercase text-[#dce8eb]"
    >
      {label}
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

