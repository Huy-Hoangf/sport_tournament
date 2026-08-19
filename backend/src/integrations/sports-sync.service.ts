import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { CITO_API_BASE_URL } from './lol/cito.client';
import { OPENF1_API_BASE_URL } from './f1/openf1.client';
import {
  ESPN_SOCCER_API_BASE_URL,
  FOOTBALL_DATA_ORG_API_BASE_URL,
  THESPORTSDB_API_BASE_URL,
} from './football/football-data-org.client';
import type { FootballCompetitionOption } from './football/football.types';
import type { F1MeetingOption } from './f1/f1.types';
import type { LolCompetitionOption } from './lol/lol.types';
import {
  ApiRateLimitError,
  fetchJson,
  fetchOptionalJson,
} from './shared/external-fetch';

// Cito LoL free tier is limited, so list calls are cached for a day unless an import forces fresh data.
const LOL_CACHE_MS = 24 * 60 * 60 * 1000;
const FEATURED_FOOTBALL_COMPETITIONS: Array<{
  id?: number;
  rank: number;
  tokens: string[];
  country?: string;
}> = [
  { id: 39, rank: 100, tokens: ['premier league'], country: 'england' },
  { id: 2, rank: 99, tokens: ['champions league'], country: 'world' },
  { id: 140, rank: 97, tokens: ['la liga'], country: 'spain' },
  { id: 135, rank: 96, tokens: ['serie a'], country: 'italy' },
  { id: 78, rank: 95, tokens: ['bundesliga'], country: 'germany' },
  { id: 61, rank: 94, tokens: ['ligue 1'], country: 'france' },
  { id: 3, rank: 93, tokens: ['europa league'], country: 'world' },
  { id: 24, rank: 91, tokens: ['asean championship'] },
  { id: 24, rank: 90, tokens: ['aff championship'] },
  { rank: 80, tokens: ['world cup'] },
  { rank: 70, tokens: ['copa america'] },
  { rank: 69, tokens: ['africa cup of nations'] },
  { rank: 68, tokens: ['asian cup'] },
  { rank: 65, tokens: ['major league soccer'] },
  { rank: 64, tokens: ['j1 league'] },
  { rank: 63, tokens: ['k league'] },
  { rank: 62, tokens: ['v-league'] },
];
const FOOTBALL_DATA_ORG_COMPETITION_CODES = new Map<number, string>([
  [39, 'PL'],
  [2, 'CL'],
  [140, 'PD'],
  [135, 'SA'],
  [78, 'BL1'],
  [61, 'FL1'],
  [3, 'EL'],
]);
const FOOTBALL_DATA_ORG_IMPORT_COMPETITIONS = [
  {
    id: 39,
    code: 'PL',
    name: 'Premier League',
    country: 'England',
    type: 'League',
  },
  {
    id: 2,
    code: 'CL',
    name: 'UEFA Champions League',
    country: 'Europe',
    type: 'Cup',
  },
  {
    id: 140,
    code: 'PD',
    name: 'La Liga',
    country: 'Spain',
    type: 'League',
  },
  {
    id: 135,
    code: 'SA',
    name: 'Serie A',
    country: 'Italy',
    type: 'League',
  },
  {
    id: 78,
    code: 'BL1',
    name: 'Bundesliga',
    country: 'Germany',
    type: 'League',
  },
  {
    id: 61,
    code: 'FL1',
    name: 'Ligue 1',
    country: 'France',
    type: 'League',
  },
  {
    id: 3,
    code: 'EL',
    name: 'UEFA Europa League',
    country: 'Europe',
    type: 'Cup',
  },
] as const;

type FootballMatch = {
  fixture: {
    id: number | string;
    date: string;
    status?: {
      short?: string;
      long?: string;
    };
  };
  league?: {
    id?: number | string;
    name: string;
    season?: number | string;
    startDate?: string | null;
    endDate?: string | null;
  };
  homeTeam?: { id?: number | string; name?: string; logo?: string };
  awayTeam?: { id?: number | string; name?: string; logo?: string };
  teams?: {
    home?: { id?: number | string; name?: string; logo?: string };
    away?: { id?: number | string; name?: string; logo?: string };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
};

type FootballDataOrgMatch = {
  id: number;
  utcDate: string;
  status: string;
  competition?: {
    id?: number;
    name?: string;
    code?: string;
  };
  season?: {
    startDate?: string;
    endDate?: string;
    currentMatchday?: number;
  };
  homeTeam?: {
    id?: number;
    name?: string;
    shortName?: string;
    tla?: string;
    crest?: string;
  };
  awayTeam?: {
    id?: number;
    name?: string;
    shortName?: string;
    tla?: string;
    crest?: string;
  };
  score?: {
    fullTime?: {
      home?: number | null;
      away?: number | null;
    };
  };
};

type TournamentStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETE';

type EspnSoccerEvent = {
  id?: string;
  date?: string;
  status?: {
    type?: {
      state?: string;
      name?: string;
      completed?: boolean;
    };
  };
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: string;
      score?: string;
      team?: {
        displayName?: string;
        logo?: string;
        logos?: Array<{ href?: string }>;
      };
    }>;
  }>;
};

type OpenF1Meeting = {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name?: string;
  country_name?: string;
  circuit_short_name?: string;
  date_start: string;
  date_end: string;
  is_cancelled?: boolean;
};

type OpenF1Session = {
  session_key: number;
  meeting_key: number;
  session_name: string;
  date_start: string;
  date_end: string;
  country_name?: string;
  circuit_short_name?: string;
};

type SyncResult = {
  skipped: boolean;
  message?: string;
  nextSyncAt?: string;
  syncedAt?: string;
  error?: string;
  football?: {
    competitions: number;
    matches: number;
    error: string | null;
  };
  f1?: {
    meetings: number;
    sessions: number;
    error: string | null;
  };
};

type CitoLolMatch = Record<string, unknown>;

type LolScheduleSnapshot = {
  competitions: LolCompetitionOption[];
  matches: Array<
    CitoLolMatch & {
      __competitionId: string;
      __competitionName: string;
      __region: string;
      __matchId: string;
      __homeName: string;
      __awayName: string;
      __homeLogoUrl: string | null;
      __awayLogoUrl: string | null;
      __scheduledTime: string;
      __status: 'PENDING' | 'LIVE' | 'FINISHED' | 'CANCELLED';
      __actualHomeScore: number | null;
      __actualAwayScore: number | null;
    }
  >;
};

@Injectable()
export class SportsApiSyncService {
  private lolScheduleCache: {
    expiresAt: number;
    snapshot: LolScheduleSnapshot;
  } | null = null;
  private lolLeagueCatalogCache: {
    expiresAt: number;
    competitions: LolCompetitionOption[];
  } | null = null;
  // LoL team logos are cached separately so imports do not spend one Cito request per team.
  private lolTeamLogoCache: {
    expiresAt: number;
    logosByName: Map<string, string>;
  } | null = null;
  private sportsDbLogoCache = new Map<string, string | null>();

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async syncAllNow() {
    return this.syncExternalData();
  }

  async deleteImportedApiData() {
    const apiSources = ['FOOTBALL_DATA', 'ESPN_ASEAN', 'OPENF1', 'CITO_LOL'];
    const apiStageNames = ['API Feed', 'Race Weekend', 'League Schedule'];
    const [result] = await this.usersRepository.query(
      `
        WITH api_tournaments AS MATERIALIZED (
          SELECT
            t.id,
            (SELECT COUNT(*) FROM matches m WHERE m.tournament_id = t.id) AS match_count
          FROM tournaments t
          WHERE
            ${this.tournamentStatusExpression('t.start_date', 't.end_date', 't.status')} != 'ONGOING'
            AND (
            EXISTS (
              SELECT 1
              FROM matches m
              WHERE m.tournament_id = t.id
                AND m.external_source = ANY($1::text[])
            )
            OR EXISTS (
              SELECT 1
              FROM stages s
              WHERE s.tournament_id = t.id
                AND s.name = ANY($2::text[])
            )
            OR (
              t.sport_type IN ('FOOTBALL', 'F1', 'LOL')
              AND NOT EXISTS (
                SELECT 1 FROM matches m WHERE m.tournament_id = t.id
              )
              AND NOT EXISTS (
                SELECT 1 FROM teams team WHERE team.tournament_id = t.id
              )
              AND NOT EXISTS (
                SELECT 1 FROM stages s WHERE s.tournament_id = t.id
              )
              AND NOT EXISTS (
                SELECT 1
                FROM tournament_participants participant
                WHERE participant.tournament_id = t.id
              )
            )
            )
        ),
        deleted AS (
          DELETE FROM tournaments tournament
          USING api_tournaments api
          WHERE tournament.id = api.id
          RETURNING tournament.id
        )
        SELECT
          COUNT(*)::int AS "deletedTournaments",
          COALESCE(SUM(api.match_count), 0)::int AS "deletedMatches"
        FROM api_tournaments api
        JOIN deleted ON deleted.id = api.id
      `,
      [apiSources, apiStageNames],
    );

    this.lolScheduleCache = null;

    return {
      deletedTournaments: Number(result?.deletedTournaments ?? 0),
      deletedMatches: Number(result?.deletedMatches ?? 0),
      message: 'Imported API data deleted successfully.',
    };
  }

  async syncFootballNow() {
    await this.ensureSportTypeConstraint();
    const adminId = await this.findAdminId();

    if (!adminId) {
      throw new Error('Admin account was not found.');
    }

    return this.syncFootball(adminId);
  }

  async syncF1Now() {
    await this.ensureSportTypeConstraint();
    const adminId = await this.findAdminId();

    if (!adminId) {
      throw new Error('Admin account was not found.');
    }

    return this.syncF1(adminId);
  }

  // Import options intentionally list competitions first; matches are fetched only after admin selection to protect quota.
  listFootballCompetitions() {
    return FOOTBALL_DATA_ORG_IMPORT_COMPETITIONS.map((competition) =>
      this.toFootballDataOrgCompetitionOption(competition),
    ).sort((first, second) => {
      const firstPhasePriority = this.getCompetitionPhasePriority(first);
      const secondPhasePriority = this.getCompetitionPhasePriority(second);

      if (firstPhasePriority !== secondPhasePriority) {
        return secondPhasePriority - firstPhasePriority;
      }

      const firstPriority = this.getCompetitionPriority(first);
      const secondPriority = this.getCompetitionPriority(second);

      if (firstPriority !== secondPriority) {
        return secondPriority - firstPriority;
      }

      return first.name.localeCompare(second.name);
    });
  }

  async syncSelectedFootballLeagues(
    leagues: Array<{
      id: number;
      season: number;
      name?: string;
      start?: string | null;
      end?: string | null;
      current?: boolean;
    }>,
  ) {
    await this.ensureSportTypeConstraint();

    const adminId = await this.findAdminId();

    if (!adminId) {
      throw new Error('Admin account was not found.');
    }

    const selectedLeagues = leagues
      .map((league) => ({
        id: Number(league.id),
        season: Number(league.season),
        name: typeof league.name === 'string' ? league.name.trim() : '',
        start: typeof league.start === 'string' ? league.start : null,
        end: typeof league.end === 'string' ? league.end : null,
        current: Boolean(league.current),
      }))
      .filter(
        (league) =>
          Number.isInteger(league.id) && Number.isInteger(league.season),
      );

    if (selectedLeagues.length === 0) {
      throw new Error('Please choose at least one football competition.');
    }

    let competitionCount = 0;
    let matchCount = 0;
    const importNotes = new Set<string>();

    for (const league of selectedLeagues) {
      try {
        const isAseanChampionship =
          league.name.trim().toLowerCase() === 'asean championship';
        const tournamentStatus = this.resolveFootballTournamentStatus(
          league.season,
          league.start,
          league.end,
          league.current,
          isAseanChampionship,
        );
        const fixtures = isAseanChampionship
          ? await this.fetchAseanChampionshipFixtures(league.season, true)
          : await this.fetchFootballDataOrgFixturesForLeague(league.id, true);
        const competitionName = fixtures[0]?.league?.name || league.name;

        if (!competitionName) {
          continue;
        }

        if (fixtures.length === 0) {
          await this.upsertEmptyFootballTournament(
            adminId,
            competitionName,
            tournamentStatus,
            league.start,
            league.end,
          );
          competitionCount += 1;
          continue;
        }

        const importedMatches = await this.syncFootballMatches(
          adminId,
          fixtures,
          isAseanChampionship ? 'ESPN_ASEAN' : 'FOOTBALL_DATA',
          tournamentStatus,
        );

        if (importedMatches > 0) {
          competitionCount += 1;
          matchCount += importedMatches;
        }
      } catch (error) {
        if (error instanceof ApiRateLimitError) {
          importNotes.add(error.message);
          break;
        }

        throw error;
      }
    }

    if (importNotes.size === 0) {
      if (matchCount === 0 && competitionCount > 0) {
        importNotes.add(
          'Selected competitions were imported, but no fixtures were returned for them.',
        );
      } else if (matchCount === 0) {
        importNotes.add(
          'No fixtures were returned for the selected competitions.',
        );
      }
    }

    return {
      competitions: competitionCount,
      matches: matchCount,
      error: importNotes.size > 0 ? Array.from(importNotes).join(' ') : null,
    };
  }

  async listF1Meetings() {
    const now = new Date();
    const years = [now.getUTCFullYear(), now.getUTCFullYear() + 1];
    const meetingResponses = await Promise.all(
      years.map((year) =>
        fetchOptionalJson<OpenF1Meeting[]>(
          `${OPENF1_API_BASE_URL}/meetings?year=${year}`,
        ),
      ),
    );

    return meetingResponses
      .flatMap((meetings) => meetings ?? [])
      .filter((meeting) => this.isF1MeetingImportable(meeting))
      .map((meeting) => this.toF1MeetingOption(meeting))
      .sort((first, second) => {
        const firstPhasePriority = first.current ? 1 : 0;
        const secondPhasePriority = second.current ? 1 : 0;

        if (firstPhasePriority !== secondPhasePriority) {
          return secondPhasePriority - firstPhasePriority;
        }

        return (
          new Date(first.start).getTime() - new Date(second.start).getTime()
        );
      })
      .slice(0, 60);
  }

  // OpenF1 is queried separately from API-SPORTS football so F1 imports do not consume football quota.
  async syncSelectedF1Meetings(meetingKeys: number[]) {
    await this.ensureSportTypeConstraint();

    const adminId = await this.findAdminId();

    if (!adminId) {
      throw new Error('Admin account was not found.');
    }

    const selectedKeys = new Set(
      meetingKeys
        .map((meetingKey) => Number(meetingKey))
        .filter((meetingKey) => Number.isInteger(meetingKey)),
    );

    if (selectedKeys.size === 0) {
      throw new Error('Please choose at least one F1 meeting.');
    }

    const now = new Date();
    const years = [now.getUTCFullYear(), now.getUTCFullYear() + 1];
    const [meetingResponses, sessionResponses] = await Promise.all([
      Promise.all(
        years.map((year) =>
          fetchOptionalJson<OpenF1Meeting[]>(
            `${OPENF1_API_BASE_URL}/meetings?year=${year}`,
          ),
        ),
      ),
      Promise.all(
        years.map((year) =>
          fetchOptionalJson<OpenF1Session[]>(
            `${OPENF1_API_BASE_URL}/sessions?year=${year}`,
          ),
        ),
      ),
    ]);
    const meetings = meetingResponses
      .flatMap((yearMeetings) => yearMeetings ?? [])
      .filter(
        (meeting) =>
          selectedKeys.has(meeting.meeting_key) &&
          this.isF1MeetingImportable(meeting),
      );
    const sessions = sessionResponses.flatMap(
      (yearSessions) => yearSessions ?? [],
    );
    let sessionCount = 0;

    for (const meeting of meetings) {
      sessionCount += await this.upsertF1Meeting(adminId, meeting, sessions);
    }

    return {
      meetings: meetings.length,
      sessions: sessionCount,
      error:
        sessionCount === 0
          ? 'No sessions were returned by OpenF1 for the selected meetings.'
          : null,
    };
  }

  async listLolCompetitions() {
    await this.ensureTeamLogoColumn();
    const [catalog, snapshot] = await Promise.all([
      this.getLolLeagueCatalog(false),
      this.getLolScheduleSnapshot(false),
    ]);
    const scheduleById = new Map(
      snapshot.competitions.map((competition) => [competition.id, competition]),
    );
    const scheduleByName = new Map(
      snapshot.competitions.map((competition) => [
        competition.name.toLowerCase(),
        competition,
      ]),
    );
    const competitions = catalog.length ? catalog : snapshot.competitions;

    return competitions
      .map((competition) => {
        const schedule =
          scheduleById.get(competition.id) ??
          scheduleByName.get(competition.name.toLowerCase());

        return {
          ...competition,
          start: schedule?.start ?? competition.start,
          nextMatchAt: schedule?.nextMatchAt ?? competition.nextMatchAt,
          current: schedule?.current ?? competition.current,
          matches: schedule?.matches ?? competition.matches,
        };
      })
      .sort((first, second) => {
        const firstPriority = this.getLolCompetitionPriority(first.name);
        const secondPriority = this.getLolCompetitionPriority(second.name);

        if (firstPriority !== secondPriority) {
          return secondPriority - firstPriority;
        }

        if (first.current !== second.current) {
          return first.current ? -1 : 1;
        }

        return first.name.localeCompare(second.name);
      })
      .slice(0, 120);
  }

  async syncSelectedLolCompetitions(competitionIds: string[]) {
    await this.ensureSportTypeConstraint();

    const adminId = await this.findAdminId();

    if (!adminId) {
      throw new Error('Admin account was not found.');
    }

    const selectedIds = new Set(
      competitionIds
        .map((competitionId) => String(competitionId).trim())
        .filter(Boolean),
    );

    if (selectedIds.size === 0) {
      throw new Error(
        'Please choose at least one League of Legends competition.',
      );
    }

    await this.ensureTeamLogoColumn();
    const catalog = await this.getLolLeagueCatalog(false);
    const broadSnapshot = await this.getLolScheduleSnapshot(false);
    const selectedCompetitionOptions = this.resolveSelectedLolCompetitions(
      selectedIds,
      catalog,
      broadSnapshot.competitions,
    );
    const snapshot = await this.getSelectedLolScheduleSnapshot(
      selectedCompetitionOptions,
    );
    const lolLogosByName = await this.getLolTeamLogosByName(false);
    const selectedMatches = snapshot.matches.filter((match) =>
      selectedIds.has(match.__competitionId),
    );
    const snapshotCompetitionsById = new Map(
      snapshot.competitions.map((competition) => [competition.id, competition]),
    );
    const selectedCompetitions = selectedCompetitionOptions.map(
      (competition) => ({
        ...competition,
        ...(snapshotCompetitionsById.get(competition.id) ?? {}),
      }),
    );
    let matchCount = 0;

    for (const competition of selectedCompetitions) {
      const tournamentMatches = selectedMatches.filter(
        (match) => match.__competitionId === competition.id,
      );

      if (tournamentMatches.length === 0) {
        continue;
      }

      const tournamentId = await this.upsertTournament({
        name: competition.name,
        sportType: 'LOL',
        status: this.mapTournamentStatusFromDates(
          competition.start,
          tournamentMatches.at(-1)?.__scheduledTime ?? null,
        ),
        startDate: competition.start,
        endDate: tournamentMatches.at(-1)?.__scheduledTime ?? null,
        adminId,
      });
      const stageId = await this.upsertStage(tournamentId, 'League Schedule');

      for (const match of tournamentMatches) {
        if (
          !this.isKnownTeamName(match.__homeName) ||
          !this.isKnownTeamName(match.__awayName)
        ) {
          continue;
        }

        const homeTeamId = await this.upsertTeam(
          tournamentId,
          match.__homeName,
          match.__homeLogoUrl ??
            this.getLolLogoForTeam(lolLogosByName, match.__homeName),
        );
        const awayTeamId = await this.upsertTeam(
          tournamentId,
          match.__awayName,
          match.__awayLogoUrl ??
            this.getLolLogoForTeam(lolLogosByName, match.__awayName),
        );

        await this.upsertMatch({
          tournamentId,
          stageId,
          homeTeamId,
          awayTeamId,
          homePlaceholder: match.__homeName,
          awayPlaceholder: match.__awayName,
          scheduledTime: match.__scheduledTime,
          status: match.__status,
          source: 'CITO_LOL',
          externalMatchId: match.__matchId,
          actualHomeScore: match.__actualHomeScore,
          actualAwayScore: match.__actualAwayScore,
        });
        matchCount += 1;
      }
    }

    return {
      competitions: selectedCompetitions.length,
      matches: matchCount,
      error:
        matchCount === 0
          ? 'No League of Legends matches were returned by Cito API for the selected competitions.'
          : null,
    };
  }

  private async syncExternalData(): Promise<SyncResult> {
    await this.ensureSportTypeConstraint();

    const adminId = await this.findAdminId();
    const result: SyncResult = {
      skipped: false,
      football: { competitions: 0, matches: 0, error: null },
      f1: { meetings: 0, sessions: 0, error: null },
      syncedAt: new Date().toISOString(),
    };

    if (!adminId) {
      return { ...result, error: 'Admin account was not found.' };
    }

    try {
      result.football = await this.syncFootball(adminId);
    } catch (error) {
      result.football = {
        competitions: 0,
        matches: 0,
        error: error instanceof Error ? error.message : 'Football sync failed.',
      };
    }

    try {
      result.f1 = await this.syncF1(adminId);
    } catch (error) {
      result.f1 = {
        meetings: 0,
        sessions: 0,
        error: error instanceof Error ? error.message : 'F1 sync failed.',
      };
    }

    return result;
  }

  private async syncFootball(adminId: number) {
    let competitionCount = 0;
    let matchCount = 0;

    for (const competition of this.listFootballCompetitions()) {
      const tournamentStatus = this.resolveFootballTournamentStatus(
        competition.season,
        competition.start,
        competition.end,
        competition.current,
        false,
      );
      const fixtures = await this.fetchFootballDataOrgFixturesForLeague(
        competition.id,
        true,
      );

      if (fixtures.length === 0) {
        continue;
      }

      const importedMatches = await this.syncFootballMatches(
        adminId,
        fixtures,
        'FOOTBALL_DATA',
        tournamentStatus,
      );

      if (importedMatches > 0) {
        competitionCount += 1;
        matchCount += importedMatches;
      }
    }

    return {
      competitions: competitionCount,
      matches: matchCount,
      error:
        matchCount === 0
          ? 'No football-data.org fixtures were returned for supported competitions.'
          : null,
    };
  }

  private async syncFootballMatches(
    adminId: number,
    matches: Iterable<FootballMatch>,
    source: 'FOOTBALL_DATA' | 'ESPN_ASEAN' = 'FOOTBALL_DATA',
    tournamentStatusOverride?: TournamentStatus,
  ) {
    await this.ensureTeamLogoColumn();
    let matchCount = 0;

    for (const match of matches) {
      if (!match.league?.name) {
        continue;
      }

      const tournamentId = await this.upsertTournament({
        name: match.league.name,
        sportType: 'FOOTBALL',
        status:
          tournamentStatusOverride ??
          this.mapTournamentStatus(match.fixture.status?.short ?? ''),
        startDate: match.league.startDate,
        endDate: match.league.endDate,
        adminId,
      });
      const stageId = await this.upsertStage(tournamentId, 'API Feed');
      const homeName =
        match.teams?.home?.name || match.homeTeam?.name || 'Home team';
      const awayName =
        match.teams?.away?.name || match.awayTeam?.name || 'Away team';
      const homeLogoUrl =
        this.pickString(match, [
          ['teams', 'home', 'logo'],
          ['homeTeam', 'logo'],
        ]) ?? (await this.fetchSportsDbTeamLogo(homeName));
      const awayLogoUrl =
        this.pickString(match, [
          ['teams', 'away', 'logo'],
          ['awayTeam', 'logo'],
        ]) ?? (await this.fetchSportsDbTeamLogo(awayName));
      const homeTeamId = await this.upsertTeam(
        tournamentId,
        homeName,
        homeLogoUrl,
      );
      const awayTeamId = await this.upsertTeam(
        tournamentId,
        awayName,
        awayLogoUrl,
      );

      await this.upsertMatch({
        tournamentId,
        stageId,
        homeTeamId,
        awayTeamId,
        homePlaceholder: homeName,
        awayPlaceholder: awayName,
        scheduledTime: match.fixture.date,
        status: this.mapMatchStatus(match.fixture.status?.short ?? ''),
        source,
        externalMatchId: String(match.fixture.id),
        actualHomeScore: match.goals?.home ?? null,
        actualAwayScore: match.goals?.away ?? null,
      });
      matchCount += 1;
    }

    return matchCount;
  }

  private async fetchAseanChampionshipFixtures(
    season: number,
    includeFinishedFixtures = false,
  ) {
    const response = await fetchJson<{ events?: EspnSoccerEvent[] }>(
      `${ESPN_SOCCER_API_BASE_URL}/aff.championship/scoreboard?dates=${season}0101-${season}1231`,
    );

    return (response.events ?? [])
      .map((event) => this.mapEspnAseanEvent(event))
      .filter(
        (match): match is FootballMatch =>
          match !== null &&
          this.isFootballFixtureImportable(match, includeFinishedFixtures),
      );
  }

  private mapEspnAseanEvent(event: EspnSoccerEvent): FootballMatch | null {
    if (!event.id || !event.date) {
      return null;
    }

    const competitors = event.competitions?.[0]?.competitors ?? [];
    const home = competitors.find(
      (competitor) => competitor.homeAway === 'home',
    );
    const away = competitors.find(
      (competitor) => competitor.homeAway === 'away',
    );

    if (!home?.team?.displayName || !away?.team?.displayName) {
      return null;
    }

    const state = event.status?.type?.state?.toLowerCase();
    const status = event.status?.type?.completed
      ? 'FT'
      : state === 'in'
        ? 'LIVE'
        : event.status?.type?.name === 'STATUS_CANCELED'
          ? 'CANC'
          : 'NS';

    return {
      fixture: {
        id: `espn-${event.id}`,
        date: event.date,
        status: { short: status },
      },
      league: { name: 'ASEAN Championship' },
      teams: {
        home: {
          name: home.team.displayName,
          logo: home.team.logo || home.team.logos?.[0]?.href,
        },
        away: {
          name: away.team.displayName,
          logo: away.team.logo || away.team.logos?.[0]?.href,
        },
      },
      goals: {
        home: this.parseOptionalScore(home.score),
        away: this.parseOptionalScore(away.score),
      },
    };
  }

  private parseOptionalScore(score?: string) {
    if (typeof score !== 'string' || score.trim() === '') {
      return null;
    }

    const parsed = Number(score);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async fetchFootballDataOrgFixturesForLeague(
    leagueId: number,
    includeFinishedFixtures = false,
  ) {
    const apiKey = process.env.FOOTBALL_DATA_ORG_API_KEY?.trim();
    const competitionCode = FOOTBALL_DATA_ORG_COMPETITION_CODES.get(leagueId);

    if (!apiKey || !competitionCode) {
      return [];
    }

    const response = await fetchOptionalJson<{
      matches?: FootballDataOrgMatch[];
    }>(
      `${FOOTBALL_DATA_ORG_API_BASE_URL}/competitions/${competitionCode}/matches`,
      { 'X-Auth-Token': apiKey },
    );

    return (response?.matches ?? [])
      .map((match) => this.toFootballDataOrgMatch(match, leagueId))
      .filter(
        (match): match is FootballMatch =>
          match !== null &&
          this.isFootballFixtureImportable(match, includeFinishedFixtures),
      )
      .sort((first, second) =>
        includeFinishedFixtures
          ? new Date(second.fixture.date).getTime() -
            new Date(first.fixture.date).getTime()
          : new Date(first.fixture.date).getTime() -
            new Date(second.fixture.date).getTime(),
      )
      .slice(0, 200);
  }

  private toFootballDataOrgMatch(
    match: FootballDataOrgMatch,
    leagueId: number,
  ): FootballMatch | null {
    if (!match.id || !match.utcDate || !match.competition?.name) {
      return null;
    }

    const seasonYear = match.season?.startDate
      ? new Date(match.season.startDate).getUTCFullYear()
      : undefined;

    return {
      fixture: {
        id: `fdorg-${match.id}`,
        date: match.utcDate,
        status: { short: this.mapFootballDataOrgStatus(match.status) },
      },
      league: {
        id: leagueId,
        name: match.competition.name,
        season: seasonYear,
        startDate: match.season?.startDate ?? null,
        endDate: match.season?.endDate ?? null,
      },
      teams: {
        home: {
          id: match.homeTeam?.id,
          name:
            match.homeTeam?.name ||
            match.homeTeam?.shortName ||
            match.homeTeam?.tla,
          logo: match.homeTeam?.crest,
        },
        away: {
          id: match.awayTeam?.id,
          name:
            match.awayTeam?.name ||
            match.awayTeam?.shortName ||
            match.awayTeam?.tla,
          logo: match.awayTeam?.crest,
        },
      },
      goals: {
        home: match.score?.fullTime?.home ?? null,
        away: match.score?.fullTime?.away ?? null,
      },
    };
  }

  private async fetchSportsDbTeamLogo(teamName: string) {
    const cacheKey = this.normalizeTeamLookupKey(teamName);

    if (this.sportsDbLogoCache.has(cacheKey)) {
      return this.sportsDbLogoCache.get(cacheKey) ?? null;
    }

    const apiKey = process.env.THESPORTSDB_API_KEY?.trim() || '123';
    const response = await fetchOptionalJson<{
      teams?: Array<{ strBadge?: string; strLogo?: string }>;
    }>(
      `${THESPORTSDB_API_BASE_URL}/${apiKey}/searchteams.php?t=${encodeURIComponent(
        teamName,
      )}`,
    );
    const logoUrl =
      response?.teams?.find((team) => team.strBadge || team.strLogo)
        ?.strBadge ??
      response?.teams?.find((team) => team.strLogo)?.strLogo ??
      null;

    this.sportsDbLogoCache.set(cacheKey, logoUrl);

    return logoUrl;
  }

  private resolveFootballTournamentStatus(
    selectedSeason: number,
    start: string | null,
    end: string | null,
    current: boolean,
    isAseanChampionship: boolean,
  ): TournamentStatus {
    if (isAseanChampionship) {
      return this.getAseanTournamentStatus(selectedSeason);
    }

    if (start || end) {
      return this.mapTournamentStatusFromDates(start, end);
    }

    if (current) {
      return 'ONGOING';
    }

    const currentYear = new Date().getUTCFullYear();

    if (selectedSeason < currentYear) {
      return 'COMPLETE';
    }

    if (selectedSeason > currentYear) {
      return 'UPCOMING';
    }

    return 'ONGOING';
  }

  private getAseanTournamentStatus(season: number): TournamentStatus {
    return this.mapTournamentStatusFromDates(
      `${season}-01-01`,
      `${season}-12-31`,
    );
  }

  private mapTournamentStatusFromDates(
    startValue?: string | null,
    endValue?: string | null,
  ): TournamentStatus {
    const now = Date.now();
    const startTime = startValue ? new Date(startValue).getTime() : NaN;
    const endTime = endValue ? new Date(endValue).getTime() : NaN;

    if (Number.isFinite(endTime) && endTime < now) {
      return 'COMPLETE';
    }

    if (Number.isFinite(startTime) && startTime > now) {
      return 'UPCOMING';
    }

    return 'ONGOING';
  }

  private isFootballFixtureImportable(
    match: FootballMatch,
    includeFinishedFixtures: boolean,
  ) {
    const mappedStatus = this.mapMatchStatus(match.fixture.status?.short ?? '');

    if (includeFinishedFixtures) {
      return mappedStatus !== 'CANCELLED';
    }

    return this.isFootballFixtureCurrentOrFuture(match);
  }

  private isFootballFixtureCurrentOrFuture(match: FootballMatch) {
    const mappedStatus = this.mapMatchStatus(match.fixture.status?.short ?? '');

    if (mappedStatus === 'LIVE') {
      return true;
    }

    if (mappedStatus === 'FINISHED' || mappedStatus === 'CANCELLED') {
      return false;
    }

    const scheduledTime = new Date(match.fixture.date).getTime();

    return Number.isFinite(scheduledTime) && scheduledTime >= Date.now();
  }

  private async syncF1(adminId: number) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const nextWindow = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    const [meetings, sessions] = await Promise.all([
      fetchJson<OpenF1Meeting[]>(
        `${OPENF1_API_BASE_URL}/meetings?year=${year}`,
      ),
      fetchJson<OpenF1Session[]>(
        `${OPENF1_API_BASE_URL}/sessions?year=${year}`,
      ),
    ]);
    let meetingCount = 0;
    let sessionCount = 0;

    for (const meeting of meetings) {
      const start = new Date(meeting.date_start);
      const end = new Date(meeting.date_end);

      if (meeting.is_cancelled || start > nextWindow || end < now) {
        continue;
      }

      sessionCount += await this.upsertF1Meeting(adminId, meeting, sessions);
      meetingCount += 1;
    }

    return { meetings: meetingCount, sessions: sessionCount, error: null };
  }

  private async upsertF1Meeting(
    adminId: number,
    meeting: OpenF1Meeting,
    sessions: OpenF1Session[],
  ) {
    const tournamentId = await this.upsertTournament({
      name:
        meeting.meeting_name || meeting.meeting_official_name || 'Formula 1',
      sportType: 'F1',
      status: this.mapTournamentStatusFromDates(
        meeting.date_start,
        meeting.date_end,
      ),
      startDate: meeting.date_start,
      endDate: meeting.date_end,
      adminId,
    });
    const stageId = await this.upsertStage(tournamentId, 'Race Weekend');
    let sessionCount = 0;

    for (const session of sessions.filter(
      (item) => item.meeting_key === meeting.meeting_key,
    )) {
      await this.upsertMatch({
        tournamentId,
        stageId,
        homeTeamId: null,
        awayTeamId: null,
        homePlaceholder: session.session_name,
        awayPlaceholder:
          session.circuit_short_name ||
          meeting.circuit_short_name ||
          meeting.country_name ||
          'F1',
        scheduledTime: session.date_start,
        status: this.isLiveWindow(session.date_start, session.date_end)
          ? 'LIVE'
          : new Date(session.date_end) < new Date()
            ? 'FINISHED'
            : 'PENDING',
        source: 'OPENF1',
        externalMatchId: String(session.session_key),
        actualHomeScore: null,
        actualAwayScore: null,
      });
      sessionCount += 1;
    }

    return sessionCount;
  }

  private async upsertTournament(data: {
    name: string;
    sportType: 'FOOTBALL' | 'F1' | 'LOL' | 'OTHER';
    status: TournamentStatus;
    startDate?: string | null;
    endDate?: string | null;
    adminId: number;
  }) {
    const [existing] = await this.usersRepository.query(
      `
        SELECT id
        FROM tournaments
        WHERE LOWER(name) = LOWER($1)
          AND sport_type = $2
        LIMIT 1
      `,
      [data.name, data.sportType],
    );

    if (existing) {
      await this.usersRepository.query(
        `
          UPDATE tournaments
          SET
            status = $1,
            start_date = COALESCE($2, start_date),
            end_date = COALESCE($3, end_date),
            updated_at = NOW()
          WHERE id = $4
        `,
        [
          data.status,
          data.startDate ?? null,
          data.endDate ?? null,
          existing.id,
        ],
      );
      return Number(existing.id);
    }

    const [created] = await this.usersRepository.query(
      `
        INSERT INTO tournaments
          (name, sport_type, format, status, visibility, start_date, end_date, created_by)
        VALUES ($1, $2, 'ROUND_ROBIN', $3, 'PUBLIC', $4, $5, $6)
        RETURNING id
      `,
      [
        data.name,
        data.sportType,
        data.status,
        data.startDate ?? null,
        data.endDate ?? null,
        data.adminId,
      ],
    );

    return Number(created.id);
  }

  private async upsertEmptyFootballTournament(
    adminId: number,
    name: string,
    status: TournamentStatus,
    startDate?: string | null,
    endDate?: string | null,
  ) {
    const tournamentId = await this.upsertTournament({
      name,
      sportType: 'FOOTBALL',
      status,
      startDate,
      endDate,
      adminId,
    });

    await this.upsertStage(tournamentId, 'API Feed');

    return tournamentId;
  }

  private async upsertStage(tournamentId: number, name: string) {
    const [existing] = await this.usersRepository.query(
      `
        SELECT id
        FROM stages
        WHERE tournament_id = $1
          AND name = $2
        LIMIT 1
      `,
      [tournamentId, name],
    );

    if (existing) {
      return Number(existing.id);
    }

    const [{ nextSortOrder }] = await this.usersRepository.query(
      `
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS "nextSortOrder"
        FROM stages
        WHERE tournament_id = $1
      `,
      [tournamentId],
    );
    const [created] = await this.usersRepository.query(
      `
        INSERT INTO stages (tournament_id, name, sort_order)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [tournamentId, name, Number(nextSortOrder ?? 1)],
    );

    return Number(created.id);
  }

  private async upsertTeam(
    tournamentId: number,
    name: string,
    logoUrl: string | null = null,
  ) {
    if (!this.isKnownTeamName(name)) {
      return null;
    }

    const [existing] = await this.usersRepository.query(
      `
        SELECT id, logo_url AS "logoUrl"
        FROM teams
        WHERE tournament_id = $1
          AND LOWER(name) = LOWER($2)
        LIMIT 1
      `,
      [tournamentId, name],
    );

    if (existing) {
      if (logoUrl && existing.logoUrl !== logoUrl) {
        await this.usersRepository.query(
          `
            UPDATE teams
            SET logo_url = $1
            WHERE id = $2
          `,
          [logoUrl, Number(existing.id)],
        );
      }

      return Number(existing.id);
    }

    const [created] = await this.usersRepository.query(
      `
        INSERT INTO teams (tournament_id, name, logo_url)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [tournamentId, name, logoUrl],
    );

    return Number(created.id);
  }

  private isKnownTeamName(name: string | null | undefined) {
    const normalized = name?.trim().toLowerCase();

    return (
      !!normalized &&
      !['tbd', 'team 1', 'team 2', 'home team', 'away team'].includes(
        normalized,
      )
    );
  }

  private async upsertMatch(data: {
    tournamentId: number;
    stageId: number;
    homeTeamId: number | null;
    awayTeamId: number | null;
    homePlaceholder: string;
    awayPlaceholder: string;
    scheduledTime: string;
    status: 'PENDING' | 'LIVE' | 'FINISHED' | 'CANCELLED';
    source: 'FOOTBALL_DATA' | 'ESPN_ASEAN' | 'OPENF1' | 'CITO_LOL';
    externalMatchId: string;
    actualHomeScore: number | null;
    actualAwayScore: number | null;
  }) {
    const [existing] = await this.usersRepository.query(
      `
        SELECT id
        FROM matches
        WHERE external_source = $1
          AND external_match_id = $2
        LIMIT 1
      `,
      [data.source, data.externalMatchId],
    );

    if (!existing) {
      await this.usersRepository.query(
        `
          INSERT INTO matches (
            tournament_id,
            stage_id,
            home_team_id,
            away_team_id,
            home_placeholder,
            away_placeholder,
            scheduled_time,
            status,
            actual_home_score,
            actual_away_score,
            external_source,
            external_match_id,
            last_synced_at,
            sync_status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), 'SYNCED')
        `,
        [
          data.tournamentId,
          data.stageId,
          data.homeTeamId,
          data.awayTeamId,
          data.homePlaceholder,
          data.awayPlaceholder,
          data.scheduledTime,
          data.status,
          data.actualHomeScore,
          data.actualAwayScore,
          data.source,
          data.externalMatchId,
        ],
      );
      return;
    }

    await this.usersRepository.query(
      `
        UPDATE matches
        SET
          tournament_id = $1,
          stage_id = $2,
          home_team_id = $3,
          away_team_id = $4,
          home_placeholder = $5,
          away_placeholder = $6,
          scheduled_time = $7,
          status = $8,
          actual_home_score = $9,
          actual_away_score = $10,
          last_synced_at = NOW(),
          sync_status = 'SYNCED',
          updated_at = NOW()
        WHERE id = $11
      `,
      [
        data.tournamentId,
        data.stageId,
        data.homeTeamId,
        data.awayTeamId,
        data.homePlaceholder,
        data.awayPlaceholder,
        data.scheduledTime,
        data.status,
        data.actualHomeScore,
        data.actualAwayScore,
        existing.id,
      ],
    );
  }

  private async getLolScheduleSnapshot(force: boolean) {
    if (
      !force &&
      this.lolScheduleCache &&
      this.lolScheduleCache.expiresAt > Date.now()
    ) {
      return this.lolScheduleCache.snapshot;
    }

    const apiKey = process.env.CITO_API_KEY?.trim();

    if (!apiKey) {
      throw new Error('CITO_API_KEY is not configured.');
    }

    const headers = { 'x-api-key': apiKey };
    const [
      todayResponse,
      upcomingResponse,
      recentResponse,
      resultsResponse,
      pastResponse,
      lckResponse,
      lckResultsResponse,
      lckChallengersResponse,
      lckChallengersResultsResponse,
    ] = await Promise.all([
      fetchJson<unknown>(`${CITO_API_BASE_URL}/lol/schedule/today`, headers),
      fetchJson<unknown>(`${CITO_API_BASE_URL}/lol/schedule/upcoming`, headers),
      fetchOptionalJson<unknown>(
        `${CITO_API_BASE_URL}/lol/schedule/recent`,
        headers,
      ),
      fetchOptionalJson<unknown>(
        `${CITO_API_BASE_URL}/lol/schedule/results`,
        headers,
      ),
      fetchOptionalJson<unknown>(
        `${CITO_API_BASE_URL}/lol/schedule/past`,
        headers,
      ),
      fetchOptionalJson<unknown>(
        `${CITO_API_BASE_URL}/lol/leagues/lck/schedule`,
        headers,
      ),
      fetchOptionalJson<unknown>(
        `${CITO_API_BASE_URL}/lol/leagues/lck/results`,
        headers,
      ),
      fetchOptionalJson<unknown>(
        `${CITO_API_BASE_URL}/lol/leagues/lck_challengers/schedule`,
        headers,
      ),
      fetchOptionalJson<unknown>(
        `${CITO_API_BASE_URL}/lol/leagues/lck_challengers/results`,
        headers,
      ),
    ]);
    const rawMatches = [
      ...this.extractResponseArray(todayResponse),
      ...this.extractResponseArray(upcomingResponse),
      ...this.extractResponseArray(recentResponse),
      ...this.extractResponseArray(resultsResponse),
      ...this.extractResponseArray(pastResponse),
      ...this.withLolLeagueIdentity(
        this.extractResponseArray(lckResponse),
        'lck',
        'LCK',
      ),
      ...this.withLolLeagueIdentity(
        this.extractResponseArray(lckResultsResponse),
        'lck',
        'LCK',
      ),
      ...this.withLolLeagueIdentity(
        this.extractResponseArray(lckChallengersResponse),
        'lck_challengers',
        'LCK Challengers',
      ),
      ...this.withLolLeagueIdentity(
        this.extractResponseArray(lckChallengersResultsResponse),
        'lck_challengers',
        'LCK Challengers',
      ),
    ];
    const snapshot = this.buildLolScheduleSnapshot(rawMatches);

    this.lolScheduleCache = {
      expiresAt: Date.now() + LOL_CACHE_MS,
      snapshot,
    };

    return snapshot;
  }

  private async getLolLeagueCatalog(force: boolean) {
    if (
      !force &&
      this.lolLeagueCatalogCache &&
      this.lolLeagueCatalogCache.expiresAt > Date.now()
    ) {
      return this.lolLeagueCatalogCache.competitions;
    }

    const apiKey = process.env.CITO_API_KEY?.trim();

    if (!apiKey) {
      throw new Error('CITO_API_KEY is not configured.');
    }

    const payload = await fetchOptionalJson<unknown>(
      `${CITO_API_BASE_URL}/lol/leagues`,
      { 'x-api-key': apiKey },
    );
    const competitions = this.extractLolLeagueOptions(payload);

    this.lolLeagueCatalogCache = {
      expiresAt: Date.now() + LOL_CACHE_MS,
      competitions,
    };

    return competitions;
  }

  private async getSelectedLolScheduleSnapshot(
    competitions: LolCompetitionOption[],
  ) {
    const rawMatches: CitoLolMatch[] = [];

    for (const competition of competitions) {
      rawMatches.push(...(await this.fetchLolLeagueMatches(competition)));
    }

    if (rawMatches.length === 0) {
      return this.getLolScheduleSnapshot(false);
    }

    return this.buildLolScheduleSnapshot(rawMatches);
  }

  private async fetchLolLeagueMatches(competition: LolCompetitionOption) {
    const leagueId = encodeURIComponent(competition.id);
    const [scheduleMatches, resultsMatches, pastMatches] = await Promise.all([
      this.fetchLolLeagueEndpointMatches(leagueId, 'schedule'),
      this.fetchLolLeagueEndpointMatches(leagueId, 'results'),
      this.fetchLolLeagueEndpointMatches(leagueId, 'past'),
    ]);
    const currentTournamentIds =
      this.getLolCurrentTournamentIds(scheduleMatches);
    const scopedResults = this.filterLolMatchesByTournamentIds(
      resultsMatches,
      currentTournamentIds,
    );
    const scopedPast = this.filterLolMatchesByTournamentIds(
      pastMatches,
      currentTournamentIds,
    );

    return this.withLolLeagueIdentity(
      [...scheduleMatches, ...scopedResults, ...scopedPast],
      competition.id,
      competition.name,
    );
  }

  private getLolCurrentTournamentIds(scheduleMatches: CitoLolMatch[]) {
    const tournamentIds = new Set<string>();

    for (const match of scheduleMatches) {
      const tournamentId = this.getLolTournamentId(match);

      if (tournamentId) {
        tournamentIds.add(tournamentId);
      }
    }

    return tournamentIds;
  }

  private filterLolMatchesByTournamentIds(
    matches: CitoLolMatch[],
    tournamentIds: Set<string>,
  ) {
    if (tournamentIds.size === 0) {
      return [];
    }

    return matches.filter((match) => {
      const tournamentId = this.getLolTournamentId(match);

      return tournamentId ? tournamentIds.has(tournamentId) : false;
    });
  }

  private async fetchLolLeagueEndpointMatches(
    leagueId: string,
    endpoint: 'schedule' | 'results' | 'past',
  ) {
    const apiKey = process.env.CITO_API_KEY?.trim();

    if (!apiKey) {
      throw new Error('CITO_API_KEY is not configured.');
    }

    const matches: CitoLolMatch[] = [];
    const seenOffsets = new Set<number>();
    let offset = 0;
    const limit = 100;

    for (let page = 0; page < 20; page += 1) {
      if (seenOffsets.has(offset)) {
        break;
      }

      seenOffsets.add(offset);

      const payload = await fetchOptionalJson<unknown>(
        `${CITO_API_BASE_URL}/lol/leagues/${leagueId}/${endpoint}?limit=${limit}&offset=${offset}`,
        { 'x-api-key': apiKey },
      );

      if (!payload) {
        break;
      }

      matches.push(...this.extractResponseArray(payload));

      const pageInfo = this.getCitoPageInfo(payload);

      if (!pageInfo.hasMore || pageInfo.nextOffset === null) {
        break;
      }

      offset = pageInfo.nextOffset;
    }

    return matches;
  }

  private getCitoPageInfo(payload: unknown) {
    const data = this.isRecord(payload) ? payload.data : null;
    const source = this.isRecord(data)
      ? data
      : this.isRecord(payload)
        ? payload
        : {};
    const hasMore = source.hasMore === true;
    const nextOffset =
      typeof source.nextOffset === 'number' &&
      Number.isFinite(source.nextOffset)
        ? source.nextOffset
        : null;

    return { hasMore, nextOffset };
  }

  private resolveSelectedLolCompetitions(
    selectedIds: Set<string>,
    catalog: LolCompetitionOption[],
    fallback: LolCompetitionOption[],
  ) {
    const byId = new Map<string, LolCompetitionOption>();

    for (const competition of [...catalog, ...fallback]) {
      byId.set(competition.id, competition);
    }

    return Array.from(selectedIds)
      .map((id) => byId.get(id))
      .filter((competition): competition is LolCompetitionOption =>
        Boolean(competition),
      );
  }

  private extractLolLeagueOptions(payload: unknown): LolCompetitionOption[] {
    const competitionsById = new Map<string, LolCompetitionOption>();

    for (const league of this.extractRecordArray(payload)) {
      const rawName = this.pickString(league, [
        ['name'],
        ['displayName'],
        ['display_name'],
        ['title'],
        ['league', 'name'],
      ]);

      if (!rawName) {
        continue;
      }

      const rawId =
        this.pickString(league, [
          ['slug'],
          ['id'],
          ['leagueId'],
          ['league_id'],
          ['key'],
          ['code'],
          ['league', 'slug'],
          ['league', 'id'],
        ]) ?? this.slugify(rawName);
      const id = this.slugify(rawId) || this.slugify(rawName);
      const name = this.normalizeLolCompetitionName(rawName, id);
      const region =
        this.pickString(league, [
          ['region'],
          ['country'],
          ['area'],
          ['league', 'region'],
        ]) ?? 'International';
      const start = this.normalizeDateString(
        this.pickString(league, [
          ['start'],
          ['startsAt'],
          ['starts_at'],
          ['startDate'],
          ['start_date'],
          ['begin_at'],
        ]),
      );
      const end = this.normalizeDateString(
        this.pickString(league, [
          ['end'],
          ['endsAt'],
          ['ends_at'],
          ['endDate'],
          ['end_date'],
        ]),
      );
      const status = this.pickString(league, [
        ['status'],
        ['state'],
        ['phase'],
      ]);
      const dateStatus =
        start || end ? this.mapTournamentStatusFromDates(start, end) : null;
      const current =
        dateStatus === 'ONGOING' ||
        ['ACTIVE', 'CURRENT', 'ONGOING', 'RUNNING', 'LIVE'].includes(
          (status ?? '').toUpperCase(),
        );

      competitionsById.set(id, {
        id,
        name,
        region,
        start,
        nextMatchAt: start,
        current,
        matches: 0,
      });
    }

    return Array.from(competitionsById.values());
  }

  private buildLolScheduleSnapshot(
    rawMatches: CitoLolMatch[],
  ): LolScheduleSnapshot {
    const now = new Date();
    const matchesById = new Map<
      string,
      LolScheduleSnapshot['matches'][number]
    >();

    for (const rawMatch of rawMatches) {
      const scheduledTime = this.normalizeDateString(
        this.pickString(rawMatch, [
          ['scheduled_at'],
          ['scheduledAt'],
          ['start_time'],
          ['startTime'],
          ['begin_at'],
          ['beginAt'],
          ['date'],
          ['matchDate'],
          ['time'],
        ]),
      );
      let status = this.mapLolStatus(
        this.pickString(rawMatch, [
          ['status'],
          ['state'],
          ['match_status'],
          ['matchStatus'],
        ]),
      );

      if (!scheduledTime) {
        continue;
      }

      const scheduledDate = new Date(scheduledTime);

      const rawCompetitionName =
        this.pickString(rawMatch, [
          ['__forcedLeagueName'],
          ['leagueName'],
          ['tournament', 'name'],
          ['serie', 'name'],
          ['tournamentName'],
          ['competition', 'name'],
          ['competitionName'],
          ['league', 'name'],
          ['leagueName'],
          ['league'],
        ]) || 'League of Legends';
      const competitionSlug = this.pickString(rawMatch, [
        ['__forcedLeagueSlug'],
        ['leagueSlug'],
        ['leagueId'],
        ['league', 'slug'],
        ['competition', 'slug'],
        ['tournament', 'slug'],
        ['serie', 'slug'],
        ['league_slug'],
        ['leagueSlug'],
        ['competition_slug'],
        ['competitionSlug'],
        ['tournament_slug'],
        ['tournamentSlug'],
      ]);
      let competitionId =
        competitionSlug ||
        this.pickString(rawMatch, [
          ['leagueId'],
          ['tournament', 'id'],
          ['serie', 'id'],
          ['tournamentId'],
          ['competition', 'id'],
          ['competitionId'],
          ['league', 'id'],
          ['leagueId'],
        ]) ||
        this.slugify(rawCompetitionName);
      let competitionName = this.normalizeLolCompetitionName(
        rawCompetitionName,
        competitionSlug || competitionId,
      );
      const homeName =
        this.pickString(rawMatch, [
          ['homeTeam', 'name'],
          ['home_team', 'name'],
          ['team1', 'name'],
          ['blueTeam', 'name'],
          ['opponents', 0, 'name'],
          ['opponents', 0, 'opponent', 'name'],
          ['opponents', 0, 'opponent', 'acronym'],
          ['teams', 0, 'name'],
          ['teams', 0, 'team', 'name'],
          ['match', 'teams', 0, 'name'],
          ['participants', 0, 'name'],
        ]) || 'Team 1';
      const homeLogoUrl = this.pickString(rawMatch, [
        ['teams', 0, 'imageUrl'],
        ['homeTeam', 'logo'],
        ['homeTeam', 'logoUrl'],
        ['homeTeam', 'image'],
        ['homeTeam', 'image_url'],
        ['home_team', 'logo'],
        ['home_team', 'image_url'],
        ['team1', 'logo'],
        ['team1', 'image_url'],
        ['blueTeam', 'logo'],
        ['blueTeam', 'image_url'],
        ['opponents', 0, 'logo'],
        ['opponents', 0, 'image_url'],
        ['opponents', 0, 'opponent', 'logo'],
        ['opponents', 0, 'opponent', 'logoUrl'],
        ['opponents', 0, 'opponent', 'image'],
        ['opponents', 0, 'opponent', 'image_url'],
        ['teams', 0, 'logo'],
        ['teams', 0, 'logoUrl'],
        ['teams', 0, 'image'],
        ['teams', 0, 'image_url'],
        ['teams', 0, 'team', 'logo'],
        ['teams', 0, 'team', 'logoUrl'],
        ['teams', 0, 'team', 'image'],
        ['teams', 0, 'team', 'image_url'],
        ['participants', 0, 'logo'],
        ['participants', 0, 'image_url'],
      ]);

      const awayName =
        this.pickString(rawMatch, [
          ['awayTeam', 'name'],
          ['away_team', 'name'],
          ['team2', 'name'],
          ['redTeam', 'name'],
          ['opponents', 1, 'name'],
          ['opponents', 1, 'opponent', 'name'],
          ['opponents', 1, 'opponent', 'acronym'],
          ['teams', 1, 'name'],
          ['teams', 1, 'team', 'name'],
          ['match', 'teams', 1, 'name'],
          ['participants', 1, 'name'],
        ]) || 'Team 2';

      if (!this.isKnownTeamName(homeName) || !this.isKnownTeamName(awayName)) {
        continue;
      }

      const awayLogoUrl = this.pickString(rawMatch, [
        ['teams', 1, 'imageUrl'],
        ['awayTeam', 'logo'],
        ['awayTeam', 'image'],
        ['awayTeam', 'image_url'],
        ['awayTeam', 'logoUrl'],
        ['away_team', 'image'],
        ['away_team', 'logoUrl'],
        ['team2', 'image'],
        ['team2', 'logoUrl'],
        ['redTeam', 'image'],
        ['redTeam', 'logoUrl'],
        ['opponents', 1, 'image'],
        ['opponents', 1, 'logoUrl'],
        ['opponents', 1, 'opponent', 'image'],
        ['opponents', 1, 'opponent', 'logoUrl'],
        ['teams', 1, 'image'],
        ['teams', 1, 'logoUrl'],
        ['teams', 1, 'team', 'logo'],
        ['teams', 1, 'team', 'image'],
        ['teams', 1, 'team', 'image_url'],
        ['teams', 1, 'team', 'logoUrl'],
        ['match', 'teams', 1, 'logo'],
        ['match', 'teams', 1, 'image'],
        ['match', 'teams', 1, 'image_url'],
        ['match', 'teams', 1, 'logoUrl'],
        ['participants', 1, 'image'],
        ['participants', 1, 'logoUrl'],
        ['away_team', 'logo'],
        ['away_team', 'image_url'],
        ['team2', 'logo'],
        ['team2', 'image_url'],
        ['redTeam', 'logo'],
        ['redTeam', 'image_url'],
        ['opponents', 1, 'logo'],
        ['opponents', 1, 'image_url'],
        ['opponents', 1, 'opponent', 'logo'],
        ['opponents', 1, 'opponent', 'image_url'],
        ['teams', 1, 'logo'],
        ['teams', 1, 'image_url'],
        ['participants', 1, 'logo'],
        ['participants', 1, 'image_url'],
      ]);
      let actualHomeScore = this.pickLolScore(rawMatch, [
        ['homeScore'],
        ['home_score'],
        ['team1Score'],
        ['team1_score'],
        ['blueScore'],
        ['blue_score'],
        ['score', 'home'],
        ['scores', 'home'],
        ['result', 'home'],
        ['results', 'home'],
        ['home', 'score'],
        ['homeTeam', 'score'],
        ['home_team', 'score'],
        ['team1', 'score'],
        ['blueTeam', 'score'],
        ['opponents', 0, 'score'],
        ['opponents', 0, 'opponent', 'score'],
        ['teams', 0, 'score'],
        ['teams', 0, 'team', 'score'],
        ['participants', 0, 'score'],
      ]);
      let actualAwayScore = this.pickLolScore(rawMatch, [
        ['awayScore'],
        ['away_score'],
        ['team2Score'],
        ['team2_score'],
        ['redScore'],
        ['red_score'],
        ['score', 'away'],
        ['scores', 'away'],
        ['result', 'away'],
        ['results', 'away'],
        ['away', 'score'],
        ['awayTeam', 'score'],
        ['away_team', 'score'],
        ['team2', 'score'],
        ['redTeam', 'score'],
        ['opponents', 1, 'score'],
        ['opponents', 1, 'opponent', 'score'],
        ['teams', 1, 'score'],
        ['teams', 1, 'team', 'score'],
        ['participants', 1, 'score'],
      ]);

      const hasCompleteScore =
        actualHomeScore !== null && actualAwayScore !== null;

      if (status === 'PENDING' && hasCompleteScore && scheduledDate <= now) {
        status = 'FINISHED';
      }

      if (status === 'FINISHED' && !hasCompleteScore) {
        continue;
      }

      if (status !== 'FINISHED' && status !== 'LIVE' && scheduledDate < now) {
        continue;
      }

      if (status === 'PENDING' || status === 'CANCELLED') {
        actualHomeScore = null;
        actualAwayScore = null;
      }
      const resolvedCompetition = this.resolveLolCompetitionIdentity(
        rawMatch,
        String(competitionId),
        competitionName,
        homeName,
        awayName,
      );
      competitionId = resolvedCompetition.id;
      competitionName = resolvedCompetition.name;
      const matchId =
        this.pickString(rawMatch, [
          ['id'],
          ['matchId'],
          ['match_id'],
          ['match', 'id'],
          ['gameId'],
          ['game_id'],
        ]) || `${competitionId}:${scheduledTime}`;
      const region =
        this.pickString(rawMatch, [
          ['region'],
          ['country'],
          ['league', 'region'],
          ['competition', 'region'],
          ['tournament', 'region'],
        ]) || 'International';

      matchesById.set(String(matchId), {
        ...rawMatch,
        __competitionId: String(competitionId),
        __competitionName: competitionName,
        __region: region,
        __matchId: String(matchId),
        __homeName: homeName,
        __awayName: awayName,
        __homeLogoUrl: homeLogoUrl,
        __awayLogoUrl: awayLogoUrl,
        __scheduledTime: scheduledTime,
        __status: status,
        __actualHomeScore: actualHomeScore,
        __actualAwayScore: actualAwayScore,
      });
    }

    const matches = Array.from(matchesById.values()).sort(
      (first, second) =>
        new Date(first.__scheduledTime).getTime() -
        new Date(second.__scheduledTime).getTime(),
    );
    const competitionsById = new Map<string, LolCompetitionOption>();

    for (const match of matches) {
      const existing = competitionsById.get(match.__competitionId);
      const current = match.__status === 'LIVE';

      if (!existing) {
        const matchTime = new Date(match.__scheduledTime).getTime();
        const upcomingOrLive =
          match.__status === 'LIVE' || matchTime >= now.getTime();

        competitionsById.set(match.__competitionId, {
          id: match.__competitionId,
          name: match.__competitionName,
          region: match.__region,
          start: match.__scheduledTime,
          nextMatchAt: upcomingOrLive ? match.__scheduledTime : null,
          current,
          matches: 1,
        });
        continue;
      }

      const existingStartTime = new Date(existing.start ?? 0).getTime();
      const matchTime = new Date(match.__scheduledTime).getTime();
      const existingNextTime = existing.nextMatchAt
        ? new Date(existing.nextMatchAt).getTime()
        : Number.POSITIVE_INFINITY;
      const upcomingOrLive =
        match.__status === 'LIVE' || matchTime >= now.getTime();
      const nextMatchAt =
        upcomingOrLive && matchTime < existingNextTime
          ? match.__scheduledTime
          : existing.nextMatchAt;

      competitionsById.set(match.__competitionId, {
        ...existing,
        start:
          existingStartTime <= matchTime
            ? existing.start
            : match.__scheduledTime,
        nextMatchAt,
        current:
          existing.current ||
          current ||
          (upcomingOrLive && existingStartTime <= now.getTime()),
        matches: existing.matches + 1,
      });
    }

    return {
      competitions: Array.from(competitionsById.values()).sort(
        (first, second) => {
          const firstPriority = this.getLolCompetitionPriority(first.name);
          const secondPriority = this.getLolCompetitionPriority(second.name);

          if (firstPriority !== secondPriority) {
            return secondPriority - firstPriority;
          }

          if (first.current !== second.current) {
            return first.current ? -1 : 1;
          }

          return (
            new Date(first.nextMatchAt ?? first.start ?? 0).getTime() -
            new Date(second.nextMatchAt ?? second.start ?? 0).getTime()
          );
        },
      ),
      matches,
    };
  }

  private extractResponseArray(payload: unknown): CitoLolMatch[] {
    const matches: CitoLolMatch[] = [];
    const visited = new Set<unknown>();
    const envelopeKeys = [
      'data',
      'response',
      'schedule',
      'events',
      'matches',
      'items',
      'results',
      'sections',
    ];

    const visit = (value: unknown, depth: number) => {
      if (depth > 5 || value === null || visited.has(value)) {
        return;
      }

      if (typeof value === 'object') {
        visited.add(value);
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (this.isRecord(item) && this.isLolMatchCandidate(item)) {
            matches.push(item);
          } else {
            visit(item, depth + 1);
          }
        }
        return;
      }

      if (!this.isRecord(value)) {
        return;
      }

      if (this.isLolMatchCandidate(value)) {
        matches.push(value);
        return;
      }

      for (const key of envelopeKeys) {
        if (key in value) {
          visit(value[key], depth + 1);
        }
      }
    };

    visit(payload, 0);
    return matches;
  }

  private extractRecordArray(payload: unknown): CitoLolMatch[] {
    const records: CitoLolMatch[] = [];
    const visited = new Set<unknown>();
    const envelopeKeys = [
      'data',
      'response',
      'teams',
      'items',
      'results',
      'nodes',
    ];

    const visit = (value: unknown, depth: number) => {
      if (depth > 5 || value === null || visited.has(value)) {
        return;
      }

      if (typeof value === 'object') {
        visited.add(value);
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (this.isRecord(item)) {
            records.push(item);
          } else {
            visit(item, depth + 1);
          }
        }
        return;
      }

      if (!this.isRecord(value)) {
        return;
      }

      for (const key of envelopeKeys) {
        if (key in value) {
          visit(value[key], depth + 1);
        }
      }
    };

    visit(payload, 0);
    return records;
  }

  private async getLolTeamLogosByName(force: boolean) {
    if (
      !force &&
      this.lolTeamLogoCache &&
      this.lolTeamLogoCache.expiresAt > Date.now()
    ) {
      return this.lolTeamLogoCache.logosByName;
    }

    const apiKey = process.env.CITO_API_KEY?.trim();

    if (!apiKey) {
      return new Map<string, string>();
    }

    const payload = await fetchOptionalJson<unknown>(
      `${CITO_API_BASE_URL}/lol/teams`,
      { 'x-api-key': apiKey },
    );
    const logosByName = new Map<string, string>();

    for (const team of this.extractRecordArray(payload)) {
      const logoUrl = this.pickString(team, [
        ['logo'],
        ['logoUrl'],
        ['logo_url'],
        ['image'],
        ['imageUrl'],
        ['image_url'],
        ['avatar'],
        ['picture'],
        ['team', 'logo'],
        ['team', 'logoUrl'],
        ['team', 'logo_url'],
        ['team', 'image'],
        ['team', 'imageUrl'],
        ['team', 'image_url'],
      ]);

      if (!logoUrl) {
        continue;
      }

      const identifiers = [
        this.pickString(team, [['name'], ['teamName'], ['displayName']]),
        this.pickString(team, [['acronym'], ['code'], ['shortName']]),
        this.pickString(team, [['slug'], ['id'], ['team', 'slug']]),
        this.pickString(team, [
          ['team', 'name'],
          ['team', 'displayName'],
        ]),
        this.pickString(team, [
          ['team', 'acronym'],
          ['team', 'code'],
        ]),
      ];

      for (const identifier of identifiers) {
        if (identifier) {
          for (const alias of this.getTeamLookupAliases(identifier)) {
            logosByName.set(alias, logoUrl);
          }
        }
      }
    }

    this.lolTeamLogoCache = {
      expiresAt: Date.now() + LOL_CACHE_MS,
      logosByName,
    };

    return logosByName;
  }

  private getLolLogoForTeam(
    logosByName: Map<string, string>,
    teamName: string,
  ) {
    for (const key of this.getTeamLookupAliases(teamName)) {
      const logoUrl = logosByName.get(key);

      if (logoUrl) {
        return logoUrl;
      }
    }

    return null;
  }

  private normalizeTeamLookupKey(value: string) {
    return value
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/\b(esports|e-sports|gaming|team)\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private getLolCompetitionPriority(name: string) {
    const normalized = name.toLowerCase();

    if (
      normalized.includes('worlds') ||
      normalized.includes('world championship')
    ) {
      return 100;
    }

    if (normalized.includes('mid-season') || normalized.includes('msi')) {
      return 95;
    }

    if (normalized === 'lck') {
      return 90;
    }

    if (normalized === 'lpl') {
      return 89;
    }

    if (normalized === 'lec') {
      return 88;
    }

    if (normalized === 'lta' || normalized === 'lcs') {
      return 87;
    }

    if (normalized === 'vcs') {
      return 80;
    }

    if (normalized.includes('challengers') || normalized.includes('academy')) {
      return 30;
    }

    return 50;
  }

  private getTeamLookupAliases(value: string) {
    const normalized = this.normalizeTeamLookupKey(value);
    const aliases = new Set([normalized]);
    const withoutCommonSuffixes = normalized
      .replace(/\b(challengers|academy|global|youth|junior|juniors)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const compact = normalized.replace(/\s+/g, '');
    const firstToken = normalized.split(' ')[0];

    if (withoutCommonSuffixes) {
      aliases.add(withoutCommonSuffixes);
    }

    if (compact) {
      aliases.add(compact);
    }

    if (firstToken && firstToken.length >= 2) {
      aliases.add(firstToken);
    }

    return Array.from(aliases).filter(Boolean);
  }

  private isLolMatchCandidate(value: CitoLolMatch) {
    const scheduledTime = this.pickString(value, [
      ['scheduled_at'],
      ['scheduledAt'],
      ['start_time'],
      ['startTime'],
      ['begin_at'],
      ['beginAt'],
      ['date'],
      ['matchDate'],
      ['time'],
    ]);
    const matchId = this.pickString(value, [
      ['id'],
      ['matchId'],
      ['match_id'],
      ['match', 'id'],
      ['gameId'],
      ['game_id'],
    ]);

    return Boolean(scheduledTime && matchId);
  }

  private withLolLeagueIdentity(
    matches: CitoLolMatch[],
    leagueSlug: string,
    leagueName: string,
  ) {
    return matches.map((match) => ({
      ...match,
      __forcedLeagueSlug: leagueSlug,
      __forcedLeagueName: leagueName,
    }));
  }

  private getLolTournamentId(match: CitoLolMatch) {
    return this.pickString(match, [
      ['tournamentId'],
      ['tournament_id'],
      ['tournament', 'id'],
      ['tournament', 'slug'],
      ['serie', 'id'],
      ['serie', 'slug'],
      ['competition', 'id'],
      ['competition', 'slug'],
    ]);
  }

  private pickString(
    source: unknown,
    paths: Array<Array<string | number>>,
  ): string | null {
    for (const path of paths) {
      let value = source;

      for (const segment of path) {
        if (typeof segment === 'number') {
          value = Array.isArray(value) ? value[segment] : undefined;
        } else {
          value = this.isRecord(value) ? value[segment] : undefined;
        }
      }

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }

    return null;
  }

  private pickLolScore(
    source: unknown,
    paths: Array<Array<string | number>>,
  ): number | null {
    for (const path of paths) {
      let value = source;

      for (const segment of path) {
        if (typeof segment === 'number') {
          value = Array.isArray(value) ? value[segment] : undefined;
        } else {
          value = this.isRecord(value) ? value[segment] : undefined;
        }
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return null;
  }

  private normalizeDateString(value: string | null) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString();
  }

  private mapLolStatus(status: string | null) {
    const normalized = (status || '').toUpperCase();

    if (
      ['LIVE', 'RUNNING', 'IN_PROGRESS', 'IN PROGRESS', 'STARTED'].includes(
        normalized,
      )
    ) {
      return 'LIVE' as const;
    }

    if (['FINISHED', 'COMPLETED', 'ENDED', 'CLOSED'].includes(normalized)) {
      return 'FINISHED' as const;
    }

    if (
      ['CANCELLED', 'CANCELED', 'POSTPONED', 'DELAYED'].includes(normalized)
    ) {
      return 'CANCELLED' as const;
    }

    return 'PENDING' as const;
  }

  private normalizeLolCompetitionName(name: string, identifier: string) {
    const normalizedIdentifier = identifier
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');

    if (
      normalizedIdentifier.includes('lck_challengers') ||
      normalizedIdentifier.includes('lck_cl')
    ) {
      return 'LCK Challengers';
    }

    if (['lck', 'lol_lck'].includes(normalizedIdentifier)) {
      return 'LCK';
    }

    return name;
  }

  private resolveLolCompetitionIdentity(
    rawMatch: CitoLolMatch,
    fallbackId: string,
    fallbackName: string,
    homeName: string,
    awayName: string,
  ) {
    const rawLeagueIdentity =
      this.pickString(rawMatch, [
        ['league', 'slug'],
        ['leagueSlug'],
        ['leagueId'],
        ['competition', 'slug'],
        ['tournament', 'slug'],
        ['serie', 'slug'],
        ['league_slug'],
        ['leagueSlug'],
        ['competition_slug'],
        ['competitionSlug'],
        ['tournament_slug'],
        ['tournamentSlug'],
        ['league', 'name'],
        ['leagueName'],
        ['competition', 'name'],
        ['tournament', 'name'],
        ['serie', 'name'],
        ['leagueName'],
        ['competitionName'],
        ['tournamentName'],
      ]) || '';
    const leagueIdentity = `${rawLeagueIdentity} ${fallbackId} ${fallbackName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');

    if (!leagueIdentity.includes('lck')) {
      return { id: fallbackId, name: fallbackName };
    }

    const teams = `${homeName} ${awayName}`.toLowerCase();
    const isChallengers =
      leagueIdentity.includes('lck_challenger') ||
      leagueIdentity.includes('lck_cl') ||
      /\b(challengers?|academy|global academy)\b/i.test(teams);

    if (isChallengers) {
      return { id: 'lck_challengers', name: 'LCK Challengers' };
    }

    return { id: 'lck', name: 'LCK' };
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private toFootballDataOrgCompetitionOption(
    competition: (typeof FOOTBALL_DATA_ORG_IMPORT_COMPETITIONS)[number],
  ): FootballCompetitionOption {
    const season = this.getCurrentEuropeanFootballSeason();
    const start = `${season}-08-01`;
    const end = `${season + 1}-06-30`;

    return {
      id: competition.id,
      name: competition.name,
      country: competition.country,
      season,
      start,
      end,
      current: this.mapTournamentStatusFromDates(start, end) === 'ONGOING',
      type: competition.type,
    };
  }

  private getCurrentEuropeanFootballSeason() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    return month >= 6 ? year : year - 1;
  }

  private getCompetitionPhasePriority(option: FootballCompetitionOption) {
    const now = new Date();
    const start = option.start ? new Date(option.start) : null;
    const end = option.end ? new Date(option.end) : null;

    if ((!start || start <= now) && (!end || end >= now)) {
      return 2;
    }

    if (start && start > now) {
      return 1;
    }

    return 0;
  }

  private toF1MeetingOption(meeting: OpenF1Meeting): F1MeetingOption {
    return {
      id: meeting.meeting_key,
      name:
        meeting.meeting_name || meeting.meeting_official_name || 'Formula 1',
      country: meeting.country_name || 'International',
      circuit: meeting.circuit_short_name || 'TBD',
      start: meeting.date_start,
      end: meeting.date_end,
      current: this.isLiveWindow(meeting.date_start, meeting.date_end),
    };
  }

  private isF1MeetingImportable(meeting: OpenF1Meeting) {
    if (meeting.is_cancelled) {
      return false;
    }

    return new Date(meeting.date_end) >= new Date();
  }

  private getCompetitionPriority(option: FootballCompetitionOption) {
    const normalizedName = option.name.toLowerCase();
    const normalizedCountry = option.country.toLowerCase();

    const featured = FEATURED_FOOTBALL_COMPETITIONS.find((competition) => {
      const hasName = competition.tokens.every((token) =>
        normalizedName.includes(token),
      );
      const hasCountry =
        !competition.country || normalizedCountry.includes(competition.country);

      return hasName && hasCountry;
    });

    if (featured) {
      return featured.rank;
    }

    if (normalizedName.includes('asean') || normalizedName.includes('aff')) {
      return 50;
    }

    if (
      normalizedName.includes('world cup') ||
      normalizedName.includes('championship') ||
      normalizedName.includes('cup')
    ) {
      return 20;
    }

    return 1;
  }

  private formatVietnamDateKey(date: Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private async findAdminId() {
    const [admin] = await this.usersRepository.query(`
      SELECT id
      FROM users
      WHERE role IN ('SUPER_ADMIN', 'ADMIN')
      ORDER BY CASE WHEN role = 'SUPER_ADMIN' THEN 0 ELSE 1 END, id ASC
      LIMIT 1
    `);

    return admin ? Number(admin.id) : null;
  }

  private mapMatchStatus(status: string) {
    if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(status)) {
      return 'LIVE' as const;
    }

    if (['FT', 'AET', 'PEN', 'FINISHED'].includes(status)) {
      return 'FINISHED' as const;
    }

    if (
      [
        'CANC',
        'PST',
        'SUSP',
        'ABD',
        'AWD',
        'WO',
        'CANCELLED',
        'POSTPONED',
        'SUSPENDED',
      ].includes(status)
    ) {
      return 'CANCELLED' as const;
    }

    return 'PENDING' as const;
  }

  private mapFootballDataOrgStatus(status: string) {
    const normalized = status.toUpperCase();

    if (['IN_PLAY', 'PAUSED'].includes(normalized)) {
      return 'LIVE';
    }

    if (normalized === 'FINISHED') {
      return 'FT';
    }

    if (
      ['CANCELLED', 'POSTPONED', 'SUSPENDED', 'AWARDED'].includes(normalized)
    ) {
      return 'CANC';
    }

    return 'NS';
  }

  private mapTournamentStatus(status: string) {
    if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(status)) {
      return 'ONGOING' as const;
    }

    if (['FT', 'AET', 'PEN', 'FINISHED'].includes(status)) {
      return 'COMPLETE' as const;
    }

    if (
      [
        'CANC',
        'PST',
        'SUSP',
        'ABD',
        'AWD',
        'WO',
        'CANCELLED',
        'POSTPONED',
        'SUSPENDED',
      ].includes(status)
    ) {
      return 'COMPLETE' as const;
    }

    return 'ONGOING' as const;
  }

  private isLiveWindow(startValue: string, endValue: string) {
    const now = new Date();
    return new Date(startValue) <= now && new Date(endValue) >= now;
  }

  private tournamentStatusExpression(
    startColumn: string,
    endColumn: string,
    fallbackColumn: string,
  ) {
    return `
      CASE
        WHEN ${endColumn} IS NOT NULL AND ${endColumn} < NOW() THEN 'COMPLETE'
        WHEN ${startColumn} IS NOT NULL AND ${startColumn} > NOW() THEN 'UPCOMING'
        WHEN ${startColumn} IS NOT NULL OR ${endColumn} IS NOT NULL THEN 'ONGOING'
        WHEN ${fallbackColumn} IN ('ACTIVE', 'LIVE', 'ONGOING') THEN 'ONGOING'
        WHEN ${fallbackColumn} IN ('COMPLETED', 'COMPLETE', 'FINISHED', 'CANCELLED', 'CANCELED') THEN 'COMPLETE'
        ELSE 'UPCOMING'
      END
    `;
  }

  private async ensureTeamLogoColumn() {
    await this.usersRepository.query(`
      ALTER TABLE teams
      ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) NULL
    `);
  }
  private async ensureSportTypeConstraint() {
    await this.usersRepository.query(`
      ALTER TABLE tournaments
      DROP CONSTRAINT IF EXISTS chk_tournaments_sport_type
    `);
    await this.usersRepository.query(`
      UPDATE tournaments
      SET sport_type = CASE
        WHEN sport_type = 'ESPORTS' THEN 'LOL'
        WHEN sport_type = 'BASKETBALL' THEN 'OTHER'
        ELSE sport_type
      END
      WHERE sport_type IN ('ESPORTS', 'BASKETBALL')
    `);
    await this.usersRepository.query(`
      ALTER TABLE tournaments
      ADD CONSTRAINT chk_tournaments_sport_type
      CHECK (sport_type IN ('FOOTBALL', 'F1', 'LOL', 'OTHER'))
    `);
  }
}
