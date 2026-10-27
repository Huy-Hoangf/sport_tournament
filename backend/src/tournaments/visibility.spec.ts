import { NotFoundException } from '@nestjs/common';
import { requireVisibleTournament } from './visibility';
describe('tournament visibility', () => {
  it('rejects a player when the tournament is not visible', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await expect(
      requireVisibleTournament({ query } as never, 7, 'PLAYER'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("visibility = 'PUBLIC'"),
      [7, 'PLAYER'],
    );
  });
  it('allows an administrator to access a private tournament', async () => {
    await expect(
      requireVisibleTournament(
        { query: jest.fn().mockResolvedValue([{ id: 7 }]) } as never,
        7,
        'ADMIN',
      ),
    ).resolves.toBeUndefined();
  });
});
