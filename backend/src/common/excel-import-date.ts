import type { ExcelCell } from './flexible-workbook';

export type DateOrder = 'DMY' | 'MDY';

export class AmbiguousImportDate extends Error {
  constructor() {
    super('Choose the date format for dates like 01/02/2027.');
  }
}

export function importDate(
  cell: ExcelCell,
  dateOrder: DateOrder | undefined,
  kickoff: boolean,
) {
  if (!cell.text) return undefined;
  if (cell.date && !Number.isFinite(cell.date.getTime()))
    throw new Error('The date is invalid.');

  const text = cell.date ? cell.date.toISOString().slice(0, 23) : cell.text;
  const fullDate = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(.*)$/.exec(text);
  const shortDate = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(.*)$/.exec(text);
  if (!fullDate && !shortDate)
    throw new Error('Enter a date with a four-digit year.');

  let year: string;
  let month: string;
  let day: string;
  let time: string;
  if (fullDate) {
    [, year, month, day, time] = fullDate;
  } else {
    const [, first, second, shortYear, shortTime] = shortDate!;
    if (
      !dateOrder &&
      Number(first) !== Number(second) &&
      Number(first) <= 12 &&
      Number(second) <= 12
    )
      throw new AmbiguousImportDate();
    const dayFirst = dateOrder ? dateOrder === 'DMY' : Number(second) <= 12;
    [day, month] = dayFirst ? [first, second] : [second, first];
    year = shortYear;
    time = shortTime;
  }

  const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const midnight = new Date(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(midnight.getTime()) ||
    midnight.toISOString().slice(0, 10) !== date ||
    Number(year) < 1900
  )
    throw new Error('The date is invalid.');
  if (!kickoff) return date;

  const clock =
    /^[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?\s*(AM|PM)?\s*(Z|[+-]\d{2}:\d{2})?$/i.exec(
      time,
    );
  if (!clock)
    throw new Error(
      'Kickoff must include a date and a time, for example 2027-02-01 19:00.',
    );

  const [
    ,
    hour,
    minute,
    second = '00',
    millis = '',
    period,
    offset = '+07:00',
  ] = clock;
  if (
    (period ? Number(hour) < 1 || Number(hour) > 12 : Number(hour) > 23) ||
    Number(minute) > 59 ||
    Number(second) > 59
  )
    throw new Error('The kickoff time is invalid.');
  const hours = period
    ? (Number(hour) % 12) + (period.toUpperCase() === 'PM' ? 12 : 0)
    : Number(hour);
  const instant = new Date(
    `${date}T${String(hours).padStart(2, '0')}:${minute}:${second}${millis}${offset.toUpperCase()}`,
  );
  if (!Number.isFinite(instant.getTime()))
    throw new Error('The kickoff time zone is invalid.');
  return instant.toISOString();
}

export function importKickoff(
  cell: ExcelCell,
  dateCell: ExcelCell,
  dateOrder: DateOrder | undefined,
) {
  const time =
    cell.date &&
    Number.isFinite(cell.date.getTime()) &&
    cell.date.getUTCFullYear() < 1900
      ? cell.date.toISOString().slice(11, 23)
      : cell.text;
  if (/^\d{1,2}:\d{2}/.test(time)) {
    const date = importDate(dateCell, dateOrder, false);
    if (!date)
      throw new Error('Choose a kickoff date column for times without a date.');
    return importDate({ text: date + ' ' + time }, dateOrder, true);
  }
  return importDate(cell, dateOrder, true);
}
