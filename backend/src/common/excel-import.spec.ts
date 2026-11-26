import { Workbook } from 'exceljs';
import { utils, write } from 'xlsx';
import { prepareExcelImport } from './excel-import';

const now = new Date('2026-01-01T00:00:00Z');

async function xlsx(
  sheets: Record<string, Array<Array<string | number | Date>>>,
) {
  const workbook = new Workbook();
  for (const [name, rows] of Object.entries(sheets))
    workbook.addWorksheet(name).addRows(rows);
  return {
    fileName: 'test.xlsx',
    contentBase64: Buffer.from(await workbook.xlsx.writeBuffer()).toString(
      'base64',
    ),
  };
}

describe('flexible Excel import', () => {
  it('finds a Vietnamese header row and reads reordered columns and harmless extra columns', async () => {
    const file = await xlsx({
      Notes: [['Read me']],
      Lich: [
        ['Lịch mùa giải'],
        [
          'Giờ thi đấu',
          'Đội khách',
          'Ghi chú',
          'Vòng đấu',
          'Đội nhà',
          'Giải đấu',
        ],
        ['2027-02-01 19:00', 'France', 'OK', 'Group A', 'Vietnam', 'Cup'],
        ['2027-02-01 19:00', 'France', '', 'Group A', 'VIETNAM', 'Cup'],
      ],
    });
    const { preview, matches } = await prepareExcelImport('matches', file, now);
    expect(preview).toMatchObject({
      canImport: true,
      validCount: 1,
      duplicateCount: 1,
      selection: { sheetIndex: 1, headerRow: 2, mode: 'sheet' },
    });
    expect(matches[0]).toMatchObject({
      row: 3,
      home: 'Vietnam',
      away: 'France',
      tournament: 'Cup',
      stage: 'Group A',
      kickoff: '2027-02-01T12:00:00.000Z',
    });
  });

  it('requires a source group when using a schedule to import teams', async () => {
    const file = await xlsx({
      Matches: [
        ['Tournament', 'Home Team', 'Away Team'],
        ['Cup A', 'Vietnam', 'France'],
        ['Cup A', 'FRANCE', 'Brazil'],
        ['Cup B', 'Japan', 'Spain'],
      ],
    });
    const first = await prepareExcelImport(
      'teams',
      { ...file, tournamentId: 7 },
      now,
    );
    expect(first.preview.canImport).toBe(false);
    expect(first.preview.teamSources).toEqual(['Cup A', 'Cup B']);
    const selected = await prepareExcelImport(
      'teams',
      {
        ...file,
        tournamentId: 7,
        selection: { ...first.preview.selection, teamSource: 'Cup A' },
      },
      now,
    );
    expect(selected.preview).toMatchObject({
      canImport: true,
      duplicateCount: 1,
    });
    expect(selected.teams.map((team) => team.name)).toEqual([
      'Vietnam',
      'France',
      'Brazil',
    ]);
  });

  it('asks about ambiguous dates and accepts a manual mapping with a date order', async () => {
    const file = await xlsx({
      Matches: [
        ['Local', 'Visitor', 'Time'],
        ['Vietnam', 'France', '01/02/2027 19:00'],
      ],
    });
    const selection = {
      sheetIndex: 0,
      headerRow: 1,
      mode: 'selected',
      columns: { home: 1, away: 2, kickoff: 3 },
    };
    const ambiguous = await prepareExcelImport(
      'matches',
      { ...file, tournamentId: 7, stageId: 8, selection },
      now,
    );
    expect(ambiguous.preview).toMatchObject({
      canImport: false,
      needsDateOrder: true,
    });
    const resolved = await prepareExcelImport(
      'matches',
      {
        ...file,
        tournamentId: 7,
        stageId: 8,
        selection: { ...selection, dateOrder: 'DMY' },
      },
      now,
    );
    expect(resolved.preview.canImport).toBe(true);
    expect(resolved.matches[0].kickoff).toBe('2027-02-01T12:00:00.000Z');
  });

  it('accepts Excel 97–2003 workbooks', async () => {
    const book = utils.book_new();
    utils.book_append_sheet(
      book,
      utils.aoa_to_sheet([['Team Name'], ['Vietnam']]),
      'Teams',
    );
    const contentBase64 = write(book, {
      bookType: 'biff8',
      type: 'base64',
    }) as string;
    const result = await prepareExcelImport(
      'teams',
      { fileName: 'teams.xls', contentBase64, tournamentId: 7 },
      now,
    );
    expect(result.preview.canImport).toBe(true);
    expect(result.teams[0].name).toBe('Vietnam');
  });

  it('requires a worksheet when both have matching headings', async () => {
    const rows = [['Team Name'], ['Vietnam']];
    const file = await xlsx({ First: rows, Second: rows });
    const first = await prepareExcelImport(
      'teams',
      { ...file, tournamentId: 7 },
      now,
    );
    expect(first.preview).toMatchObject({ needsSheet: true, canImport: false });
    const chosen = await prepareExcelImport(
      'teams',
      { ...file, tournamentId: 7, selection: { sheetIndex: 1 } },
      now,
    );
    expect(chosen.preview).toMatchObject({
      needsSheet: false,
      canImport: true,
    });
  });

  it('joins dates and times stored in separate columns', async () => {
    const file = await xlsx({
      Matches: [
        ['Home Team', 'Away Team', 'Match Date', 'Time'],
        ['Vietnam', 'France', '2027-04-08', '7:30 PM'],
      ],
    });
    const result = await prepareExcelImport(
      'matches',
      { ...file, tournamentId: 7, stageId: 8 },
      now,
    );
    expect(result.preview.canImport).toBe(true);
    expect(result.matches[0].kickoff).toBe('2027-04-08T12:30:00.000Z');
  });
});
