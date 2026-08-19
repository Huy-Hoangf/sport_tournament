import {
  Minus,
  Plus,
  Search,
  Shield,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiRequest } from "../../../api";
import type { MatchRow, TournamentRow } from "../types";
import { isFinishedStatus } from "../utils";

type TeamRow = {
  name: string;
  logoUrl?: string | null;
  stage: string;
  wins: number;
  losses: number;
  draws: number;
  score: number;
  points: number;
  matches: number;
  members: number;
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
  const [apiTeamRows, setApiTeamRows] = useState<TeamRow[] | null>(null);
  const [isRegisterTeamOpen, setIsRegisterTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [playerNames, setPlayerNames] = useState([""]);
  const [registerTeamError, setRegisterTeamError] = useState<string | null>(
    null,
  );
  const [isRegisteringTeam, setIsRegisteringTeam] = useState(false);
  const pageSize = 4;
  const canRegisterTeam =
    canManage && tournament.status.toUpperCase() !== "COMPLETE";
  const fallbackTeamRows = useMemo(
    () => buildTeamRows(matches, tournament.sportType),
    [matches, tournament.sportType],
  );
  const teamRows = apiTeamRows ?? fallbackTeamRows;
  const stageOptions = useMemo(
    () => [
      "ALL",
      ...Array.from(new Set(teamRows.map((team) => team.stage))).filter(
        Boolean,
      ),
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

  const loadTeams = useCallback(async () => {
    const rows = await apiRequest<TeamRow[]>(
      `/teams?tournamentId=${tournament.id}`,
    );

    setApiTeamRows(
      rows
        .filter((row) => isKnownTeamName(row.name))
        .map((row) => normalizeTeamRow(row, tournament.sportType)),
    );
  }, [tournament.id, tournament.sportType]);

  useEffect(() => {
    let isMounted = true;

    apiRequest<TeamRow[]>(`/teams?tournamentId=${tournament.id}`)
      .then((rows) => {
        if (isMounted) {
          setApiTeamRows(
            rows
              .filter((row) => isKnownTeamName(row.name))
              .map((row) => normalizeTeamRow(row, tournament.sportType)),
          );
        }
      })
      .catch(() => {
        if (isMounted) {
          setApiTeamRows(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [tournament.id, tournament.sportType]);

  function closeRegisterTeamModal() {
    setIsRegisterTeamOpen(false);
    setTeamName("");
    setPlayerNames([""]);
    setRegisterTeamError(null);
  }

  function addPlayerField() {
    setPlayerNames((current) => [...current, ""]);
  }

  function updatePlayerName(index: number, value: string) {
    setPlayerNames((current) =>
      current.map((name, currentIndex) =>
        currentIndex === index ? value : name,
      ),
    );
  }

  function removePlayerField(index: number) {
    setPlayerNames((current) =>
      current.length === 1
        ? [""]
        : current.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  async function registerTeam() {
    const normalizedTeamName = teamName.trim();
    const normalizedPlayers = playerNames
      .map((name) => name.trim())
      .filter(Boolean);
    const uniquePlayers = new Set(
      normalizedPlayers.map((name) => name.toLowerCase()),
    );

    if (!normalizedTeamName) {
      setRegisterTeamError("Team name is required.");
      return;
    }

    if (normalizedPlayers.length === 0) {
      setRegisterTeamError("Add at least one player.");
      return;
    }

    if (uniquePlayers.size !== normalizedPlayers.length) {
      setRegisterTeamError("Player names must be unique.");
      return;
    }

    setIsRegisteringTeam(true);
    setRegisterTeamError(null);

    try {
      await apiRequest("/teams/register", {
        method: "POST",
        body: JSON.stringify({
          tournamentId: tournament.id,
          teamName: normalizedTeamName,
          players: normalizedPlayers.map((name) => ({ name })),
        }),
      });
      closeRegisterTeamModal();
      setPage(1);
      await loadTeams();
    } catch (error) {
      setRegisterTeamError(
        error instanceof Error ? error.message : "Cannot register team.",
      );
    } finally {
      setIsRegisteringTeam(false);
    }
  }

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
            onClick={() => {
              if (!canRegisterTeam) {
                onUnavailableFeature();
                return;
              }

              setIsRegisterTeamOpen(true);
            }}
            disabled={!canRegisterTeam}
            className="inline-flex h-11 items-center gap-2 border border-[#84d8e8] bg-[#84d8e8] px-5 text-xs font-black uppercase tracking-[0.12em] text-[#06161b] transition hover:bg-[#a1e8f2] disabled:cursor-not-allowed disabled:border-[#314850] disabled:bg-[#10242b] disabled:text-[#789098]"
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
          <div className="min-w-[1030px]">
            <div className="grid grid-cols-[72px_minmax(250px,1fr)_80px_80px_80px_80px_90px_92px_90px_90px] gap-x-5 border-b border-[#243c43] bg-[#10242b] px-5 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-[#9fb2b8]">
              <span>Rank</span>
              <span>Team Identity</span>
              <span>Pts</span>
              <span>Wins</span>
              <span>Loss</span>
              <span>Draw</span>
              <span>Score</span>
              <span>Trend</span>
              <span>Members</span>
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

      {isRegisterTeamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void registerTeam();
            }}
            className="w-full max-w-xl border border-[#31515a] bg-[#102b33] p-6 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-[#84d8e8]">
                  Register New Team
                </h3>
                <p className="mt-1 text-sm font-bold text-[#9fb2b8]">
                  {tournament.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRegisterTeamModal}
                className="grid h-10 w-10 place-items-center border border-[#314850] text-[#9fb2b8] transition hover:border-[#84d8e8] hover:text-[#84d8e8]"
                aria-label="Close register team modal"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-[#9fb2b8]">
              Team name
            </label>
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              className="mt-2 h-12 w-full border border-[#31515a] bg-[#071516] px-4 text-sm font-bold text-white outline-none placeholder:text-[#789098] focus:border-[#84d8e8]"
              placeholder="Enter team name..."
            />

            <div className="mt-5 flex items-center justify-between gap-3">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-[#9fb2b8]">
                Players
              </label>
              <button
                type="button"
                onClick={addPlayerField}
                className="inline-flex h-9 items-center gap-2 border border-[#31515a] px-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#84d8e8] transition hover:border-[#84d8e8]"
              >
                <Plus size={14} />
                Add player
              </button>
            </div>

            <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
              {playerNames.map((name, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={name}
                    onChange={(event) =>
                      updatePlayerName(index, event.target.value)
                    }
                    placeholder={`Player ${index + 1}`}
                    className="h-11 flex-1 border border-[#31515a] bg-[#071516] px-4 text-sm font-bold text-white outline-none placeholder:text-[#789098] focus:border-[#84d8e8]"
                  />
                  <button
                    type="button"
                    onClick={() => removePlayerField(index)}
                    className="grid h-11 w-11 place-items-center border border-[#31515a] text-[#ff9d9d] transition hover:border-[#ff9d9d]"
                    aria-label={`Remove player ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {registerTeamError && (
              <p className="mt-4 border border-[#8a3d3d] bg-[#2a1114] px-4 py-3 text-sm font-bold text-[#ffb4b4]">
                {registerTeamError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeRegisterTeamModal}
                className="h-11 border border-[#31515a] px-5 text-sm font-black text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRegisteringTeam}
                className="h-11 border border-[#84d8e8] bg-[#84d8e8] px-5 text-sm font-black text-[#06161b] transition hover:bg-[#a1e8f2] disabled:cursor-wait disabled:opacity-60"
              >
                {isRegisteringTeam ? "Registering..." : "Register Team"}
              </button>
            </div>
          </form>
        </div>
      )}
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
      className={`grid grid-cols-[72px_minmax(250px,1fr)_80px_80px_80px_80px_90px_92px_90px_90px] items-center gap-x-5 px-5 py-4 text-sm ${
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
        <TeamLogo team={team} />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#dce8eb]">
            {team.name}
          </p>
          <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.08em] text-[#789098]">
            {team.stage}
          </p>
        </div>
      </div>
      <TeamNumber value={team.points} accent />
      <TeamNumber value={team.wins} />
      <TeamNumber value={team.losses} />
      <TeamNumber value={team.draws} />
      <TeamNumber value={team.score} />
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
      <TeamNumber value={team.members} />
      <TeamNumber value={team.matches} />
    </div>
  );
}

function TeamLogo({ team }: { team: TeamRow }) {
  const logoUrl = team.logoUrl?.trim();

  return (
    <span
      aria-label={`${team.name} logo`}
      className="relative grid h-10 w-12 shrink-0 place-items-center overflow-hidden border border-[#314850] bg-[#07181d] text-sm font-black text-[#84d8e8]"
      title={team.name}
    >
      <span className={logoUrl ? "text-[#54747d]" : ""}>
        {getInitials(team.name)}
      </span>
      {logoUrl && (
        <span
          aria-hidden="true"
          className="absolute inset-1 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: toCssUrl(logoUrl) }}
        />
      )}
    </span>
  );
}

function TeamNumber({
  value,
  accent = false,
}: {
  value: number;
  accent?: boolean;
}) {
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

function buildTeamRows(matches: MatchRow[], sportType?: string): TeamRow[] {
  const teams = new Map<string, TeamRow>();
  const winPoints = sportType === "LOL" ? 1 : 3;
  const drawPoints = sportType === "LOL" ? 0 : 1;

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
      home.points += winPoints;
      away.losses += 1;
    } else if (match.actualHomeScore < match.actualAwayScore) {
      away.wins += 1;
      away.points += winPoints;
      home.losses += 1;
    } else {
      home.draws += 1;
      home.points += drawPoints;
      away.draws += 1;
      away.points += drawPoints;
    }
  });

  return [...teams.values()].sort(
    (first, second) =>
      second.points - first.points ||
      second.wins - first.wins ||
      first.losses - second.losses ||
      second.draws - first.draws ||
      second.score - first.score ||
      first.name.localeCompare(second.name),
  );
}

function normalizeTeamRow(row: TeamRow, sportType?: string): TeamRow {
  const wins = Number(row.wins ?? 0);
  const draws = Number(row.draws ?? 0);
  const fallbackPoints = sportType === "LOL" ? wins : wins * 3 + draws;

  return {
    ...row,
    wins,
    losses: Number(row.losses ?? 0),
    draws,
    score: Number(row.score ?? 0),
    logoUrl: row.logoUrl ?? null,
    points: Number(row.points ?? fallbackPoints),
    matches: Number(row.matches ?? 0),
    members: Number(row.members ?? 0),
  };
}

function ensureTeam(teams: Map<string, TeamRow>, name: string, stage: string) {
  const existingTeam = teams.get(name);

  if (existingTeam) {
    return existingTeam;
  }

  const team: TeamRow = {
    name,
    logoUrl: null,
    stage,
    wins: 0,
    losses: 0,
    draws: 0,
    score: 0,
    points: 0,
    matches: 0,
    members: 0,
  };

  teams.set(name, team);
  return team;
}

function normalizeTeamName(name?: string | null) {
  const normalized = name?.trim();

  if (!isKnownTeamName(normalized)) {
    return null;
  }

  return normalized;
}

function isKnownTeamName(name?: string | null) {
  const normalized = name?.trim().toLowerCase();

  return (
    !!normalized &&
    !["tbd", "team 1", "team 2", "home team", "away team"].includes(normalized)
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function toCssUrl(value: string) {
  return `url("${value.replace(/"/g, '\\"')}")`;
}
