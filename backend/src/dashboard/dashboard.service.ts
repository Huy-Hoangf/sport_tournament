import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getDashboard() {
    const [
      summaryRows,
      tournaments,
      tournamentMatches,
      upcomingSchedule,
      activities,
    ] = await Promise.all([
      this.usersRepository.query(this.summaryQuery()),
      this.usersRepository.query(this.tournamentsQuery()),
      this.usersRepository.query(this.tournamentMatchesQuery()),
      this.usersRepository.query(this.upcomingScheduleQuery()),
      this.usersRepository.query(this.activitiesQuery()),
    ]);

    const summary = this.mapSummary(summaryRows[0]);

    return {
      apiStatus: {
        connected: Boolean(summary.lastApiSync),
        provider: 'API-SPORTS Football + OpenF1 + Cito LoL',
        lastSync: summary.lastApiSync,
        externalId: this.buildExternalId(summary.lastApiSync),
      },
      stats: {
        activeTournaments: summary.activeTournaments,
        totalPlayers: summary.totalPlayers,
        upcomingMatches: summary.upcomingMatches,
        attentionNeeded: summary.attentionNeeded,
        pendingPredictions: summary.pendingPredictions,
        warningMatches: summary.warningMatches,
        inactivePlayers: summary.inactivePlayers,
      },
      tournaments: tournaments.map((row) => ({
        id: Number(row.id),
        name: row.name,
        sportType: row.sportType,
        status: row.status,
        players: Number(row.players ?? 0),
        matches: Number(row.matches ?? 0),
        source: row.source ?? 'MANUAL',
      })),
      tournamentMatches: tournamentMatches.map((row) => ({
        id: Number(row.id),
        tournamentId: Number(row.tournamentId),
        homeName: row.homeTeam ?? 'TBD',
        awayName: row.awayTeam ?? 'TBD',
        encounter: `${row.homeTeam ?? 'TBD'} vs ${row.awayTeam ?? 'TBD'}`,
        tournamentName: row.tournamentName,
        scheduledTime: row.scheduledTime,
        deadline: row.deadline,
        source: row.source ?? 'MANUAL',
        status: row.status,
      })),
      upcomingSchedule: upcomingSchedule.map((row) => ({
        id: Number(row.id),
        homeName: row.homeTeam ?? 'TBD',
        awayName: row.awayTeam ?? 'TBD',
        encounter: `${row.homeTeam ?? 'TBD'} vs ${row.awayTeam ?? 'TBD'}`,
        tournamentName: row.tournamentName,
        scheduledTime: row.scheduledTime,
        deadline: row.deadline,
        source: row.source ?? 'MANUAL',
        status: row.status,
      })),
      recentActivity: activities.map((row) => ({
        id: row.id,
        type: row.type,
        message: row.message,
        createdAt: row.createdAt,
      })),
    };
  }

  private summaryQuery() {
    return `
      SELECT
        (SELECT COUNT(*) FROM tournaments WHERE status = 'ACTIVE') AS "activeTournaments",
        (SELECT COUNT(*) FROM users WHERE role = 'PLAYER') AS "totalPlayers",
        (SELECT COUNT(*) FROM users WHERE role = 'PLAYER' AND user_status <> 'ACTIVE') AS "inactivePlayers",
        (SELECT COUNT(*) FROM matches WHERE scheduled_time >= NOW() AND status IN ('PENDING', 'LIVE')) AS "upcomingMatches",
        (SELECT COUNT(*) FROM predictions p JOIN matches m ON m.id = p.match_id WHERE m.status IN ('PENDING', 'LIVE')) AS "pendingPredictions",
        (SELECT COUNT(*) FROM matches WHERE sync_status IS NOT NULL AND sync_status <> 'SYNCED') AS "warningMatches",
        (SELECT MAX(last_synced_at) FROM matches WHERE last_synced_at IS NOT NULL) AS "lastApiSync"
    `;
  }

  private tournamentsQuery() {
    return `
      SELECT
        t.id,
        t.name,
        t.sport_type AS "sportType",
        t.status,
        COUNT(DISTINCT tp.user_id) AS players,
        COUNT(DISTINCT m.id) AS matches,
        COALESCE(MAX(m.external_source), 'MANUAL') AS source
      FROM tournaments t
      LEFT JOIN tournament_participants tp ON tp.tournament_id = t.id
      LEFT JOIN matches m ON m.tournament_id = t.id
      GROUP BY t.id, t.name, t.sport_type, t.status, t.updated_at, t.created_at
      ORDER BY
        CASE t.status
          WHEN 'ACTIVE' THEN 0
          WHEN 'UPCOMING' THEN 1
          WHEN 'COMPLETED' THEN 2
          ELSE 3
        END,
        t.updated_at DESC,
        t.created_at DESC
      LIMIT 80
    `;
  }

  private upcomingScheduleQuery() {
    return `
      SELECT
        m.id,
        t.name AS "tournamentName",
        COALESCE(home.name, m.home_placeholder) AS "homeTeam",
        COALESCE(away.name, m.away_placeholder) AS "awayTeam",
        m.scheduled_time AS "scheduledTime",
        m.scheduled_time - (m.lock_minutes_before_start * INTERVAL '1 minute') AS deadline,
        COALESCE(m.external_source, 'MANUAL') AS source,
        m.status
      FROM matches m
      JOIN tournaments t ON t.id = m.tournament_id
      LEFT JOIN teams home ON home.id = m.home_team_id
      LEFT JOIN teams away ON away.id = m.away_team_id
      WHERE m.scheduled_time >= NOW()
      ORDER BY m.scheduled_time ASC
      LIMIT 8
    `;
  }

  private tournamentMatchesQuery() {
    return `
      SELECT
        ranked.id,
        ranked."tournamentId",
        ranked."tournamentName",
        ranked."homeTeam",
        ranked."awayTeam",
        ranked."scheduledTime",
        ranked.deadline,
        ranked.source,
        ranked.status
      FROM (
        SELECT
          m.id,
          m.tournament_id AS "tournamentId",
          t.name AS "tournamentName",
          COALESCE(home.name, m.home_placeholder) AS "homeTeam",
          COALESCE(away.name, m.away_placeholder) AS "awayTeam",
          m.scheduled_time AS "scheduledTime",
          m.scheduled_time - (m.lock_minutes_before_start * INTERVAL '1 minute') AS deadline,
          COALESCE(m.external_source, 'MANUAL') AS source,
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
      ) ranked
      WHERE ranked.row_number <= 20
      ORDER BY ranked."tournamentId", ranked."scheduledTime" ASC
    `;
  }

  private activitiesQuery() {
    return `
      SELECT *
      FROM (
        SELECT
          CONCAT('match-', m.id) AS id,
          'match' AS type,
          CONCAT('Match #', m.id, ' moved to ', m.status) AS message,
          m.updated_at AS "createdAt"
        FROM matches m
        UNION ALL
        SELECT
          CONCAT('tournament-', t.id) AS id,
          'tournament' AS type,
          CONCAT(t.name, ' tournament updated') AS message,
          t.updated_at AS "createdAt"
        FROM tournaments t
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

  private mapSummary(row?: Record<string, unknown>) {
    const pendingPredictions = Number(row?.pendingPredictions ?? 0);
    const warningMatches = Number(row?.warningMatches ?? 0);
    const inactivePlayers = Number(row?.inactivePlayers ?? 0);

    return {
      activeTournaments: Number(row?.activeTournaments ?? 0),
      totalPlayers: Number(row?.totalPlayers ?? 0),
      upcomingMatches: Number(row?.upcomingMatches ?? 0),
      attentionNeeded: inactivePlayers + pendingPredictions + warningMatches,
      pendingPredictions,
      warningMatches,
      inactivePlayers,
      lastApiSync: (row?.lastApiSync as string | null | undefined) ?? null,
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
}
