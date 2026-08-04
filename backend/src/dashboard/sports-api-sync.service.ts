import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

const LOL_CACHE_MS = 24 * 60 * 60 * 1000;
const FOOTBALL_API_BASE_URL = 'https://v3.football.api-sports.io';
const OPENF1_API_BASE_URL = 'https://api.openf1.org/v1';
const CITO_API_BASE_URL = 'https://api.citoapi.com/api/v1';
const ESPN_SOCCER_API_BASE_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer';

type FootballCompetition = {
  league: {
    id: number;
    name: string;
    type?: string;
  };
  country?: {
    name?: string;
  };
  seasons?: Array<{
    year: number;
    start?: string;
    end?: string;
    current?: boolean;
  }>;
};

export type FootballCompetitionOption = {
  id: number;
  name: string;
  country: string;
  season: number;
  start: string | null;
  end: string | null;
  current: boolean;
  type: string;
};

type FootballMatch = {
  fixture: {
    id: number | string;
    date: string;
    status?: {
      short?: string;
      long?: string;
    };
  };
  league?: { name: string };
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  teams?: {
    home?: { name?: string };
    away?: { name?: string };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
};

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

export type F1MeetingOption = {
  id: number;
  name: string;
  country: string;
  circuit: string;
  start: string;
  end: string;
  current: boolean;
};

export type LolCompetitionOption = {
  id: string;
  name: string;
  region: string;
  start: string | null;
  nextMatchAt: string | null;
  current: boolean;
  matches: number;
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
      __scheduledTime: string;
      __status: 'PENDING' | 'LIVE' | 'FINISHED' | 'CANCELLED';
    }
  >;
};

@Injectable()
export class SportsApiSyncService {
  private lolScheduleCache: {
    expiresAt: number;
    snapshot: LolScheduleSnapshot;
  } | null = null;

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
              t.sport_type IN ('FOOTBALL', 'F1', 'ESPORTS')
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

  async listFootballCompetitions() {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY?.trim();

    if (!apiKey) {
      throw new Error('FOOTBALL_DATA_API_KEY is not configured.');
    }

    const headers = { 'x-apisports-key': apiKey };
    const responses = await Promise.all([
      this.fetchJson<{ response?: FootballCompetition[] }>(
        `${FOOTBALL_API_BASE_URL}/leagues?current=true`,
        headers,
      ),
      this.fetchJson<{ response?: FootballCompetition[] }>(
        `${FOOTBALL_API_BASE_URL}/leagues?search=ASEAN`,
        headers,
      ),
      this.fetchJson<{ response?: FootballCompetition[] }>(
        `${FOOTBALL_API_BASE_URL}/leagues?search=AFF`,
        headers,
      ),
    ]);
    const optionsByKey = new Map<string, FootballCompetitionOption>();

    for (const competition of responses.flatMap(
      (response) => response.response ?? [],
    )) {
      for (const option of this.toFootballCompetitionOptions(competition)) {
        optionsByKey.set(`${option.id}:${option.season}`, option);
      }
    }

    return Array.from(optionsByKey.values())
      .filter((option) => this.isCompetitionImportable(option))
      .sort((first, second) => {
        const firstPhasePriority = this.getCompetitionPhasePriority(first);
        const secondPhasePriority = this.getCompetitionPhasePriority(second);

        if (firstPhasePriority !== secondPhasePriority) {
          return secondPhasePriority - firstPhasePriority;
        }

        const firstPriority = this.getCompetitionPriority(first.name);
        const secondPriority = this.getCompetitionPriority(second.name);

        if (firstPriority !== secondPriority) {
          return secondPriority - firstPriority;
        }

        return first.name.localeCompare(second.name);
      })
      .slice(0, 120);
  }

  async syncSelectedFootballLeagues(
    leagues: Array<{ id: number; season: number; name?: string }>,
  ) {
    await this.ensureSportTypeConstraint();

    const adminId = await this.findAdminId();

    if (!adminId) {
      throw new Error('Admin account was not found.');
    }

    const apiKey = process.env.FOOTBALL_DATA_API_KEY?.trim();

    if (!apiKey) {
      throw new Error('FOOTBALL_DATA_API_KEY is not configured.');
    }

    const selectedLeagues = leagues
      .map((league) => ({
        id: Number(league.id),
        season: Number(league.season),
        name: typeof league.name === 'string' ? league.name.trim() : '',
      }))
      .filter(
        (league) =>
          Number.isInteger(league.id) && Number.isInteger(league.season),
      );

    if (selectedLeagues.length === 0) {
      throw new Error('Please choose at least one football competition.');
    }

    const headers = { 'x-apisports-key': apiKey };
    let competitionCount = 0;
    let matchCount = 0;

    for (const league of selectedLeagues) {
      const isAseanChampionship =
        league.name.trim().toLowerCase() === 'asean championship';
      const fixtures = isAseanChampionship
        ? await this.fetchAseanChampionshipFixtures(league.season)
        : await this.fetchFootballFixturesForLeague(
            league.id,
            league.season,
            headers,
          );
      const competitionName = fixtures[0]?.league?.name || league.name;

      if (!competitionName || fixtures.length === 0) {
        continue;
      }

      const importedMatches = await this.syncFootballMatches(
        adminId,
        fixtures,
        isAseanChampionship ? 'ESPN_ASEAN' : 'FOOTBALL_DATA',
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
          ? 'No fixtures were returned by API-SPORTS for the selected competitions.'
          : null,
    };
  }

  async listF1Meetings() {
    const now = new Date();
    const years = [now.getUTCFullYear(), now.getUTCFullYear() + 1];
    const meetingResponses = await Promise.all(
      years.map((year) =>
        this.fetchOptionalJson<OpenF1Meeting[]>(
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
          this.fetchOptionalJson<OpenF1Meeting[]>(
            `${OPENF1_API_BASE_URL}/meetings?year=${year}`,
          ),
        ),
      ),
      Promise.all(
        years.map((year) =>
          this.fetchOptionalJson<OpenF1Session[]>(
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
    const snapshot = await this.getLolScheduleSnapshot(false);

    return snapshot.competitions.slice(0, 80);
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

    const snapshot = await this.getLolScheduleSnapshot(false);
    const selectedMatches = snapshot.matches.filter((match) =>
      selectedIds.has(match.__competitionId),
    );
    const selectedCompetitions = snapshot.competitions.filter((competition) =>
      selectedIds.has(competition.id),
    );
    let matchCount = 0;

    for (const competition of selectedCompetitions) {
      const tournamentMatches = selectedMatches.filter(
        (match) => match.__competitionId === competition.id,
      );
      const tournamentId = await this.upsertTournament({
        name: competition.name,
        sportType: 'ESPORTS',
        status: competition.current ? 'ACTIVE' : 'UPCOMING',
        adminId,
      });
      const stageId = await this.upsertStage(tournamentId, 'League Schedule');

      for (const match of tournamentMatches) {
        const homeTeamId = await this.upsertTeam(
          tournamentId,
          match.__homeName,
        );
        const awayTeamId = await this.upsertTeam(
          tournamentId,
          match.__awayName,
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
          actualHomeScore: null,
          actualAwayScore: null,
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
    const apiKey = process.env.FOOTBALL_DATA_API_KEY?.trim();

    if (!apiKey) {
      return {
        competitions: 0,
        matches: 0,
        error: 'FOOTBALL_DATA_API_KEY is not configured.',
      };
    }

    const headers = { 'x-apisports-key': apiKey };
    const today = this.formatApiDate(new Date());
    const [liveMatchesResponse, todayMatchesResponse] = await Promise.all([
      this.fetchJson<{ response?: FootballMatch[] }>(
        `${FOOTBALL_API_BASE_URL}/fixtures?live=all`,
        headers,
      ),
      this.fetchJson<{ response?: FootballMatch[] }>(
        `${FOOTBALL_API_BASE_URL}/fixtures?date=${today}`,
        headers,
      ),
    ]);
    const matchesById = new Map<string, FootballMatch>();

    for (const match of [
      ...(liveMatchesResponse.response ?? []),
      ...(todayMatchesResponse.response ?? []),
    ]) {
      if (
        match.fixture?.id &&
        (this.isFootballFixtureToday(match) ||
          this.mapMatchStatus(match.fixture.status?.short ?? '') === 'LIVE')
      ) {
        matchesById.set(String(match.fixture.id), match);
      }
    }

    const competitionNames = new Set(
      Array.from(matchesById.values())
        .map((match) => match.league?.name?.trim())
        .filter((name): name is string => Boolean(name)),
    );
    const matchCount = await this.syncFootballMatches(
      adminId,
      matchesById.values(),
    );

    return {
      competitions: competitionNames.size,
      matches: matchCount,
      error:
        matchCount === 0
          ? 'No live or scheduled football fixtures were returned for today.'
          : null,
    };
  }

  private async syncFootballMatches(
    adminId: number,
    matches: Iterable<FootballMatch>,
    source: 'FOOTBALL_DATA' | 'ESPN_ASEAN' = 'FOOTBALL_DATA',
  ) {
    let matchCount = 0;

    for (const match of matches) {
      if (!match.league?.name) {
        continue;
      }

      const tournamentId = await this.upsertTournament({
        name: match.league.name,
        sportType: 'FOOTBALL',
        status: this.mapTournamentStatus(match.fixture.status?.short ?? ''),
        adminId,
      });
      const stageId = await this.upsertStage(tournamentId, 'API Feed');
      const homeName =
        match.teams?.home?.name || match.homeTeam?.name || 'Home team';
      const awayName =
        match.teams?.away?.name || match.awayTeam?.name || 'Away team';
      const homeTeamId = await this.upsertTeam(tournamentId, homeName);
      const awayTeamId = await this.upsertTeam(tournamentId, awayName);

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

  private async fetchAseanChampionshipFixtures(season: number) {
    const response = await this.fetchJson<{ events?: EspnSoccerEvent[] }>(
      `${ESPN_SOCCER_API_BASE_URL}/aff.championship/scoreboard?dates=${season}0101-${season}1231`,
    );

    return (response.events ?? [])
      .map((event) => this.mapEspnAseanEvent(event))
      .filter(
        (match): match is FootballMatch =>
          match !== null && this.isFootballFixtureCurrentOrFuture(match),
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
        home: { name: home.team.displayName },
        away: { name: away.team.displayName },
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

  private async fetchFootballFixturesForLeague(
    leagueId: number,
    season: number,
    headers: Record<string, string>,
  ) {
    const now = new Date();
    const shortFrom = this.formatApiDate(
      new Date(now.getTime() - 3 * 60 * 60 * 1000),
    );
    const shortTo = this.formatApiDate(
      new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
    );
    const queries = [
      `league=${leagueId}&season=${season}&from=${shortFrom}&to=${shortTo}`,
      `league=${leagueId}&season=${season}&next=50`,
    ];
    const fixturesById = new Map<string, FootballMatch>();

    for (const query of queries) {
      const response = await this.fetchJson<{ response?: FootballMatch[] }>(
        `${FOOTBALL_API_BASE_URL}/fixtures?${query}`,
        headers,
      );

      for (const match of response.response ?? []) {
        if (match.fixture?.id && this.isFootballFixtureCurrentOrFuture(match)) {
          fixturesById.set(String(match.fixture.id), match);
        }
      }

      if (fixturesById.size > 0) {
        break;
      }
    }

    return Array.from(fixturesById.values());
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

  private isFootballFixtureToday(match: FootballMatch) {
    const scheduledTime = new Date(match.fixture.date);

    if (Number.isNaN(scheduledTime.getTime())) {
      return false;
    }

    return (
      this.formatVietnamDateKey(scheduledTime) ===
      this.formatVietnamDateKey(new Date())
    );
  }

  private async syncF1(adminId: number) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const nextWindow = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    const [meetings, sessions] = await Promise.all([
      this.fetchJson<OpenF1Meeting[]>(
        `${OPENF1_API_BASE_URL}/meetings?year=${year}`,
      ),
      this.fetchJson<OpenF1Session[]>(
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
      status: this.isLiveWindow(meeting.date_start, meeting.date_end)
        ? 'ACTIVE'
        : 'UPCOMING',
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
    sportType: 'FOOTBALL' | 'F1' | 'ESPORTS';
    status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
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
          SET status = $1, updated_at = NOW()
          WHERE id = $2
        `,
        [data.status, existing.id],
      );
      return Number(existing.id);
    }

    const [created] = await this.usersRepository.query(
      `
        INSERT INTO tournaments
          (name, sport_type, format, status, visibility, created_by)
        VALUES ($1, $2, 'ROUND_ROBIN', $3, 'PUBLIC', $4)
        RETURNING id
      `,
      [data.name, data.sportType, data.status, data.adminId],
    );

    return Number(created.id);
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

  private async upsertTeam(tournamentId: number, name: string) {
    const [existing] = await this.usersRepository.query(
      `
        SELECT id
        FROM teams
        WHERE tournament_id = $1
          AND LOWER(name) = LOWER($2)
        LIMIT 1
      `,
      [tournamentId, name],
    );

    if (existing) {
      return Number(existing.id);
    }

    const [created] = await this.usersRepository.query(
      `
        INSERT INTO teams (tournament_id, name)
        VALUES ($1, $2)
        RETURNING id
      `,
      [tournamentId, name],
    );

    return Number(created.id);
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
      lckResponse,
      lckChallengersResponse,
    ] = await Promise.all([
      this.fetchJson<unknown>(
        `${CITO_API_BASE_URL}/lol/schedule/today`,
        headers,
      ),
      this.fetchJson<unknown>(
        `${CITO_API_BASE_URL}/lol/schedule/upcoming`,
        headers,
      ),
      this.fetchOptionalJson<unknown>(
        `${CITO_API_BASE_URL}/lol/leagues/lck/schedule`,
        headers,
      ),
      this.fetchOptionalJson<unknown>(
        `${CITO_API_BASE_URL}/lol/leagues/lck_challengers/schedule`,
        headers,
      ),
    ]);
    const rawMatches = [
      ...this.extractResponseArray(todayResponse),
      ...this.extractResponseArray(upcomingResponse),
      ...this.withLolLeagueIdentity(
        this.extractResponseArray(lckResponse),
        'lck',
        'LCK',
      ),
      ...this.withLolLeagueIdentity(
        this.extractResponseArray(lckChallengersResponse),
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
      const status = this.mapLolStatus(
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

      if (status !== 'LIVE' && scheduledDate < now) {
        continue;
      }

      const rawCompetitionName =
        this.pickString(rawMatch, [
          ['__forcedLeagueName'],
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
          ['teams', 0, 'name'],
          ['match', 'teams', 0, 'name'],
          ['participants', 0, 'name'],
        ]) || 'Team 1';
      const awayName =
        this.pickString(rawMatch, [
          ['awayTeam', 'name'],
          ['away_team', 'name'],
          ['team2', 'name'],
          ['redTeam', 'name'],
          ['opponents', 1, 'name'],
          ['teams', 1, 'name'],
          ['match', 'teams', 1, 'name'],
          ['participants', 1, 'name'],
        ]) || 'Team 2';
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
        __scheduledTime: scheduledTime,
        __status: status,
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
        competitionsById.set(match.__competitionId, {
          id: match.__competitionId,
          name: match.__competitionName,
          region: match.__region,
          start: match.__scheduledTime,
          nextMatchAt: match.__scheduledTime,
          current,
          matches: 1,
        });
        continue;
      }

      const existingStartTime = new Date(existing.start ?? 0).getTime();
      const existingNextTime = new Date(existing.nextMatchAt ?? 0).getTime();
      const matchTime = new Date(match.__scheduledTime).getTime();

      competitionsById.set(match.__competitionId, {
        ...existing,
        start:
          existingStartTime <= matchTime
            ? existing.start
            : match.__scheduledTime,
        nextMatchAt:
          existingNextTime <= matchTime
            ? existing.nextMatchAt
            : match.__scheduledTime,
        current: existing.current || current,
        matches: existing.matches + 1,
      });
    }

    return {
      competitions: Array.from(competitionsById.values()).sort(
        (first, second) => {
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

  private async fetchJson<T>(url: string, headers?: Record<string, string>) {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API request failed ${response.status}: ${text}`);
    }

    return (await response.json()) as T;
  }

  private async fetchOptionalJson<T>(
    url: string,
    headers?: Record<string, string>,
  ) {
    try {
      return await this.fetchJson<T>(url, headers);
    } catch {
      return null;
    }
  }

  private toFootballCompetitionOptions(
    competition: FootballCompetition,
  ): FootballCompetitionOption[] {
    if (!competition.league?.id || !competition.league.name) {
      return [];
    }

    return (competition.seasons ?? [])
      .filter((season) => Boolean(season.year))
      .map((season) => ({
        id: competition.league.id,
        name: competition.league.name,
        country: competition.country?.name || 'International',
        season: season.year,
        start: season.start ?? null,
        end: season.end ?? null,
        current: Boolean(season.current),
        type: competition.league.type || 'League',
      }));
  }

  private isCompetitionImportable(option: FootballCompetitionOption) {
    const now = new Date();
    const start = option.start ? new Date(option.start) : null;
    const end = option.end ? new Date(option.end) : null;

    if (end && end < now) {
      return false;
    }

    return Boolean(start || end);
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

  private getCompetitionPriority(name: string) {
    const normalized = name.toLowerCase();

    if (normalized.includes('asean') || normalized.includes('aff')) {
      return 3;
    }

    if (
      normalized.includes('world cup') ||
      normalized.includes('championship') ||
      normalized.includes('cup')
    ) {
      return 2;
    }

    return 1;
  }

  private formatApiDate(date: Date) {
    return this.formatVietnamDateKey(date);
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

  private mapTournamentStatus(status: string) {
    if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(status)) {
      return 'ACTIVE' as const;
    }

    if (['FT', 'AET', 'PEN', 'FINISHED'].includes(status)) {
      return 'COMPLETED' as const;
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

    return 'ACTIVE' as const;
  }

  private isLiveWindow(startValue: string, endValue: string) {
    const now = new Date();
    return new Date(startValue) <= now && new Date(endValue) >= now;
  }

  private async ensureSportTypeConstraint() {
    await this.usersRepository.query(`
      ALTER TABLE tournaments
      DROP CONSTRAINT IF EXISTS chk_tournaments_sport_type
    `);
    await this.usersRepository.query(`
      ALTER TABLE tournaments
      ADD CONSTRAINT chk_tournaments_sport_type
      CHECK (sport_type IN ('FOOTBALL', 'F1', 'BASKETBALL', 'ESPORTS'))
    `);
  }
}
