"use client";

import { useEffect, useState } from "react";
import { readMatchesState, saveMatchesState } from "../lib/navigation";
import { apiRequest } from "../../api";
import { DashboardStatusBadge, MatchTeams } from "../shared/dashboard-ui";
import type {
  MatchRow,
  TournamentRow,
  TournamentStage,
} from "../tournaments/types";
import { formatDateTime, formatScore } from "../tournaments/utils";
import { MatchEditor } from "./match-editor";
import { PredictionHistory, VoteDialog } from "./predictions";

export type MatchesInitialFilter = {
  tournamentId?: number;
  stageId?: number;
  tournamentName?: string;
  stageName?: string;
};
type MatchPage = {
  items: MatchRow[];
  total: number;
  page: number;
  pageSize: number;
};
const button =
  "rounded border border-[#3a4d54] px-3 py-2 text-sm font-bold hover:border-[#84d8e8] disabled:cursor-not-allowed disabled:opacity-40";
const input =
  "rounded border border-[#3a4d54] bg-[#06161b] px-3 py-2 text-white";

export default function MatchesView({
  initialFilter,
  canManage,
}: {
  initialFilter?: MatchesInitialFilter;
  canManage: boolean;
  onUnavailableFeature?: () => void;
}) {
  const [data, setData] = useState<MatchPage>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [savedNavigation] = useState(() => readMatchesState());
  const [query, setQuery] = useState(savedNavigation?.query ?? ""),
    [status, setStatus] = useState(savedNavigation?.status ?? (canManage ? "ALL" : "OPEN"));
  const [tournamentId, setTournamentId] = useState(
    savedNavigation?.tournamentId ?? String(initialFilter?.tournamentId ?? ""),
  );
  const [stageId, setStageId] = useState(savedNavigation?.stageId ?? String(initialFilter?.stageId ?? ""));
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [stages, setStages] = useState<TournamentStage[]>([]);
  const [page, setPage] = useState(savedNavigation?.page ?? 1),
    [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [editor, setEditor] = useState<{
    match?: MatchRow;
    importing?: boolean;
  } | null>(null);
  const [vote, setVote] = useState<MatchRow | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    saveMatchesState({ query, status, tournamentId, stageId, page });
  }, [query, status, tournamentId, stageId, page]);

  useEffect(() => {
    apiRequest<TournamentRow[]>("/tournaments")
      .then(setTournaments)
      .catch((e) => setError(e.message));
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    if (tournamentId)
      apiRequest<TournamentStage[]>(`/stages?tournamentId=${tournamentId}`)
        .then((items) => {
          if (active) setStages(items);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [tournamentId]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        search: query,
      });
      if (status === "OPEN") params.set("openForVoting", "true");
      else params.set("status", status);
      if (tournamentId) params.set("tournamentId", tournamentId);
      if (stageId) params.set("stageId", stageId);
      apiRequest<MatchPage>(`/matches/page?${params}`)
        .then((next) => {
          if (active) {
            setData(next);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page, query, status, tournamentId, stageId, refresh]);

  function reload() {
    setPage(1);
    setRefresh((value) => value + 1);
  }
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(path, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      setNotice("Saved successfully.");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-6 text-white sm:px-6 xl:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black">Matches</h2>
          <p className="mt-2 text-sm text-[#b6cbd1]">
            {data.total} matches · Search and filter matches
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              className={button}
              onClick={() => setEditor({ importing: true })}
            >
              Import Matches
            </button>
            <button
              className="rounded bg-[#84d8e8] px-4 py-2 font-bold text-[#06161b]"
              onClick={() => setEditor({})}
            >
              + Add Match
            </button>
          </div>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded border border-red-400 p-3 text-red-200"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 text-[#84d8e8]">
          {notice}
        </p>
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-sm">
          Search
          <input
            aria-label="Search matches"
            className={input}
            maxLength={200}
            value={query}
            placeholder="Team, tournament or stage"
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Status
          <select
            className={input}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {!canManage && <option value="OPEN">Open for voting</option>}
            {["ALL", "PENDING", "LIVE", "FINISHED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Tournament
          <select
            className={input}
            value={tournamentId}
            onChange={(e) => {
              setTournamentId(e.target.value);
              setStageId("");
              setStages([]);
              setPage(1);
            }}
          >
            <option value="">All tournaments</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Stage
          <select
            className={input}
            value={stageId}
            onChange={(e) => {
              setStageId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section
        aria-busy={loading || busy}
        className="overflow-hidden rounded border border-[#3a4d54] bg-[#10242b]"
      >
        {data.items.map((match) => {
          const closed =
            Boolean(match.predictionLocked) ||
            match.source === "OPENF1" ||
            match.status !== "PENDING" ||
            new Date(match.deadline).getTime() <= now;
          return (
            <article
              key={match.id}
              className="grid gap-4 border-b border-[#3a4d54] p-4 xl:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_minmax(160px,1fr)_minmax(260px,1.2fr)] xl:items-center"
            >
              <div>
                <MatchTeams match={match} />
                <p className="mt-2 text-xs text-[#b6cbd1]">
                  {match.tournamentName} / {match.stageName}
                </p>
              </div>
              <div>
                <p>{formatDateTime(match.scheduledTime)}</p>
                <p className="mt-1 text-xs text-[#b6cbd1]">
                  Vote deadline: {formatDateTime(match.deadline)}
                </p>
              </div>
              <div>
                <DashboardStatusBadge status={match.status} />
                <p className="mt-2 text-sm">
                  {formatScore(match)} · {closed ? "Locked" : "Unlocked"}
                  {match.predictionLocked ? " (manual)" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManage ? (
                  <>
                    <button
                      className={button}
                      disabled={busy || match.status !== "PENDING"}
                      onClick={() => setEditor({ match })}
                    >
                      Edit
                    </button>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${match.homeName} vs ${match.awayName}?`,
                          )
                        )
                          void mutate(`/matches/${match.id}`, "DELETE");
                      }}
                    >
                      Delete
                    </button>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          `/matches/${match.id}/prediction-lock`,
                          "PUT",
                          { locked: !match.predictionLocked },
                        )
                      }
                    >
                      {match.predictionLocked ? "Unlock" : "Lock"}
                    </button>
                    <button
                      className={button}
                      disabled={busy || closed}
                      onClick={() => setVote(match)}
                    >
                      {match.source === "OPENF1" ? "Voting unavailable" : closed ? "Voting closed" : "Vote / Edit my vote"}
                    </button>
                  </>
                ) : (
                  <button
                    disabled={closed}
                    className={button}
                    onClick={() => setVote(match)}
                  >
                    {match.source === "OPENF1" ? "Voting unavailable" : closed ? "Voting closed" : "Vote / Edit prediction"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {!data.items.length && (
          <p className="p-8 text-center text-[#b6cbd1]">
            {loading
              ? "Loading matches…"
              : status === "OPEN"
                ? "No matches are open for voting. Choose All to see other matches."
                : "No matches found."}
          </p>
        )}
        <div className="flex items-center justify-end gap-3 p-4">
          <button
            className={button}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} / {Math.max(1, Math.ceil(data.total / 20))}
          </span>
          <button
            className={button}
            disabled={page * 20 >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </section>
      <PredictionHistory
        key={tournamentId || "all-tournaments"}
        tournamentId={tournamentId ? Number(tournamentId) : undefined}
        refresh={refresh}
      />
      {editor && (
        <MatchEditor
          match={editor.match}
          importing={editor.importing}
          tournamentId={tournamentId ? Number(tournamentId) : undefined}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setNotice("Saved successfully.");
            reload();
          }}
        />
      )}
      {vote && (
        <VoteDialog
          match={vote}
          onClose={() => setVote(null)}
          onSaved={() => {
            setNotice("Prediction saved.");
            reload();
          }}
        />
      )}
    </div>
  );
}
