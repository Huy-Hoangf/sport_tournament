import { Minus, Plus, Search, Shield, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import type { MatchRow, TournamentRow } from "../types";
import { isFinishedStatus } from "../utils";

type TeamRow = {
  name: string;
  stage: string;
  wins: number;
  losses: number;
  draws: number;
  score: number;
  matches: number;
};

export function TeamsTab({
  tournament,
  matches,
  canManage,
  onUnavailableFeature,
}: {
  tournament: TournamentRow;
  matches: MatchRow[];
  canManage: boolean;
  onUnavailableFeature: () => void;
}) {
  const [searchValue, setSearchValue] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 4;
  const teamRows = useMemo(() => buildTeamRows(matches), [matches]);
  const stageOptions = useMemo(
    () => [
      "ALL",
      ...Array.from(new Set(teamRows.map((team) => team.stage))).filter(Boolean),
    ],
    [teamRows],
  );
  const filteredRows = teamRows.filter((team) => {
    const matchesSearch = team.name
      .toLowerCase()
      .includes(searchValue.trim().toLowerCase());
    const matchesStage = stageFilter === "ALL" || team.stage === stageFilter;

    return matchesSearch && matchesStage;
  });
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const start = (activePage - 1) * pageSize;
  const visibleRows = filteredRows.slice(start, start + pageSize);

  return (
    <section className="border-t border-[#314850] bg-[#06161b] p-4 sm:p-7 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-2xl font-black text-white">Active Teams</p>
          <p className="mt-1 max-w-2xl text-sm font-bold text-[#9fb2b8]">
            Manage and monitor all teams currently deployed in{" "}
            <span className="text-[#84d8e8]">{tournament.name}</span>.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={onUnavailableFeature}
            className="inline-flex h-11 items-center gap-2 border border-[#84d8e8] bg-[#84d8e8] px-5 text-xs font-black uppercase tracking-[0.12em] text-[#06161b] transition hover:bg-[#a1e8f2]"
          >
            <Plus size={15} />
            Register New Team
          </button>
        )}
      </div>

      <div className="mb-6 grid gap-3 border border-[#243c43] bg-[#0d252d] p-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
        <label className="relative block min-w-0">
          <Search
            aria-hidden="true"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#84d8e8]"
            size={16}
          />
          <input
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setPage(1);
            }}
            placeholder="Filter by team name..."
            className="h-12 w-full border border-[#243c43] bg-[#07181d] pl-11 pr-4 text-sm font-bold text-white outline-none placeholder:text-[#789098] focus:border-[#84d8e8]"
          />
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#789098]">
            Stage:
          </span>
          {stageOptions.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => {
                setStageFilter(stage);
                setPage(1);
              }}
              className={`h-9 border px-3 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                stageFilter === stage
                  ? "border-[#84d8e8] bg-[#142f37] text-[#84d8e8]"
                  : "border-[#314850] bg-[#10242b] text-[#b7d2d8] hover:border-[#84d8e8] hover:text-[#84d8e8]"
              }`}
            >
              {stage === "ALL" ? "All" : stage}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden border border-[#243c43] bg-[#0d252d]">
        <div className="overflow-x-auto">
          <div className="min-w-[840px]">
            <div className="grid grid-cols-[72px_minmax(260px,1fr)_90px_90px_90px_100px_92px_90px] gap-x-5 border-b border-[#243c43] bg-[#10242b] px-5 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-[#9fb2b8]">
              <span>Rank</span>
              <span>Team Identity</span>
              <span>Wins</span>
              <span>Loss</span>
              <span>Draw</span>
              <span>Score</span>
              <span>Trend</span>
              <span>Matches</span>
            </div>
            <div className="divide-y divide-[#243c43]">
              {visibleRows.map((team, index) => (
                <TeamTableRow
                  key={team.name}
                  team={team}
                  rank={start + index + 1}
                  highlighted={index === 0}
                />
              ))}
              {visibleRows.length === 0 && (
                <div className="grid place-items-center px-5 py-16 text-center">
                  <Shield className="mb-3 text-[#27414a]" size={46} />
                  <p className="text-sm font-bold text-[#9fb2b8]">
                    No teams found for this tournament yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#243c43] bg-[#14272e] px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#9fb2b8]">
            Showing {filteredRows.length ? start + 1 : 0}-
            {Math.min(start + pageSize, filteredRows.length)} of{" "}
            {filteredRows.length} teams
          </p>
          <div className="flex gap-2">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`h-9 min-w-9 border px-3 text-xs font-black transition ${
                    pageNumber === activePage
                      ? "border-[#84d8e8] bg-[#142f37] text-[#84d8e8]"
                      : "border-[#314850] text-[#9fb2b8] hover:border-[#84d8e8] hover:text-[#84d8e8]"
                  }`}
                >
                  {pageNumber}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TeamTableRow({
  team,
  rank,
  highlighted,
}: {
  team: TeamRow;
  rank: number;
  highlighted: boolean;
}) {
  const trend =
    team.wins > 0 && team.wins >= team.losses
      ? "up"
      : team.losses > team.wins
        ? "down"
        : "flat";

  return (
    <div
      className={`grid grid-cols-[72px_minmax(260px,1fr)_90px_90px_90px_100px_92px_90px] items-center gap-x-5 px-5 py-4 text-sm ${
        highlighted ? "bg-[#18343d]" : "bg-[#0d252d]"
      }`}
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-full text-xs font-black ${
          highlighted
            ? "bg-[#84d8e8] text-[#06161b]"
            : "bg-[#263b43] text-[#dce8eb]"
        }`}
      >
        {String(rank).padStart(2, "0")}
      </span>
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-11 shrink-0 place-items-center border border-[#314850] bg-[#07181d] text-sm font-black text-[#84d8e8]">
          {getInitials(team.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#dce8eb]">
            {team.name}
          </p>
          <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.08em] text-[#789098]">
            {team.stage}
          </p>
        </div>
      </div>
      <TeamNumber value={team.wins} />
      <TeamNumber value={team.losses} />
      <TeamNumber value={team.draws} />
      <TeamNumber value={team.score} accent />
      <span
        className={`inline-flex h-8 w-8 items-center justify-center ${
          trend === "up"
            ? "text-[#84d8e8]"
            : trend === "down"
              ? "text-[#ff9d9d]"
              : "text-[#9fb2b8]"
        }`}
      >
        {trend === "up" ? (
          <TrendingUp size={18} />
        ) : trend === "down" ? (
          <TrendingDown size={18} />
        ) : (
          <Minus size={18} />
        )}
      </span>
      <TeamNumber value={team.matches} />
    </div>
  );
}

function TeamNumber({ value, accent = false }: { value: number; accent?: boolean }) {
  return (
    <span
      className={`whitespace-nowrap text-sm font-black tabular-nums ${
        accent ? "text-[#84d8e8]" : "text-[#dce8eb]"
      }`}
    >
      {value.toLocaleString()}
    </span>
  );
}

function buildTeamRows(matches: MatchRow[]): TeamRow[] {
  const teams = new Map<string, TeamRow>();

  matches.forEach((match) => {
    const homeName = normalizeTeamName(match.homeName);
    const awayName = normalizeTeamName(match.awayName);
    const stage = match.stageName ?? "Main Stage";

    if (homeName) {
      ensureTeam(teams, homeName, stage).matches += 1;
    }

    if (awayName) {
      ensureTeam(teams, awayName, stage).matches += 1;
    }

    if (
      !homeName ||
      !awayName ||
      !isFinishedStatus(match.status) ||
      match.actualHomeScore == null ||
      match.actualAwayScore == null
    ) {
      return;
    }

    const home = ensureTeam(teams, homeName, stage);
    const away = ensureTeam(teams, awayName, stage);
    home.score += match.actualHomeScore;
    away.score += match.actualAwayScore;

    if (match.actualHomeScore > match.actualAwayScore) {
      home.wins += 1;
      away.losses += 1;
    } else if (match.actualHomeScore < match.actualAwayScore) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
    }
  });

  return [...teams.values()].sort(
    (first, second) =>
      second.wins - first.wins ||
      first.losses - second.losses ||
      second.draws - first.draws ||
      second.score - first.score ||
      first.name.localeCompare(second.name),
  );
}

function ensureTeam(teams: Map<string, TeamRow>, name: string, stage: string) {
  const existingTeam = teams.get(name);

  if (existingTeam) {
    return existingTeam;
  }

  const team: TeamRow = {
    name,
    stage,
    wins: 0,
    losses: 0,
    draws: 0,
    score: 0,
    matches: 0,
  };

  teams.set(name, team);
  return team;
}

function normalizeTeamName(name?: string | null) {
  const normalized = name?.trim();

  if (!normalized || normalized.toUpperCase() === "TBD") {
    return null;
  }

  return normalized;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
