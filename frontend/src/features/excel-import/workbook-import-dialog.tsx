"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api/client";
import type { TournamentRow, TournamentStage } from "../tournaments/types";

type Kind = "matches" | "teams";
type Field = "home" | "away" | "kickoff" | "kickoffDate" | "tournament" | "stage" | "startDate" | "endDate" | "teamName" | "memberCode";
type Selection = {
  sheetIndex?: number;
  headerRow?: number;
  columns?: Partial<Record<Field, number>>;
  mode?: "sheet" | "selected";
  teamLayout?: "names" | "opponents";
  teamSource?: string;
  dateOrder?: "DMY" | "MDY";
};
type RowError = { row: number; message: string };
type FilePayload = { fileName: string; contentBase64: string };
type Preview = {
  sheets: { index: number; name: string; usable: boolean }[];
  columns: { index: number; label: string }[];
  selection: Selection;
  required: Field[];
  teamSources: string[];
  tournamentNames: string[];
  needsSheet: boolean;
  needsTeamSource: boolean;
  needsDateOrder: boolean;
  canImport: boolean;
  validCount: number;
  duplicateCount: number;
  existingCount: number;
  errorCount: number;
  messages: string[];
  errors: RowError[];
  sample: { row: number; label: string; tournament?: string; stage?: string; kickoff?: string }[];
};
type ImportResult = { imported: number; rejected?: number; skipped?: number; errors?: RowError[] };

const labels: Record<Field, string> = {
  home: "Home team", away: "Away team", kickoff: "Kickoff time", kickoffDate: "Kickoff date (if separate)",
  tournament: "Tournament", stage: "Stage", startDate: "Tournament start date",
  endDate: "Tournament end date", teamName: "Team name", memberCode: "Member code",
};
const fieldClass = "mt-1 block w-full rounded border border-[#3a4d54] bg-[#06161b] px-3 py-2 text-sm text-white";

function downloadErrors(errors: RowError[]) {
  const blob = new Blob([errors.map(item => `Row ${item.row}: ${item.message}`).join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "import-errors.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function readFile(file: File): Promise<FilePayload> {
  if (!/\.xlsx?$/i.test(file.name) || file.size > 5 * 1024 * 1024)
    throw new Error("Choose an .xlsx or .xls file up to 5 MB.");
  const contentBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Cannot read this Excel file."));
    reader.readAsDataURL(file);
  });
  return { fileName: file.name, contentBase64 };
}

export function WorkbookImportDialog({
  kind, initialTournamentId, initialTournamentName, onClose, onImported, onDownloadTemplate,
}: {
  kind: Kind;
  initialTournamentId?: number;
  initialTournamentName?: string;
  onClose: () => void;
  onImported: (count: number) => void;
  onDownloadTemplate?: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<FilePayload | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selection, setSelection] = useState<Selection>({});
  const [dirty, setDirty] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [tournamentId, setTournamentId] = useState(initialTournamentId);
  const [stageId, setStageId] = useState<number>();
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [stages, setStages] = useState<TournamentStage[]>([]);
  const [destinationError, setDestinationError] = useState("");
  const title = kind === "teams" ? "Import Teams" : "Import Matches";
  const endpoint = `/${kind}/import`;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const chooseDestination = kind === "matches" && selection.mode === "selected";
  useEffect(() => {
    if (!chooseDestination) return;
    let active = true;
    apiRequest<TournamentRow[]>("/tournaments")
      .then(items => { if (active) setTournaments(items); })
      .catch(() => { if (active) setDestinationError("Cannot load tournaments. Close the dialog and try again."); });
    return () => { active = false; };
  }, [chooseDestination]);

  useEffect(() => {
    if (!chooseDestination || !tournamentId) return;
    let active = true;
    apiRequest<TournamentStage[]>(`/stages?tournamentId=${tournamentId}`)
      .then(items => { if (active) setStages(items); })
      .catch(() => { if (active) setDestinationError("Cannot load stages. Choose a tournament and try again."); });
    return () => { active = false; };
  }, [chooseDestination, tournamentId]);

  function changeSelection(change: Partial<Selection>) {
    setSelection(current => ({ ...current, ...change }));
    setDirty(true);
    setResult(null);
  }

  function requestBody(file: FilePayload, nextSelection: Selection) {
    return { ...file, selection: nextSelection, tournamentId, stageId };
  }

  async function inspect(file: FilePayload, nextSelection: Selection) {
    const next = await apiRequest<Preview>(`${endpoint}/preview`, {
      method: "POST", body: JSON.stringify(requestBody(file, nextSelection)),
    });
    setPreview(next);
    setSelection(next.needsSheet ? { ...next.selection, sheetIndex: undefined } : next.selection);
    setShowMapping(current => current || next.required.some(field => !next.selection.columns?.[field]));
    setDirty(false);
  }

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cannot process this Excel file.");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  function upload(file: File | undefined) {
    setPayload(null);
    setPreview(null);
    setResult(null);
    setSelection({});
    setShowMapping(false);
    setDirty(false);
    setError("");
    if (!file) return;
    void run(async () => {
      const next = await readFile(file);
      setPayload(next);
      await inspect(next, {});
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload || result) return;
    void run(async () => {
      if (!preview || dirty || !preview.canImport) {
        await inspect(payload, selection);
        return;
      }
      const saved = await apiRequest<ImportResult>(endpoint, {
        method: "POST", body: JSON.stringify(requestBody(payload, selection)),
      });
      setResult(saved);
      if (saved.imported) onImported(saved.imported);
    });
  }

  const fields: Field[] = kind === "matches"
    ? chooseDestination ? ["home", "away", "kickoff", "kickoffDate"] : ["home", "away", "kickoff", "kickoffDate", "tournament", "stage", "startDate", "endDate"]
    : selection.teamLayout === "opponents" ? ["home", "away", "tournament"] : ["teamName", "memberCode", "tournament"];
  const changingSheet = Boolean(preview) && (selection.sheetIndex !== preview?.selection.sheetIndex || selection.headerRow !== preview?.selection.headerRow);
  const ready = !dirty && Boolean(preview?.canImport);
  const destinationName = tournaments.find(item => item.id === tournamentId)?.name
    ?? (tournamentId === initialTournamentId ? initialTournamentName : undefined)
    ?? (tournamentId ? `Tournament #${tournamentId}` : undefined);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="workbook-import-title"
      className="m-auto max-h-[90vh] w-[min(680px,94vw)] overflow-y-auto rounded-lg border border-[#3a4d54] bg-[#10242b] text-white backdrop:bg-black/70"
      onCancel={event => {
        event.preventDefault();
        if (!inFlight.current) onClose();
      }}
    >
      <form onSubmit={submit} className="space-y-4 p-4 sm:p-6">
        <h2 id="workbook-import-title" className="text-xl font-black">{title}</h2>
        <p className="text-sm text-[#b6cbd1]">Choose an Excel file to review its data before importing.</p>
        {kind === "teams" && destinationName && (
          <p className="break-words text-sm">Destination: <strong>{destinationName}</strong></p>
        )}
        <label className="block text-sm font-bold">
          Excel file
          <input type="file" accept=".xlsx,.xls" disabled={busy} className={fieldClass}
            onChange={event => upload(event.target.files?.[0])} />
        </label>
        {onDownloadTemplate && (
          <button type="button" onClick={() => void onDownloadTemplate().catch(cause => setError(cause.message))}
            className="min-h-10 text-sm font-bold text-[#84d8e8] underline">
            Download Excel template
          </button>
        )}
        {error && <p role="alert" className="break-words rounded border border-[#764348] p-3 text-sm text-[#ffb4a8]">{error}</p>}
        {preview && !result && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {preview.sheets.length > 1 && (
                <label className="text-sm font-bold">
                  Worksheet
                  <select value={selection.sheetIndex ?? ""} disabled={busy} className={fieldClass}
                    onChange={event => changeSelection({ sheetIndex: event.target.value === "" ? undefined : Number(event.target.value), headerRow: undefined, columns: undefined, mode: undefined, teamLayout: undefined, teamSource: undefined })}>
                    <option value="">Choose worksheet</option>
                    {preview.sheets.map(sheet => <option key={sheet.index} value={sheet.index} disabled={!sheet.usable}>{sheet.name}{sheet.usable ? "" : " (outside size limits)"}</option>)}
                  </select>
                </label>
              )}
              {kind === "matches" && (
                <label className="text-sm font-bold">
                  Destination
                  <select value={selection.mode ?? "sheet"} disabled={busy} className={fieldClass}
                    onChange={event => changeSelection({ mode: event.target.value === "selected" ? "selected" : "sheet" })}>
                    <option value="sheet">Use tournament and stage from the file</option>
                    <option value="selected">Use a selected tournament and stage</option>
                  </select>
                </label>
              )}
              {chooseDestination && (
                <>
                  <label className="text-sm font-bold">
                    Tournament
                    <select value={tournamentId ?? ""} disabled={busy} className={fieldClass} onChange={event => {
                      setTournamentId(event.target.value ? Number(event.target.value) : undefined);
                      setStageId(undefined);
                      setStages([]);
                      setDestinationError("");
                      setDirty(true);
                    }}>
                      <option value="">Select tournament</option>
                      {tournaments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold">
                    Stage
                    <select value={stageId ?? ""} disabled={busy || !tournamentId} className={fieldClass} onChange={event => {
                      setStageId(event.target.value ? Number(event.target.value) : undefined);
                      setDirty(true);
                    }}>
                      <option value="">Select stage</option>
                      {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                    </select>
                  </label>
                </>
              )}
              {kind === "teams" && preview.teamSources.length > 1 && (
                <label className="text-sm font-bold">
                  Take teams from
                  <select value={selection.teamSource ?? ""} disabled={busy || changingSheet} className={fieldClass}
                    onChange={event => changeSelection({ teamSource: event.target.value || undefined })}>
                    <option value="">Select tournament from the worksheet</option>
                    {preview.teamSources.map(name => <option key={name}>{name}</option>)}
                  </select>
                </label>
              )}
              {kind === "matches" && (preview.needsDateOrder || selection.dateOrder || showMapping) && (
                <label className="text-sm font-bold">
                  Date format
                  <select value={selection.dateOrder ?? ""} disabled={busy} className={fieldClass}
                    onChange={event => changeSelection({ dateOrder: event.target.value === "DMY" ? "DMY" : event.target.value === "MDY" ? "MDY" : undefined })}>
                    <option value="">Detect automatically</option>
                    <option value="DMY">Day / Month / Year</option>
                    <option value="MDY">Month / Day / Year</option>
                  </select>
                </label>
              )}
            </div>
            {destinationError && chooseDestination && <p role="alert" className="text-sm text-[#ffb4a8]">{destinationError}</p>}
            <button type="button" aria-expanded={showMapping} onClick={() => setShowMapping(value => !value)}
              className="min-h-10 text-sm font-bold text-[#84d8e8] underline">
              {showMapping ? "Hide column mapping" : "Change column mapping"}
            </button>
            {showMapping && (
              <fieldset className="grid gap-3 rounded border border-[#3a4d54] p-3 sm:grid-cols-2" disabled={busy}>
                <legend className="px-1 text-sm font-bold">Column mapping</legend>
                <label className="text-sm font-bold">
                  Header row (0 if there is no header)
                  <input type="number" min="0" max="50" value={selection.headerRow ?? ""} className={fieldClass}
                    onChange={event => changeSelection({ headerRow: event.target.value === "" ? undefined : Number(event.target.value), columns: undefined })} />
                </label>
                {kind === "teams" && (
                  <label className="text-sm font-bold">
                    Team columns
                    <select value={selection.teamLayout} className={fieldClass}
                      onChange={event => changeSelection({ teamLayout: event.target.value === "opponents" ? "opponents" : "names" })}>
                      <option value="names">One team name column</option>
                      <option value="opponents">Home and away columns</option>
                    </select>
                  </label>
                )}
                {changingSheet && <p className="text-sm text-[#b6cbd1] sm:col-span-2">Update the preview to load columns for this sheet and header row.</p>}
                {!changingSheet && fields.map(field => (
                  <label key={field} className="text-sm font-bold">
                    {labels[field]}
                    <select value={selection.columns?.[field] ?? ""} className={fieldClass}
                      onChange={event => changeSelection({ columns: { ...selection.columns, [field]: event.target.value ? Number(event.target.value) : undefined } })}>
                      <option value="">{preview.required.includes(field) ? "Choose column" : "None"}</option>
                      {preview.columns.map(column => <option key={column.index} value={column.index}>{column.index}. {column.label}</option>)}
                    </select>
                  </label>
                ))}
              </fieldset>
            )}
            {!dirty && <PreviewSummary preview={preview} kind={kind} />}
          </div>
        )}
        {result && (
          <section role="status" className="rounded border border-[#3a4d54] p-3 text-sm">
            <p className="font-bold">{result.imported} imported{result.skipped ? ` / ${result.skipped} existing ${kind} skipped` : ""}{result.rejected ? ` / ${result.rejected} rejected` : ""}</p>
            {result.errors?.length ? (
              <>
                <RowErrors errors={result.errors} />
                <button type="button" onClick={() => downloadErrors(result.errors ?? [])} className="mt-2 min-h-10 font-bold text-[#84d8e8] underline">Download error log</button>
              </>
            ) : null}
          </section>
        )}
        <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-3 border-t border-[#3a4d54] bg-[#10242b] px-4 pt-3 pb-1 sm:-mx-6 sm:px-6">
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded border border-[#3a4d54] px-4 py-2 text-sm font-bold disabled:opacity-60">Close</button>
          {!result && (
            <button type="submit" disabled={!payload || busy} className="min-h-11 rounded bg-[#84d8e8] px-4 py-2 text-sm font-black text-[#06161b] disabled:opacity-60">
              {busy ? "Working..." : ready ? title : "Update preview"}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}

function RowErrors({ errors }: { errors: RowError[] }) {
  return (
    <ul className="mt-2 max-h-40 space-y-1 overflow-auto break-words text-sm text-[#ffb4a8]">
      {errors.map(item => <li key={item.row}>Row {item.row}: {item.message}</li>)}
    </ul>
  );
}

function PreviewSummary({ preview, kind }: { preview: Preview; kind: Kind }) {
  return (
    <section aria-label="Import preview" aria-live="polite" className="rounded border border-[#3a4d54] p-3 text-sm">
      <p className="font-bold">
        {preview.validCount} {kind} ready / {preview.duplicateCount} duplicates in the file / {preview.errorCount} rows to fix
        {preview.existingCount ? ` / ${preview.existingCount} already saved` : ""}
      </p>
      {preview.messages.map(message => <p key={message} className="mt-2 text-[#ffb4a8]">{message}</p>)}
      <RowErrors errors={preview.errors} />
      {preview.errorCount > preview.errors.length && <p className="mt-2">Showing the first {preview.errors.length} errors.</p>}
      {preview.tournamentNames.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer font-bold text-[#84d8e8]">Tournaments in this file ({preview.tournamentNames.length})</summary>
          <ul className="mt-2 max-h-32 space-y-1 overflow-auto break-words text-[#b6cbd1]">
            {preview.tournamentNames.map(name => <li key={name}>{name}</li>)}
          </ul>
        </details>
      )}
      {preview.sample.length > 0 && (
        <ul className="mt-2 space-y-1 break-words text-[#b6cbd1]">
          {preview.sample.map(item => (
            <li key={`${item.row}-${item.label}`}>
              {item.label}
              {item.tournament ? ` / ${item.tournament}` : ""}
              {item.stage ? ` / ${item.stage}` : ""}
              {item.kickoff ? ` / ${new Date(item.kickoff).toLocaleString()}` : ""}
            </li>
          ))}
        </ul>
      )}
      {kind === "matches" && <p className="mt-2 text-xs text-[#b6cbd1]">Kickoff times without a timezone are read as Vietnam time (UTC+07).</p>}
    </section>
  );
}
