import { Test, TestingModule } from '@nestjs/testing';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { AuthService } from '../auth/auth.service';

describe('PredictionsController', () => {
  let controller: PredictionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PredictionsController],
      providers: [
        {
          provide: PredictionsService,
          useValue: { vote: jest.fn(), list: jest.fn() },
        },
        { provide: AuthService, useValue: { verifyAccessToken: jest.fn() } },
      ],
    }).compile();

    controller = module.get<PredictionsController>(PredictionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
