import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';

describe('StagesController', () => {
  let controller: StagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StagesController],
      providers: [
        { provide: StagesService, useValue: { findByTournament: jest.fn() } },
        {
          provide: AuthService,
          useValue: { verifyAccessToken: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<StagesController>(StagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  it('passes the user role to tournament visibility checks', async () => {
    const auth = (controller as any).authService;
    const stages = (controller as any).stagesService;
    auth.verifyAccessToken.mockResolvedValue({ role: 'PLAYER' });
    await controller.findByTournament('Bearer token', '12');
    expect(stages.findByTournament).toHaveBeenCalledWith(12, 'PLAYER');
  });
});
