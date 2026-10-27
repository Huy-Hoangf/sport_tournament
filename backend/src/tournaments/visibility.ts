import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { User, type UserRole } from '../users/user.entity';

export async function requireVisibleTournament(
  repository: Repository<User>,
  id: number,
  role: UserRole,
) {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new BadRequestException('Invalid tournament id.');
  const rows = await repository.query(
    "SELECT id FROM tournaments WHERE id = $1 AND (visibility = 'PUBLIC' OR $2 IN ('ADMIN', 'SUPER_ADMIN'))",
    [id, role],
  );
  if (!rows.length) throw new NotFoundException('Tournament not found.');
}
