import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findAll(filters: {
    includePrivateTournaments: boolean;
    tournamentId?: number;
    stageId?: number;
    status?: string;
    search?: string;
  }) {
    const values: unknown[] = [];
    const where: string[] = [];

    if (!filters.includePrivateTournaments) {
      where.push("t.visibility = 'PUBLIC'");
    }

    if (filters.tournamentId) {
      values.push(filters.tournamentId);
      where.push(`m.tournament_id = $${values.length}`);
    }

    if (filters.stageId) {
      values.push(filters.stageId);
      where.push(`m.stage_id = $${values.length}`);
    }

    if (filters.status && filters.status !== 'ALL') {
      values.push(filters.status.toUpperCase());
      where.push(`m.status = $${values.length}`);
    }

    const search = filters.search?.trim();
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      where.push(`
        (
          LOWER(t.name) LIKE $${values.length}
          OR LOWER(s.name) LIKE $${values.length}
          OR LOWER(COALESCE(home.name, m.home_placeholder, 'TBD')) LIKE $${values.length}
          OR LOWER(COALESCE(away.name, m.away_placeholder, 'TBD')) LIKE $${values.length}
        )
      `);
    }

    const rows = await this.usersRepository.query(
      `
        SELECT
          m.id,
          m.tournament_id AS "tournamentId",
          t.name AS "tournamentName",
          m.stage_id AS "stageId",
          s.name AS "stageName",
          COALESCE(home.name, m.home_placeholder) AS "homeName",
          COALESCE(away.name, m.away_placeholder) AS "awayName",
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
        JOIN stages s ON s.id = m.stage_id
        LEFT JOIN teams home ON home.id = m.home_team_id
        LEFT JOIN teams away ON away.id = m.away_team_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY m.scheduled_time ASC, m.id ASC
        LIMIT 300
      `,
      values,
    );

    return rows.map((row) => ({
      id: Number(row.id),
      tournamentId: Number(row.tournamentId),
      tournamentName: row.tournamentName,
      stageId: Number(row.stageId),
      stageName: row.stageName,
      homeName: row.homeName ?? 'TBD',
      awayName: row.awayName ?? 'TBD',
      homeLogoUrl: row.homeLogoUrl ?? null,
      awayLogoUrl: row.awayLogoUrl ?? null,
      encounter: `${row.homeName ?? 'TBD'} vs ${row.awayName ?? 'TBD'}`,
      scheduledTime: row.scheduledTime,
      deadline: row.deadline,
      source: row.source ?? 'MANUAL',
      status: row.status,
      actualHomeScore:
        row.actualHomeScore == null ? null : Number(row.actualHomeScore),
      actualAwayScore:
        row.actualAwayScore == null ? null : Number(row.actualAwayScore),
    }));
  }
}
