import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

describe('MatchesController', () => {
  let controller: MatchesController;
  let matchesService: { findAll: jest.Mock; importWorkbook: jest.Mock };
  let authService: {
    verifyAccessToken: jest.Mock;
    verifyAdminToken: jest.Mock;
  };

  beforeEach(async () => {
    matchesService = {
      findAll: jest.fn().mockResolvedValue([]),
      importWorkbook: jest.fn().mockResolvedValue({ imported: 1, rejected: 0 }),
    };
    authService = {
      verifyAccessToken: jest.fn().mockResolvedValue({ role: 'PLAYER' }),
      verifyAdminToken: jest.fn().mockResolvedValue({ sub: 42, role: 'ADMIN' }),
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
  it('keeps the total when a requested page is empty', async () => {
    matchesService.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ totalCount: 25 }]);
    const result = await controller.page('Bearer valid', { page: '9' });
    expect(result.total).toBe(25);
  });
  it('passes the authenticated admin id to the Excel importer', async () => {
    const body = { fileName: 'matches.xlsx', contentBase64: 'data' };
    await controller.import('Bearer valid', body);
    expect(matchesService.importWorkbook).toHaveBeenCalledWith(body, 42);
  });
});
