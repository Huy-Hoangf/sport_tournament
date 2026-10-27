import { ScoringRulesService } from './scoring-rules.service';
describe('ScoringRulesService', () => {
  it('requires exactly one rule that controls outcome points', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 1 }]);
    const transaction = jest.fn();
    const service = new ScoringRulesService({
      query,
      manager: { transaction },
    } as never);
    await expect(service.replaceTournamentRules(1, [])).rejects.toThrow(
      'exactly one',
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
