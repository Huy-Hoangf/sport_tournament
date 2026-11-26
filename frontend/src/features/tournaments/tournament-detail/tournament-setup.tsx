export function TournamentSetup({ teamCount, matchCount, onManageTeams, onCreateMatch, onImportTeams, canRegisterTeam }: {
  teamCount: number | null;
  matchCount: number | null;
  onManageTeams: () => void;
  onCreateMatch: () => void;
  onImportTeams: () => void;
  canRegisterTeam: boolean;
}) {
  const button = "inline-flex min-h-10 items-center justify-center rounded border border-[#3a4d54] px-3 py-2 text-xs font-bold text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84d8e8]";
  return (
    <section aria-labelledby="tournament-setup-title" className="grid gap-5 pt-5 md:grid-cols-[1.1fr_1fr_1.1fr]">
      <div className="min-w-0">
        <h3 id="tournament-setup-title" className="text-xs font-black uppercase tracking-[0.06em] text-white">Tournament setup</h3>
        <p className="mt-2 max-w-64 text-xs leading-relaxed text-[#b6cbd1]">Set up your tournament at your own pace. Your changes are saved as you go.</p>
        <p className="mt-2 text-xs font-bold text-[#84d8e8]">Details: Saved</p>
      </div>
      <div className="min-w-0">
          <h3 className="text-xs font-black uppercase tracking-[0.06em] text-white">Teams and players</h3>
          <p className="mt-2 text-xs text-[#b6cbd1]">{teamCount === null ? "Count unavailable" : `${teamCount} teams`}</p>
          {canRegisterTeam ? (
            <button type="button" className={`${button} mt-3`} onClick={onManageTeams}>Add teams and players</button>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-[#b6cbd1]">Teams can only be registered before the tournament starts.</p>
          )}
      </div>
      <div className="min-w-0">
          <h3 className="text-xs font-black uppercase tracking-[0.06em] text-white">Match schedule</h3>
          <p className="mt-2 text-xs text-[#b6cbd1]">{matchCount === null ? "Count unavailable" : `${matchCount} matches`}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={button} onClick={onCreateMatch}>Create match</button>
            {canRegisterTeam && <button type="button" className={`${button} bg-[#143943] text-[#84d8e8]`} onClick={onImportTeams}>Import Teams</button>}
          </div>
      </div>
    </section>
  );
}
