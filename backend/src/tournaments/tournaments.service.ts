import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
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

const SPORT_TYPES = ['FOOTBALL', 'F1', 'BASKETBALL', 'ESPORTS'];
const FORMATS = ['GROUP_AND_KNOCKOUT', 'ROUND_ROBIN', 'KNOCKOUT'];
const STATUSES = ['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
const VISIBILITIES = ['PUBLIC', 'PRIVATE'];

@Injectable()
export class TournamentsService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.ensureSportTypeConstraint();
  }

  async findAll() {
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

    return {
      message: 'Tournament created successfully.',
      tournament: row,
    };
  }

  async updateTournamentByAdmin(id: number, input: TournamentInput) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Invalid tournament id.');
    }

    const data = this.normalizeInput(input, false);
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

    if (!row) {
      throw new NotFoundException('Tournament not found.');
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
      format: format ?? (requireName ? 'ROUND_ROBIN' : undefined),
      status: status ?? (requireName ? 'UPCOMING' : undefined),
      visibility: visibility ?? (requireName ? 'PUBLIC' : undefined),
    };
  }

  private async ensureSportTypeConstraint() {
    await this.usersRepository.query(`
      ALTER TABLE tournaments
      DROP CONSTRAINT IF EXISTS chk_tournaments_sport_type
    `);
    await this.usersRepository.query(`
      ALTER TABLE tournaments
      ADD CONSTRAINT chk_tournaments_sport_type
      CHECK (sport_type IN ('FOOTBALL', 'F1', 'BASKETBALL', 'ESPORTS'))
    `);
  }
}
