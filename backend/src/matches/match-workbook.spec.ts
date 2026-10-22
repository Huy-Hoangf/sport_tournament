import { Workbook } from 'exceljs';
import { MATCH_HEADERS, readMatchWorkbook } from './match-workbook';

describe('Excel match upload boundary', () => {
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
      await file([['Team A', 'Team B', date]]),
    );
    expect(rows[0]).toMatchObject({
      row: 2,
      home: 'Team A',
      away: 'Team B',
      kickoff: date.toISOString(),
    });
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
