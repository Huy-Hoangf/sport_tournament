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
  players: Array<{ id?: number; name?: string }>;
};

type UpdateTeamInput = {
  teamId: number;
  teamName: string;
  players: Array<{ id?: number; name?: string }>;
};

type DeleteTeamInput = {
  teamId: number;
};

type RosterPlayer = {
  id: number;
  name: string;
};

type TeamPlayerDetailRow = {
  userId: number | null;
  name: string;
  email: string | null;
  memberCode: string | null;
};

type RosterPlayerRow = {
  id: number;
  name: string;
};

type RosterConflictRow = {
  playerName: string;
  teamName: string;
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
            team.logo_url AS "logoUrl",
            (
              SELECT COUNT(*)
              FROM matches match_count
              WHERE match_count.home_team_id = team.id
                 OR match_count.away_team_id = team.id
            ) AS "directMatchCount"
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
            bt.team_id AS id,
            bt.sport_type,
            bt.name,
            bt."logoUrl",
            COALESCE(id_stats.stage, name_stats.stage, 'Roster') AS stage,
            COALESCE(id_stats.matches, name_stats.matches, 0) AS matches,
            COALESCE(bt."directMatchCount", 0) AS "directMatchCount",
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
            NULL AS id,
            sport_type,
            name,
            NULL AS "logoUrl",
            COALESCE(stage, 'Main Stage') AS stage,
            matches,
            0 AS "directMatchCount",
            wins,
            losses,
            draws,
            score,
            0 AS members
          FROM placeholder_stats
        )
        SELECT
          "tournamentId",
          id,
          name,
          "logoUrl",
          stage,
          matches,
          "directMatchCount",
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
      id: row.id === null || row.id === undefined ? null : Number(row.id),
      name: row.name,
      logoUrl: row.logoUrl ?? null,
      stage: row.stage ?? 'Main Stage',
      matches: Number(row.matches ?? 0),
      directMatchCount: Number(row.directMatchCount ?? 0),
      wins: Number(row.wins ?? 0),
      losses: Number(row.losses ?? 0),
      draws: Number(row.draws ?? 0),
      score: Number(row.score ?? 0),
      points: Number(row.points ?? 0),
      members: Number(row.members ?? 0),
    }));
  }

  async findOne({
    includePrivateTournaments,
    teamId,
  }: {
    includePrivateTournaments: boolean;
    teamId: number;
  }) {
    if (!Number.isInteger(teamId) || teamId <= 0) {
      throw new BadRequestException('Invalid team id.');
    }

    const values: unknown[] = [teamId];
    const visibilityCondition = includePrivateTournaments
      ? ''
      : "AND t.visibility = 'PUBLIC'";
    const [team] = await this.usersRepository.query(
      `
        SELECT
          team.id,
          team.tournament_id AS "tournamentId",
          team.name,
          team.logo_url AS "logoUrl",
          (
            SELECT COUNT(*)
            FROM matches match_count
            WHERE match_count.home_team_id = team.id
               OR match_count.away_team_id = team.id
          ) AS "directMatchCount",
          ${this.tournamentStatusExpression('t.start_date', 't.end_date', 't.status')} AS "tournamentStatus"
        FROM teams team
        JOIN tournaments t ON t.id = team.tournament_id
        WHERE team.id = $1
          ${visibilityCondition}
        LIMIT 1
      `,
      values,
    );

    if (!team) {
      throw new NotFoundException('Team not found.');
    }

    const players: TeamPlayerDetailRow[] = await this.usersRepository.query(
      `
        SELECT
          COALESCE(u.id, tp.user_id) AS "userId",
          COALESCE(u.full_name, tp.name) AS name,
          u.email,
          u.member_code AS "memberCode"
        FROM team_players tp
        LEFT JOIN users u ON u.id = tp.user_id
        WHERE tp.team_id = $1
        ORDER BY COALESCE(u.full_name, tp.name) ASC
      `,
      [teamId],
    );

    return {
      id: Number(team.id),
      tournamentId: Number(team.tournamentId),
      name: team.name,
      logoUrl: team.logoUrl ?? null,
      tournamentStatus: team.tournamentStatus,
      locked: team.tournamentStatus === 'ONGOING',
      directMatchCount: Number(team.directMatchCount ?? 0),
      players: players.map((player) => ({
        id:
          player.userId === null || player.userId === undefined
            ? undefined
            : Number(player.userId),
        name: player.name,
        email: player.email ?? null,
        memberCode: player.memberCode ?? null,
      })),
    };
  }

  async registerTeam(input: RegisterTeamInput) {
    const tournamentId = input.tournamentId;
    const teamName = input.teamName.trim();
    const playerIds = this.normalizeRosterPlayerIds(input.players);

    if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
      throw new BadRequestException('Invalid tournament id.');
    }

    if (!this.isKnownTeamName(teamName)) {
      throw new BadRequestException('Team name is required.');
    }

    if (playerIds.length === 0) {
      throw new BadRequestException('At least one player is required.');
    }

    const [tournament] = await this.usersRepository.query(
      `
        SELECT
          id,
          ${this.tournamentStatusExpression('start_date', 'end_date', 'status')} AS status
        FROM tournaments
        WHERE id = $1
        LIMIT 1
      `,
      [tournamentId],
    );

    if (!tournament) {
      throw new NotFoundException('Tournament not found.');
    }

    if (tournament.status !== 'UPCOMING') {
      throw new BadRequestException(
        'Teams can only be registered before the tournament starts.',
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

    const rosterPlayers = await this.resolveRosterPlayers(
      tournamentId,
      playerIds,
    );

    const [team] = await this.usersRepository.query(
      `
        INSERT INTO teams (tournament_id, name)
        VALUES ($1, $2)
        RETURNING id, name
      `,
      [tournamentId, teamName],
    );

    for (const player of rosterPlayers) {
      await this.usersRepository.query(
        `
          INSERT INTO team_players (team_id, user_id, name)
          VALUES ($1, $2, $3)
        `,
        [Number(team.id), player.id, player.name],
      );
    }

    return {
      message: 'Team registered successfully.',
      team: {
        id: Number(team.id),
        name: team.name,
        members: rosterPlayers.length,
      },
    };
  }

  async updateTeam(input: UpdateTeamInput) {
    const teamId = input.teamId;
    const teamName = input.teamName.trim();
    const playerIds = this.normalizeRosterPlayerIds(input.players);

    if (!Number.isInteger(teamId) || teamId <= 0) {
      throw new BadRequestException('Invalid team id.');
    }

    if (!this.isKnownTeamName(teamName)) {
      throw new BadRequestException('Team name is required.');
    }

    const [team] = await this.usersRepository.query(
      `
        SELECT
          team.id,
          team.tournament_id AS "tournamentId",
          ${this.tournamentStatusExpression('t.start_date', 't.end_date', 't.status')} AS "tournamentStatus"
        FROM teams team
        JOIN tournaments t ON t.id = team.tournament_id
        WHERE team.id = $1
        LIMIT 1
      `,
      [teamId],
    );

    if (!team) {
      throw new NotFoundException('Team not found.');
    }

    if (team.tournamentStatus === 'ONGOING') {
      throw new BadRequestException('Ongoing tournaments cannot edit teams.');
    }

    const [duplicateTeam] = await this.usersRepository.query(
      `
        SELECT id
        FROM teams
        WHERE tournament_id = $1
          AND id != $2
          AND LOWER(name) = LOWER($3)
        LIMIT 1
      `,
      [Number(team.tournamentId), teamId, teamName],
    );

    if (duplicateTeam) {
      throw new BadRequestException('Team already exists in this tournament.');
    }

    const rosterPlayers = await this.resolveRosterPlayers(
      Number(team.tournamentId),
      playerIds,
      teamId,
    );

    await this.usersRepository.manager.transaction(async (manager) => {
      await manager.query(
        `
          UPDATE teams
          SET name = $1
          WHERE id = $2
        `,
        [teamName, teamId],
      );
      await manager.query('DELETE FROM team_players WHERE team_id = $1', [
        teamId,
      ]);

      for (const player of rosterPlayers) {
        await manager.query(
          `
            INSERT INTO team_players (team_id, user_id, name)
            VALUES ($1, $2, $3)
          `,
          [teamId, player.id, player.name],
        );
      }
    });

    return {
      message: 'Team updated successfully.',
      team: {
        id: teamId,
        name: teamName,
        members: rosterPlayers.length,
      },
    };
  }

  async deleteTeam(input: DeleteTeamInput) {
    const teamId = input.teamId;

    if (!Number.isInteger(teamId) || teamId <= 0) {
      throw new BadRequestException('Invalid team id.');
    }

    const [team] = await this.usersRepository.query(
      `
        SELECT
          team.id,
          team.name,
          team.tournament_id AS "tournamentId",
          ${this.tournamentStatusExpression('t.start_date', 't.end_date', 't.status')} AS "tournamentStatus",
          (
            SELECT COUNT(*)
            FROM matches match_count
            WHERE match_count.home_team_id = team.id
               OR match_count.away_team_id = team.id
          ) AS "directMatchCount"
        FROM teams team
        JOIN tournaments t ON t.id = team.tournament_id
        WHERE team.id = $1
        LIMIT 1
      `,
      [teamId],
    );

    if (!team) {
      throw new NotFoundException('Team not found.');
    }

    if (team.tournamentStatus === 'ONGOING') {
      throw new BadRequestException(
        'Cannot delete team while tournament is ongoing.',
      );
    }

    if (team.tournamentStatus === 'COMPLETE') {
      throw new BadRequestException(
        'Completed tournaments are read-only. Export data instead.',
      );
    }

    if (Number(team.directMatchCount ?? 0) > 0) {
      throw new BadRequestException(
        'Cannot delete team after matches have been created.',
      );
    }

    await this.usersRepository.query('DELETE FROM teams WHERE id = $1', [
      teamId,
    ]);

    return {
      message: 'Team deleted successfully.',
      deletedId: teamId,
      tournamentId: Number(team.tournamentId),
      teamName: team.name,
    };
  }

  private normalizeRosterPlayerIds(players: Array<{ id?: number }>) {
    const playerIds = players.map((player) => Number(player.id));

    if (playerIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new BadRequestException(
        'Every team member must be selected from the Players table.',
      );
    }

    const uniquePlayerIds = Array.from(new Set(playerIds));

    if (uniquePlayerIds.length !== playerIds.length) {
      throw new BadRequestException('Players must be unique.');
    }

    return uniquePlayerIds;
  }

  private async resolveRosterPlayers(
    tournamentId: number,
    playerIds: number[],
    currentTeamId?: number,
  ): Promise<RosterPlayer[]> {
    if (playerIds.length === 0) {
      return [];
    }

    const players: RosterPlayerRow[] = await this.usersRepository.query(
      `
        SELECT
          id,
          full_name AS name
        FROM users
        WHERE id = ANY($1::int[])
          AND role = 'PLAYER'
          AND user_status = 'ACTIVE'
      `,
      [playerIds],
    );

    if (players.length !== playerIds.length) {
      throw new BadRequestException(
        'Every team member must be an active player from the Players table.',
      );
    }

    const conflicts: RosterConflictRow[] = await this.usersRepository.query(
      `
        SELECT
          u.full_name AS "playerName",
          team.name AS "teamName"
        FROM team_players tp
        JOIN teams team ON team.id = tp.team_id
        JOIN users u ON u.id = tp.user_id
        WHERE team.tournament_id = $1
          AND tp.user_id = ANY($2::int[])
          AND ($3::int IS NULL OR team.id != $3::int)
        ORDER BY u.full_name ASC
        LIMIT 3
      `,
      [tournamentId, playerIds, currentTeamId ?? null],
    );

    if (conflicts.length > 0) {
      const conflict = conflicts[0];

      throw new BadRequestException(
        `${conflict.playerName} already belongs to ${conflict.teamName}.`,
      );
    }

    const playersById = new Map<number, RosterPlayer>(
      players.map((player) => [
        Number(player.id),
        {
          id: Number(player.id),
          name: player.name,
        },
      ]),
    );

    return playerIds.map((playerId) => playersById.get(playerId)!);
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
        WHEN ${startColumn} IS NOT NULL AND ${startColumn} <= NOW()
          AND (${endColumn} IS NULL OR ${endColumn} >= NOW()) THEN 'ONGOING'
        WHEN ${fallbackColumn} IN ('ACTIVE', 'LIVE', 'ONGOING') THEN 'ONGOING'
        WHEN ${fallbackColumn} IN ('COMPLETED', 'COMPLETE', 'FINISHED', 'CANCELLED', 'CANCELED') THEN 'COMPLETE'
        ELSE 'UPCOMING'
      END
    `;
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
