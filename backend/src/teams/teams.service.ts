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
        WITH visible_tournaments AS (
          SELECT t.id
          FROM tournaments t
          ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ),
        base_teams AS (
          SELECT
            team.tournament_id,
            team.id AS team_id,
            team.name,
            team.logo_url AS "logoUrl"
          FROM teams team
          JOIN visible_tournaments vt ON vt.id = team.tournament_id
        ),
        match_rows AS (
          SELECT
            t.id AS tournament_id,
            home.id AS team_id,
            COALESCE(home.name, m.home_placeholder, 'TBD') AS team_name,
            s.name AS stage_name,
            m.status,
            m.actual_home_score AS own_score,
            m.actual_away_score AS opponent_score
          FROM matches m
          JOIN tournaments t ON t.id = m.tournament_id
          JOIN stages s ON s.id = m.stage_id
          LEFT JOIN teams home ON home.id = m.home_team_id
          JOIN visible_tournaments vt ON vt.id = t.id

          UNION ALL

          SELECT
            t.id AS tournament_id,
            away.id AS team_id,
            COALESCE(away.name, m.away_placeholder, 'TBD') AS team_name,
            s.name AS stage_name,
            m.status,
            m.actual_away_score AS own_score,
            m.actual_home_score AS opponent_score
          FROM matches m
          JOIN tournaments t ON t.id = m.tournament_id
          JOIN stages s ON s.id = m.stage_id
          LEFT JOIN teams away ON away.id = m.away_team_id
          JOIN visible_tournaments vt ON vt.id = t.id
        ),
        team_id_stats AS (
          SELECT
            tournament_id,
            team_id,
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
          FROM match_rows
          WHERE team_id IS NOT NULL
          GROUP BY tournament_id, team_id
        ),
        team_name_stats AS (
          SELECT
            tournament_id,
            LOWER(team_name) AS team_name_key,
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
          FROM match_rows
          WHERE team_id IS NULL
            AND team_name IS NOT NULL
            AND UPPER(team_name) <> 'TBD'
          GROUP BY tournament_id, LOWER(team_name)
        ),
        placeholder_stats AS (
          SELECT
            tournament_id,
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
          FROM match_rows
          WHERE team_id IS NULL
            AND team_name IS NOT NULL
            AND UPPER(team_name) <> 'TBD'
            AND NOT EXISTS (
              SELECT 1
              FROM base_teams bt
              WHERE bt.tournament_id = match_rows.tournament_id
            )
          GROUP BY tournament_id, team_name
        ),
        combined_teams AS (
          SELECT
            bt.tournament_id AS "tournamentId",
            bt.name,
            bt."logoUrl",
            COALESCE(id_stats.stage, name_stats.stage, 'Roster') AS stage,
            COALESCE(id_stats.matches, name_stats.matches, 0) AS matches,
            COALESCE(id_stats.wins, name_stats.wins, 0) AS wins,
            COALESCE(id_stats.losses, name_stats.losses, 0) AS losses,
            COALESCE(id_stats.draws, name_stats.draws, 0) AS draws,
            COALESCE(id_stats.score, name_stats.score, 0) AS score
          FROM base_teams bt
          LEFT JOIN team_id_stats id_stats
            ON id_stats.tournament_id = bt.tournament_id
           AND id_stats.team_id = bt.team_id
          LEFT JOIN team_name_stats name_stats
            ON name_stats.tournament_id = bt.tournament_id
           AND name_stats.team_name_key = LOWER(bt.name)

          UNION ALL

          SELECT
            tournament_id AS "tournamentId",
            name,
            NULL AS "logoUrl",
            COALESCE(stage, 'Main Stage') AS stage,
            matches,
            wins,
            losses,
            draws,
            score
          FROM placeholder_stats
        )
        SELECT
          "tournamentId",
          name,
          "logoUrl",
          stage,
          matches,
          wins,
          losses,
          draws,
          score,
          (wins * 3 + draws) AS points
        FROM combined_teams
        ORDER BY points DESC, wins DESC, losses ASC, draws DESC, score DESC, name ASC
        LIMIT 500
      `,
      values,
    );

    return rows.map((row) => ({
      tournamentId: Number(row.tournamentId),
      name: row.name,
      logoUrl: row.logoUrl ?? null,
      stage: row.stage ?? 'Main Stage',
      matches: Number(row.matches ?? 0),
      wins: Number(row.wins ?? 0),
      losses: Number(row.losses ?? 0),
      draws: Number(row.draws ?? 0),
      score: Number(row.score ?? 0),
      points: Number(row.points ?? 0),
    }));
  }
}
