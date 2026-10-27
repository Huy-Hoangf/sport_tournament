import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, type UserRole } from '../users/user.entity';
import { requireVisibleTournament } from '../tournaments/visibility';

type ScoringRuleInput = {
  code?: string | null;
  category?: string;
  title?: string;
  content?: string;
  points?: number;
  sortOrder?: number;
};

const DEFAULT_RULE: ScoringRuleInput = {
  code: 'CORRECT_OUTCOME',
  category: 'PREDICTION',
  title: 'Correct Match Outcome',
  content: 'User correctly predicts a home win, away win, or draw.',
  points: 3,
  sortOrder: 1,
};

@Injectable()
export class ScoringRulesService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByTournament(tournamentId: number, role: UserRole) {
    await requireVisibleTournament(this.usersRepository, tournamentId, role);
    await this.seedDefaultRules(tournamentId);

    const rows = await this.usersRepository.query(
      `
        SELECT
          id,
          tournament_id AS "tournamentId",
          category,
          rule_code AS code,
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
    if (
      normalized.filter((rule) => rule.code === 'CORRECT_OUTCOME').length !== 1
    ) {
      throw new BadRequestException(
        'Rules must contain exactly one correct outcome rule.',
      );
    }

    await this.usersRepository.manager.transaction(async (manager) => {
      await manager.query(
        'SELECT id FROM tournaments WHERE id = $1 FOR UPDATE',
        [tournamentId],
      );
      await manager.query(
        'DELETE FROM scoring_rules WHERE tournament_id = $1',
        [tournamentId],
      );

      for (const rule of normalized) {
        await manager.query(
          `
            INSERT INTO scoring_rules
              (tournament_id, category, title, content, points, sort_order, rule_code)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            tournamentId,
            rule.category,
            rule.title,
            rule.content,
            rule.points,
            rule.sortOrder,
            rule.code,
          ],
        );
      }
    });

    return this.findByTournament(tournamentId, 'ADMIN');
  }

  private async seedDefaultRules(tournamentId: number) {
    await this.usersRepository.manager.transaction(async (manager) => {
      await manager.query(
        'SELECT id FROM tournaments WHERE id = $1 FOR UPDATE',
        [tournamentId],
      );
      const [{ count }] = await manager.query(
        'SELECT COUNT(*) AS count FROM scoring_rules WHERE tournament_id = $1 AND rule_code = $2',
        [tournamentId, 'CORRECT_OUTCOME'],
      );
      if (Number(count) > 0) return;
      const rule = this.normalizeRule(DEFAULT_RULE, 1);
      await manager.query(
        'INSERT INTO scoring_rules (tournament_id, category, title, content, points, sort_order, rule_code) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [
          tournamentId,
          rule.category,
          rule.title,
          rule.content,
          rule.points,
          rule.sortOrder,
          rule.code,
        ],
      );
    });
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
      code: rule.code === 'CORRECT_OUTCOME' ? rule.code : null,
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
