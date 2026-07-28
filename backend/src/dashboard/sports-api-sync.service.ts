import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

const SYNC_INTERVAL_MS = 14.4 * 60 * 1000;
const FOOTBALL_API_BASE_URL = 'https://v3.football.api-sports.io';
const OPENF1_API_BASE_URL = 'https://api.openf1.org/v1';

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

type FootballMatch = {
  fixture: {
    id: number;
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

@Injectable()
export class SportsApiSyncService {
  private lastSyncAttempt = 0;
  private inFlight: Promise<SyncResult> | null = null;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async syncIfStale(force = false) {
    if (!force && Date.now() - this.lastSyncAttempt < SYNC_INTERVAL_MS) {
      return {
        skipped: true,
        message: 'API cache is still fresh.',
        nextSyncAt: new Date(
          this.lastSyncAttempt + SYNC_INTERVAL_MS,
        ).toISOString(),
      };
    }

    if (this.inFlight) {
      return this.inFlight;
    }

    this.lastSyncAttempt = Date.now();
    this.inFlight = this.syncExternalData().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
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
    const season = new Date().getUTCFullYear();
    const [competitionsResponse, liveMatchesResponse, upcomingMatchesResponse] =
      await Promise.all([
      this.fetchJson<{ response?: FootballCompetition[] }>(
        `${FOOTBALL_API_BASE_URL}/leagues?current=true`,
        headers,
      ),
      this.fetchJson<{ response?: FootballMatch[] }>(
        `${FOOTBALL_API_BASE_URL}/fixtures?live=all`,
        headers,
      ),
      this.fetchJson<{ response?: FootballMatch[] }>(
        `${FOOTBALL_API_BASE_URL}/fixtures?next=30`,
        headers,
      ),
    ]);
    const now = new Date();
    const matchesById = new Map<number, FootballMatch>();
    let competitionCount = 0;
    let matchCount = 0;

    for (const competition of (competitionsResponse.response ?? []).slice(
      0,
      80,
    )) {
      if (!competition.league?.name) {
        continue;
      }

      const currentSeason =
        competition.seasons?.find((item) => item.current) ??
        competition.seasons?.find((item) => item.year === season);
      const start = currentSeason?.start
        ? new Date(currentSeason.start)
        : null;
      const end = currentSeason?.end
        ? new Date(currentSeason.end)
        : null;

      if ((start && start > now) || (end && end < now)) {
        continue;
      }

      await this.upsertTournament({
        name: competition.league.name,
        sportType: 'FOOTBALL',
        status: 'ACTIVE',
        adminId,
      });
      competitionCount += 1;
    }

    for (const match of [
      ...(liveMatchesResponse.response ?? []),
      ...(upcomingMatchesResponse.response ?? []),
    ]) {
      if (match.fixture?.id) {
        matchesById.set(match.fixture.id, match);
      }
    }

    for (const match of matchesById.values()) {
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
      const homeName = match.teams?.home?.name || match.homeTeam?.name || 'Home team';
      const awayName = match.teams?.away?.name || match.awayTeam?.name || 'Away team';
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
        source: 'FOOTBALL_DATA',
        externalMatchId: String(match.fixture.id),
        actualHomeScore: match.goals?.home ?? null,
        actualAwayScore: match.goals?.away ?? null,
      });
      matchCount += 1;
    }

    return { competitions: competitionCount, matches: matchCount, error: null };
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
            : new Date(session.date_end) < now
              ? 'FINISHED'
              : 'PENDING',
          source: 'OPENF1',
          externalMatchId: String(session.session_key),
          actualHomeScore: null,
          actualAwayScore: null,
        });
        sessionCount += 1;
      }

      meetingCount += 1;
    }

    return { meetings: meetingCount, sessions: sessionCount, error: null };
  }

  private async upsertTournament(data: {
    name: string;
    sportType: 'FOOTBALL' | 'F1';
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
    source: 'FOOTBALL_DATA' | 'OPENF1';
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

  private async fetchJson<T>(url: string, headers?: Record<string, string>) {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API request failed ${response.status}: ${text}`);
    }

    return (await response.json()) as T;
  }

  private async findAdminId() {
    const [admin] = await this.usersRepository.query(`
      SELECT id
      FROM users
      WHERE role = 'ADMIN'
      ORDER BY id ASC
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

    if (['CANC', 'PST', 'SUSP', 'ABD', 'AWD', 'WO', 'CANCELLED', 'POSTPONED', 'SUSPENDED'].includes(status)) {
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

    if (['CANC', 'PST', 'SUSP', 'ABD', 'AWD', 'WO', 'CANCELLED', 'POSTPONED', 'SUSPENDED'].includes(status)) {
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
