import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardController', () => {
  let controller: LeaderboardController;
  const list = jest.fn();
  const verifyAccessToken = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaderboardController],
      providers: [
        { provide: LeaderboardService, useValue: { list } },
        { provide: AuthService, useValue: { verifyAccessToken } },
      ],
    }).compile();

    controller = module.get<LeaderboardController>(LeaderboardController);
  });

  it('returns the selected tournament standings for an admin', async () => {
    verifyAccessToken.mockResolvedValue({ role: 'ADMIN' });
    list.mockResolvedValue([{ userId: 7, totalPoints: 6 }]);

    await expect(controller.list('Bearer token', '12')).resolves.toEqual([
      { userId: 7, totalPoints: 6 },
    ]);
    expect(list).toHaveBeenCalledWith(12, true);
  });

  it('keeps private tournaments out of the player leaderboard', async () => {
    verifyAccessToken.mockResolvedValue({ role: 'PLAYER' });
    await controller.list('Bearer token');

    expect(list).toHaveBeenCalledWith(undefined, false);
  });
});
