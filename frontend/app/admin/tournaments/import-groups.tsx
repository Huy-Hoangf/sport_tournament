import type { F1MeetingOption, FootballCompetitionOption, LolCompetitionOption } from "./types";
import {
  formatDateOnly,
  formatDateTime,
  getF1MeetingPhase,
  getFootballCompetitionPhase,
  getFootballLeagueKey,
  getLolCompetitionPhase,
} from "./utils";
export function FootballCompetitionGroup({
  title,
  competitions,
  selectedKeys,
  onToggle,
}: {
  title: "Ongoing" | "Upcoming";
  competitions: FootballCompetitionOption[];
  selectedKeys: string[];
  onToggle: (competition: FootballCompetitionOption) => void;
}) {
  if (competitions.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#243c43] bg-[#14272e] px-4 py-3">
        <h4 className="text-xs font-black uppercase tracking-[0.12em] text-[#84d8e8]">
          {title}
        </h4>
        <span className="text-xs font-black uppercase text-[#9fb2b8]">
          {competitions.length} competitions
        </span>
      </div>
      <div className="divide-y divide-[#243c43]">
        {competitions.map((competition) => {
          const key = getFootballLeagueKey(competition);
          const checked = selectedKeys.includes(key);
          const phase = getFootballCompetitionPhase(competition);

          return (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-4 px-4 py-4 transition hover:bg-[#102d35]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(competition)}
                className="h-4 w-4 accent-[#84d8e8]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  {competition.name}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[#9fb2b8]">
                  {competition.country} / {competition.type} / Season{" "}
                  {competition.season}
                </p>
                <p className="mt-1 text-xs text-[#789098]">
                  {formatDateOnly(competition.start)} -{" "}
                  {formatDateOnly(competition.end)}
                </p>
              </div>
              <span className="shrink-0 rounded bg-[#162b32] px-3 py-1 text-xs font-black uppercase text-[#84d8e8]">
                {phase}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export function F1MeetingGroup({
  title,
  meetings,
  selectedKeys,
  onToggle,
}: {
  title: "Ongoing" | "Upcoming";
  meetings: F1MeetingOption[];
  selectedKeys: number[];
  onToggle: (meeting: F1MeetingOption) => void;
}) {
  if (meetings.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#243c43] bg-[#14272e] px-4 py-3">
        <h4 className="text-xs font-black uppercase tracking-[0.12em] text-[#84d8e8]">
          {title}
        </h4>
        <span className="text-xs font-black uppercase text-[#9fb2b8]">
          {meetings.length} meetings
        </span>
      </div>
      <div className="divide-y divide-[#243c43]">
        {meetings.map((meeting) => {
          const checked = selectedKeys.includes(meeting.id);
          const phase = getF1MeetingPhase(meeting);

          return (
            <label
              key={meeting.id}
              className="flex cursor-pointer items-center gap-4 px-4 py-4 transition hover:bg-[#102d35]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(meeting)}
                className="h-4 w-4 accent-[#84d8e8]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  {meeting.name}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[#9fb2b8]">
                  {meeting.country} / Circuit: {meeting.circuit}
                </p>
                <p className="mt-1 text-xs text-[#789098]">
                  {formatDateOnly(meeting.start)} -{" "}
                  {formatDateOnly(meeting.end)}
                </p>
              </div>
              <span className="shrink-0 rounded bg-[#162b32] px-3 py-1 text-xs font-black uppercase text-[#84d8e8]">
                {phase}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export function LolCompetitionGroup({
  title,
  competitions,
  selectedKeys,
  onToggle,
}: {
  title: "Ongoing" | "Upcoming";
  competitions: LolCompetitionOption[];
  selectedKeys: string[];
  onToggle: (competition: LolCompetitionOption) => void;
}) {
  if (competitions.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#243c43] bg-[#14272e] px-4 py-3">
        <h4 className="text-xs font-black uppercase tracking-[0.12em] text-[#84d8e8]">
          {title}
        </h4>
        <span className="text-xs font-black uppercase text-[#9fb2b8]">
          {competitions.length} competitions
        </span>
      </div>
      <div className="divide-y divide-[#243c43]">
        {competitions.map((competition) => {
          const checked = selectedKeys.includes(competition.id);
          const phase = getLolCompetitionPhase(competition);

          return (
            <label
              key={competition.id}
              className="flex cursor-pointer items-center gap-4 px-4 py-4 transition hover:bg-[#102d35]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(competition)}
                className="h-4 w-4 accent-[#84d8e8]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  {competition.name}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[#9fb2b8]">
                  {competition.region} / {competition.matches} matches
                </p>
                <p className="mt-1 text-xs text-[#789098]">
                  Next match: {formatDateTime(competition.nextMatchAt)}
                </p>
              </div>
              <span className="shrink-0 rounded bg-[#162b32] px-3 py-1 text-xs font-black uppercase text-[#84d8e8]">
                {phase}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}



