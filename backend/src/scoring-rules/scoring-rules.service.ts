import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

type ScoringRuleInput = {
  category?: string;
  title?: string;
  content?: string;
  points?: number;
  sortOrder?: number;
};

const DEFAULT_RULES: ScoringRuleInput[] = [
  {
    category: 'PREDICTION',
    title: 'Correct Match Winner',
    content: 'User correctly predicts which team wins the match.',
    points: 3,
    sortOrder: 1,
  },
  {
    category: 'PREDICTION',
    title: 'Exact Scoreline',
    content: 'User predicts the exact final match or round score.',
    points: 5,
    sortOrder: 2,
  },
  {
    category: 'IN-GAME EVENT',
    title: 'First Blood Prediction',
    content: 'User predicts which player secures the first elimination.',
    points: 2,
    sortOrder: 3,
  },
];

@Injectable()
export class ScoringRulesService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByTournament(tournamentId: number) {
    await this.ensureTournamentExists(tournamentId);
    await this.seedDefaultRules(tournamentId);

    const rows = await this.usersRepository.query(
      `
        SELECT
          id,
          tournament_id AS "tournamentId",
          category,
          title,
          content,
          points,
          sort_order AS "sortOrder"
        FROM scoring_rules
        WHERE tournament_id = $1
        ORDER BY sort_order ASC, id ASC
      `,
      [tournamentId],
    );

    return rows.map((row) => ({
      ...row,
      id: Number(row.id),
      tournamentId: Number(row.tournamentId),
      points: Number(row.points ?? 0),
      sortOrder: Number(row.sortOrder ?? 0),
    }));
  }

  async replaceTournamentRules(
    tournamentId: number,
    rules: ScoringRuleInput[],
  ) {
    await this.ensureTournamentExists(tournamentId);

    if (!Array.isArray(rules)) {
      throw new BadRequestException('Rules must be an array.');
    }

    const normalized = rules.map((rule, index) =>
      this.normalizeRule(rule, index + 1),
    );

    await this.usersRepository.manager.transaction(async (manager) => {
      await manager.query(
        'DELETE FROM scoring_rules WHERE tournament_id = $1',
        [tournamentId],
      );

      for (const rule of normalized) {
        await manager.query(
          `
            INSERT INTO scoring_rules
              (tournament_id, category, title, content, points, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            tournamentId,
            rule.category,
            rule.title,
            rule.content,
            rule.points,
            rule.sortOrder,
          ],
        );
      }
    });

    return this.findByTournament(tournamentId);
  }

  private async seedDefaultRules(tournamentId: number) {
    const [{ count }] = await this.usersRepository.query(
      'SELECT COUNT(*) AS count FROM scoring_rules WHERE tournament_id = $1',
      [tournamentId],
    );

    if (Number(count ?? 0) > 0) {
      return;
    }

    for (const rule of DEFAULT_RULES) {
      const normalized = this.normalizeRule(rule, rule.sortOrder ?? 0);
      await this.usersRepository.query(
        `
          INSERT INTO scoring_rules
            (tournament_id, category, title, content, points, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          tournamentId,
          normalized.category,
          normalized.title,
          normalized.content,
          normalized.points,
          normalized.sortOrder,
        ],
      );
    }
  }

  private normalizeRule(rule: ScoringRuleInput, sortOrder: number) {
    const category = String(rule.category ?? 'CUSTOM')
      .trim()
      .toUpperCase();
    const title = String(rule.title ?? '').trim();
    const content = String(rule.content ?? '').trim();
    const points = Number(rule.points ?? 0);

    if (!title) {
      throw new BadRequestException('Rule title is required.');
    }

    return {
      category: category || 'CUSTOM',
      title,
      content: content || 'Describe when users receive these points.',
      points: Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0,
      sortOrder: Math.max(1, Number(rule.sortOrder ?? sortOrder)),
    };
  }

  private async ensureTournamentExists(tournamentId: number) {
    if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
      throw new BadRequestException('Invalid tournament id.');
    }

    const [tournament] = await this.usersRepository.query(
      'SELECT id FROM tournaments WHERE id = $1',
      [tournamentId],
    );

    if (!tournament) {
      throw new BadRequestException('Tournament does not exist.');
    }
  }
}
