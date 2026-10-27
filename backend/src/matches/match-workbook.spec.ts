import { Workbook } from 'exceljs';
import { MATCH_HEADERS, readMatchWorkbook } from './match-workbook';

describe('Excel match upload boundary', () => {
  const fiveColumnHeaders = [
    'Tournament',
    'Stage',
    'Home Team',
    'Away Team',
    'Kickoff Time',
  ];
  async function file(rows: unknown[][], headers = MATCH_HEADERS) {
    const book = new Workbook();
    const sheet = book.addWorksheet('Matches');
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(row));
    return Buffer.from(await book.xlsx.writeBuffer()).toString('base64');
  }
  it('reads names and an Excel date without guessing a timezone', async () => {
    const date = new Date('2027-01-01T12:00:00Z');
    const rows = await readMatchWorkbook(
      'matches.xlsx',
      await file(
        [['Team A', 'Team B', date]],
        ['Home Team', 'Away Team', 'Kickoff Time'],
      ),
    );
    expect(rows[0]).toMatchObject({
      row: 2,
      home: 'Team A',
      away: 'Team B',
      kickoff: date.toISOString(),
    });
  });
  it('reads a tournament and stage from the new five-column template', async () => {
    const rows = await readMatchWorkbook(
      'matches.xlsx',
      await file(
        [
          [
            'Summer Cup',
            'Group Stage',
            'Team A',
            'Team B',
            '2027-01-01T12:00:00Z',
          ],
        ],
        fiveColumnHeaders,
      ),
    );
    expect(rows[0]).toMatchObject({
      tournament: 'Summer Cup',
      stage: 'Group Stage',
      home: 'Team A',
      away: 'Team B',
    });
  });
  it('reads tournament dates from the seven-column template', async () => {
    const rows = await readMatchWorkbook(
      'matches.xlsx',
      await file([
        [
          'Summer Cup',
          '2027-01-01',
          '2027-02-01',
          'Group Stage',
          'Team A',
          'Team B',
          '2027-01-15T19:00:00+07:00',
        ],
      ]),
    );
    expect(rows[0]).toMatchObject({
      tournament: 'Summer Cup',
      startDate: '2027-01-01',
      endDate: '2027-02-01',
      stage: 'Group Stage',
      home: 'Team A',
      away: 'Team B',
      kickoff: '2027-01-15T19:00:00+07:00',
    });
  });
  it('reports invalid tournament dates on the affected row', async () => {
    const rows = await readMatchWorkbook(
      'matches.xlsx',
      await file([
        [
          'Summer Cup',
          '2027-02-30',
          '2027-02-01',
          'Group Stage',
          'Team A',
          'Team B',
          '2027-01-15T19:00:00+07:00',
        ],
      ]),
    );
    expect(rows[0].error).toContain('date');
  });
  it('accepts Excel Date cells and rejects an end date before the start', async () => {
    const rows = await readMatchWorkbook(
      'matches.xlsx',
      await file([
        [
          'Date Cup',
          new Date('2027-01-01T00:00:00Z'),
          new Date('2027-02-01T00:00:00Z'),
          'Group Stage',
          'A',
          'B',
          '2027-01-15T12:00:00Z',
        ],
        [
          'Reverse Cup',
          '2027-03-01',
          '2027-02-01',
          'Group Stage',
          'A',
          'B',
          '2027-03-15T12:00:00Z',
        ],
      ]),
    );
    expect(rows[0]).toMatchObject({
      startDate: '2027-01-01',
      endDate: '2027-02-01',
    });
    expect(rows[1].error).toContain('end date');
  });
  it('continues to accept the three-column legacy template', async () => {
    const rows = await readMatchWorkbook(
      'matches.xlsx',
      await file(
        [['Team A', 'Team B', '2027-01-01T12:00:00Z']],
        ['Home Team', 'Away Team', 'Kickoff Time'],
      ),
    );
    expect(rows[0]).toMatchObject({ home: 'Team A', away: 'Team B' });
    expect(rows[0].tournament).toBeUndefined();
  });
  it('marks formulas as row errors instead of accepting a cached result', async () => {
    const rows = await readMatchWorkbook(
      'matches.xlsx',
      await file([
        [{ formula: '1+1', result: 2 }, 'Team B', '2027-01-01T12:00:00Z'],
      ]),
    );
    expect(rows[0].error).toContain('Formula');
  });
  it('rejects invalid headers and an empty workbook', async () => {
    await expect(
      readMatchWorkbook(
        'matches.xlsx',
        await file([['A', 'B', 'C']], ['Wrong', 'Away Team', 'Kickoff Time']),
      ),
    ).rejects.toThrow('Required columns');
    await expect(
      readMatchWorkbook('matches.xlsx', await file([])),
    ).rejects.toThrow('no data');
  });
  it('rejects the wrong extension and oversized compressed input', async () => {
    await expect(readMatchWorkbook('data.xls', 'aGVsbG8=')).rejects.toThrow();
    await expect(
      readMatchWorkbook('data.xlsx', 'A'.repeat(7 * 1024 * 1024 + 1)),
    ).rejects.toThrow();
  });
});
