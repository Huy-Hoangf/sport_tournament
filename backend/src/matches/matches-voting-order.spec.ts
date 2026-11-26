import type { Repository } from 'typeorm';
import type { User } from '../users/user.entity';
import { MatchesService } from './matches.service';

describe('View all matches voting order', () => {
  it('applies the voting and completion order before paginating', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new MatchesService({
      query,
    } as unknown as Repository<User>);

    await service.findAll({
      includePrivateTournaments: false,
      tournamentId: 7,
      status: 'ALL',
      prioritizeVoting: true,
      page: 2,
      pageSize: 20,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(
        /ORDER BY\s+CASE[\s\S]+THEN 0[\s\S]+'FINISHED'[\s\S]+THEN 2[\s\S]+m\.scheduled_time ASC, m\.id ASC\s+LIMIT/,
      ),
      [7, 20, 20],
    );
  });

  it('keeps chronological ordering for existing match list callers', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new MatchesService({
      query,
    } as unknown as Repository<User>);
    await service.findAll({ includePrivateTournaments: false });
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(
        /ORDER BY\s+m\.scheduled_time ASC, m\.id ASC\s+LIMIT/,
      ),
      [300, 0],
    );
  });
});
