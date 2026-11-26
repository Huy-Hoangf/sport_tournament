import { useEffect, useRef, useState, type FormEvent } from "react";

import { apiRequest } from "../../../lib/api/client";

export function TeamImportDialog({ tournamentId, onClose, onImported }: {
  tournamentId: number;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    if (!file || !file.name.toLowerCase().endsWith(".xlsx") || file.size > 5 * 1024 * 1024) {
      setError("Choose an .xlsx file up to 5 MB.");
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Cannot read the file."));
        reader.readAsDataURL(file);
      });
      const result = await apiRequest<{ imported: number }>("/teams/import", {
        method: "POST",
        body: JSON.stringify({ tournamentId, fileName: file.name, contentBase64 }),
      });
      onImported(result.imported);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cannot import teams.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="team-import-title"
      className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded border border-[#3a4d54] bg-[#0d252d] p-5 text-[#dce8eb] backdrop:bg-black/70"
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting.current) onClose();
      }}
    >
      <form onSubmit={submit}>
        <h2 id="team-import-title" className="text-xl font-black text-white">Import Teams</h2>
        <label htmlFor="team-import-file" className="mt-4 block text-sm font-bold">Excel file</label>
        <p id="team-import-help" className="mt-1 text-sm text-[#b6cbd1]">
          Use an Excel .xlsx file with a Team Name column. Member Code is optional.
          Use one row per player and repeat the team name for each player.
        </p>
        <input
          id="team-import-file"
          type="file"
          accept=".xlsx"
          aria-describedby="team-import-help"
          disabled={busy}
          className="mt-3 block w-full rounded border border-[#3a4d54] p-2 text-sm"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError("");
          }}
        />
        {error && <p role="alert" className="mt-3 text-sm text-[#ff9d9d]">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="rounded border border-[#3a4d54] px-4 py-2 text-sm font-bold disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" disabled={busy || !file} className="rounded bg-[#84d8e8] px-4 py-2 text-sm font-bold text-[#06161b] disabled:opacity-60">
            {busy ? "Importing..." : "Import Teams"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
