import { Test, TestingModule } from '@nestjs/testing';
import { PredictionsService } from './predictions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';

describe('PredictionsService', () => {
  let service: PredictionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionsService,
        { provide: getRepositoryToken(User), useValue: { query: jest.fn() } },
      ],
    }).compile();

    service = module.get<PredictionsService>(PredictionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
