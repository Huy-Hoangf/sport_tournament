import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { MatchesService } from './matches.service';

describe('MatchesService', () => {
  let service: MatchesService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: getRepositoryToken(User), useValue: { query } },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('only returns public matches whose vote deadline has not passed', async () => {
    await service.findAll({
      includePrivateTournaments: false,
      openForVoting: true,
    });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("t.visibility = 'PUBLIC'");
    expect(sql).toContain("m.status = 'PENDING'");
    expect(sql).toContain('m.prediction_locked = FALSE');
    expect(sql).toContain(
      "m.scheduled_time - (m.lock_minutes_before_start * INTERVAL '1 minute') > clock_timestamp()",
    );
  });
});
