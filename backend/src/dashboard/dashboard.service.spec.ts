import type { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('counts inactive and pending players separately', async () => {
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          activeTournaments: '0',
          totalPlayers: '2',
          upcomingMatches: '0',
          pendingPredictions: '0',
          warningMatches: '0',
          inactivePlayers: '1',
          pendingPlayers: '1',
          lastApiSync: null,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: '1',
          memberCode: 'GC-0001',
          fullName: 'Inactive Player',
          email: 'inactive@tech.com',
          status: 'INACTIVE',
          updatedAt: new Date(),
        },
        {
          id: '2',
          memberCode: 'GC-0002',
          fullName: 'Pending Player',
          email: 'pending@tech.com',
          status: 'PENDING',
          updatedAt: new Date(),
        },
      ]);
    const usersRepository = {
      query: queryMock,
    } as unknown as Repository<User>;
    const service = new DashboardService(usersRepository);

    const dashboard = await service.getDashboard({
      includeAttentionDetails: true,
    });

    expect(dashboard.stats.attentionNeeded).toBe(2);
    expect(dashboard.stats.inactivePlayers).toBe(1);
    expect(dashboard.stats.pendingPlayers).toBe(1);
    expect(dashboard.inactivePlayers).toHaveLength(2);
    expect(queryMock).toHaveBeenCalledTimes(7);
  });

  it('redacts attention details from the player dashboard', async () => {
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          activeTournaments: '1',
          totalPlayers: '3',
          upcomingMatches: '2',
          pendingPredictions: '4',
          warningMatches: '5',
          inactivePlayers: '1',
          pendingPlayers: '1',
          lastApiSync: null,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const usersRepository = {
      query: queryMock,
    } as unknown as Repository<User>;
    const service = new DashboardService(usersRepository);

    const dashboard = await service.getDashboard();

    expect(dashboard.stats.attentionNeeded).toBe(0);
    expect(dashboard.stats.inactivePlayers).toBe(0);
    expect(dashboard.stats.pendingPlayers).toBe(0);
    expect(dashboard.stats.pendingPredictions).toBe(0);
    expect(dashboard.stats.warningMatches).toBe(0);
    expect(dashboard.inactivePlayers).toEqual([]);
    expect(queryMock).toHaveBeenCalledTimes(6);
  });
});
