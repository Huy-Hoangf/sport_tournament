import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { positiveId, validateScores } from '../matches/match-validation';

@Injectable()
export class PredictionsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async vote(userId: number, matchId: number, input: Record<string, unknown>) {
    positiveId(matchId);
    const vote =
      input.outcome === undefined
        ? validateScores(input)
        : { outcome: input.outcome, home: null, away: null };
    if (
      typeof vote.outcome !== 'string' ||
      !['HOME_WIN', 'DRAW', 'AWAY_WIN'].includes(vote.outcome)
    ) {
      throw new BadRequestException('Vote must be HOME_WIN, DRAW or AWAY_WIN.');
    }
    return this.users.manager.transaction(async (manager) => {
      const rows: Array<{
        scheduled_time: string | Date;
        lock_minutes_before_start: number;
        prediction_locked: boolean;
        status: string;
        visibility: string;
      }> = await manager.query(
        `SELECT m.*, t.visibility FROM matches m
        JOIN tournaments t ON t.id=m.tournament_id WHERE m.id=$1 FOR UPDATE OF m`,
        [matchId],
      );
      if (!rows.length) throw new NotFoundException('Match not found.');
      const match = rows[0];
      const players = await manager.query(
        "SELECT id FROM users WHERE id=$1 AND role IN ('PLAYER', 'ADMIN', 'SUPER_ADMIN') AND user_status='ACTIVE'",
        [userId],
      );
      if (!players.length || match.visibility !== 'PUBLIC')
        throw new ForbiddenException('Cannot vote on this match.');
      const [clock]: Array<{ now: string | Date }> = await manager.query(
        'SELECT clock_timestamp() AS now',
      );
      const deadline =
        new Date(match.scheduled_time).getTime() -
        Number(match.lock_minutes_before_start) * 60000;
      if (
        match.prediction_locked ||
        match.status !== 'PENDING' ||
        new Date(clock.now).getTime() >= deadline
      ) {
        throw new ConflictException(
          'Voting is locked or the deadline has passed.',
        );
      }
      const saved = await manager.query(
        `INSERT INTO predictions
        (user_id,match_id,predicted_outcome,predicted_home_score,predicted_away_score)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (user_id,match_id) DO UPDATE SET predicted_outcome=EXCLUDED.predicted_outcome,
          predicted_home_score=EXCLUDED.predicted_home_score, predicted_away_score=EXCLUDED.predicted_away_score,
          updated_at=clock_timestamp()
        RETURNING id, match_id AS "matchId", predicted_outcome AS outcome,
          predicted_home_score AS "homeScore", predicted_away_score AS "awayScore"`,
        [userId, matchId, vote.outcome, vote.home, vote.away],
      );
      return saved[0];
    });
  }

  async list(
    userId: number,
    isAdmin: boolean,
    tournamentId?: number,
    matchId?: number,
    page = 1,
  ) {
    const values: unknown[] = [];
    const where: string[] = [];
    if (!isAdmin) {
      values.push(userId);
      where.push(`p.user_id=$${values.length}`, "t.visibility='PUBLIC'");
    }
    if (tournamentId) {
      values.push(tournamentId);
      where.push(`m.tournament_id=$${values.length}`);
    }
    if (matchId) {
      values.push(matchId);
      where.push(`m.id=$${values.length}`);
    }
    const rows = await this.users.query(
      `SELECT p.id, p.match_id AS "matchId", p.user_id AS "userId",
      u.full_name AS player, u.member_code AS "playerCode", s.name AS stage,
      COALESCE(h.name,m.home_placeholder,'TBD') AS "homeName", COALESCE(a.name,m.away_placeholder,'TBD') AS "awayName",
      p.predicted_home_score AS "homeScore", p.predicted_away_score AS "awayScore",
      p.predicted_outcome AS outcome, p.updated_at AS "updatedAt", m.status AS "matchStatus",
      m.actual_home_score AS "actualHomeScore", m.actual_away_score AS "actualAwayScore",
      s.correct_points AS "correctPoints", s.exact_score_bonus AS "exactBonus", COUNT(*) OVER() AS total
      FROM predictions p JOIN users u ON u.id=p.user_id JOIN matches m ON m.id=p.match_id
      JOIN tournaments t ON t.id=m.tournament_id JOIN stages s ON s.id=m.stage_id
      LEFT JOIN teams h ON h.id=m.home_team_id LEFT JOIN teams a ON a.id=m.away_team_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.updated_at DESC,p.id DESC LIMIT 100 OFFSET $${values.length + 1}`,
      [...values, (page - 1) * 100],
    );
    const items = rows.map((row) => {
      const finished =
        row.matchStatus === 'FINISHED' &&
        row.actualHomeScore != null &&
        row.actualAwayScore != null;
      const outcome = !finished
        ? null
        : row.actualHomeScore === row.actualAwayScore
          ? 'DRAW'
          : row.actualHomeScore > row.actualAwayScore
            ? 'HOME_WIN'
            : 'AWAY_WIN';
      const correct = finished && row.outcome === outcome;
      const exact =
        finished &&
        row.homeScore === row.actualHomeScore &&
        row.awayScore === row.actualAwayScore;
      return {
        ...row,
        id: Number(row.id),
        matchId: Number(row.matchId),
        userId: Number(row.userId),
        match: `${row.homeName} vs ${row.awayName}`,
        prediction:
          row.outcome === 'DRAW'
            ? 'Draw'
            : row.outcome === 'HOME_WIN'
              ? `${row.homeName} wins`
              : `${row.awayName} wins`,
        status: !finished ? 'PENDING' : correct ? 'CORRECT' : 'INCORRECT',
        points: finished
          ? (correct ? Number(row.correctPoints) : 0) +
            (exact ? Number(row.exactBonus) : 0)
          : null,
      };
    });
    return { items, total: Number(rows[0]?.total ?? 0), page, pageSize: 100 };
  }
}
