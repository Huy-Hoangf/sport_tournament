export function TournamentSetup({ teamCount, matchCount, onManageTeams, onCreateMatch, onImportMatches, canRegisterTeam }: {
  teamCount: number | null;
  matchCount: number | null;
  onManageTeams: () => void;
  onCreateMatch: () => void;
  onImportMatches: () => void;
  canRegisterTeam: boolean;
}) {
  const button = "rounded border border-[#52757e] px-4 py-2 text-sm font-bold text-[#dce8eb] hover:border-[#84d8e8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84d8e8]";
  return (
    <section aria-labelledby="tournament-setup-title" className="border-b border-[#314850] bg-[#0d252d] px-4 py-6 sm:px-7 lg:px-8">
      <h3 id="tournament-setup-title" className="text-xl font-black text-white">Tournament setup</h3>
      <p className="mt-2 text-sm text-[#c8d6db]">Set up your tournament at your own pace. Your changes are saved as you go.</p>
      <ol className="mt-5 grid gap-4 md:grid-cols-3">
        <li className="min-w-0 border-t border-[#52757e] pt-3">
          <p className="font-bold text-white">Tournament details</p>
          <p className="mt-1 text-sm text-[#c8d6db]">Saved</p>
        </li>
        <li className="min-w-0 border-t border-[#52757e] pt-3">
          <p className="font-bold text-white">Teams and players</p>
          <p className="mt-1 text-sm text-[#c8d6db]">{teamCount === null ? "Count unavailable" : `${teamCount} teams`}</p>
          {canRegisterTeam ? (
            <button type="button" className={`${button} mt-3`} onClick={onManageTeams}>Add teams and players</button>
          ) : (
            <p className="mt-3 text-sm text-[#c8d6db]">Teams can only be registered before the tournament starts.</p>
          )}
        </li>
        <li className="min-w-0 border-t border-[#52757e] pt-3">
          <p className="font-bold text-white">Match schedule</p>
          <p className="mt-1 text-sm text-[#c8d6db]">{matchCount === null ? "Count unavailable" : `${matchCount} matches`}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={button} onClick={onCreateMatch}>Create match</button>
            <button type="button" className={button} onClick={onImportMatches}>Import matches</button>
          </div>
        </li>
      </ol>
    </section>
  );
}
