import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: {
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    query: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    usersRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      query: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: usersRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('migrates stored user emails to @tech.com on startup', async () => {
    usersRepository.query.mockResolvedValue([]);
    usersRepository.findOne.mockResolvedValue({
      email: 'son.vu@tech.com',
      role: 'ADMIN',
    });
    usersRepository.find.mockResolvedValue([]);

    await service.onModuleInit();

    expect(usersRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users AS target_user'),
      ['@tech.com', '%@tech.com'],
    );
  });
});
