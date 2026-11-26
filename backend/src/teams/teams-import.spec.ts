import { Workbook } from 'exceljs';
import type { Repository } from 'typeorm';
import type { User } from '../users/user.entity';
import { TeamsService } from './teams.service';

describe('team registration and import', () => {
  const query = jest.fn();
  const service = new TeamsService({
    query,
    manager: {
      transaction: (run: (manager: { query: typeof query }) => unknown) =>
        run({ query }),
    },
  } as unknown as Repository<User>);

  beforeEach(() => {
    query
      .mockReset()
      .mockImplementation((sql: string, parameters: unknown[]) => {
        if (sql.includes('FROM tournaments'))
          return [{ id: 1, status: 'UPCOMING' }];
        if (sql.includes('INSERT INTO teams'))
          return [{ id: 4, name: parameters[1] }];
        return [];
      });
  });

  it('registers a team without players', async () => {
    await expect(
      service.registerTeam({
        tournamentId: 1,
        teamName: 'France',
        players: [],
      }),
    ).resolves.toMatchObject({ team: { name: 'France', members: 0 } });
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes('INSERT INTO team_players'),
      ),
    ).toBe(false);
  });

  it('imports teams from a workbook with just the team name column', async () => {
    const workbook = new Workbook();
    workbook
      .addWorksheet('Teams')
      .addRows([['Team Name'], ['France'], ['Argentina']]);
    const contentBase64 = Buffer.from(
      await workbook.xlsx.writeBuffer(),
    ).toString('base64');
    await expect(
      service.importWorkbook(1, 'teams.xlsx', contentBase64),
    ).resolves.toEqual({ imported: 2 });
    expect(
      query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO teams')),
    ).toEqual([
      [expect.any(String), [1, 'France']],
      [expect.any(String), [1, 'Argentina']],
    ]);
  });

  it('reports the Excel row when an optional member code is invalid', async () => {
    const workbook = new Workbook();
    workbook
      .addWorksheet('Teams')
      .addRows([
        ['Team Name', 'Member Code'],
        ['France'],
        ['Argentina', 'unknown'],
      ]);
    const contentBase64 = Buffer.from(
      await workbook.xlsx.writeBuffer(),
    ).toString('base64');

    await expect(
      service.importWorkbook(1, 'teams.xlsx', contentBase64),
    ).rejects.toThrow('Row 3: Member Code must identify one active player.');
  });
});
