import { BadRequestException } from '@nestjs/common';
import {
  AmbiguousImportDate,
  importDate,
  importKickoff,
  type DateOrder,
} from './excel-import-date';
import {
  canReadSheet,
  MAX_HEADER_ROW,
  MAX_IMPORT_ROWS,
  readFlexibleWorkbook,
  type ExcelSheet,
} from './flexible-workbook';

const aliases = {
  tournament: [
    'tournament',
    'tournament name',
    'competition',
    'league',
    'giải đấu',
    'tên giải',
    'tên giải đấu',
  ],
  stage: [
    'stage',
    'stage name',
    'round',
    'group',
    'vòng',
    'vòng đấu',
    'giai đoạn',
    'bảng đấu',
  ],
  startDate: [
    'start date',
    'tournament start date',
    'ngày bắt đầu',
    'ngày khai mạc',
  ],
  endDate: ['end date', 'tournament end date', 'ngày kết thúc', 'ngày bế mạc'],
  home: [
    'home team',
    'home team name',
    'home',
    'đội nhà',
    'chủ nhà',
    'đội chủ nhà',
  ],
  away: ['away team', 'away team name', 'away', 'đội khách', 'đội sân khách'],
  kickoffDate: ['kickoff date', 'match date', 'date', 'ngày thi đấu', 'ngày'],
  kickoff: [
    'time',
    'kickoff time',
    'kickoff',
    'kick off time',
    'scheduled time',
    'match date time',
    'match datetime',
    'datetime',
    'giờ thi đấu',
    'ngày giờ thi đấu',
    'giờ bắt đầu',
  ],
  teamName: ['team name', 'team', 'name', 'đội', 'tên đội', 'tên đội bóng'],
  memberCode: ['member code', 'player code', 'mã cầu thủ', 'mã thành viên'],
};
export const importFields = {
  matches: [
    'home',
    'away',
    'kickoff',
    'kickoffDate',
    'tournament',
    'stage',
    'startDate',
    'endDate',
  ],
  teams: ['teamName', 'home', 'away', 'tournament', 'memberCode'],
} as const;

type Kind = keyof typeof importFields;
type Field = keyof typeof aliases;
type Mapping = Partial<Record<Field, number>>;
type Selection = {
  sheetIndex: number;
  headerRow: number;
  columns: Mapping;
  mode: 'sheet' | 'selected';
  teamLayout: 'names' | 'opponents';
  teamSource?: string;
  dateOrder?: DateOrder;
};
type Issue = { row: number; message: string };
export type MatchImportRow = {
  row: number;
  tournament?: string;
  stage?: string;
  startDate?: string;
  endDate?: string;
  home: string;
  away: string;
  kickoff: string;
  error?: string;
};
type TeamImportGroup = {
  row: number;
  name: string;
  members: Array<{ row: number; code: string }>;
};

const textKey = (value: string) => value.trim().toLowerCase();
const headerKey = (value: string) =>
  textKey(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const normalizedAliases = Object.fromEntries(
  Object.entries(aliases).map(([field, names]) => [
    field,
    new Set(names.map(headerKey)),
  ]),
) as Record<Field, Set<string>>;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function inferColumns(
  sheet: ExcelSheet,
  headerRow: number,
  fields: readonly Field[],
): Mapping {
  if (!headerRow) return {};
  const headers = Array.from({ length: sheet.columnCount }, (_, col) =>
    headerKey(sheet.cell(headerRow, col + 1).text),
  );
  const mapping: Mapping = {};
  for (const field of fields) {
    const positions = headers.flatMap((header, index) =>
      normalizedAliases[field].has(header) ? [index + 1] : [],
    );
    if (positions.length === 1) mapping[field] = positions[0];
  }
  return mapping;
}

function scoreColumns(kind: Kind, columns: Mapping) {
  const fields =
    kind === 'matches'
      ? (['home', 'away', 'kickoff'] as const)
      : (['teamName', 'home', 'away'] as const);
  const core = fields.filter((field) => columns[field]).length;
  const complete =
    kind === 'matches'
      ? core === 3
      : Boolean(columns.teamName || (columns.home && columns.away));
  return (complete ? 100 : 0) + core * 10 + Object.keys(columns).length;
}

function getHeader(kind: Kind, sheet: ExcelSheet) {
  let headerRow = sheet.rowCount ? 1 : 0;
  let score = 0;
  for (let row = 1; row <= Math.min(sheet.rowCount, MAX_HEADER_ROW); row++) {
    const candidate = scoreColumns(
      kind,
      inferColumns(sheet, row, importFields[kind]),
    );
    if (candidate > score) {
      score = candidate;
      headerRow = row;
    }
  }
  return { headerRow, score };
}

function columnLetter(column: number) {
  const prefix =
    column > 26 ? String.fromCharCode(64 + Math.floor((column - 1) / 26)) : '';
  return prefix + String.fromCharCode(65 + ((column - 1) % 26));
}

function readSelection(
  kind: Kind,
  sheet: ExcelSheet,
  index: number,
  row: number,
  raw: Record<string, unknown>,
): Selection {
  const headerRow = raw.headerRow === undefined ? row : raw.headerRow;
  if (
    typeof headerRow !== 'number' ||
    !Number.isInteger(headerRow) ||
    headerRow < 0 ||
    headerRow > Math.min(sheet.rowCount, MAX_HEADER_ROW)
  ) {
    throw new BadRequestException(
      'Choose a valid header row, or choose no header.',
    );
  }
  const columns = inferColumns(sheet, headerRow, importFields[kind]);
  if (raw.columns !== undefined) {
    const requested = object(raw.columns);
    for (const key of importFields[kind]) {
      const value = requested[key];
      if (value === undefined || value === null) {
        delete columns[key];
        continue;
      }
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > sheet.columnCount
      )
        throw new BadRequestException(
          'One or more selected columns are outside this sheet.',
        );
      columns[key] = value;
    }
  }
  return {
    sheetIndex: index,
    headerRow,
    columns,
    mode:
      raw.mode === 'sheet' || raw.mode === 'selected'
        ? raw.mode
        : columns.tournament
          ? 'sheet'
          : 'selected',
    teamLayout:
      raw.teamLayout === 'names' || raw.teamLayout === 'opponents'
        ? raw.teamLayout
        : columns.teamName || (!columns.home && !columns.away)
          ? 'names'
          : 'opponents',
    teamSource: typeof raw.teamSource === 'string' ? raw.teamSource : undefined,
    dateOrder:
      raw.dateOrder === 'DMY' || raw.dateOrder === 'MDY'
        ? raw.dateOrder
        : undefined,
  };
}

function hasId(value: unknown) {
  return (
    (typeof value === 'number' ||
      (typeof value === 'string' && /^\d+$/.test(value))) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
  );
}

export async function prepareExcelImport(
  kind: Kind,
  input: Record<string, unknown>,
  now = new Date(),
) {
  const sheets = await readFlexibleWorkbook(
    input.fileName,
    input.contentBase64,
  );
  const raw = object(input.selection);
  const sheetOptions = sheets.map((sheet, index) => ({
    index,
    name: sheet.name,
    usable: canReadSheet(sheet),
    ...(canReadSheet(sheet)
      ? getHeader(kind, sheet)
      : { headerRow: 0, score: -1 }),
  }));
  const usable = sheetOptions.filter((sheet) => sheet.usable);
  if (!usable.length)
    throw new BadRequestException(
      'Use a sheet with at most 2,000 data rows and 100 columns.',
    );

  const best = [...usable].sort((a, b) => b.score - a.score)[0];
  const choice =
    raw.sheetIndex === undefined
      ? best
      : usable.find((sheet) => sheet.index === raw.sheetIndex);
  if (!choice)
    throw new BadRequestException(
      'Choose a worksheet within the import limits.',
    );
  const needsSheet =
    raw.sheetIndex === undefined &&
    usable.filter((option) => option.score >= 100).length > 1;
  const sheet = sheets[choice.index];
  const selection = readSelection(
    kind,
    sheet,
    choice.index,
    choice.headerRow,
    raw,
  );
  const { columns, headerRow, mode, teamLayout, dateOrder } = selection;

  const withinLimit = sheet.rowCount - headerRow <= MAX_IMPORT_ROWS;
  const messages: string[] = [];
  if (!withinLimit)
    messages.push('The selected sheet has more than 2,000 data rows.');
  const errors: Issue[] = [];
  const matches: MatchImportRow[] = [];
  const teams: TeamImportGroup[] = [];
  const sources = new Map<string, string>();
  let duplicateCount = 0;
  let needsDateOrder = false;
  let needsTeamSource = false;

  const required: Field[] =
    kind === 'matches'
      ? mode === 'sheet'
        ? ['home', 'away', 'kickoff', 'tournament', 'stage']
        : ['home', 'away', 'kickoff']
      : teamLayout === 'names'
        ? ['teamName']
        : ['home', 'away'];
  const active =
    kind === 'matches'
      ? mode === 'sheet'
        ? importFields.matches
        : (['home', 'away', 'kickoff', 'kickoffDate'] as const)
      : teamLayout === 'names'
        ? (['teamName', 'memberCode', 'tournament'] as const)
        : (['home', 'away', 'tournament'] as const);
  const mapped = active.flatMap((field) =>
    columns[field] ? [columns[field]] : [],
  );
  const canReadRows =
    required.every((field) => columns[field]) &&
    new Set(mapped).size === mapped.length;
  if (!required.every((field) => columns[field]))
    messages.push('Choose a column for each required field.');
  if (new Set(mapped).size !== mapped.length)
    messages.push('Use a different column for each mapped field.');
  if (needsSheet)
    messages.push(
      'More than one sheet looks usable. Choose the sheet to import.',
    );
  if (kind === 'teams' && !hasId(input.tournamentId))
    messages.push('Select the destination tournament.');
  if (
    kind === 'matches' &&
    mode === 'selected' &&
    (!hasId(input.tournamentId) || !hasId(input.stageId))
  )
    messages.push('Select the destination tournament and stage.');

  const get = (row: number, field: Field) =>
    columns[field] ? sheet.cell(row, columns[field]) : { text: '' };
  const rowNumbers = Array.from(
    { length: sheet.rowCount - headerRow },
    (_, index) => headerRow + index + 1,
  );
  const dataRows =
    canReadRows && withinLimit
      ? rowNumbers.filter((row) =>
          active.some((field) => {
            const cell = get(row, field);
            return cell.text || cell.formula;
          }),
        )
      : [];

  if (kind === 'teams' && columns.tournament) {
    for (const row of dataRows) {
      const cell = get(row, 'tournament');
      if (cell.text && !sources.has(textKey(cell.text)))
        sources.set(textKey(cell.text), cell.text);
    }
    const source = selection.teamSource
      ? sources.get(textKey(selection.teamSource))
      : sources.size === 1
        ? sources.values().next().value
        : undefined;
    selection.teamSource = source;
    needsTeamSource = sources.size > 1 && !source;
    if (needsTeamSource)
      messages.push('Choose which tournament to take teams from.');
  }

  const teamsByName = new Map<string, TeamImportGroup>();
  const membersByTeam = new Map<string, string>();
  const matchKeys = new Set<string>();
  const datesByTournament = new Map<
    string,
    { startDate?: string; endDate?: string }
  >();
  for (const row of dataRows) {
    if (needsTeamSource) break;
    if (
      kind === 'teams' &&
      selection.teamSource &&
      textKey(get(row, 'tournament').text) !== textKey(selection.teamSource)
    )
      continue;
    try {
      if (active.some((field) => get(row, field).formula))
        throw new Error(
          'Copy formula cells and paste them as values before importing.',
        );
      if (active.some((field) => get(row, field).text.length > 255))
        throw new Error('A cell exceeds the 255-character limit.');
      if (kind === 'teams') {
        const names =
          teamLayout === 'names'
            ? [get(row, 'teamName').text]
            : [get(row, 'home').text, get(row, 'away').text];
        const code = teamLayout === 'names' ? get(row, 'memberCode').text : '';
        if (names.every((name) => !name))
          throw new Error('A team name is required.');
        const usableNames = names.filter(Boolean);
        if (
          usableNames.some((name) =>
            ['tbd', 'team 1', 'team 2', 'home team', 'away team'].includes(
              textKey(name),
            ),
          )
        )
          throw new Error('Replace the placeholder with the actual team name.');
        if (code) {
          const key = textKey(code);
          const owner = membersByTeam.get(key);
          if (owner && owner !== textKey(usableNames[0]))
            throw new Error(
              'This member code is assigned to more than one team.',
            );
          membersByTeam.set(key, textKey(usableNames[0]));
        }
        for (const name of usableNames) {
          const key = textKey(name);
          let team = teamsByName.get(key);
          if (!team) {
            team = { row, name, members: [] };
            teamsByName.set(key, team);
            teams.push(team);
          } else if (
            !code ||
            team.members.some(
              (member) => textKey(member.code) === textKey(code),
            )
          ) {
            duplicateCount++;
            continue;
          }
          if (code) team.members.push({ row, code });
        }
        continue;
      }

      const home = get(row, 'home').text;
      const away = get(row, 'away').text;
      if (!home || !away) throw new Error('Both team names are required.');
      if (textKey(home) === textKey(away))
        throw new Error('Home and away teams must be different.');
      const kickoff = importKickoff(
        get(row, 'kickoff'),
        get(row, 'kickoffDate'),
        dateOrder,
      );
      if (!kickoff) throw new Error('Kickoff is required.');
      if (Date.parse(kickoff) <= now.getTime())
        throw new Error('Kickoff must be in the future.');
      const tournament =
        mode === 'sheet' ? get(row, 'tournament').text : undefined;
      const stage = mode === 'sheet' ? get(row, 'stage').text : undefined;
      if (mode === 'sheet' && (!tournament || !stage))
        throw new Error('Enter the tournament and stage in this row.');
      if (stage && stage.length > 100)
        throw new Error('Stage name must have at most 100 characters.');
      const startDate =
        mode === 'sheet'
          ? importDate(get(row, 'startDate'), dateOrder, false)
          : undefined;
      const endDate =
        mode === 'sheet'
          ? importDate(get(row, 'endDate'), dateOrder, false)
          : undefined;
      if (startDate && endDate && endDate < startDate)
        throw new Error('Tournament end date must be on or after start date.');
      if (tournament) {
        const name = textKey(tournament);
        const dates = datesByTournament.get(name);
        if (
          (dates?.startDate && startDate && dates.startDate !== startDate) ||
          (dates?.endDate && endDate && dates.endDate !== endDate)
        )
          throw new Error(
            'Rows for this tournament have different start or end dates.',
          );
        datesByTournament.set(name, {
          startDate: dates?.startDate ?? startDate,
          endDate: dates?.endDate ?? endDate,
        });
      }
      const matchKey = JSON.stringify([
        tournament && textKey(tournament),
        stage && textKey(stage),
        textKey(home),
        textKey(away),
        kickoff,
      ]);
      if (matchKeys.has(matchKey)) {
        duplicateCount++;
        continue;
      }
      matchKeys.add(matchKey);
      matches.push({
        row,
        tournament,
        stage,
        home,
        away,
        kickoff,
        startDate,
        endDate,
      });
    } catch (error) {
      if (error instanceof AmbiguousImportDate) needsDateOrder = true;
      errors.push({
        row,
        message:
          error instanceof Error ? error.message : 'Cannot read this row.',
      });
    }
  }

  const validCount = kind === 'matches' ? matches.length : teams.length;
  if (!validCount && !errors.length && !messages.length)
    messages.push('No importable rows were found.');
  return {
    matches,
    teams,
    preview: {
      sheets: sheetOptions.map(({ index, name, usable }) => ({
        index,
        name,
        usable,
      })),
      selection,
      needsSheet,
      needsDateOrder,
      needsTeamSource,
      teamSources: [...sources.values()],
      tournamentNames: [
        ...new Map(
          matches.flatMap((match) =>
            match.tournament
              ? [[textKey(match.tournament), match.tournament] as const]
              : [],
          ),
        ).values(),
      ],
      columns: Array.from({ length: sheet.columnCount }, (_, index) => {
        const column = index + 1;
        return {
          index: column,
          label: headerRow
            ? sheet.cell(headerRow, column).text || columnLetter(column)
            : columnLetter(column),
        };
      }),
      required,
      messages,
      validCount,
      duplicateCount,
      errorCount: errors.length,
      existingCount: 0,
      errors: errors.slice(0, 50),
      sample:
        kind === 'matches'
          ? matches
              .slice(0, 5)
              .map(({ row, home, away, tournament, stage, kickoff }) => ({
                row,
                label: `${home} vs ${away}`,
                tournament,
                stage,
                kickoff,
              }))
          : teams.slice(0, 5).map(({ row, name }) => ({ row, label: name })),
      canImport: validCount > 0 && errors.length === 0 && messages.length === 0,
    },
  };
}

export function requireValidImport(
  preview: Awaited<ReturnType<typeof prepareExcelImport>>['preview'],
) {
  if (preview.canImport) return;
  const issue = preview.errors[0];
  throw new BadRequestException(
    preview.messages[0] ??
      (issue
        ? `Row ${issue.row}: ${issue.message}`
        : 'Check the Excel preview before importing.'),
  );
}
