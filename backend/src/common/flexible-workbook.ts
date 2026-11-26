import { BadRequestException } from '@nestjs/common';
import { ValueType, type Worksheet } from 'exceljs';
import { read, utils } from 'xlsx';
import { readXlsxWorkbook } from './xlsx-workbook';

export type ExcelCell = { text: string; date?: Date; formula?: boolean };
export type ExcelSheet = {
  name: string;
  rowCount: number;
  columnCount: number;
  cell: (row: number, column: number) => ExcelCell;
};

export const MAX_HEADER_ROW = 50;
export const MAX_IMPORT_ROWS = 2000;
const MAX_WORKBOOK_ROWS = MAX_IMPORT_ROWS + MAX_HEADER_ROW;
const MAX_IMPORT_COLUMNS = 100;
const MAX_IMPORT_SHEETS = 32;

function xlsxSheet(sheet: Worksheet): ExcelSheet {
  return {
    name: sheet.name,
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    cell(row, column) {
      const cell = sheet.findRow(row)?.findCell(column);
      if (!cell) return { text: '' };
      return {
        text: cell.text.trim(),
        date: cell.value instanceof Date ? cell.value : undefined,
        formula:
          cell.effectiveType === ValueType.Formula ||
          cell.type === ValueType.Formula,
      };
    },
  };
}

export async function readFlexibleWorkbook(
  fileName: unknown,
  content: unknown,
): Promise<ExcelSheet[]> {
  if (
    typeof fileName !== 'string' ||
    !/\.xlsx?$/i.test(fileName) ||
    typeof content !== 'string' ||
    content.length > 7 * 1024 * 1024 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(content)
  ) {
    throw new BadRequestException(
      'Upload an .xlsx or .xls file, maximum 5 MB.',
    );
  }

  try {
    if (/\.xlsx$/i.test(fileName)) {
      return checkSheetCount(
        (await readXlsxWorkbook(fileName, content)).worksheets.map(xlsxSheet),
      );
    }

    const buffer = Buffer.from(content, 'base64');
    if (buffer.length > 5 * 1024 * 1024)
      throw new Error('File size limit is 5 MB.');

    const ole = buffer
      .subarray(0, 8)
      .equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
    const biff =
      buffer.length >= 4 &&
      buffer[0] === 0x09 &&
      [0x00, 0x02, 0x04, 0x08].includes(buffer[1]);
    if (!ole && !biff) throw new Error('File is not an Excel .xls workbook.');

    const workbook = read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellFormula: true,
      sheetRows: MAX_WORKBOOK_ROWS + 1,
    });
    return checkSheetCount(
      workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const ref = sheet['!fullref'] ?? sheet['!ref'];
        const end = ref ? utils.decode_range(ref).e : null;
        return {
          name,
          rowCount: end ? end.r + 1 : 0,
          columnCount: end ? end.c + 1 : 0,
          cell(row, column) {
            const value =
              sheet[utils.encode_cell({ r: row - 1, c: column - 1 })];
            return {
              text:
                !value || value.t === 'e'
                  ? ''
                  : String(value.w ?? value.v ?? '').trim(),
              date: value?.v instanceof Date ? value.v : undefined,
              formula: Boolean(value?.f),
            };
          },
        };
      }),
    );
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    const message = error instanceof Error ? error.message : '';
    throw new BadRequestException(
      /size limit|not an Excel/i.test(message)
        ? message
        : 'Cannot open this Excel file. Check that the file is intact and does not require a password.',
    );
  }
}

function checkSheetCount(sheets: ExcelSheet[]) {
  if (sheets.length < 1)
    throw new BadRequestException('The workbook has no worksheets.');
  if (sheets.length > MAX_IMPORT_SHEETS)
    throw new BadRequestException('Use a workbook with at most 32 sheets.');
  return sheets;
}

export function canReadSheet(sheet: ExcelSheet) {
  return (
    sheet.rowCount <= MAX_WORKBOOK_ROWS &&
    sheet.columnCount <= MAX_IMPORT_COLUMNS
  );
}
