import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { apiRequest } from "../../api";
import type { TournamentRow } from "../tournaments/types";
import type { LeaderboardEntry } from "./types";

export function LeaderboardView() {
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<TournamentRow[]>("/tournaments")
      .then((rows) => {
        if (active) setTournaments(rows);
      })
      .catch(() => {
        if (active) setTournaments([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const path = tournamentId
      ? `/leaderboard?tournamentId=${tournamentId}`
      : "/leaderboard";
    apiRequest<LeaderboardEntry[]>(path)
      .then((rows) => {
        if (active) {
          setEntries(rows);
          setError("");
          setIsLoading(false);
        }
      })
      .catch((caught) => {
        if (active) {
          setEntries([]);
          setError(caught instanceof Error ? caught.message : "Cannot load leaderboard.");
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [tournamentId]);

  return (
    <section className="min-w-0 space-y-6 p-4 sm:p-7 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#84d8e8]">
            Predictions
          </p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-black text-white">
            <Trophy aria-hidden="true" size={28} /> Leaderboard
          </h1>
          <p className="mt-2 text-sm text-[#9fb2b8]">
            Points from completed matches and actual results.
          </p>
        </div>
        <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-wide text-[#b7d2d8]">
          Tournament
          <select
            value={tournamentId ?? ""}
            onChange={(event) => {
              setIsLoading(true);
              setTournamentId(event.target.value ? Number(event.target.value) : null);
            }}
            className="min-w-52 border border-[#41636d] bg-[#0d252d] px-3 py-2 text-sm font-semibold normal-case text-white"
          >
            <option value="">All tournaments</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto border border-[#3a4d54] bg-[#0d252d]">
        {isLoading ? (
          <p className="p-8 text-center text-[#9fb2b8]">Loading leaderboard…</p>
        ) : error ? (
          <p role="alert" className="p-8 text-center text-[#ffb4a8]">{error}</p>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-[#9fb2b8]">No predictions yet.</p>
        ) : (
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-[#3a4d54] text-xs uppercase tracking-wide text-[#9fb2b8]">
              <tr>
                <th scope="col" className="px-5 py-4">Rank</th>
                <th scope="col" className="px-5 py-4">Player</th>
                <th scope="col" className="px-5 py-4 text-right">Correct</th>
                <th scope="col" className="px-5 py-4 text-right">Votes</th>
                <th scope="col" className="px-5 py-4 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#243c43]">
              {entries.map((entry, index) => (
                <tr key={entry.userId}>
                  <td className="px-5 py-4 font-black text-[#84d8e8]">{index + 1}</td>
                  <td className="px-5 py-4 font-semibold text-white">{entry.fullName}</td>
                  <td className="px-5 py-4 text-right">{entry.correctPredictions}</td>
                  <td className="px-5 py-4 text-right">{entry.totalPredictions}</td>
                  <td className="px-5 py-4 text-right font-black text-white">{entry.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
