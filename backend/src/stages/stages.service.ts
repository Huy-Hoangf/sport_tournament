import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class StagesService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByTournament(tournamentId: number) {
    const rows = await this.usersRepository.query(
      `
        SELECT
          id,
          tournament_id AS "tournamentId",
          name,
          sort_order AS "sortOrder",
          correct_points AS "correctPoints",
          exact_score_bonus AS "exactScoreBonus",
          is_knockout AS "isKnockout"
        FROM stages
        WHERE tournament_id = $1
        ORDER BY sort_order ASC, id ASC
      `,
      [tournamentId],
    );

    return rows.map((row) => ({
      ...row,
      id: Number(row.id),
      tournamentId: Number(row.tournamentId),
      sortOrder: Number(row.sortOrder),
      correctPoints: Number(row.correctPoints ?? 0),
      exactScoreBonus: Number(row.exactScoreBonus ?? 0),
      isKnockout: Boolean(row.isKnockout),
    }));
  }
}
