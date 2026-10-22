import { BadRequestException } from '@nestjs/common';
import { inflateRawSync } from 'node:zlib';
import { ValueType, Workbook } from 'exceljs';

export const MATCH_HEADERS = ['Home Team', 'Away Team', 'Kickoff Time'];
export type ImportRow = {
  row: number;
  home: string;
  away: string;
  kickoff: string;
  error?: string;
};

// Validate actual inflated sizes before passing an untrusted ZIP to ExcelJS.
function checkArchive(buffer: Buffer) {
  if (buffer.length < 22 || buffer.length > 5 * 1024 * 1024)
    throw new Error('File size limit is 5 MB.');
  let end = buffer.length - 22;
  while (
    end >= Math.max(0, buffer.length - 65557) &&
    buffer.readUInt32LE(end) !== 0x06054b50
  )
    end--;
  if (end < 0 || buffer.readUInt32LE(end) !== 0x06054b50)
    throw new Error('Invalid XLSX archive.');
  const count = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  let total = 0;
  if (count > 128 || count === 0)
    throw new Error('Workbook has too many archive entries.');
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error('Invalid archive directory.');
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const size = buffer.readUInt32LE(cursor + 20);
    const local = buffer.readUInt32LE(cursor + 42);
    if (flags & 1 || buffer.readUInt32LE(local) !== 0x04034b50)
      throw new Error('Encrypted/corrupt workbook.');
    const start =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    if (start + size > buffer.length) throw new Error('Invalid entry size.');
    const raw = buffer.subarray(start, start + size);
    const inflated =
      method === 0
        ? raw
        : method === 8
          ? inflateRawSync(raw, { maxOutputLength: 20 * 1024 * 1024 - total })
          : (() => {
              throw new Error('Unsupported compression.');
            })();
    total += inflated.length;
    if (total >= 20 * 1024 * 1024)
      throw new Error('Expanded workbook exceeds 20 MB.');
    cursor +=
      46 +
      buffer.readUInt16LE(cursor + 28) +
      buffer.readUInt16LE(cursor + 30) +
      buffer.readUInt16LE(cursor + 32);
  }
}

export async function readMatchWorkbook(
  fileName: unknown,
  content: unknown,
): Promise<ImportRow[]> {
  if (
    typeof fileName !== 'string' ||
    !fileName.toLowerCase().endsWith('.xlsx') ||
    typeof content !== 'string' ||
    content.length > 7 * 1024 * 1024 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(content)
  ) {
    throw new BadRequestException('Upload an .xlsx file, maximum 5 MB.');
  }
  try {
    const buffer = Buffer.from(content, 'base64');
    checkArchive(buffer);
    const workbook = new Workbook();
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    if (workbook.worksheets.length !== 1)
      throw new Error('Use one worksheet only.');
    const sheet = workbook.worksheets[0];
    if (sheet.rowCount > 2001 || sheet.columnCount > 3)
      throw new Error('Maximum 2000 rows and 3 columns.');
    if (
      MATCH_HEADERS.some(
        (header, index) =>
          sheet
            .getRow(1)
            .getCell(index + 1)
            .text.trim() !== header,
      )
    ) {
      throw new Error(`Required columns: ${MATCH_HEADERS.join(', ')}.`);
    }
    const rows: ImportRow[] = [];
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      const cells = [row.getCell(1), row.getCell(2), row.getCell(3)];
      const texts = cells.map((cell) =>
        cell.value instanceof Date
          ? cell.value.toISOString()
          : cell.text.trim(),
      );
      if (texts.every((text) => !text)) return;
      rows.push({
        row: index,
        home: texts[0],
        away: texts[1],
        kickoff: texts[2],
        error: cells.some((cell) => cell.type === ValueType.Formula)
          ? 'Formula cells are not allowed.'
          : texts.some((text) => text.length > 255)
            ? 'Cell text is too long.'
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
  sheet.addRow([
    'Team A',
    'Team B',
    new Date(Date.now() + 7 * 86400000).toISOString(),
  ]);
  sheet.columns.forEach((column) => {
    column.width = 32;
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
