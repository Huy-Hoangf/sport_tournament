import { WorkbookImportDialog } from "../../excel-import/workbook-import-dialog";

export function TeamImportDialog({ tournamentId, tournamentName, onClose, onImported }: {
  tournamentId: number;
  tournamentName: string;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  return <WorkbookImportDialog kind="teams" initialTournamentId={tournamentId}
    initialTournamentName={tournamentName} onClose={onClose} onImported={onImported} />;
}
