"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { apiRequest } from "../../lib/api/client";
import { MatchTeams } from "../../components/ui/dashboard-ui";
import type { MatchRow, TournamentRow } from "../tournaments/types";
import { formatDateTime } from "../tournaments/utils";
import { loadAllMatchPages } from "./load-tournament-matches";
import { getVotingClosedReason } from "./voting-availability";

type Outcome = "HOME_WIN" | "DRAW" | "AWAY_WIN";
type MyPrediction = { matchId: number; outcome: Outcome };

export function InlineVotePanel({
  tournament,
  matches,
  now,
  onSaved,
}: {
  tournament: TournamentRow;
  matches: MatchRow[];
  now: number | null;
  onSaved: () => void;
}) {
  const [predictions, setPredictions] = useState<MyPrediction[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [limit, setLimit] = useState(4);
  const [filter, setFilter] = useState<"ALL" | "UNVOTED" | "VOTED">("ALL");

  useEffect(() => {
    let active = true;
    loadAllMatchPages((page) =>
      apiRequest<{ items: MyPrediction[]; total: number }>(
        `/predictions?tournamentId=${tournament.id}&mine=true&page=${page}`,
      ),
    )
      .then((items) => {
        if (active) {
          setPredictions(items);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("Cannot load your predictions. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [tournament.id, retry]);

  const selected = new Map(
    predictions?.map((prediction) => [prediction.matchId, prediction.outcome]),
  );
  const visible = matches.filter(
    (match) =>
      filter === "ALL" ||
      (filter === "VOTED" ? selected.has(match.id) : !selected.has(match.id)),
  );

  return (
    <section className="min-w-0 overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d]">
      <header className="border-b border-[#3a4d54] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black uppercase tracking-[0.08em] text-white">
            Upcoming Matches{" "}
            <span className="ml-2 rounded bg-[#143943] px-2 py-1 text-xs text-[#84d8e8]">
              Vote 1X2
            </span>
          </h2>
          <span className="text-xs font-bold text-[#84d8e8]">
            {matches.length} total
          </span>
        </div>
        <p className="mt-2 text-sm text-[#b6cbd1]">
          Choose a winner or draw. Your prediction saves automatically.
        </p>
        <div
          className="mt-3 flex flex-wrap gap-2"
          aria-label="Filter predictions"
        >
          {(
            [
              ["ALL", "All matches"],
              ["UNVOTED", "Not voted"],
              ["VOTED", "Voted"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={predictions === null}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setLimit(4);
              }}
              className={`min-h-10 rounded border px-3 text-xs font-bold disabled:opacity-50 ${filter === value ? "border-[#84d8e8] bg-[#143943] text-[#84d8e8]" : "border-[#3a4d54] text-[#b6cbd1] hover:border-[#84d8e8]"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="m-4 rounded border border-[#5d3037] p-3 text-sm text-[#ffb4a8]"
        >
          {error}{" "}
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="ml-2 min-h-10 underline"
          >
            Try again
          </button>
        </div>
      )}
      <div className="space-y-3 p-4">
        {visible.slice(0, limit).map((match) => (
          <InlineVoteRow
            key={match.id}
            match={match}
            tournament={tournament}
            now={now}
            loading={predictions === null}
            initialOutcome={selected.get(match.id) ?? null}
            onSaved={(outcome) => {
              setPredictions((items) => [
                ...(items ?? []).filter((item) => item.matchId !== match.id),
                { matchId: match.id, outcome },
              ]);
              onSaved();
            }}
          />
        ))}
        {visible.length === 0 && (
          <p className="py-10 text-center text-sm text-[#b6cbd1]">
            {now === null
              ? "Loading matches…"
              : "No upcoming matches in this view."}
          </p>
        )}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#243c43] px-4 py-3 text-xs text-[#b6cbd1]">
        <span>Change your prediction any time before the deadline.</span>
        {visible.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((value) => value + 8)}
            className="flex min-h-10 items-center gap-1 font-bold text-[#84d8e8]"
          >
            View more matches <ChevronRight size={14} />
          </button>
        )}
      </footer>
    </section>
  );
}

function InlineVoteRow({
  match,
  tournament,
  now,
  loading,
  initialOutcome,
  onSaved,
}: {
  match: MatchRow;
  tournament: TournamentRow;
  now: number | null;
  loading: boolean;
  initialOutcome: Outcome | null;
  onSaved: (outcome: Outcome) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const closed = getVotingClosedReason(match, tournament, now);

  async function saveVote(outcome: Outcome) {
    if (inFlight.current || loading || closed) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await apiRequest<MyPrediction>(`/predictions/${match.id}`, {
        method: "PUT",
        body: JSON.stringify({ outcome }),
      });
      setMessage("✓ Prediction saved");
      onSaved(saved.outcome);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Cannot save prediction. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <article className="min-w-0 rounded border border-[#243c43] bg-[#10242b] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#b6cbd1]">
        <span>{formatDateTime(match.scheduledTime)}</span>
        <span className="rounded bg-[#203940] px-2 py-1">
          {match.stageName || match.source}
        </span>
      </div>
      <div className="grid min-w-0 gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_minmax(240px,1fr)] min-[1400px]:items-center">
        <MatchTeams match={match} />
        <fieldset
          disabled={loading || saving || Boolean(closed)}
          className="grid min-w-0 grid-cols-3 gap-2"
        >
          <legend className="sr-only">
            Predict {match.homeName} versus {match.awayName}
          </legend>
          {(
            [
              ["HOME_WIN", "1", match.homeName ?? "Home"],
              ["DRAW", "X", "Draw"],
              ["AWAY_WIN", "2", match.awayName ?? "Away"],
            ] as const
          ).map(([outcome, symbol, label]) => (
            <button
              key={outcome}
              type="button"
              aria-pressed={initialOutcome === outcome}
              onClick={() => void saveVote(outcome)}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center rounded border px-2 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${initialOutcome === outcome ? "border-[#84d8e8] bg-[#143943] text-[#84d8e8] shadow-[0_0_12px_rgba(132,216,232,0.12)]" : "border-[#3a4d54] bg-[#0d252d] text-[#dce8eb] hover:border-[#84d8e8]"}`}
            >
              <span className="break-words">
                [{symbol}] {label}
              </span>
              {initialOutcome === outcome && (
                <span className="mt-1 flex items-center gap-1 text-[10px]">
                  <Check size={12} /> Selected
                </span>
              )}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-[#b6cbd1]">
        <span>Deadline: {formatDateTime(match.deadline)}</span>
        <span role="status" className="text-[#84d8e8]">
          {saving
            ? "Saving…"
            : closed || (loading ? "Loading your prediction…" : message)}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#ffb4a8]">
          {error}
        </p>
      )}
    </article>
  );
}
