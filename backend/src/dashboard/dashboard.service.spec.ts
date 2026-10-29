import type { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('counts every match today and includes future matches for tournament cards', () => {
    const service = new DashboardService({} as Repository<User>);
    const summary = (service as any).summaryQuery('today', true) as string;
    const countQuery = summary.split('AS "upcomingMatches"')[0].split('FROM matches m').pop()!;
    expect(countQuery).not.toContain('m.scheduled_time >= NOW()');
    expect(countQuery).not.toContain("m.status IN ('PENDING', 'LIVE')");
    const todayMatches = (service as any).tournamentMatchesQuery('today', true) as string;
    const nextMatches = (service as any).tournamentMatchesQuery('today', true, true) as string;
    expect(todayMatches).toContain('row_number <= 20');
    expect(nextMatches).toContain('m.scheduled_time >= NOW()');
    expect(nextMatches).toContain('row_number <= 1');
  });
  it('counts inactive and pending players separately', async () => {
    const queryMock = jest
      .fn().mockResolvedValue([])
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
    expect(queryMock).toHaveBeenCalledTimes(8);
  });

  it('redacts attention details from the player dashboard', async () => {
    const queryMock = jest
      .fn().mockResolvedValue([])
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
    expect(queryMock).toHaveBeenCalledTimes(7);
  });
});
