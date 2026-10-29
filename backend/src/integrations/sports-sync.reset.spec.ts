import type { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { SportsApiSyncService } from './sports-sync.service';

describe('reset of imported API sources', () => {
  it('syncs the imported identities for each source and isolates errors', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        provider: 'FOOTBALL_DATA',
        competitionId: '39',
        season: '2026',
        name: 'League',
      },
      {
        provider: 'ESPN_ASEAN',
        competitionId: '12',
        season: '2026',
        name: 'ASEAN Championship',
      },
      {
        provider: 'OPENF1',
        competitionId: '123',
        season: '2026',
        name: 'Grand Prix',
      },
      {
        provider: 'CITO_LOL',
        competitionId: 'worlds',
        season: '2026',
        name: 'Worlds',
      },
    ]);
    const service = new SportsApiSyncService({
      query,
    } as unknown as Repository<User>);
    const football = jest
      .spyOn(service, 'syncSelectedFootballLeagues')
      .mockResolvedValueOnce({ competitions: 1, matches: 2, error: null })
      .mockRejectedValueOnce(new Error('ESPN unavailable'));
    const f1 = jest
      .spyOn(service, 'syncSelectedF1Meetings')
      .mockResolvedValue({ meetings: 1, sessions: 2, error: null });
    const lol = jest
      .spyOn(service, 'syncSelectedLolCompetitions')
      .mockResolvedValue({ competitions: 1, matches: 3, error: null });
    const result = (await service.syncAllNow()) as {
      football?: { competitions: number };
      espn?: { error: string | null };
      lol?: { matches: number };
    };
    expect(football).toHaveBeenCalledTimes(2);
    expect(f1).toHaveBeenCalledWith([123], true);
    expect(lol).toHaveBeenCalledWith(['worlds'], true);
    expect(result.football?.competitions).toBe(1);
    expect(result.espn?.error).toContain('ESPN unavailable');
    expect(result.lol?.matches).toBe(3);
  });

  it('reports legacy tournaments without identities without importing new competitions', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        provider: 'CITO_LOL',
        competitionId: null,
        season: null,
        name: 'Legacy LoL',
      },
      {
        provider: 'FOOTBALL_DATA',
        competitionId: null,
        season: null,
        name: 'Legacy Football',
      },
    ]);
    const service = new SportsApiSyncService({
      query,
    } as unknown as Repository<User>);
    const football = jest.spyOn(service, 'syncSelectedFootballLeagues');
    const f1 = jest.spyOn(service, 'syncSelectedF1Meetings');
    const lol = jest.spyOn(service, 'syncSelectedLolCompetitions');
    const result = await service.syncAllNow();
    expect(football).not.toHaveBeenCalled();
    expect(f1).not.toHaveBeenCalled();
    expect(lol).not.toHaveBeenCalled();
    expect(result.football?.error).toContain('missing');
    expect(result.lol?.error).toContain('missing');
  });

  it('continues syncing other competitions when one football competition fails', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        provider: 'FOOTBALL_DATA',
        competitionId: '1',
        season: '2026',
        name: 'First',
      },
      {
        provider: 'FOOTBALL_DATA',
        competitionId: '2',
        season: '2026',
        name: 'Second',
      },
    ]);
    const service = new SportsApiSyncService({
      query,
    } as unknown as Repository<User>);
    const sync = jest
      .spyOn(service, 'syncSelectedFootballLeagues')
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce({ competitions: 1, matches: 2, error: null });
    const result = await service.syncAllNow();
    expect(sync).toHaveBeenCalledTimes(2);
    expect(result.football?.matches).toBe(2);
    expect(result.football?.error).toContain('First: unavailable');
  });
});
