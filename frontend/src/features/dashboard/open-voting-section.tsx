import { MatchTeams } from "../../components/ui/dashboard-ui";
import type { MatchRow } from "../tournaments/types";
import { formatDateTime } from "../tournaments/utils";

export function OpenVotingSection({ matches, onVote }: {
  matches: MatchRow[];
  onVote: (match: MatchRow) => void;
}) {
  return (
    <section aria-labelledby="open-voting-title" className="rounded-lg border border-[#3a4d54] bg-[#0d252d]">
      <h2 id="open-voting-title" className="px-4 pb-3 pt-4 text-xl font-black text-white sm:px-5">
        Open for voting
      </h2>
      {matches.length === 0 ? (
        <p className="px-4 pb-5 text-sm text-[#b6cbd1] sm:px-5">No matches are open for voting right now.</p>
      ) : (
        <ul className="divide-y divide-[#29444d]">
          {matches.map((match) => (
            <li key={match.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
              <div className="min-w-0">
                <p className="mb-2 break-words text-xs font-bold text-[#b6cbd1]">{match.tournamentName}</p>
                <div className="max-w-lg text-sm">
                  <MatchTeams match={match} wrapNames />
                </div>
                <p className="mt-2 text-sm text-[#dce8eb]">
                  Voting closes <time dateTime={match.deadline}>{formatDateTime(match.deadline)}</time>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onVote(match)}
                aria-label={`Vote now: ${match.homeName} vs ${match.awayName}`}
                className="min-h-11 rounded bg-[#84d8e8] px-4 py-2 text-sm font-black text-[#06161b] hover:bg-[#a6e5ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84d8e8]"
              >
                Vote now
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
