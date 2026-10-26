import { Test, TestingModule } from '@nestjs/testing';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { AuthService } from '../auth/auth.service';

describe('PredictionsController', () => {
  let controller: PredictionsController;
  let predictions: { vote: jest.Mock; list: jest.Mock };
  let auth: { verifyAccessToken: jest.Mock };

  beforeEach(async () => {
    predictions = { vote: jest.fn(), list: jest.fn() };
    auth = { verifyAccessToken: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PredictionsController],
      providers: [
        {
          provide: PredictionsService,
          useValue: predictions,
        },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();

    controller = module.get<PredictionsController>(PredictionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it.each(['ADMIN', 'SUPER_ADMIN'])(
    'lets %s cast a vote for their own user id',
    async (role) => {
      auth.verifyAccessToken.mockResolvedValue({ sub: 7, role });
      await controller.vote('Bearer token', '2', { outcome: 'DRAW' });
      expect(predictions.vote).toHaveBeenCalledWith(7, 2, {
        outcome: 'DRAW',
      });
    },
  );

  it.each(['ADMIN', 'SUPER_ADMIN'])(
    'lets %s view all votes but scope mine=true to their own votes',
    async (role) => {
      auth.verifyAccessToken.mockResolvedValue({ sub: 7, role });
      await controller.list('Bearer token', { matchId: '2' });
      expect(predictions.list).toHaveBeenLastCalledWith(
        7,
        true,
        undefined,
        2,
        1,
      );
      await controller.list('Bearer token', { matchId: '2', mine: 'true' });
      expect(predictions.list).toHaveBeenLastCalledWith(
        7,
        false,
        undefined,
        2,
        1,
      );
    },
  );
});
