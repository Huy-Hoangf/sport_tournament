import { BadRequestException } from '@nestjs/common';
import { ValueType, Workbook } from 'exceljs';
import { readXlsxWorksheet } from '../common/xlsx-workbook';

export const MATCH_HEADERS = [
  'Tournament',
  'Start Date',
  'End Date',
  'Stage',
  'Home Team',
  'Away Team',
  'Kickoff Time',
];
const FIVE_COLUMN_HEADERS = [
  'Tournament',
  'Stage',
  'Home Team',
  'Away Team',
  'Kickoff Time',
];
const LEGACY_MATCH_HEADERS = ['Home Team', 'Away Team', 'Kickoff Time'];
export type ImportRow = {
  row: number;
  tournament?: string;
  startDate?: string;
  endDate?: string;
  stage?: string;
  home: string;
  away: string;
  kickoff: string;
  error?: string;
};

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export async function readMatchWorkbook(
  fileName: unknown,
  content: unknown,
): Promise<ImportRow[]> {
  const sheet = await readXlsxWorksheet(fileName, content);
  try {
    if (sheet.rowCount > 2001 || sheet.columnCount > 7)
      throw new Error('Maximum 2000 rows and 7 columns.');
    const hasHeaders = (headers: string[]) =>
      sheet.columnCount === headers.length &&
      headers.every(
        (header, index) =>
          sheet
            .getRow(1)
            .getCell(index + 1)
            .text.trim() === header,
      );
    const datedFormat = hasHeaders(MATCH_HEADERS);
    const namedFormat = hasHeaders(FIVE_COLUMN_HEADERS);
    if (!datedFormat && !namedFormat && !hasHeaders(LEGACY_MATCH_HEADERS))
      throw new Error(
        `Required columns: ${MATCH_HEADERS.join(', ')} (or a previous five/three-column template).`,
      );
    const rows: ImportRow[] = [];
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      const cells = Array.from(
        { length: datedFormat ? 7 : namedFormat ? 5 : 3 },
        (_, i) => row.getCell(i + 1),
      );
      const texts = cells.map((cell, i) => {
        if (!(cell.value instanceof Date)) return cell.text.trim();
        const iso = cell.value.toISOString();
        return datedFormat && (i === 1 || i === 2) ? iso.slice(0, 10) : iso;
      });
      if (texts.every((text) => !text)) return;
      const stageIndex = datedFormat ? 3 : namedFormat ? 1 : -1;
      rows.push({
        row: index,
        tournament: datedFormat || namedFormat ? texts[0] : undefined,
        startDate: datedFormat ? texts[1] : undefined,
        endDate: datedFormat ? texts[2] : undefined,
        stage: stageIndex >= 0 ? texts[stageIndex] : undefined,
        home: texts[datedFormat ? 4 : namedFormat ? 2 : 0],
        away: texts[datedFormat ? 5 : namedFormat ? 3 : 1],
        kickoff: texts[datedFormat ? 6 : namedFormat ? 4 : 2],
        error: cells.some((cell) => cell.type === ValueType.Formula)
          ? 'Formula cells are not allowed.'
          : texts.some((text) => text.length > 255)
            ? 'Cell text is too long.'
            : stageIndex >= 0 && texts[stageIndex].length > 100
              ? 'Stage name is too long (maximum 100 characters).'
              : texts.some((text) => !text)
                ? 'All columns are required.'
                : datedFormat &&
                    (!isCalendarDate(texts[1]) || !isCalendarDate(texts[2]))
                  ? 'Tournament dates must use YYYY-MM-DD or Excel Date cells.'
                  : datedFormat && texts[2] < texts[1]
                    ? 'Tournament end date must be on or after start date.'
                    : undefined,
      });
    });
    if (!rows.length) throw new Error('Workbook has no data rows.');
    return rows;
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : 'Invalid Excel workbook.',
    );
  }
}

export async function matchTemplate() {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Matches');
  sheet.addRow(MATCH_HEADERS);
  const startDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const endDate = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  sheet.addRow([
    `Excel Import Cup ${new Date().toISOString().slice(0, 10)}`,
    startDate,
    endDate,
    'Group Stage',
    'Team A',
    'Team B',
    new Date(Date.now() + 7 * 86400000).toISOString(),
  ]);
  sheet.columns.forEach((column) => {
    column.width = 32;
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
