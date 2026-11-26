import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { inflateRawSync } from 'node:zlib';

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

export async function readXlsxWorkbook(fileName: unknown, content: unknown) {
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
    return workbook;
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : 'Invalid Excel workbook.',
    );
  }
}

export async function readXlsxWorksheet(fileName: unknown, content: unknown) {
  const workbook = await readXlsxWorkbook(fileName, content);
  if (workbook.worksheets.length !== 1)
    throw new BadRequestException('Use one worksheet only.');
  return workbook.worksheets[0];
}
