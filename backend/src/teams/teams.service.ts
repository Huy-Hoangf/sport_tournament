import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findAll({
    includePrivateTournaments,
    tournamentId,
  }: {
    includePrivateTournaments: boolean;
    tournamentId?: number;
  }) {
    if (
      tournamentId !== undefined &&
      (!Number.isInteger(tournamentId) || tournamentId <= 0)
    ) {
      throw new BadRequestException('Invalid tournament id.');
    }

    const values: unknown[] = [];
    const where: string[] = [];

    if (!includePrivateTournaments) {
      where.push("t.visibility = 'PUBLIC'");
    }

    if (tournamentId) {
      values.push(tournamentId);
      where.push(`t.id = $${values.length}`);
    }

    const rows = await this.usersRepository.query(
      `
        WITH team_matches AS (
          SELECT
            t.id AS tournament_id,
            COALESCE(home.id, -m.id * 2) AS team_key,
            COALESCE(home.name, m.home_placeholder, 'TBD') AS team_name,
            s.name AS stage_name,
            m.status,
            m.actual_home_score AS own_score,
            m.actual_away_score AS opponent_score
          FROM matches m
          JOIN tournaments t ON t.id = m.tournament_id
          JOIN stages s ON s.id = m.stage_id
          LEFT JOIN teams home ON home.id = m.home_team_id
          ${where.length ? `WHERE ${where.join(' AND ')}` : ''}

          UNION ALL

          SELECT
            t.id AS tournament_id,
            COALESCE(away.id, -m.id * 2 - 1) AS team_key,
            COALESCE(away.name, m.away_placeholder, 'TBD') AS team_name,
            s.name AS stage_name,
            m.status,
            m.actual_away_score AS own_score,
            m.actual_home_score AS opponent_score
          FROM matches m
          JOIN tournaments t ON t.id = m.tournament_id
          JOIN stages s ON s.id = m.stage_id
          LEFT JOIN teams away ON away.id = m.away_team_id
          ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        )
        SELECT
          tournament_id AS "tournamentId",
          team_name AS name,
          MIN(stage_name) AS stage,
          COUNT(*) AS matches,
          SUM(
            CASE
              WHEN status IN ('FINISHED', 'COMPLETED') AND own_score > opponent_score THEN 1
              ELSE 0
            END
          ) AS wins,
          SUM(
            CASE
              WHEN status IN ('FINISHED', 'COMPLETED') AND own_score < opponent_score THEN 1
              ELSE 0
            END
          ) AS losses,
          SUM(
            CASE
              WHEN status IN ('FINISHED', 'COMPLETED') AND own_score = opponent_score THEN 1
              ELSE 0
            END
          ) AS draws,
          SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') THEN COALESCE(own_score, 0) ELSE 0 END) AS score
        FROM team_matches
        WHERE team_name IS NOT NULL AND UPPER(team_name) <> 'TBD'
        GROUP BY tournament_id, team_name
        ORDER BY wins DESC, losses ASC, draws DESC, score DESC, name ASC
        LIMIT 500
      `,
      values,
    );

    return rows.map((row) => ({
      tournamentId: Number(row.tournamentId),
      name: row.name,
      stage: row.stage ?? 'Main Stage',
      matches: Number(row.matches ?? 0),
      wins: Number(row.wins ?? 0),
      losses: Number(row.losses ?? 0),
      draws: Number(row.draws ?? 0),
      score: Number(row.score ?? 0),
    }));
  }
}
