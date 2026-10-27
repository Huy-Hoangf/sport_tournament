import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { positiveId, validateMatchInput } from './match-validation';
import { readMatchWorkbook } from './match-workbook';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(input: Record<string, unknown>) {
    try {
      return await this.usersRepository.manager.transaction((manager) =>
        this.insert(manager, input),
      );
    } catch (error) {
      return this.databaseError(error);
    }
  }

  private async insert(manager: EntityManager, input: Record<string, unknown>) {
    const data = validateMatchInput(input);
    const references = await manager.query(
      `
      SELECT s.id FROM stages s
      JOIN teams h ON h.tournament_id = s.tournament_id AND h.id = $3
      JOIN teams a ON a.tournament_id = s.tournament_id AND a.id = $4
      WHERE s.id = $2 AND s.tournament_id = $1
      FOR KEY SHARE OF s, h, a
    `,
      [data.tournamentId, data.stageId, data.homeTeamId, data.awayTeamId],
    );
    if (!references.length)
      throw new BadRequestException(
        'Team hoặc stage không tồn tại trong giải đấu.',
      );
    const rows = await manager.query(
      `
      INSERT INTO matches (tournament_id, stage_id, home_team_id, away_team_id,
        scheduled_time, lock_minutes_before_start, external_source, prediction_locked)
      VALUES ($1,$2,$3,$4,$5,$6,'MANUAL',FALSE) RETURNING id
    `,
      [
        data.tournamentId,
        data.stageId,
        data.homeTeamId,
        data.awayTeamId,
        data.scheduledTime,
        data.lockMinutes,
      ],
    );
    return { id: Number(rows[0].id), predictionLocked: false };
  }

  async update(id: number, input: Record<string, unknown>) {
    positiveId(id);
    const data = validateMatchInput(input);
    try {
      return await this.usersRepository.manager.transaction(async (manager) => {
        const rows = await manager.query(
          'SELECT * FROM matches WHERE id = $1 FOR UPDATE',
          [id],
        );
        if (!rows.length) throw new NotFoundException('Match not found.');
        if (rows[0].status !== 'PENDING')
          throw new ConflictException('Only pending matches can be edited.');
        const votes = await manager.query(
          'SELECT id FROM predictions WHERE match_id = $1 LIMIT 1',
          [id],
        );
        if (votes.length)
          throw new ConflictException(
            'Cannot edit a match that already has votes.',
          );
        const refs = await manager.query(
          `
          SELECT s.id FROM stages s
          JOIN teams h ON h.id=$3 AND h.tournament_id=s.tournament_id
          JOIN teams a ON a.id=$4 AND a.tournament_id=s.tournament_id
          WHERE s.id=$2 AND s.tournament_id=$1 FOR KEY SHARE OF s,h,a
        `,
          [data.tournamentId, data.stageId, data.homeTeamId, data.awayTeamId],
        );
        if (!refs.length)
          throw new BadRequestException(
            'Team hoặc stage không tồn tại trong giải đấu.',
          );
        await manager.query(
          `UPDATE matches SET tournament_id=$2, stage_id=$3, home_team_id=$4,
          away_team_id=$5, scheduled_time=$6, lock_minutes_before_start=$7, updated_at=NOW()
          WHERE id=$1`,
          [
            id,
            data.tournamentId,
            data.stageId,
            data.homeTeamId,
            data.awayTeamId,
            data.scheduledTime,
            data.lockMinutes,
          ],
        );
        return { id };
      });
    } catch (error) {
      return this.databaseError(error);
    }
  }

  async remove(id: number) {
    positiveId(id);
    return this.usersRepository.manager.transaction(async (manager) => {
      const rows = await manager.query(
        'SELECT id FROM matches WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!rows.length) throw new NotFoundException('Match not found.');
      const votes = await manager.query(
        'SELECT id FROM predictions WHERE match_id=$1 LIMIT 1',
        [id],
      );
      if (votes.length)
        throw new ConflictException(
          'Cannot delete a match that already has votes.',
        );
      await manager.query('DELETE FROM matches WHERE id=$1', [id]);
      return { id };
    });
  }

  async setPredictionLock(id: number, locked: unknown) {
    positiveId(id);
    if (typeof locked !== 'boolean')
      throw new BadRequestException('locked must be a boolean.');
    const rows = await this.usersRepository.query(
      `
      WITH changed AS (UPDATE matches SET prediction_locked=$2, updated_at=NOW()
        WHERE id=$1 RETURNING id, prediction_locked AS "predictionLocked") SELECT * FROM changed
    `,
      [id, locked],
    );
    if (!rows.length) throw new NotFoundException('Match not found.');
    return rows[0];
  }

  async importWorkbook(input: Record<string, unknown>, adminId: number) {
    const rows = await readMatchWorkbook(input.fileName, input.contentBase64);
    const legacy = rows[0].tournament === undefined;
    const tournamentId = legacy
      ? positiveId(input.tournamentId, 'tournamentId')
      : undefined;
    const stageId = legacy ? positiveId(input.stageId, 'stageId') : undefined;
    return this.usersRepository.manager.transaction(async (manager) => {
      const tournamentIds = new Map<string, number>();
      const stageIds = new Map<string, number>();
      const teamIds = new Map<string, number>();
      if (legacy) {
        await manager.query(
          'SELECT id FROM tournaments WHERE id=$1 FOR UPDATE',
          [tournamentId],
        );
        const stage = await manager.query(
          'SELECT id FROM stages WHERE id=$1 AND tournament_id=$2',
          [stageId, tournamentId],
        );
        if (!stage.length)
          throw new BadRequestException('Stage not found in tournament.');
      }
      const errors: Array<{ row: number; message: string }> = [];
      let imported = 0;
      for (const row of rows) {
        await manager.query('SAVEPOINT import_row');
        try {
          if (row.error) throw new BadRequestException(row.error);
          const tournamentKey = `${row.tournament?.toLowerCase()}\0${row.startDate ?? ''}\0${row.endDate ?? ''}`;
          const rowTournamentId = legacy
            ? tournamentId!
            : (tournamentIds.get(tournamentKey) ??
              (await this.findOrCreateTournament(
                manager,
                row.tournament!,
                adminId,
                row.startDate,
                row.endDate,
              )));
          const stageKey = `${rowTournamentId}\0${row.stage?.toLowerCase()}`;
          const rowStageId = legacy
            ? stageId!
            : (stageIds.get(stageKey) ??
              (await this.findOrCreateStage(
                manager,
                rowTournamentId,
                row.stage!,
              )));
          const homeKey = `${rowTournamentId}\0${row.home.toLowerCase()}`;
          const awayKey = `${rowTournamentId}\0${row.away.toLowerCase()}`;
          const homeTeamId =
            teamIds.get(homeKey) ??
            (await this.findOrCreateTeam(manager, rowTournamentId, row.home));
          const awayTeamId =
            teamIds.get(awayKey) ??
            (await this.findOrCreateTeam(manager, rowTournamentId, row.away));
          await this.insert(manager, {
            tournamentId: rowTournamentId,
            stageId: rowStageId,
            homeTeamId,
            awayTeamId,
            scheduledTime: row.kickoff,
          });
          if (!legacy) {
            tournamentIds.set(tournamentKey, rowTournamentId);
            stageIds.set(stageKey, rowStageId);
          }
          teamIds.set(homeKey, homeTeamId);
          teamIds.set(awayKey, awayTeamId);
          imported++;
        } catch (error) {
          await manager.query('ROLLBACK TO SAVEPOINT import_row');
          const code = (error as { code?: string }).code;
          if (
            !(error instanceof HttpException) &&
            !['23505', '23503'].includes(code ?? '')
          )
            throw error;
          errors.push({
            row: row.row,
            message:
              code === '23505'
                ? 'Trận đấu đã tồn tại.'
                : code === '23503'
                  ? 'Team không tồn tại.'
                  : (error as Error).message,
          });
        }
        await manager.query('RELEASE SAVEPOINT import_row');
      }
      return { imported, rejected: errors.length, errors };
    });
  }

  private async findOrCreateTournament(
    manager: EntityManager,
    name: string,
    adminId: number,
    startDate?: string,
    endDate?: string,
  ) {
    const startTimestamp = startDate ? `${startDate}T00:00:00.000+07:00` : null;
    const endTimestamp = endDate ? `${endDate}T23:59:59.999+07:00` : null;
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtext('excel-tournament'), hashtext(LOWER($1)))",
      [name],
    );
    const existing: Array<{
      id: number;
      startDate: string | null;
      endDate: string | null;
    }> = await manager.query(
      `SELECT id,
        to_char(start_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS "startDate",
        to_char(end_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS "endDate"
       FROM tournaments WHERE LOWER(name)=LOWER($1) AND sport_type='FOOTBALL' FOR UPDATE`,
      [name],
    );
    if (existing.length > 1)
      throw new BadRequestException(
        `Multiple tournaments named ${name}; rename the tournament in Excel.`,
      );
    if (existing.length) {
      const current = existing[0];
      if (
        (startDate && current.startDate && current.startDate !== startDate) ||
        (endDate && current.endDate && current.endDate !== endDate)
      )
        throw new BadRequestException(
          `Tournament ${name} already has different start or end dates.`,
        );
      if (startDate && endDate && (!current.startDate || !current.endDate))
        await manager.query(
          `UPDATE tournaments SET start_date=COALESCE(start_date,$2::timestamptz),
           end_date=COALESCE(end_date,$3::timestamptz), updated_at=NOW() WHERE id=$1`,
          [current.id, startTimestamp, endTimestamp],
        );
      return Number(current.id);
    }
    const [created] = await manager.query(
      "INSERT INTO tournaments (name, sport_type, format, status, visibility, start_date, end_date, created_by) VALUES ($1, 'FOOTBALL', 'ROUND_ROBIN', 'UPCOMING', 'PUBLIC', $2, $3, $4) RETURNING id",
      [name, startTimestamp, endTimestamp, adminId],
    );
    return Number(created.id);
  }

  private async findOrCreateStage(
    manager: EntityManager,
    tournamentId: number,
    name: string,
  ) {
    const existing: Array<{ id: number }> = await manager.query(
      'SELECT id FROM stages WHERE tournament_id=$1 AND LOWER(name)=LOWER($2)',
      [tournamentId, name],
    );
    if (existing.length) return Number(existing[0].id);
    const [created] = await manager.query(
      'INSERT INTO stages (tournament_id, name, sort_order, is_knockout) VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM stages WHERE tournament_id=$1), FALSE) RETURNING id',
      [tournamentId, name],
    );
    return Number(created.id);
  }

  private async findOrCreateTeam(
    manager: EntityManager,
    tournamentId: number,
    name: string,
  ) {
    const existing: Array<{ id: number }> = await manager.query(
      'SELECT id FROM teams WHERE tournament_id=$1 AND LOWER(name)=LOWER($2)',
      [tournamentId, name],
    );
    if (existing.length > 1)
      throw new BadRequestException(
        `Multiple teams named ${name}; resolve duplicates first.`,
      );
    if (existing.length) return Number(existing[0].id);
    const [created] = await manager.query(
      'INSERT INTO teams (tournament_id, name) VALUES ($1, $2) RETURNING id',
      [tournamentId, name],
    );
    return Number(created.id);
  }

  private databaseError(error: unknown): never {
    const code = (error as { code?: string }).code;
    if (code === '23505') throw new ConflictException('Trận đấu đã tồn tại.');
    if (code === '23503')
      throw new BadRequestException('Team hoặc stage không tồn tại.');
    throw error;
  }

  async findAll(filters: {
    includePrivateTournaments: boolean;
    tournamentId?: number;
    stageId?: number;
    status?: string;
    openForVoting?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
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

    if (filters.openForVoting) {
      where.push("m.status = 'PENDING'");
      where.push('m.prediction_locked = FALSE');
      where.push(
        "m.scheduled_time - (m.lock_minutes_before_start * INTERVAL '1 minute') > clock_timestamp()",
      );
      where.push('m.home_team_id IS NOT NULL AND m.away_team_id IS NOT NULL');
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
          m.home_team_id AS "homeTeamId",
          m.away_team_id AS "awayTeamId",
          m.lock_minutes_before_start AS "lockMinutes",
          m.prediction_locked AS "predictionLocked",
          COUNT(*) OVER() AS "totalCount",
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
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `,
      [
        ...values,
        filters.pageSize ?? 300,
        ((filters.page ?? 1) - 1) * (filters.pageSize ?? 300),
      ],
    );

    return rows.map((row) => ({
      id: Number(row.id),
      totalCount: Number(row.totalCount),
      homeTeamId: row.homeTeamId == null ? null : Number(row.homeTeamId),
      awayTeamId: row.awayTeamId == null ? null : Number(row.awayTeamId),
      lockMinutes: Number(row.lockMinutes),
      predictionLocked: row.predictionLocked,
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
