import type { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('returns open voting for a tomorrow match separately from today totals', async () => {
    const kickoff = new Date('2026-11-27T01:00:00+07:00');
    const query = jest
      .fn()
      .mockResolvedValue([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: '1',
          name: 'Open',
          sportType: 'FOOTBALL',
          matches: '0',
          votableMatchesToday: '0',
          openVotingCount: '1',
          nextOpenVotingKickoff: kickoff,
        },
        {
          id: '2',
          name: 'Locked',
          sportType: 'FOOTBALL',
          matches: '3',
          votableMatchesToday: '0',
        },
      ]);
    const service = new DashboardService({
      query,
    } as unknown as Repository<User>);
    const result = await service.getDashboard();
    expect(result.tournaments[0]).toMatchObject({
      matches: 0,
      votableMatchesToday: 0,
      openVotingCount: 1,
      nextOpenVotingKickoff: kickoff,
    });
    expect(result.tournaments[1]).toMatchObject({
      matches: 3,
      votableMatchesToday: 0,
      openVotingCount: 0,
      nextOpenVotingKickoff: null,
    });
  });

  it('counts only open voting and includes its tournaments in today scope regardless of kickoff date', () => {
    const service = new DashboardService({} as Repository<User>);
    for (const scope of ['today', 'all']) {
      const sql = (service as any).tournamentsQuery(scope, true) as string;
      const openVoting = sql
        .split(') open_voting ON TRUE')[0]
        .split('LEFT JOIN LATERAL (')
        .pop()!;
      const eligibility = openVoting.split('FROM matches vote_match')[1];
      expect(eligibility).toContain("t.visibility = 'PUBLIC'");
      expect(eligibility).toContain("t.sport_type <> 'F1'");
      expect(eligibility).toContain(
        "vote_match.external_source IS DISTINCT FROM 'OPENF1'",
      );
      expect(eligibility).toContain("vote_match.status = 'PENDING'");
      expect(eligibility).toContain(
        'NOT COALESCE(vote_match.prediction_locked, false)',
      );
      expect(eligibility).toMatch(
        /vote_match\.scheduled_time\s*-\s*vote_match\.lock_minutes_before_start \* INTERVAL '1 minute' > NOW\(\)/,
      );
      expect(eligibility).not.toContain('AT TIME ZONE');
      expect(openVoting).toContain("AT TIME ZONE 'Asia/Ho_Chi_Minh'");
      if (scope === 'today')
        expect(sql).toContain('OR open_voting.match_count > 0');
    }
  });

  it('lists open matches by deadline across midnight for the player dashboard', () => {
    const service = new DashboardService({} as Repository<User>);
    const sql = service['upcomingScheduleQuery']('today', false, true);
    expect(sql).toContain("m.status = 'PENDING'");
    expect(sql).toContain("m.external_source IS DISTINCT FROM 'OPENF1'");
    expect(sql).toContain('ORDER BY deadline ASC, m.id');
    expect(sql).toContain('LIMIT 3');
    expect(sql).not.toContain('AT TIME ZONE');
  });

  it('counts every match today and includes future matches for tournament cards', () => {
    const service = new DashboardService({} as Repository<User>);
    const summary = (service as any).summaryQuery('today', true) as string;
    const countQuery = summary
      .split('AS "upcomingMatches"')[0]
      .split('FROM matches m')
      .pop()!;
    expect(countQuery).not.toContain('m.scheduled_time >= NOW()');
    expect(countQuery).not.toContain("m.status IN ('PENDING', 'LIVE')");
    const todayMatches = (service as any).tournamentMatchesQuery(
      'today',
      true,
    ) as string;
    const nextMatches = (service as any).tournamentMatchesQuery(
      'today',
      true,
      true,
    ) as string;
    expect(todayMatches).toContain('row_number <= 20');
    expect(nextMatches).toContain('m.scheduled_time >= NOW()');
    expect(nextMatches).toContain('row_number <= 1');
  });
  it('counts inactive and pending players separately', async () => {
    const queryMock = jest
      .fn()
      .mockResolvedValue([])
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
      .fn()
      .mockResolvedValue([])
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
    expect(queryMock).toHaveBeenCalledTimes(8);
  });
});
