import { Test, TestingModule } from '@nestjs/testing';
import { PredictionsService } from './predictions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';

describe('PredictionsService', () => {
  let service: PredictionsService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          scheduled_time: '2030-01-01T00:00:00Z',
          lock_minutes_before_start: 0,
          prediction_locked: false,
          status: 'PENDING',
          visibility: 'PUBLIC',
        },
      ])
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ now: '2029-01-01T00:00:00Z' }])
      .mockResolvedValueOnce([
        { id: 1, matchId: 2, homeScore: null, awayScore: null },
      ]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionsService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            query: jest.fn(),
            manager: {
              transaction: (
                callback: (manager: { query: jest.Mock }) => unknown,
              ) => callback({ query }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PredictionsService>(PredictionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each(['HOME_WIN', 'DRAW', 'AWAY_WIN'])(
    'stores an outcome vote without scores: %s',
    async (outcome) => {
      await service.vote(1, 2, { outcome });
      expect(query).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO predictions'),
        [1, 2, outcome, null, null],
      );
    },
  );

  it('rejects an invalid outcome', async () => {
    await expect(service.vote(1, 2, { outcome: 'INVALID' })).rejects.toThrow();
  });

  it('rejects win/draw/loss votes on F1 sessions without scores', async () => {
    query
      .mockReset()
      .mockResolvedValueOnce([
        { sport_type: 'F1', status: 'PENDING', visibility: 'PUBLIC' },
      ]);
    await expect(service.vote(1, 2, { outcome: 'HOME_WIN' })).rejects.toThrow(
      'unavailable for F1',
    );
  });

  it('keeps score-based requests working during the frontend rollout', async () => {
    await service.vote(1, 2, { homeScore: 2, awayScore: 1 });
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO predictions'),
      [1, 2, 'HOME_WIN', 2, 1],
    );
  });

  it('checks that the current active user may vote, regardless of voting role', async () => {
    await service.vote(1, 2, { outcome: 'DRAW' });
    expect(query.mock.calls[1][0]).toContain(
      "role IN ('PLAYER', 'ADMIN', 'SUPER_ADMIN')",
    );
    expect(query.mock.calls[1][1]).toEqual([1]);
    expect(query.mock.calls[3][1][0]).toBe(1);
  });
  it('awards only outcome points even when old score fields exist', async () => {
    const repo = (service as any).users;
    repo.query.mockResolvedValue([
      {
        id: 1,
        matchId: 2,
        userId: 1,
        matchStatus: 'FINISHED',
        actualHomeScore: 2,
        actualAwayScore: 1,
        homeScore: 2,
        awayScore: 1,
        outcome: 'HOME_WIN',
        correctPoints: 3,
        exactBonus: 5,
        total: 1,
      },
    ]);
    const result = await service.list(1, false);
    expect(result.items[0].points).toBe(3);
  });

  it.each([
    ['HOME_WIN', 2, 1],
    ['AWAY_WIN', 1, 2],
    ['DRAW', 1, 1],
  ])('awards the configured points for %s', async (outcome, home, away) => {
    const repo = (service as any).users;
    repo.query.mockResolvedValue([
      {
        id: 1,
        matchId: 2,
        userId: 1,
        matchStatus: 'FINISHED',
        actualHomeScore: home,
        actualAwayScore: away,
        outcome,
        correctPoints: 5,
        total: 1,
      },
    ]);
    const result = await service.list(1, false);
    expect(result.items[0].points).toBe(5);
  });

  it('awards no points for an incorrect outcome', async () => {
    const repo = (service as any).users;
    repo.query.mockResolvedValue([
      {
        id: 1,
        matchId: 2,
        userId: 1,
        matchStatus: 'FINISHED',
        actualHomeScore: 2,
        actualAwayScore: 1,
        outcome: 'DRAW',
        correctPoints: 5,
        total: 1,
      },
    ]);
    const result = await service.list(1, false);
    expect(result.items[0].points).toBe(0);
  });
});
