import { SportsApiSyncService } from './sports-sync.service';
describe('tournament import identity', () => {
  it('links a legacy API tournament when matching external matches identify exactly one tournament', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 9 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const service = new SportsApiSyncService({
      manager: {
        transaction: (run: (manager: unknown) => unknown) => run({ query }),
      },
    } as never);
    const id = await (service as any).upsertTournament({
      provider: 'FOOTBALL_DATA',
      competitionId: '39',
      season: '2026',
      name: 'League',
      sportType: 'FOOTBALL',
      status: 'UPCOMING',
      adminId: 1,
      externalMatchIds: ['m1', 'm2'],
      requireExisting: true,
    });
    expect(id).toBe(9);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO tournament_external_identities'),
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO tournaments'),
      ),
    ).toBe(false);
  });

  it('refuses to link when API matches point to multiple tournaments', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 9 }, { id: 10 }]);
    const service = new SportsApiSyncService({
      manager: {
        transaction: (run: (manager: unknown) => unknown) => run({ query }),
      },
    } as never);
    await expect(
      (service as any).upsertTournament({
        provider: 'FOOTBALL_DATA',
        competitionId: '39',
        season: '2026',
        name: 'League',
        sportType: 'FOOTBALL',
        status: 'UPCOMING',
        adminId: 1,
        externalMatchIds: ['m1', 'm2'],
      }),
    ).rejects.toThrow('multiple tournaments');
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('refuses to update when a saved identity conflicts with the existing match owner', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 8 }])
      .mockResolvedValueOnce([{ id: 9 }]);
    const service = new SportsApiSyncService({
      manager: {
        transaction: (run: (manager: unknown) => unknown) => run({ query }),
      },
    } as never);
    await expect(
      (service as any).upsertTournament({
        provider: 'FOOTBALL_DATA',
        competitionId: '39',
        season: '2026',
        name: 'League',
        sportType: 'FOOTBALL',
        status: 'UPCOMING',
        adminId: 1,
        externalMatchIds: ['m1'],
      }),
    ).rejects.toThrow('multiple tournaments');
    expect(query).toHaveBeenCalledTimes(3);
  });

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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 11, tournament_id: 4 }]);
    const service = new SportsApiSyncService({
      manager: {
        transaction: (run: (manager: unknown) => unknown) => run({ query }),
      },
    } as never);
    await expect(
      (service as any).upsertMatch({
        tournamentId: 8,
        source: 'FOOTBALL_DATA',
        externalMatchId: 'match-1',
      }),
    ).rejects.toThrow('reconcile its external identity');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('refuses ambiguous duplicate API match identities', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 11, tournament_id: 4 },
        { id: 12, tournament_id: 4 },
      ]);
    const service = new SportsApiSyncService({
      manager: {
        transaction: (run: (manager: unknown) => unknown) => run({ query }),
      },
    } as never);
    await expect(
      (service as any).upsertMatch({
        source: 'FOOTBALL_DATA',
        externalMatchId: 'match-1',
      }),
    ).rejects.toThrow('Duplicate imported match identity');
  });
});
