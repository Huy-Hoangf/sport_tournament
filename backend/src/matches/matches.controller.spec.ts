import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

describe('MatchesController', () => {
  let controller: MatchesController;
  let matchesService: { findAll: jest.Mock };
  let authService: { verifyAccessToken: jest.Mock };

  beforeEach(async () => {
    matchesService = { findAll: jest.fn().mockResolvedValue([]) };
    authService = {
      verifyAccessToken: jest.fn().mockResolvedValue({ role: 'PLAYER' }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        { provide: MatchesService, useValue: matchesService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    controller = module.get<MatchesController>(MatchesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards the open-for-voting filter to the query', async () => {
    await controller.page('Bearer valid', { openForVoting: 'true' });
    expect(matchesService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        includePrivateTournaments: false,
        openForVoting: true,
      }),
    );
  });

  it('rejects an invalid open-for-voting value', async () => {
    await expect(
      controller.page('Bearer valid', { openForVoting: 'yes' }),
    ).rejects.toThrow();
  });
});
