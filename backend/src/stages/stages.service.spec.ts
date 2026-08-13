import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { StagesService } from './stages.service';

describe('StagesService', () => {
  let service: StagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StagesService,
        { provide: getRepositoryToken(User), useValue: { query: jest.fn() } },
      ],
    }).compile();

    service = module.get<StagesService>(StagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
