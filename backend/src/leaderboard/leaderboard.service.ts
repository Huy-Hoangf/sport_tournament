import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

export type LeaderboardEntry = {
  userId: number;
  fullName: string;
  totalPredictions: number;
  correctPredictions: number;
  totalPoints: number;
};

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async list(
    tournamentId?: number,
    includePrivateTournaments = false,
  ): Promise<LeaderboardEntry[]> {
    const rows: Array<{
      userId: string | number;
      fullName: string;
      totalPredictions: string | number;
      correctPredictions: string | number;
      totalPoints: string | number;
    }> = await this.usersRepository.query(
      `
        SELECT
          v.user_id AS "userId",
          v.full_name AS "fullName",
          SUM(v.total_predictions)::integer AS "totalPredictions",
          SUM(v.correct_predictions)::integer AS "correctPredictions",
          SUM(v.total_points)::integer AS "totalPoints"
        FROM vw_leaderboard v
        JOIN tournaments t ON t.id = v.tournament_id
        WHERE ($1::integer IS NULL OR t.id = $1)
          AND ($2::boolean OR t.visibility = 'PUBLIC')
        GROUP BY v.user_id, v.full_name
        ORDER BY "totalPoints" DESC, "correctPredictions" DESC, v.full_name, v.user_id
      `,
      [tournamentId ?? null, includePrivateTournaments],
    );

    return rows.map((row) => ({
      userId: Number(row.userId),
      fullName: row.fullName,
      totalPredictions: Number(row.totalPredictions),
      correctPredictions: Number(row.correctPredictions),
      totalPoints: Number(row.totalPoints),
    }));
  }
}
