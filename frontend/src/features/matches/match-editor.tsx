"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { API_BASE_URL, apiRequest } from "../../lib/api/client";
import { WorkbookImportDialog } from "../excel-import/workbook-import-dialog";
import type {
  MatchRow,
  TournamentRow,
  TournamentStage,
} from "../tournaments/types";

const fieldClass =
  "w-full rounded border border-[#3a4d54] bg-[#06161b] px-3 py-2 text-white";

export async function downloadTemplate() {
  const response = await fetch(`${API_BASE_URL}/matches/template`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}`,
    },
  });
  if (!response.ok) throw new Error("Cannot download template.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "matches-template.xlsx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type MatchEditorProps = {
  match?: MatchRow;
  importing?: boolean;
  tournamentId?: number;
  onClose: () => void;
  onSaved: () => void;
};

export function MatchEditor(props: MatchEditorProps) {
  return props.importing ? (
    <WorkbookImportDialog kind="matches" initialTournamentId={props.tournamentId}
      onClose={props.onClose} onImported={props.onSaved} onDownloadTemplate={downloadTemplate} />
  ) : <MatchForm {...props} />;
}

function MatchForm({ match, tournamentId: initialTournamentId, onClose, onSaved }: MatchEditorProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [tournamentId, setTournamentId] = useState(
    String(match?.tournamentId ?? initialTournamentId ?? ""),
  );
  const [stages, setStages] = useState<TournamentStage[]>([]);
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [stageId, setStageId] = useState(String(match?.stageId ?? ""));
  const [home, setHome] = useState(String(match?.homeTeamId ?? ""));
  const [away, setAway] = useState(String(match?.awayTeamId ?? ""));
  const [time, setTime] = useState(() => {
    const date = new Date(match?.scheduledTime ?? Date.now() + 86400000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [minutes, setMinutes] = useState(match?.lockMinutes ?? 15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
    apiRequest<TournamentRow[]>("/tournaments")
      .then(setTournaments)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let active = true;
    if (tournamentId)
      Promise.all([
        apiRequest<TournamentStage[]>(`/stages?tournamentId=${tournamentId}`),
        apiRequest<{ id: number; name: string }[]>(
          `/teams?tournamentId=${tournamentId}`,
        ),
      ])
        .then(([nextStages, nextTeams]) => {
          if (active) {
            setStages(nextStages);
            setTeams(nextTeams);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [tournamentId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!Number.isFinite(new Date(time).getTime()))
        throw new Error("Choose a valid kickoff date and time.");
      await apiRequest(match ? `/matches/${match.id}` : "/matches", {
        method: match ? "PUT" : "POST",
        body: JSON.stringify({
          tournamentId: Number(tournamentId),
          stageId: Number(stageId),
          homeTeamId: Number(home),
          awayTeamId: Number(away),
          scheduledTime: new Date(time).toISOString(),
          lockMinutes: minutes,
        }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot save match.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      aria-labelledby="match-editor-title"
      className="m-auto max-h-[90vh] w-[min(620px,94vw)] overflow-y-auto rounded-lg border border-[#3a4d54] bg-[#10242b] p-6 text-white backdrop:bg-black/70"
    >
      <form onSubmit={submit} className="grid gap-4">
        <h3 id="match-editor-title" className="text-xl font-black">
          {match ? "Edit Match" : "Create Match"}
        </h3>
        {error && (
          <p
            role="alert"
            className="rounded border border-red-400 p-3 text-red-200"
          >
            {error}
          </p>
        )}
        <label>
          Tournament
          <select
            required
            className={fieldClass}
            value={tournamentId}
            disabled={busy}
            onChange={(e) => {
              setTournamentId(e.target.value);
              setStages([]);
              setTeams([]);
              setStageId("");
              setHome("");
              setAway("");
            }}
          >
            <option value="">Select tournament</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stage
          <select
            required
            className={fieldClass}
            value={stageId}
            disabled={busy}
            onChange={(e) => setStageId(e.target.value)}
          >
            <option value="">Select stage</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Home Team", home, setHome],
            ["Away Team", away, setAway],
          ].map(([label, value, setter]) => (
            <label key={String(label)}>
              {String(label)}
              <select
                required
                className={fieldClass}
                value={String(value)}
                disabled={busy}
                onChange={(e) =>
                  (setter as (value: string) => void)(e.target.value)
                }
              >
                <option value="">Select team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label>
          Kickoff (your local time)
          <input
            required
            type="datetime-local"
            className={fieldClass}
            value={time}
            disabled={busy}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label>
          Lock minutes before kickoff
          <input
            required
            min={0}
            max={10080}
            type="number"
            className={fieldClass}
            value={minutes}
            disabled={busy}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            className="rounded border px-4 py-2"
            onClick={onClose}
          >
            Close
          </button>
          <button
            disabled={busy}
            className="rounded bg-[#84d8e8] px-4 py-2 font-bold text-[#06161b] disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save Match"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
