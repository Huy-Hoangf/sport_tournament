import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

type DashboardScope = 'today' | 'all';
type TournamentVisibility = 'PUBLIC' | 'PRIVATE';

type DashboardSummaryRow = {
  activeTournaments: string | number | null;
  totalPlayers: string | number | null;
  upcomingMatches: string | number | null;
  inactivePlayers: string | number | null;
  pendingPlayers: string | number | null;
  pendingPredictions: string | number | null;
  warningMatches: string | number | null;
  lastApiSync: string | null;
};

type DashboardTournamentRow = {
  id: string | number;
  name: string;
  sportType: string;
  status: string;
  visibility: TournamentVisibility | null;
  teams: string | number | null;
  matches: string | number | null;
  source: string | null;
};

type DashboardMatchRow = {
  id: string | number;
  tournamentId?: string | number;
  tournamentName: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
  scheduledTime: string;
  deadline: string;
  source: string | null;
  status: string;
  actualHomeScore: string | number | null;
  actualAwayScore: string | number | null;
};

type DashboardActivityRow = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

type DashboardInactivePlayerRow = {
  id: string | number;
  memberCode: string;
  fullName: string;
  email: string;
  status: string;
  updatedAt: string;
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getDashboard({
    includeAttentionDetails = false,
    includePrivateTournaments = false,
    scope = 'today',
  }: {
    includeAttentionDetails?: boolean;
    includePrivateTournaments?: boolean;
    scope?: DashboardScope;
  } = {}) {
    await this.ensureTeamLogoColumn();

    const dashboardQueries: [
      Promise<DashboardSummaryRow[]>,
      Promise<DashboardTournamentRow[]>,
      Promise<DashboardMatchRow[]>,
      Promise<DashboardMatchRow[]>,
      Promise<DashboardActivityRow[]>,
      Promise<DashboardInactivePlayerRow[]>,
    ] = [
      this.usersRepository.query<DashboardSummaryRow[]>(
        this.summaryQuery(scope, includePrivateTournaments),
      ),
      this.usersRepository.query<DashboardTournamentRow[]>(
        this.tournamentsQuery(scope, includePrivateTournaments),
      ),
      this.usersRepository.query<DashboardMatchRow[]>(
        this.tournamentMatchesQuery(scope, includePrivateTournaments),
      ),
      this.usersRepository.query<DashboardMatchRow[]>(
        this.upcomingScheduleQuery(scope, includePrivateTournaments),
      ),
      this.usersRepository.query<DashboardActivityRow[]>(
        this.activitiesQuery(includePrivateTournaments),
      ),
      includeAttentionDetails
        ? this.usersRepository.query<DashboardInactivePlayerRow[]>(
            this.inactivePlayersQuery(),
          )
        : Promise.resolve<DashboardInactivePlayerRow[]>([]),
    ];

    const [
      summaryRows,
      tournaments,
      tournamentMatches,
      upcomingSchedule,
      activities,
      inactivePlayers,
    ] = await Promise.all(dashboardQueries);
    const summary = this.mapSummary(summaryRows[0]);

    return {
      apiStatus: {
        connected: Boolean(summary.lastApiSync),
        provider: 'API-SPORTS Football + ESPN ASEAN + OpenF1 + Cito LoL',
        lastSync: summary.lastApiSync,
        externalId: this.buildExternalId(summary.lastApiSync),
      },
      stats: {
        activeTournaments: summary.activeTournaments,
        totalPlayers: summary.totalPlayers,
        upcomingMatches: summary.upcomingMatches,
        attentionNeeded: includeAttentionDetails ? summary.attentionNeeded : 0,
        pendingPredictions: includeAttentionDetails
          ? summary.pendingPredictions
          : 0,
        warningMatches: includeAttentionDetails ? summary.warningMatches : 0,
        inactivePlayers: includeAttentionDetails ? summary.inactivePlayers : 0,
        pendingPlayers: includeAttentionDetails ? summary.pendingPlayers : 0,
      },
      tournaments: tournaments.map((row) => ({
        id: Number(row.id),
        name: row.name,
        sportType: row.sportType,
        status: row.status,
        teams: Number(row.teams ?? 0),
        matches: Number(row.matches ?? 0),
        source: row.source ?? 'MANUAL',
        visibility: row.visibility ?? 'PUBLIC',
      })),
      tournamentMatches: tournamentMatches.map((row) => ({
        id: Number(row.id),
        tournamentId: Number(row.tournamentId),
        homeName: row.homeTeam ?? 'TBD',
        awayName: row.awayTeam ?? 'TBD',
        homeLogoUrl: row.homeLogoUrl ?? null,
        awayLogoUrl: row.awayLogoUrl ?? null,
        encounter: `${row.homeTeam ?? 'TBD'} vs ${row.awayTeam ?? 'TBD'}`,
        tournamentName: row.tournamentName,
        scheduledTime: row.scheduledTime,
        deadline: row.deadline,
        source: row.source ?? 'MANUAL',
        status: row.status,
        actualHomeScore: this.mapNullableNumber(row.actualHomeScore),
        actualAwayScore: this.mapNullableNumber(row.actualAwayScore),
      })),
      upcomingSchedule: upcomingSchedule.map((row) => ({
        id: Number(row.id),
        homeName: row.homeTeam ?? 'TBD',
        awayName: row.awayTeam ?? 'TBD',
        homeLogoUrl: row.homeLogoUrl ?? null,
        awayLogoUrl: row.awayLogoUrl ?? null,
        encounter: `${row.homeTeam ?? 'TBD'} vs ${row.awayTeam ?? 'TBD'}`,
        tournamentName: row.tournamentName,
        scheduledTime: row.scheduledTime,
        deadline: row.deadline,
        source: row.source ?? 'MANUAL',
        status: row.status,
        actualHomeScore: this.mapNullableNumber(row.actualHomeScore),
        actualAwayScore: this.mapNullableNumber(row.actualAwayScore),
      })),
      recentActivity: activities.map((row) => ({
        id: row.id,
        type: row.type,
        message: row.message,
        createdAt: row.createdAt,
      })),
      inactivePlayers: includeAttentionDetails
        ? inactivePlayers.map((row) => ({
            id: Number(row.id),
            memberCode: row.memberCode,
            fullName: row.fullName,
            email: row.email,
            status: row.status,
            updatedAt: row.updatedAt,
          }))
        : [],
    };
  }

  private async ensureTeamLogoColumn() {
    await this.usersRepository.query(`
      ALTER TABLE teams
      ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) NULL
    `);
  }
  private summaryQuery(
    scope: DashboardScope,
    includePrivateTournaments: boolean,
  ) {
    const tournamentVisibilityCondition = includePrivateTournaments
      ? ''
      : "AND t.visibility = 'PUBLIC'";
    const matchVisibilityCondition = includePrivateTournaments
      ? ''
      : "AND t.visibility = 'PUBLIC'";
    const activeTournamentCondition =
      scope === 'today'
        ? `AND EXISTS (
            SELECT 1
            FROM matches tm
            WHERE tm.tournament_id = t.id
              AND ${this.todayDateCondition('tm.scheduled_time')}
          )`
        : '';
    const upcomingMatchCondition =
      scope === 'today'
        ? `AND ${this.todayDateCondition('m.scheduled_time')}`
        : '';

    return `
      SELECT
        (
          SELECT COUNT(*)
          FROM tournaments t
          WHERE t.status = 'ACTIVE'
            ${tournamentVisibilityCondition}
            ${activeTournamentCondition}
        ) AS "activeTournaments",
        (SELECT COUNT(*) FROM users WHERE role = 'PLAYER') AS "totalPlayers",
        (SELECT COUNT(*) FROM users WHERE role = 'PLAYER' AND user_status = 'INACTIVE') AS "inactivePlayers",
        (SELECT COUNT(*) FROM users WHERE role = 'PLAYER' AND user_status = 'PENDING') AS "pendingPlayers",
        (
          SELECT COUNT(*)
          FROM matches m
          JOIN tournaments t ON t.id = m.tournament_id
          WHERE m.scheduled_time >= NOW()
            AND m.status IN ('PENDING', 'LIVE')
            ${matchVisibilityCondition}
            ${upcomingMatchCondition}
        ) AS "upcomingMatches",
        (
          SELECT COUNT(*)
          FROM predictions p
          JOIN matches m ON m.id = p.match_id
          JOIN tournaments t ON t.id = m.tournament_id
          WHERE m.status IN ('PENDING', 'LIVE')
            ${matchVisibilityCondition}
            ${scope === 'today' ? `AND ${this.todayDateCondition('m.scheduled_time')}` : ''}
        ) AS "pendingPredictions",
        (
          SELECT COUNT(*)
          FROM matches m
          JOIN tournaments t ON t.id = m.tournament_id
          WHERE m.sync_status IS NOT NULL
            AND m.sync_status <> 'SYNCED'
            ${matchVisibilityCondition}
            ${scope === 'today' ? `AND ${this.todayDateCondition('m.scheduled_time')}` : ''}
        ) AS "warningMatches",
        (SELECT MAX(last_synced_at) FROM matches WHERE last_synced_at IS NOT NULL) AS "lastApiSync"
    `;
  }

  private tournamentsQuery(
    scope: DashboardScope,
    includePrivateTournaments: boolean,
  ) {
    const whereClause = this.tournamentWhereClause(
      scope,
      includePrivateTournaments,
    );
    const matchJoinCondition =
      scope === 'today'
        ? `m.tournament_id = t.id AND ${this.todayDateCondition('m.scheduled_time')}`
        : 'm.tournament_id = t.id';

    return `
      SELECT
        t.id,
        t.name,
        t.sport_type AS "sportType",
        t.status,
        t.visibility,
        COUNT(DISTINCT team.id) AS teams,
        COUNT(DISTINCT m.id) AS matches,
        COALESCE(
          MAX(m.external_source),
          CASE
            WHEN BOOL_OR(s.name = 'API Feed') THEN 'FOOTBALL_DATA'
            ELSE 'MANUAL'
          END
        ) AS source
      FROM tournaments t
      LEFT JOIN teams team ON team.tournament_id = t.id
      LEFT JOIN matches m ON ${matchJoinCondition}
      LEFT JOIN stages s ON s.tournament_id = t.id
      ${whereClause}
      GROUP BY t.id, t.name, t.sport_type, t.status, t.visibility, t.updated_at, t.created_at
      ORDER BY
        CASE t.status
          WHEN 'ACTIVE' THEN 0
          WHEN 'UPCOMING' THEN 1
          WHEN 'COMPLETED' THEN 2
          ELSE 3
        END,
        t.updated_at DESC,
        t.created_at DESC
    `;
  }

  private inactivePlayersQuery() {
    return `
      SELECT
        id,
        member_code AS "memberCode",
        full_name AS "fullName",
        email,
        user_status AS status,
        updated_at AS "updatedAt"
      FROM users
      WHERE role = 'PLAYER'
        AND user_status <> 'ACTIVE'
      ORDER BY
        CASE user_status
          WHEN 'INACTIVE' THEN 0
          WHEN 'PENDING' THEN 1
          ELSE 2
        END,
        full_name ASC
    `;
  }

  private upcomingScheduleQuery(
    scope: DashboardScope,
    includePrivateTournaments: boolean,
  ) {
    const visibilityCondition = includePrivateTournaments
      ? ''
      : "AND t.visibility = 'PUBLIC'";
    const scopeCondition =
      scope === 'today'
        ? `AND ${this.todayDateCondition('m.scheduled_time')}`
        : '';

    return `
      SELECT
        m.id,
        t.name AS "tournamentName",
        COALESCE(home.name, m.home_placeholder) AS "homeTeam",
        COALESCE(away.name, m.away_placeholder) AS "awayTeam",
        home.logo_url AS "homeLogoUrl",
        away.logo_url AS "awayLogoUrl",
        m.scheduled_time AS "scheduledTime",
        m.scheduled_time - (m.lock_minutes_before_start * INTERVAL '1 minute') AS deadline,
        COALESCE(m.external_source, 'MANUAL') AS source,
        m.status,
        m.actual_home_score AS "actualHomeScore",
        m.actual_away_score AS "actualAwayScore"
      FROM matches m
      JOIN tournaments t ON t.id = m.tournament_id
      LEFT JOIN teams home ON home.id = m.home_team_id
      LEFT JOIN teams away ON away.id = m.away_team_id
      WHERE m.scheduled_time >= NOW()
        ${visibilityCondition}
        ${scopeCondition}
      ORDER BY m.scheduled_time ASC
      LIMIT 8
    `;
  }

  private tournamentMatchesQuery(
    scope: DashboardScope,
    includePrivateTournaments: boolean,
  ) {
    const visibilityCondition = includePrivateTournaments
      ? ''
      : "AND t.visibility = 'PUBLIC'";
    const scopeCondition =
      scope === 'today'
        ? `AND ${this.todayDateCondition('m.scheduled_time')}`
        : '';

    return `
      SELECT
        ranked.id,
        ranked."tournamentId",
        ranked."tournamentName",
        ranked."homeTeam",
        ranked."awayTeam",
        ranked."homeLogoUrl",
        ranked."awayLogoUrl",
        ranked."scheduledTime",
        ranked.deadline,
        ranked.source,
        ranked.status,
        ranked."actualHomeScore",
        ranked."actualAwayScore"
      FROM (
        SELECT
          m.id,
          m.tournament_id AS "tournamentId",
          t.name AS "tournamentName",
          COALESCE(home.name, m.home_placeholder) AS "homeTeam",
          COALESCE(away.name, m.away_placeholder) AS "awayTeam",
          home.logo_url AS "homeLogoUrl",
          away.logo_url AS "awayLogoUrl",
          m.scheduled_time AS "scheduledTime",
          m.scheduled_time - (m.lock_minutes_before_start * INTERVAL '1 minute') AS deadline,
          COALESCE(m.external_source, 'MANUAL') AS source,
          m.actual_home_score AS "actualHomeScore",
          m.actual_away_score AS "actualAwayScore",
          m.status,
          ROW_NUMBER() OVER (
            PARTITION BY m.tournament_id
            ORDER BY
              CASE WHEN m.scheduled_time >= NOW() THEN 0 ELSE 1 END,
              CASE WHEN m.scheduled_time >= NOW() THEN m.scheduled_time END ASC,
              CASE WHEN m.scheduled_time < NOW() THEN m.scheduled_time END DESC
          ) AS row_number
        FROM matches m
        JOIN tournaments t ON t.id = m.tournament_id
        LEFT JOIN teams home ON home.id = m.home_team_id
        LEFT JOIN teams away ON away.id = m.away_team_id
        WHERE 1 = 1
          ${visibilityCondition}
          ${scopeCondition}
      ) ranked
      WHERE ranked.row_number <= 20
      ORDER BY ranked."tournamentId", ranked."scheduledTime" ASC
    `;
  }

  private activitiesQuery(includePrivateTournaments: boolean) {
    const visibilityCondition = includePrivateTournaments
      ? ''
      : "WHERE t.visibility = 'PUBLIC'";
    const matchVisibilityCondition = includePrivateTournaments
      ? ''
      : "WHERE t.visibility = 'PUBLIC'";

    return `
      SELECT *
      FROM (
        SELECT
          CONCAT('match-', m.id) AS id,
          'match' AS type,
          CONCAT('Match #', m.id, ' moved to ', m.status) AS message,
          m.updated_at AS "createdAt"
        FROM matches m
        JOIN tournaments t ON t.id = m.tournament_id
        ${matchVisibilityCondition}
        UNION ALL
        SELECT
          CONCAT('tournament-', t.id) AS id,
          'tournament' AS type,
          CONCAT(t.name, ' tournament updated') AS message,
          t.updated_at AS "createdAt"
        FROM tournaments t
        ${visibilityCondition}
        UNION ALL
        SELECT
          CONCAT('user-', u.id) AS id,
          'user' AS type,
          CONCAT(u.full_name, ' joined the platform') AS message,
          u.created_at AS "createdAt"
        FROM users u
        WHERE u.role = 'PLAYER'
      ) activity
      ORDER BY "createdAt" DESC
      LIMIT 8
    `;
  }

  private mapSummary(row?: DashboardSummaryRow) {
    const pendingPredictions = Number(row?.pendingPredictions ?? 0);
    const warningMatches = Number(row?.warningMatches ?? 0);
    const inactivePlayers = Number(row?.inactivePlayers ?? 0);
    const pendingPlayers = Number(row?.pendingPlayers ?? 0);

    return {
      activeTournaments: Number(row?.activeTournaments ?? 0),
      totalPlayers: Number(row?.totalPlayers ?? 0),
      upcomingMatches: Number(row?.upcomingMatches ?? 0),
      attentionNeeded: inactivePlayers + pendingPlayers,
      pendingPredictions,
      warningMatches,
      inactivePlayers,
      pendingPlayers,
      lastApiSync: row?.lastApiSync ?? null,
    };
  }

  private buildExternalId(lastSync: string | null) {
    if (!lastSync) {
      return 'LOCAL';
    }

    const hash = Array.from(lastSync).reduce(
      (total, char) => total + char.charCodeAt(0),
      0,
    );

    return `FD_${String(hash).padStart(5, '0').slice(-5)}`;
  }

  private tournamentWhereClause(
    scope: DashboardScope,
    includePrivateTournaments: boolean,
  ) {
    const conditions: string[] = [];

    if (!includePrivateTournaments) {
      conditions.push("t.visibility = 'PUBLIC'");
    }

    if (scope === 'today') {
      conditions.push(`EXISTS (
        SELECT 1
        FROM matches today_match
        WHERE today_match.tournament_id = t.id
          AND ${this.todayDateCondition('today_match.scheduled_time')}
      )`);
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  private todayDateCondition(column: string) {
    return `(${column} AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
  }

  private mapNullableNumber(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? null : numberValue;
  }
}
