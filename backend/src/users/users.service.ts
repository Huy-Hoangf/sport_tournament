import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import {
  ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_PLAYER_PASSWORD,
  isTwentyTechEmail,
  normalizeEmail,
} from '../auth/auth.constants';
import { User, type UserStatus } from './user.entity';

const USER_STATUSES: UserStatus[] = ['ACTIVE', 'INACTIVE', 'PENDING'];

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultAdmin();
    await this.backfillMemberCodes();
  }

  async findAll() {
    await this.backfillMemberCodes();

    const rows = await this.usersRepository.query(`
      SELECT
        u.id,
        u.member_code AS "memberCode",
        u.email,
        u.full_name AS "fullName",
        u.role,
        u.user_status AS status,
        u.created_at AS "createdAt",
        u.updated_at AS "updatedAt",
        COUNT(DISTINCT tp.tournament_id) AS "eventsCount"
      FROM users u
      LEFT JOIN tournament_participants tp ON tp.user_id = u.id
      GROUP BY
        u.id,
        u.member_code,
        u.email,
        u.full_name,
        u.role,
        u.user_status,
        u.created_at,
        u.updated_at
      ORDER BY u.created_at DESC
    `);

    return rows.map((row) => ({
      ...row,
      eventsCount: Number(row.eventsCount ?? 0),
    }));
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({
      where: {
        email: normalizeEmail(email),
      },
    });
  }

  async createPlayerByAdmin(data: { email: string; fullName: string }) {
    const email = normalizeEmail(data.email);
    const fullName = data.fullName.trim();

    if (!fullName) {
      throw new BadRequestException('Full name is required.');
    }

    if (!isTwentyTechEmail(email)) {
      throw new BadRequestException('Email must use @twenty-tech.com.');
    }

    if (email === ADMIN_EMAIL) {
      throw new BadRequestException('Cannot create another admin account.');
    }

    const existingUser = await this.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email already exists.');
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PLAYER_PASSWORD, 10);
    const memberCode = await this.generateMemberCode();
    const user = this.usersRepository.create({
      email,
      memberCode,
      fullName,
      passwordHash,
      role: 'PLAYER',
      status: 'ACTIVE',
    });

    const savedUser = await this.usersRepository.save(user);

    return {
      id: savedUser.id,
      memberCode: savedUser.memberCode,
      email: savedUser.email,
      fullName: savedUser.fullName,
      role: savedUser.role,
      status: savedUser.status,
      defaultPassword: DEFAULT_PLAYER_PASSWORD,
    };
  }

  async renamePlayerByAdmin(data: {
    id: number;
    email: string;
    fullName: string;
  }) {
    const name = data.fullName.trim();
    const email = normalizeEmail(data.email);

    if (!name) {
      throw new BadRequestException('Full name is required.');
    }

    if (!isTwentyTechEmail(email)) {
      throw new BadRequestException('Email must use @twenty-tech.com.');
    }

    if (email === ADMIN_EMAIL) {
      throw new BadRequestException('Cannot use the admin email.');
    }

    const user = await this.usersRepository.findOne({
      where: { id: data.id },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role === 'ADMIN' || normalizeEmail(user.email) === ADMIN_EMAIL) {
      throw new BadRequestException('Cannot rename the admin account.');
    }

    const existingUser = await this.findByEmail(email);

    if (existingUser && existingUser.id !== user.id) {
      throw new ConflictException('Email already exists.');
    }

    user.fullName = name;
    user.email = email;
    const savedUser = await this.usersRepository.save(user);

    return {
      id: savedUser.id,
      memberCode: savedUser.memberCode,
      email: savedUser.email,
      fullName: savedUser.fullName,
      role: savedUser.role,
      status: savedUser.status,
    };
  }

  async updatePlayerStatusByAdmin(id: number, status: UserStatus) {
    if (!USER_STATUSES.includes(status)) {
      throw new BadRequestException('Invalid user status.');
    }

    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role === 'ADMIN' || normalizeEmail(user.email) === ADMIN_EMAIL) {
      throw new BadRequestException('Cannot update the admin account status.');
    }

    user.status = status;
    const savedUser = await this.usersRepository.save(user);

    return {
      id: savedUser.id,
      memberCode: savedUser.memberCode,
      email: savedUser.email,
      fullName: savedUser.fullName,
      role: savedUser.role,
      status: savedUser.status,
    };
  }

  async deletePlayerByAdmin(id: number) {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role === 'ADMIN' || normalizeEmail(user.email) === ADMIN_EMAIL) {
      throw new BadRequestException('Cannot delete the admin account.');
    }

    await this.usersRepository.remove(user);

    return {
      message: 'User deleted successfully.',
    };
  }

  async deleteAllPlayersByAdmin() {
    const admin = await this.findByEmail(ADMIN_EMAIL);

    if (!admin) {
      throw new NotFoundException('Admin account not found.');
    }

    const [{ totalPlayers }] = await this.usersRepository.query(`
      SELECT COUNT(*) AS "totalPlayers"
      FROM users
      WHERE role = 'PLAYER'
        AND email <> $1
    `, [ADMIN_EMAIL]);
    const deletedCount = Number(totalPlayers ?? 0);

    await this.usersRepository.manager.transaction(async (manager) => {
      await manager.query(`
        DELETE FROM predictions p
        USING users u
        WHERE u.id = p.user_id
          AND u.role = 'PLAYER'
          AND u.email <> $1
      `, [ADMIN_EMAIL]);

      await manager.query(`
        DELETE FROM leaderboard_snapshots ls
        USING users u
        WHERE u.id = ls.user_id
          AND u.role = 'PLAYER'
          AND u.email <> $1
      `, [ADMIN_EMAIL]);

      await manager.query(`
        DELETE FROM tournament_participants tp
        USING users u
        WHERE u.id = tp.user_id
          AND u.role = 'PLAYER'
          AND u.email <> $1
      `, [ADMIN_EMAIL]);

      await manager.query(`
        UPDATE tournaments t
        SET created_by = $1
        FROM users u
        WHERE u.id = t.created_by
          AND u.role = 'PLAYER'
          AND u.email <> $2
      `, [admin.id, ADMIN_EMAIL]);

      await manager.query(`
        DELETE FROM users
        WHERE role = 'PLAYER'
          AND email <> $1
      `, [ADMIN_EMAIL]);
    });

    return {
      message: 'All players deleted successfully.',
      deletedCount,
    };
  }

  async updatePassword(email: string, password: string) {
    const user = await this.findByEmail(email);

    if (!user) {
      return null;
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    return this.usersRepository.save(user);
  }

  private async seedDefaultAdmin() {
    const existingAdmin = await this.findByEmail(ADMIN_EMAIL);

    if (existingAdmin) {
      if (existingAdmin.role !== 'ADMIN') {
        existingAdmin.role = 'ADMIN';
        await this.usersRepository.save(existingAdmin);
      }

      return;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    const memberCode = await this.generateMemberCode();
    const admin = this.usersRepository.create({
      email: ADMIN_EMAIL,
      memberCode,
      fullName: 'Son Vu',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    await this.usersRepository.save(admin);
  }

  private async backfillMemberCodes() {
    const users = await this.usersRepository.find({
      order: {
        id: 'ASC',
      },
    });

    for (const user of users) {
      if (user.memberCode) {
        continue;
      }

      user.memberCode = await this.generateMemberCode();
      await this.usersRepository.save(user);
    }
  }

  private async generateMemberCode() {
    const rows = await this.usersRepository.query(`
      SELECT member_code AS "memberCode"
      FROM users
      WHERE member_code IS NOT NULL
    `);
    const usedNumbers = new Set<number>();

    for (const row of rows) {
      const match = String(row.memberCode).match(/^GC-(\d+)$/);

      if (match) {
        usedNumbers.add(Number(match[1]));
      }
    }

    let nextNumber = 1;

    while (usedNumbers.has(nextNumber)) {
      nextNumber += 1;
    }

    return `GC-${String(nextNumber).padStart(4, '0')}`;
  }
}


