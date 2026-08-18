import { Fragment, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { AdminSelect } from "../shared/admin-select";
import {
  DashboardPanelTitle,
  DashboardSourceBadge,
  DashboardStatusBadge,
} from "../shared/dashboard-ui";
import type { MatchRow, TournamentRow, TournamentStatusFilter } from "./types";
export function TournamentManagementTable({
  title,
  total,
  tournaments,
  emptyMessage,
  tournamentMatches,
  selectedTournamentId,
  onSelectTournament,
  isAdmin,
  onEditTournament,
  onDeleteTournament,
}: {
  title: string;
  total: number;
  tournaments: TournamentRow[];
  emptyMessage: string;
  tournamentMatches: MatchRow[];
  selectedTournamentId: number | null;
  onSelectTournament: React.Dispatch<React.SetStateAction<number | null>>;
  isAdmin: boolean;
  onEditTournament: (tournament: TournamentRow) => void;
  onDeleteTournament: (tournament: TournamentRow) => void;
}) {
  const pageSize = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] =
    useState<TournamentStatusFilter>("ALL");
  const filteredTournaments = tournaments.filter((tournament) => {
    const status = tournament.status.toUpperCase();

    if (statusFilter === "ALL") {
      return true;
    }

    if (statusFilter === "COMPLETED") {
      return status === "COMPLETED" || status === "CANCELLED";
    }

    return status === statusFilter;
  });
  const filteredTotal = filteredTournaments.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const firstVisibleIndex = (activePage - 1) * pageSize;
  // Keep each tournament table paginated so iPad/mobile layouts do not clip long imported lists.
  const visibleTournaments = filteredTournaments.slice(
    firstVisibleIndex,
    firstVisibleIndex + pageSize,
  );
  const pageNumbers = Array.from(
    { length: totalPages },
    (_, index) => index + 1,
  );

  function changePage(page: number) {
    const nextPage = Math.min(Math.max(page, 1), totalPages);

    if (nextPage === activePage) {
      return;
    }

    setCurrentPage(nextPage);
    onSelectTournament(null);
  }

  function changeStatusFilter(filter: TournamentStatusFilter) {
    setStatusFilter(filter);
    setCurrentPage(1);
    onSelectTournament(null);
  }

  return (
    <section className="overflow-hidden rounded border border-[#3a4d54] bg-[#0d252d]">
      <DashboardPanelTitle
        title={title}
        icon={
          <AdminSelect
            value={statusFilter}
            options={[
              { value: "ALL", label: "All statuses" },
              { value: "ACTIVE", label: "Ongoing" },
              { value: "UPCOMING", label: "Upcoming" },
              { value: "COMPLETED", label: "Completed" },
            ]}
            onChange={(nextValue) =>
              changeStatusFilter(nextValue as TournamentStatusFilter)
            }
            ariaLabel={`Filter ${title} by status`}
            className="w-full min-w-[150px] sm:w-[150px]"
            icon={<Filter size={16} />}
            size="compact"
          />
        }
        right={
          filteredTotal > 0
            ? `Showing ${firstVisibleIndex + 1}-${Math.min(
                firstVisibleIndex + pageSize,
                filteredTotal,
              )} of ${filteredTotal}${statusFilter === "ALL" ? "" : ` / ${total}`}`
            : statusFilter === "ALL"
              ? "0 total"
              : `0 of ${total}`
        }
      />
      <div className="divide-y divide-[#243c43] xl:hidden">
        {visibleTournaments.map((tournament) => {
          const matches = tournamentMatches.filter(
            (match) => match.tournamentId === tournament.id,
          );
          const deleteAllowed = canDeleteTournament(tournament);

          return (
            <article key={tournament.id} className="bg-[#0d252d]">
              <button
                type="button"
                onClick={() => onSelectTournament(tournament.id)}
                className={`w-full px-4 py-4 text-left transition ${
                  selectedTournamentId === tournament.id
                    ? "bg-[#12333c]"
                    : "hover:bg-[#102d35]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#143942] text-[#84d8e8]">
                    <ShieldCheck size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-base font-black text-white">
                      {tournament.name}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[#07181d] px-2 py-1 text-xs font-black uppercase text-[#dce8eb]">
                        {tournament.sportType ?? "FOOTBALL"}
                      </span>
                      <DashboardStatusBadge status={tournament.status} />
                      <DashboardSourceBadge source={tournament.source} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded border border-[#243c43] bg-[#07181d] p-3">
                    <p className="uppercase tracking-[0.08em] text-[#789098]">
                      Teams
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {tournament.teams.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded border border-[#243c43] bg-[#07181d] p-3">
                    <p className="uppercase tracking-[0.08em] text-[#789098]">
                      Matches
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {tournament.matches.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded border border-[#243c43] bg-[#07181d] p-3">
                    <p className="uppercase tracking-[0.08em] text-[#789098]">
                      Details
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {matches.length}
                    </p>
                  </div>
                </div>
              </button>

              {isAdmin && (
                <div className="flex items-center gap-2 border-t border-[#243c43] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onEditTournament(tournament)}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded border border-[#3a4d54] text-sm font-black text-[#84d8e8] transition hover:border-[#84d8e8] hover:text-white"
                  >
                    <Pencil size={16} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTournament(tournament)}
                    disabled={!deleteAllowed}
                    title={
                      deleteAllowed
                        ? "Delete tournament"
                        : "Only completed tournaments can be deleted"
                    }
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded border border-[#ff6b6b99] bg-[#35171b] text-sm font-black text-[#ff8a8a] transition hover:border-[#ff6b6b] hover:text-[#ffb0b0] disabled:cursor-not-allowed disabled:border-[#3a4d54] disabled:bg-[#10242b] disabled:text-[#789098]"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              )}

            </article>
          );
        })}

        {visibleTournaments.length === 0 && (
          <div className="px-4 py-10 text-center text-[#9fb2b8]">
            {emptyMessage}
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[980px] table-fixed text-left">
          <thead className="h-[65px] border-b border-[#3a4d54] bg-[#14272e] text-xs uppercase tracking-[0.08em] text-[#d5e0e3]">
            <tr>
              <th className="px-6 py-4">Tournament Name</th>
              <th className="w-28 px-4 py-4">Sport</th>
              <th className="w-32 px-4 py-4">Status</th>
              <th className="w-24 px-4 py-4">Teams</th>
              <th className="w-24 px-4 py-4">Matches</th>
              <th className="w-44 px-4 py-4">Source</th>
              <th className="w-28 px-4 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleTournaments.map((tournament) => {
              const isSelected = selectedTournamentId === tournament.id;
              const deleteAllowed = canDeleteTournament(tournament);

              return (
                <Fragment key={tournament.id}>
                  <tr
                    onClick={() => onSelectTournament(tournament.id)}
                    className={`h-[73px] cursor-pointer border-b border-[#243c43] text-sm transition hover:bg-[#102d35] ${
                      isSelected ? "bg-[#12333c]" : ""
                    }`}
                  >
                    <td className="px-6 font-black text-white">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center bg-[#143942] text-[#84d8e8]">
                          <ShieldCheck size={17} />
                        </span>
                        <span className="min-w-0 truncate">
                          {tournament.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 text-white">
                      {tournament.sportType ?? "FOOTBALL"}
                    </td>
                    <td className="px-4">
                      <DashboardStatusBadge status={tournament.status} />
                    </td>
                    <td className="px-4 text-white">
                      {tournament.teams.toLocaleString()}
                    </td>
                    <td className="px-4 text-white">
                      {tournament.matches.toLocaleString()}
                    </td>
                    <td className="px-4">
                      <DashboardSourceBadge source={tournament.source} />
                    </td>
                    <td
                      className="px-4"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {isAdmin ? (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => onEditTournament(tournament)}
                            className="text-[#84d8e8] transition hover:text-white"
                            title="Edit tournament"
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            onClick={() => onDeleteTournament(tournament)}
                            disabled={!deleteAllowed}
                            className="text-[#ff6b6b] transition hover:text-[#ff9b9b] disabled:cursor-not-allowed disabled:text-[#789098]"
                            title={
                              deleteAllowed
                                ? "Delete tournament"
                                : "Only completed tournaments can be deleted"
                            }
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs uppercase text-[#789098]">
                          Details
                        </span>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {visibleTournaments.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="h-[104px] text-center text-[#9fb2b8]"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex min-h-[64px] flex-wrap items-center justify-between gap-4 border-t border-[#3a4d54] bg-[#10242b] px-6 py-3">
          <span className="text-xs font-black uppercase text-[#9fb2b8]">
            Page {activePage} of {totalPages}
          </span>
          <nav
            aria-label={`${title} pagination`}
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              onClick={() => changePage(activePage - 1)}
              disabled={activePage === 1}
              aria-label="Previous page"
              title="Previous page"
              className="flex h-9 w-9 items-center justify-center border border-[#3a4d54] text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={17} />
            </button>
            {pageNumbers.map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => changePage(page)}
                aria-label={`Page ${page}`}
                aria-current={page === activePage ? "page" : undefined}
                className={`flex h-9 min-w-9 items-center justify-center border px-2 text-xs font-black transition ${
                  page === activePage
                    ? "border-[#84d8e8] bg-[#84d8e8] text-[#06161b]"
                    : "border-[#3a4d54] text-[#dce8eb] hover:border-[#84d8e8] hover:text-[#84d8e8]"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => changePage(activePage + 1)}
              disabled={activePage === totalPages}
              aria-label="Next page"
              title="Next page"
              className="flex h-9 w-9 items-center justify-center border border-[#3a4d54] text-[#dce8eb] transition hover:border-[#84d8e8] hover:text-[#84d8e8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={17} />
            </button>
          </nav>
        </div>
      )}
    </section>
  );
}

function canDeleteTournament(tournament: TournamentRow) {
  return tournament.status.toUpperCase() === "COMPLETED";
}




