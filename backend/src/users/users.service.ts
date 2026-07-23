import {
  BadRequestException,
  ConflictException,
  Injectable,
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
import { User } from './user.entity';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultAdmin();
  }

  async findAll() {
    const rows = await this.usersRepository.query(`
      SELECT
        u.id,
        u.email,
        u.full_name AS fullName,
        u.role,
        u.created_at AS createdAt,
        u.updated_at AS updatedAt,
        COUNT(DISTINCT tp.tournament_id) AS eventsCount
      FROM users u
      LEFT JOIN tournament_participants tp ON tp.user_id = u.id
      GROUP BY
        u.id,
        u.email,
        u.full_name,
        u.role,
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
    const user = this.usersRepository.create({
      email,
      fullName,
      passwordHash,
      role: 'PLAYER',
    });

    const savedUser = await this.usersRepository.save(user);

    return {
      id: savedUser.id,
      email: savedUser.email,
      fullName: savedUser.fullName,
      role: savedUser.role,
      defaultPassword: DEFAULT_PLAYER_PASSWORD,
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
    const admin = this.usersRepository.create({
      email: ADMIN_EMAIL,
      fullName: 'Son Vu',
      passwordHash,
      role: 'ADMIN',
    });

    await this.usersRepository.save(admin);
  }
}
