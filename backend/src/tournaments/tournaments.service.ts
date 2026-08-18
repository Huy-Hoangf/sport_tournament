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
};

type TournamentFormat = 'GROUP_AND_KNOCKOUT' | 'ROUND_ROBIN' | 'KNOCKOUT';

const SPORT_TYPES = ['FOOTBALL', 'F1', 'LOL', 'OTHER'];
const FORMATS = ['GROUP_AND_KNOCKOUT', 'ROUND_ROBIN', 'KNOCKOUT'];
const STATUSES = ['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
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
        t.status,
        t.visibility,
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
          (name, sport_type, format, status, visibility, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          name,
          sport_type AS "sportType",
          format,
          status,
          visibility,
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
          visibility
        FROM tournaments
        WHERE id = $1
      `,
      [id],
    );

    if (!current) {
      throw new NotFoundException('Tournament not found.');
    }

    const data = this.normalizeInput(input, false);
    const lockedFields = [
      ['name', data.name, current.name],
      ['sportType', data.sportType, current.sportType],
      ['format', data.format, current.format],
      ['visibility', data.visibility, current.visibility],
    ] as const;
    const locksCoreFields =
      current.status === 'ACTIVE' || data.status === 'ACTIVE';

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

    if (current.status !== 'COMPLETED') {
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
    const status = input.status?.trim().toUpperCase();
    const visibility = input.visibility?.trim().toUpperCase();

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

    if (input.status !== undefined && (!status || !STATUSES.includes(status))) {
      throw new BadRequestException('Invalid tournament status.');
    }

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
      status: status ?? (requireName ? 'UPCOMING' : undefined),
      visibility: visibility ?? (requireName ? 'PUBLIC' : undefined),
    };
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
