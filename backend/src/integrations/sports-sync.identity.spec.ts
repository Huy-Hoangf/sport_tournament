import { SportsApiSyncService } from './sports-sync.service';
describe('tournament import identity', () => {
  it('does not use name to match a manual tournament', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 17 }])
      .mockResolvedValueOnce([]);
    const service = new SportsApiSyncService({
      manager: {
        transaction: (run: (manager: unknown) => unknown) => run({ query }),
      },
    } as never);
    await (service as any).upsertTournament({
      provider: 'FOOTBALL_DATA',
      competitionId: '39',
      season: '2025',
      name: 'League',
      sportType: 'FOOTBALL',
      status: 'UPCOMING',
      adminId: 1,
    });
    expect(query.mock.calls[1][0]).toContain('tournament_external_identities');
    expect(query.mock.calls[1][1]).toEqual(['FOOTBALL_DATA', '39', '2025']);
  });

  it('does not move an existing imported match to another tournament', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ id: 11, tournament_id: 4 }]);
    const service = new SportsApiSyncService({ query } as never);
    await expect(
      (service as any).upsertMatch({
        tournamentId: 8,
        source: 'FOOTBALL_DATA',
        externalMatchId: 'match-1',
      }),
    ).rejects.toThrow('reconcile its external identity');
    expect(query).toHaveBeenCalledTimes(1);
  });
});
