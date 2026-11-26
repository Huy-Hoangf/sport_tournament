import { BadRequestException } from '@nestjs/common';
import { readXlsxWorksheet } from '../common/xlsx-workbook';

type TeamImportGroup = {
  row: number;
  name: string;
  members: Array<{ row: number; code: string }>;
};

export async function readTeamWorkbook(fileName: unknown, content: unknown) {
  const sheet = await readXlsxWorksheet(fileName, content);
  if (sheet.rowCount > 2001 || sheet.columnCount > 2) {
    throw new BadRequestException(
      'Use at most 2000 data rows and two columns.',
    );
  }

  const header = sheet.getRow(1);
  if (
    header.getCell(1).text.trim() !== 'Team Name' ||
    (sheet.columnCount === 2 && header.getCell(2).text.trim() !== 'Member Code')
  ) {
    throw new BadRequestException(
      'Use Team Name and optional Member Code columns.',
    );
  }

  const teams = new Map<string, TeamImportGroup>();
  sheet.eachRow((row, number) => {
    if (number === 1) return;

    const name = row.getCell(1).text.trim();
    const code = row.getCell(2).text.trim();
    if (!name && !code) return;
    if (!name)
      throw new BadRequestException(`Row ${number}: Team Name is required.`);

    const key = name.toLowerCase();
    let team = teams.get(key);
    if (!team) {
      team = { row: number, name, members: [] };
      teams.set(key, team);
    }
    if (code) team.members.push({ row: number, code });
  });

  if (!teams.size) throw new BadRequestException('Workbook has no teams.');
  return [...teams.values()];
}
