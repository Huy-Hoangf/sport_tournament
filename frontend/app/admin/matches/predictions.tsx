"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest } from "../../api";
import type { MatchRow } from "../tournaments/types";

type Prediction = {
  id: number;
  matchId: number;
  player: string;
  match: string;
  stage: string;
  homeScore: number;
  awayScore: number;
  prediction: string;
  status: string;
  points: number | null;
  updatedAt: string;
};
type PredictionPage = {
  items: Prediction[];
  total: number;
  page: number;
  pageSize: number;
};

export function PredictionHistory({
  tournamentId,
  refresh = 0,
}: {
  tournamentId?: number;
  refresh?: number;
}) {
  const [data, setData] = useState<PredictionPage>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 100,
  });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    apiRequest<PredictionPage>(
      `/predictions?page=${page}${tournamentId ? `&tournamentId=${tournamentId}` : ""}`,
    )
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
    return () => {
      active = false;
    };
  }, [page, tournamentId, refresh]);
  const visible = data.items.filter((p) =>
    `${p.player} ${p.match} ${p.stage}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="mt-6 rounded border border-[#3a4d54] bg-[#10242b] p-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black">Predictions · {data.total}</h3>
        <label className="text-sm">
          Search this page
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ml-2 rounded border border-[#3a4d54] bg-[#06161b] px-3 py-2"
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="py-3 text-red-200">
          {error}
        </p>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#3a4d54] text-[#84d8e8]">
              {[
                "Player",
                "Match / Stage",
                "Prediction",
                "Status",
                "Points",
              ].map((h) => (
                <th key={h} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id} className="border-b border-[#243c43]">
                <td className="p-3">{p.player}</td>
                <td className="p-3">
                  {p.match}
                  <div className="text-xs text-[#b6cbd1]">{p.stage}</div>
                </td>
                <td className="p-3 font-bold">{p.prediction}</td>
                <td className="p-3">{p.status}</td>
                <td className="p-3">{p.points ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <p className="py-5 text-[#b6cbd1]">
          {loading ? "Loading predictions…" : "No predictions found."}
        </p>
      )}
      <div className="mt-3 flex items-center justify-end gap-3">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border px-3 py-2 disabled:opacity-40"
        >
          Previous predictions
        </button>
        <span>Page {page}</span>
        <button
          disabled={page * 100 >= data.total}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border px-3 py-2 disabled:opacity-40"
        >
          Next predictions
        </button>
      </div>
    </section>
  );
}

export function VoteDialog({
  match,
  onClose,
  onSaved,
}: {
  match: MatchRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [home, setHome] = useState(0),
    [away, setAway] = useState(0);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    apiRequest<PredictionPage>(`/predictions?matchId=${match.id}`)
      .then((data) => {
        if (active && data.items[0]) {
          setHome(data.items[0].homeScore);
          setAway(data.items[0].awayScore);
          setSaved(true);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [match.id]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/predictions/${match.id}`, {
        method: "PUT",
        body: JSON.stringify({ homeScore: home, awayScore: away }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot save vote.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="vote-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      className="m-auto w-[min(520px,94vw)] rounded-lg border border-[#3a4d54] bg-[#10242b] p-6 text-white backdrop:bg-black/70"
    >
      <form onSubmit={submit} className="grid gap-4">
        <h3 id="vote-title" className="text-xl font-black">
          {saved ? "Update prediction" : "Vote"}
        </h3>
        <p>
          {match.homeName} vs {match.awayName}
        </p>
        <p className="text-sm text-[#b6cbd1]">
          Deadline: {new Date(match.deadline).toLocaleString()}
        </p>
        {error && (
          <p role="alert" className="text-red-200">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <label>
            {match.homeName}
            <input
              aria-label="Home score"
              required
              type="number"
              min={0}
              max={100}
              value={home}
              disabled={busy || loading}
              onChange={(e) => setHome(Number(e.target.value))}
              className="w-full rounded border border-[#3a4d54] bg-[#06161b] p-3"
            />
          </label>
          <label>
            {match.awayName}
            <input
              aria-label="Away score"
              required
              type="number"
              min={0}
              max={100}
              value={away}
              disabled={busy || loading}
              onChange={(e) => setAway(Number(e.target.value))}
              className="w-full rounded border border-[#3a4d54] bg-[#06161b] p-3"
            />
          </label>
        </div>
        <p className="text-sm text-[#b6cbd1]">
          You can change your prediction before voting is locked.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded border px-4 py-2"
          >
            Close
          </button>
          <button
            disabled={busy || loading}
            className="rounded bg-[#84d8e8] px-4 py-2 font-bold text-[#06161b] disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save prediction"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
