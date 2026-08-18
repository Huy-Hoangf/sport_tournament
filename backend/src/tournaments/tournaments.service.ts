import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

type TournamentInput = {
  name?: string;
  sportType?: string;
  format?: string;
  status?: string;
  visibility?: string;
  startDate?: string | null;
  endDate?: string | null;
};

type TournamentFormat = 'GROUP_AND_KNOCKOUT' | 'ROUND_ROBIN' | 'KNOCKOUT';
type TournamentStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETE';

const SPORT_TYPES = ['FOOTBALL', 'F1', 'LOL', 'OTHER'];
const FORMATS = ['GROUP_AND_KNOCKOUT', 'ROUND_ROBIN', 'KNOCKOUT'];
const STATUSES: TournamentStatus[] = ['UPCOMING', 'ONGOING', 'COMPLETE'];
const VISIBILITIES = ['PUBLIC', 'PRIVATE'];

const STAGES_BY_FORMAT: Record<
  TournamentFormat,
  Array<{ name: string; isKnockout: boolean }>
> = {
  ROUND_ROBIN: [
    { name: 'League Schedule', isKnockout: false },
    { name: 'Final Table', isKnockout: false },
  ],
  KNOCKOUT: [
    { name: 'Round of 16', isKnockout: true },
    { name: 'Quarter Finals', isKnockout: true },
    { name: 'Semi Finals', isKnockout: true },
    { name: 'Final', isKnockout: true },
  ],
  GROUP_AND_KNOCKOUT: [
    { name: 'Group Stage', isKnockout: false },
    { name: 'Round of 16', isKnockout: true },
    { name: 'Quarter Finals', isKnockout: true },
    { name: 'Semi Finals', isKnockout: true },
    { name: 'Final', isKnockout: true },
  ],
};

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findAll({
    includePrivateTournaments = false,
  }: {
    includePrivateTournaments?: boolean;
  } = {}) {
    const visibilityCondition = includePrivateTournaments
      ? ''
      : "WHERE t.visibility = 'PUBLIC'";
    const rows = await this.usersRepository.query(`
      SELECT
        t.id,
        t.name,
        t.sport_type AS "sportType",
        t.format,
        ${this.statusExpression('t.start_date', 't.end_date', 't.status')} AS status,
        t.visibility,
        t.start_date AS "startDate",
        t.end_date AS "endDate",
        t.created_by AS "createdBy",
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt",
        COUNT(DISTINCT tp.user_id) AS players,
        COUNT(DISTINCT m.id) AS matches
      FROM tournaments t
      LEFT JOIN tournament_participants tp ON tp.tournament_id = t.id
      LEFT JOIN matches m ON m.tournament_id = t.id
      ${visibilityCondition}
      GROUP BY t.id
      ORDER BY t.updated_at DESC, t.created_at DESC
    `);

    return rows.map((row) => ({
      ...row,
      players: Number(row.players ?? 0),
      matches: Number(row.matches ?? 0),
    }));
  }

  async createTournamentByAdmin(adminId: number, input: TournamentInput) {
    const data = this.normalizeInput(input, true);

    const [row] = await this.usersRepository.query(
      `
        INSERT INTO tournaments
          (name, sport_type, format, status, visibility, start_date, end_date, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          name,
          sport_type AS "sportType",
          format,
          status,
          visibility,
          start_date AS "startDate",
          end_date AS "endDate",
          created_by AS "createdBy",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        data.name,
        data.sportType,
        data.format,
        data.status,
        data.visibility,
        data.startDate,
        data.endDate,
        adminId,
      ],
    );

    await this.ensureStagesForFormat(Number(row.id), data.format);

    return {
      message: 'Tournament created successfully.',
      tournament: row,
    };
  }

  async updateTournamentByAdmin(id: number, input: TournamentInput) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Invalid tournament id.');
    }

    const [current] = await this.usersRepository.query(
      `
        SELECT
          id,
          name,
          sport_type AS "sportType",
          format,
          status,
          visibility,
          start_date AS "startDate",
          end_date AS "endDate"
        FROM tournaments
        WHERE id = $1
      `,
      [id],
    );

    if (!current) {
      throw new NotFoundException('Tournament not found.');
    }

    const data = this.normalizeInput(input, false);
    if (data.startDate !== undefined || data.endDate !== undefined) {
      data.status = this.calculateStatus(
        data.startDate === undefined ? current.startDate : data.startDate,
        data.endDate === undefined ? current.endDate : data.endDate,
        data.status ?? this.normalizeStatus(current.status) ?? 'UPCOMING',
      );
    }
    const lockedFields = [
      ['name', data.name, current.name],
      ['sportType', data.sportType, current.sportType],
      ['format', data.format, current.format],
      ['visibility', data.visibility, current.visibility],
    ] as const;
    const locksCoreFields =
      current.status === 'ONGOING' || data.status === 'ONGOING';

    if (locksCoreFields) {
      const changedLockedField = lockedFields.find(
        ([, nextValue, currentValue]) =>
          nextValue !== undefined && nextValue !== currentValue,
      );

      if (changedLockedField) {
        throw new BadRequestException(
          'Active tournaments cannot change name, sport type, format or visibility.',
        );
      }
    }

    if (data.format && data.format !== current.format) {
      await this.assertFormatCanChange(id);
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [column, value] of [
      ['name', data.name],
      ['sport_type', data.sportType],
      ['format', data.format],
      ['status', data.status],
      ['visibility', data.visibility],
      ['start_date', data.startDate],
      ['end_date', data.endDate],
    ] as const) {
      if (value === undefined) {
        continue;
      }

      values.push(value);
      fields.push(`${column} = $${values.length}`);
    }

    if (fields.length === 0) {
      throw new BadRequestException('No tournament changes provided.');
    }

    values.push(id);
    const [row] = await this.usersRepository.query(
      `
        UPDATE tournaments
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING
          id,
          name,
          sport_type AS "sportType",
          format,
          status,
          visibility,
          start_date AS "startDate",
          end_date AS "endDate",
          created_by AS "createdBy",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      values,
    );

    if (data.format && data.format !== current.format) {
      await this.replaceStagesForFormat(id, data.format);
    }

    return {
      message: 'Tournament updated successfully.',
      tournament: row,
    };
  }

  async deleteTournamentByAdmin(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Invalid tournament id.');
    }

    const [current] = await this.usersRepository.query(
      `
        SELECT id, status
        FROM tournaments
        WHERE id = $1
      `,
      [id],
    );

    if (!current) {
      throw new NotFoundException('Tournament not found.');
    }

    if (current.status !== 'COMPLETE') {
      throw new BadRequestException(
        'Only completed tournaments can be deleted.',
      );
    }

    const rows = await this.usersRepository.query(
      `
        DELETE FROM tournaments
        WHERE id = $1
        RETURNING id
      `,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Tournament not found.');
    }

    return {
      message: 'Tournament deleted successfully.',
      deletedId: id,
    };
  }

  private normalizeInput(input: TournamentInput, requireName: boolean) {
    const name = input.name?.trim();
    const sportType = input.sportType?.trim().toUpperCase();
    const format = input.format?.trim().toUpperCase();
    const status = this.normalizeStatus(input.status);
    const visibility = input.visibility?.trim().toUpperCase();
    const startDate = this.normalizeDateInput(input.startDate);
    const endDate = this.normalizeDateInput(input.endDate);

    if (requireName && !name) {
      throw new BadRequestException('Tournament name is required.');
    }

    if (name !== undefined && !name) {
      throw new BadRequestException('Tournament name is required.');
    }

    if (
      input.sportType !== undefined &&
      (!sportType || !SPORT_TYPES.includes(sportType))
    ) {
      throw new BadRequestException('Invalid tournament sport type.');
    }

    if (input.format !== undefined && (!format || !FORMATS.includes(format))) {
      throw new BadRequestException('Invalid tournament format.');
    }

    if (input.status !== undefined && !status) {
      throw new BadRequestException('Invalid tournament status.');
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException('Tournament start date must be before end date.');
    }

    const resolvedStatus = this.resolveStatusFromDates(
      startDate,
      endDate,
      status ?? (requireName ? 'UPCOMING' : undefined),
    );

    if (
      input.visibility !== undefined &&
      (!visibility || !VISIBILITIES.includes(visibility))
    ) {
      throw new BadRequestException('Invalid tournament visibility.');
    }

    return {
      name,
      sportType: sportType ?? (requireName ? 'FOOTBALL' : undefined),
      format: (format ?? (requireName ? 'ROUND_ROBIN' : undefined)) as
        TournamentFormat | undefined,
      status: resolvedStatus,
      visibility: visibility ?? (requireName ? 'PUBLIC' : undefined),
      startDate,
      endDate,
    };
  }

  private normalizeStatus(status?: string): TournamentStatus | undefined {
    const normalized = status?.trim().toUpperCase();

    if (!normalized) {
      return undefined;
    }

    if (normalized === 'ACTIVE' || normalized === 'LIVE') {
      return 'ONGOING';
    }

    if (
      normalized === 'COMPLETED' ||
      normalized === 'FINISHED' ||
      normalized === 'CANCELLED' ||
      normalized === 'CANCELED'
    ) {
      return 'COMPLETE';
    }

    return STATUSES.includes(normalized as TournamentStatus)
      ? (normalized as TournamentStatus)
      : undefined;
  }

  private normalizeDateInput(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value.trim() === '') {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid tournament date.');
    }

    return parsed.toISOString();
  }

  private resolveStatusFromDates(
    startDate: string | null | undefined,
    endDate: string | null | undefined,
    fallbackStatus: TournamentStatus | undefined,
  ): TournamentStatus | undefined {
    if (startDate === undefined && endDate === undefined) {
      return fallbackStatus;
    }

    return this.calculateStatus(startDate, endDate, fallbackStatus);
  }

  private calculateStatus(
    startDate: string | null | undefined,
    endDate: string | null | undefined,
    fallbackStatus: TournamentStatus = 'UPCOMING',
  ): TournamentStatus {
    const now = Date.now();
    const startTime = startDate ? new Date(startDate).getTime() : NaN;
    const endTime = endDate ? new Date(endDate).getTime() : NaN;

    if (Number.isFinite(endTime) && endTime < now) {
      return 'COMPLETE';
    }

    if (Number.isFinite(startTime) && startTime > now) {
      return 'UPCOMING';
    }

    if (Number.isFinite(startTime) || Number.isFinite(endTime)) {
      return 'ONGOING';
    }

    return fallbackStatus;
  }

  private statusExpression(startColumn: string, endColumn: string, fallbackColumn: string) {
    return `
      CASE
        WHEN ${endColumn} IS NOT NULL AND ${endColumn} < NOW() THEN 'COMPLETE'
        WHEN ${startColumn} IS NOT NULL AND ${startColumn} > NOW() THEN 'UPCOMING'
        WHEN ${startColumn} IS NOT NULL OR ${endColumn} IS NOT NULL THEN 'ONGOING'
        WHEN ${fallbackColumn} IN ('ACTIVE', 'LIVE', 'ONGOING') THEN 'ONGOING'
        WHEN ${fallbackColumn} IN ('COMPLETED', 'COMPLETE', 'FINISHED', 'CANCELLED', 'CANCELED') THEN 'COMPLETE'
        ELSE 'UPCOMING'
      END
    `;
  }

  private async ensureStagesForFormat(
    tournamentId: number,
    format: TournamentFormat | undefined,
  ) {
    const stages = STAGES_BY_FORMAT[format ?? 'ROUND_ROBIN'];

    for (const [index, stage] of stages.entries()) {
      await this.usersRepository.query(
        `
          INSERT INTO stages (tournament_id, name, sort_order, is_knockout)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (tournament_id, sort_order)
          DO UPDATE SET
            name = EXCLUDED.name,
            is_knockout = EXCLUDED.is_knockout,
            updated_at = NOW()
        `,
        [tournamentId, stage.name, index + 1, stage.isKnockout],
      );
    }
  }

  private async replaceStagesForFormat(
    tournamentId: number,
    format: TournamentFormat,
  ) {
    await this.assertFormatCanChange(tournamentId);
    await this.usersRepository.query(
      'DELETE FROM stages WHERE tournament_id = $1',
      [tournamentId],
    );
    await this.ensureStagesForFormat(tournamentId, format);
  }

  private async assertFormatCanChange(tournamentId: number) {
    const [{ count }] = await this.usersRepository.query(
      'SELECT COUNT(*) AS count FROM matches WHERE tournament_id = $1',
      [tournamentId],
    );

    if (Number(count ?? 0) > 0) {
      throw new BadRequestException(
        'Cannot change tournament format after matches have been created.',
      );
    }
  }
}
