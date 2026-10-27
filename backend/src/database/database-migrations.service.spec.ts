import { DatabaseMigrationsService } from './database-migrations.service';

describe('DatabaseMigrationsService', () => {
  it('does not delete matches or teams during application startup', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new DatabaseMigrationsService({ query } as never);

    await service.onModuleInit();

    const startupSql = query.mock.calls.map(([sql]) => String(sql)).join('\n');
    expect(startupSql).not.toMatch(/DELETE\s+FROM\s+(matches|teams)\b/i);
    expect(startupSql).toContain('CREATE OR REPLACE VIEW vw_leaderboard');
    expect(startupSql).toContain("m.status = 'FINISHED'");
    expect(startupSql).toContain("sr.rule_code = 'CORRECT_OUTCOME'");
    expect(startupSql).not.toContain('THEN exact_score_bonus');
    expect(startupSql).not.toContain('SUM(p.points_earned)');
  });
});
