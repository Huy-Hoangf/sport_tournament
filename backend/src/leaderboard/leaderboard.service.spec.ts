import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../users/user.entity';
import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([
      {
        userId: '7',
        fullName: 'Player Seven',
        totalPredictions: '3',
        correctPredictions: '2',
        totalPoints: '6',
      },
    ]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: getRepositoryToken(User), useValue: { query } },
      ],
    }).compile();
    service = module.get<LeaderboardService>(LeaderboardService);
  });

  it('calculates tournament standings from finished matches for an admin', async () => {
    const result = await service.list(12, true);

    expect(query).toHaveBeenCalledWith(expect.any(String), [12, true]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('FROM vw_leaderboard');
    expect(sql).toContain('SUM(v.total_points)');
    expect(result).toEqual([
      {
        userId: 7,
        fullName: 'Player Seven',
        totalPredictions: 3,
        correctPredictions: 2,
        totalPoints: 6,
      },
    ]);
  });

  it('filters private tournaments when listing for a player', async () => {
    await service.list(undefined, false);

    expect(query).toHaveBeenCalledWith(expect.any(String), [null, false]);
    expect(String(query.mock.calls[0][0])).toContain("t.visibility = 'PUBLIC'");
  });
});
