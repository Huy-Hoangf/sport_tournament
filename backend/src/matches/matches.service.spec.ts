import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { MatchesService } from './matches.service';
import { Workbook } from 'exceljs';

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

  it('imports a new tournament and teams without player accounts', async () => {
    const book = new Workbook();
    const sheet = book.addWorksheet('Matches');
    sheet.addRow([
      'Tournament',
      'Start Date',
      'End Date',
      'Stage',
      'Home Team',
      'Away Team',
      'Kickoff Time',
    ]);
    sheet.addRow([
      'Summer Cup',
      '2027-01-01',
      '2027-02-01',
      'Group Stage',
      'Team A',
      'Team B',
      '2027-01-15T12:00:00Z',
    ]);
    sheet.addRow([
      'Summer Cup',
      '2027-01-01',
      '2027-02-01',
      'Group Stage',
      'Team B',
      'Team A',
      '2027-01-16T12:00:00Z',
    ]);
    const tournaments: Array<{
      id: number;
      name: string;
      startDate: string;
      endDate: string;
    }> = [];
    const stages: Array<{ id: number; name: string; tournamentId: number }> =
      [];
    const teams: Array<{ id: number; name: string; tournamentId: number }> = [];
    const manager = {
      query: jest.fn((sql: string, params: unknown[] = []) => {
        if (
          /^\s*(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT|SELECT pg_advisory_xact_lock)/i.test(
            sql,
          )
        )
          return [];
        if (/FROM tournaments WHERE LOWER\(name\)/i.test(sql))
          return tournaments
            .filter(
              (t) => t.name.toLowerCase() === String(params[0]).toLowerCase(),
            )
            .map((t) => ({
              id: t.id,
              startDate: t.startDate.slice(0, 10),
              endDate: t.endDate.slice(0, 10),
            }));
        if (/INSERT INTO tournaments/i.test(sql)) {
          const item = {
            id: tournaments.length + 1,
            name: String(params[0]),
            startDate: String(params[1]),
            endDate: String(params[2]),
          };
          tournaments.push(item);
          return [item];
        }
        if (/SELECT id FROM stages WHERE/i.test(sql))
          return stages.filter(
            (s) =>
              s.tournamentId === params[0] &&
              s.name.toLowerCase() === String(params[1]).toLowerCase(),
          );
        if (/INSERT INTO stages/i.test(sql)) {
          const item = {
            id: stages.length + 1,
            tournamentId: Number(params[0]),
            name: String(params[1]),
          };
          stages.push(item);
          return [item];
        }
        if (/SELECT id FROM teams WHERE/i.test(sql))
          return teams.filter(
            (t) =>
              t.tournamentId === params[0] &&
              t.name.toLowerCase() === String(params[1]).toLowerCase(),
          );
        if (/INSERT INTO teams/i.test(sql)) {
          const item = {
            id: teams.length + 1,
            tournamentId: Number(params[0]),
            name: String(params[1]),
          };
          teams.push(item);
          return [item];
        }
        if (/SELECT s.id FROM stages/i.test(sql)) return [{ id: params[1] }];
        if (/INSERT INTO matches/i.test(sql)) return [{ id: 1 }];
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    };
    (
      service as unknown as { usersRepository: { manager: unknown } }
    ).usersRepository.manager = {
      transaction: (callback: (value: typeof manager) => Promise<unknown>) =>
        callback(manager),
    };
    const result = await service.importWorkbook(
      {
        fileName: 'matches.xlsx',
        contentBase64: Buffer.from(await book.xlsx.writeBuffer()).toString(
          'base64',
        ),
      },
      42,
    );
    expect(result).toMatchObject({ imported: 2, rejected: 0 });
    expect(tournaments).toHaveLength(1);
    expect(tournaments[0]).toMatchObject({
      startDate: '2027-01-01T00:00:00.000+07:00',
      endDate: '2027-02-01T23:59:59.999+07:00',
    });
    expect(stages).toHaveLength(1);
    expect(teams).toHaveLength(2);
    expect(
      manager.query.mock.calls.filter(([sql]) =>
        /INSERT INTO matches/i.test(sql),
      ),
    ).toHaveLength(2);
  });

  it('rejects a row when an existing tournament has different dates', async () => {
    const book = new Workbook();
    const sheet = book.addWorksheet('Matches');
    sheet.addRow([
      'Tournament',
      'Start Date',
      'End Date',
      'Stage',
      'Home Team',
      'Away Team',
      'Kickoff Time',
    ]);
    sheet.addRow([
      'Summer Cup',
      '2027-01-01',
      '2027-02-01',
      'Group Stage',
      'Team A',
      'Team B',
      '2027-01-15T12:00:00Z',
    ]);
    const manager = {
      query: jest.fn((sql: string) => {
        if (/SAVEPOINT|pg_advisory_xact_lock/i.test(sql)) return [];
        if (/FROM tournaments WHERE LOWER\(name\)/i.test(sql))
          return [{ id: 7, startDate: '2027-03-01', endDate: '2027-03-31' }];
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    };
    (
      service as unknown as { usersRepository: { manager: unknown } }
    ).usersRepository.manager = {
      transaction: (callback: (value: typeof manager) => Promise<unknown>) =>
        callback(manager),
    };
    const result = await service.importWorkbook(
      {
        fileName: 'matches.xlsx',
        contentBase64: Buffer.from(await book.xlsx.writeBuffer()).toString(
          'base64',
        ),
      },
      42,
    );
    expect(result).toMatchObject({ imported: 0, rejected: 1 });
    expect(result.errors[0].message).toContain('different start or end dates');
  });

  it('fills missing dates on an existing tournament while importing its first match', async () => {
    const book = new Workbook();
    const sheet = book.addWorksheet('Matches');
    sheet.addRow([
      'Tournament',
      'Start Date',
      'End Date',
      'Stage',
      'Home Team',
      'Away Team',
      'Kickoff Time',
    ]);
    sheet.addRow([
      'Summer Cup',
      '2027-01-01',
      '2027-02-01',
      'Group Stage',
      'Team A',
      'Team B',
      '2027-01-15T12:00:00Z',
    ]);
    let nextTeamId = 1;
    const manager = {
      query: jest.fn((sql: string) => {
        if (/SAVEPOINT|pg_advisory_xact_lock/i.test(sql)) return [];
        if (/FROM tournaments WHERE LOWER\(name\)/i.test(sql))
          return [{ id: 7, startDate: null, endDate: null }];
        if (/UPDATE tournaments/i.test(sql)) return [];
        if (/SELECT id FROM stages WHERE/i.test(sql)) return [{ id: 8 }];
        if (/SELECT id FROM teams WHERE/i.test(sql)) return [];
        if (/INSERT INTO teams/i.test(sql)) return [{ id: nextTeamId++ }];
        if (/SELECT s.id FROM stages/i.test(sql)) return [{ id: 8 }];
        if (/INSERT INTO matches/i.test(sql)) return [{ id: 9 }];
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    };
    (
      service as unknown as { usersRepository: { manager: unknown } }
    ).usersRepository.manager = {
      transaction: (callback: (value: typeof manager) => Promise<unknown>) =>
        callback(manager),
    };
    const result = await service.importWorkbook(
      {
        fileName: 'matches.xlsx',
        contentBase64: Buffer.from(await book.xlsx.writeBuffer()).toString(
          'base64',
        ),
      },
      42,
    );
    expect(result).toMatchObject({ imported: 1, rejected: 0 });
    const update = manager.query.mock.calls.find(([sql]) =>
      /UPDATE tournaments/i.test(sql),
    ) as unknown as [string, unknown[]] | undefined;
    expect(update?.[1]).toEqual([
      7,
      '2027-01-01T00:00:00.000+07:00',
      '2027-02-01T23:59:59.999+07:00',
    ]);
  });
});
