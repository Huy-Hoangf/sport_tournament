import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

type RegisterTeamInput = {
  tournamentId: number;
  teamName: string;
  players: Array<{ name?: string }>;
};

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
          SELECT t.id, t.sport_type
          FROM tournaments t
          ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ),
        base_teams AS (
          SELECT
            team.tournament_id,
            vt.sport_type,
            team.id AS team_id,
            team.name,
            team.logo_url AS "logoUrl"
          FROM teams team
          JOIN visible_tournaments vt ON vt.id = team.tournament_id
          WHERE LOWER(TRIM(team.name)) NOT IN ('tbd', 'team 1', 'team 2', 'home team', 'away team')
        ),
        match_rows AS (
          SELECT
            t.id AS tournament_id,
            vt.sport_type,
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
            vt.sport_type,
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
            sport_type,
            team_id,
            MIN(stage_name) AS stage,
            COUNT(*) AS matches,
            SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') AND own_score > opponent_score THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') AND own_score < opponent_score THEN 1 ELSE 0 END) AS losses,
            SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') AND own_score = opponent_score THEN 1 ELSE 0 END) AS draws,
            SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') THEN COALESCE(own_score, 0) ELSE 0 END) AS score
          FROM match_rows
          WHERE team_id IS NOT NULL
            AND LOWER(TRIM(team_name)) NOT IN ('tbd', 'team 1', 'team 2', 'home team', 'away team')
          GROUP BY tournament_id, sport_type, team_id
        ),
        team_name_stats AS (
          SELECT
            tournament_id,
            sport_type,
            LOWER(team_name) AS team_name_key,
            MIN(stage_name) AS stage,
            COUNT(*) AS matches,
            SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') AND own_score > opponent_score THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') AND own_score < opponent_score THEN 1 ELSE 0 END) AS losses,
            SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') AND own_score = opponent_score THEN 1 ELSE 0 END) AS draws,
            SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') THEN COALESCE(own_score, 0) ELSE 0 END) AS score
          FROM match_rows
          WHERE team_id IS NULL
            AND team_name IS NOT NULL
            AND LOWER(TRIM(team_name)) NOT IN ('tbd', 'team 1', 'team 2', 'home team', 'away team')
          GROUP BY tournament_id, sport_type, LOWER(team_name)
        ),
        placeholder_stats AS (
          SELECT
            tournament_id,
            sport_type,
            team_name AS name,
            MIN(stage_name) AS stage,
            COUNT(*) AS matches,
            SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') AND own_score > opponent_score THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') AND own_score < opponent_score THEN 1 ELSE 0 END) AS losses,
            SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') AND own_score = opponent_score THEN 1 ELSE 0 END) AS draws,
            SUM(CASE WHEN status IN ('FINISHED', 'COMPLETED') THEN COALESCE(own_score, 0) ELSE 0 END) AS score
          FROM match_rows
          WHERE team_id IS NULL
            AND team_name IS NOT NULL
            AND LOWER(TRIM(team_name)) NOT IN ('tbd', 'team 1', 'team 2', 'home team', 'away team')
            AND NOT EXISTS (
              SELECT 1
              FROM base_teams bt
              WHERE bt.tournament_id = match_rows.tournament_id
            )
          GROUP BY tournament_id, sport_type, team_name
        ),
        roster_counts AS (
          SELECT
            team_id,
            COUNT(*) AS members
          FROM team_players
          GROUP BY team_id
        ),
        combined_teams AS (
          SELECT
            bt.tournament_id AS "tournamentId",
            bt.sport_type,
            bt.name,
            bt."logoUrl",
            COALESCE(id_stats.stage, name_stats.stage, 'Roster') AS stage,
            COALESCE(id_stats.matches, name_stats.matches, 0) AS matches,
            COALESCE(id_stats.wins, name_stats.wins, 0) AS wins,
            COALESCE(id_stats.losses, name_stats.losses, 0) AS losses,
            COALESCE(id_stats.draws, name_stats.draws, 0) AS draws,
            COALESCE(id_stats.score, name_stats.score, 0) AS score,
            COALESCE(roster_counts.members, 0) AS members
          FROM base_teams bt
          LEFT JOIN team_id_stats id_stats
            ON id_stats.tournament_id = bt.tournament_id
           AND id_stats.team_id = bt.team_id
          LEFT JOIN team_name_stats name_stats
            ON name_stats.tournament_id = bt.tournament_id
           AND name_stats.team_name_key = LOWER(bt.name)
          LEFT JOIN roster_counts
            ON roster_counts.team_id = bt.team_id

          UNION ALL

          SELECT
            tournament_id AS "tournamentId",
            sport_type,
            name,
            NULL AS "logoUrl",
            COALESCE(stage, 'Main Stage') AS stage,
            matches,
            wins,
            losses,
            draws,
            score,
            0 AS members
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
          members,
          CASE WHEN sport_type = 'LOL' THEN wins ELSE wins * 3 + draws END AS points
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
      members: Number(row.members ?? 0),
    }));
  }

  async registerTeam(input: RegisterTeamInput) {
    const tournamentId = input.tournamentId;
    const teamName = input.teamName.trim();
    const playerNames = input.players
      .map((player) => player.name?.trim() ?? '')
      .filter(Boolean);

    if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
      throw new BadRequestException('Invalid tournament id.');
    }

    if (!this.isKnownTeamName(teamName)) {
      throw new BadRequestException('Team name is required.');
    }

    if (playerNames.length === 0) {
      throw new BadRequestException('At least one player is required.');
    }

    const uniquePlayerNames = Array.from(
      new Map(
        playerNames.map((playerName) => [playerName.toLowerCase(), playerName]),
      ).values(),
    );

    if (uniquePlayerNames.length !== playerNames.length) {
      throw new BadRequestException('Player names must be unique.');
    }

    const [tournament] = await this.usersRepository.query(
      `
        SELECT
          id,
          CASE
            WHEN end_date IS NOT NULL AND end_date < NOW() THEN 'COMPLETE'
            WHEN start_date IS NOT NULL AND start_date > NOW() THEN 'UPCOMING'
            WHEN start_date IS NOT NULL OR end_date IS NOT NULL THEN 'ONGOING'
            WHEN status IN ('ACTIVE', 'LIVE', 'ONGOING') THEN 'ONGOING'
            WHEN status IN ('COMPLETED', 'COMPLETE', 'FINISHED', 'CANCELLED', 'CANCELED') THEN 'COMPLETE'
            ELSE 'UPCOMING'
          END AS status
        FROM tournaments
        WHERE id = $1
        LIMIT 1
      `,
      [tournamentId],
    );

    if (!tournament) {
      throw new NotFoundException('Tournament not found.');
    }

    if (tournament.status === 'COMPLETE') {
      throw new BadRequestException(
        'Completed tournaments cannot register teams.',
      );
    }

    const [existingTeam] = await this.usersRepository.query(
      `
        SELECT id
        FROM teams
        WHERE tournament_id = $1
          AND LOWER(name) = LOWER($2)
        LIMIT 1
      `,
      [tournamentId, teamName],
    );

    if (existingTeam) {
      throw new BadRequestException('Team already exists in this tournament.');
    }

    const [team] = await this.usersRepository.query(
      `
        INSERT INTO teams (tournament_id, name)
        VALUES ($1, $2)
        RETURNING id, name
      `,
      [tournamentId, teamName],
    );

    for (const playerName of uniquePlayerNames) {
      await this.usersRepository.query(
        `
          INSERT INTO team_players (team_id, name)
          VALUES ($1, $2)
        `,
        [Number(team.id), playerName],
      );
    }

    return {
      message: 'Team registered successfully.',
      team: {
        id: Number(team.id),
        name: team.name,
        members: uniquePlayerNames.length,
      },
    };
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
}
