import { BadRequestException } from '@nestjs/common';

export function positiveId(value: unknown, field = 'id'): number {
  const id =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (
    typeof id !== 'number' ||
    !Number.isInteger(id) ||
    id <= 0 ||
    id > 2147483647
  ) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }
  return id;
}

export function validateMatchInput(
  input: Record<string, unknown>,
  now = new Date(),
) {
  const tournamentId = positiveId(input.tournamentId, 'tournamentId');
  const stageId = positiveId(input.stageId, 'stageId');
  const homeTeamId = positiveId(input.homeTeamId, 'homeTeamId');
  const awayTeamId = positiveId(input.awayTeamId, 'awayTeamId');
  if (homeTeamId === awayTeamId)
    throw new BadRequestException('Home Team và Away Team phải khác nhau.');
  const text = input.scheduledTime;
  if (
    typeof text !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(
      text,
    )
  ) {
    throw new BadRequestException(
      'Sai định dạng ngày giờ. Dùng ISO-8601 có múi giờ.',
    );
  }
  const [year, month, day] = text.slice(0, 10).split('-').map(Number);
  const date = new Date(text);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isFinite(date.getTime()) ||
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  ) {
    throw new BadRequestException('Sai định dạng ngày giờ.');
  }
  if (date.getTime() <= now.getTime())
    throw new BadRequestException('Thời gian phải ở tương lai.');
  const lockMinutes = input.lockMinutes ?? 15;
  if (
    typeof lockMinutes !== 'number' ||
    !Number.isInteger(lockMinutes) ||
    lockMinutes < 0 ||
    lockMinutes > 10080
  ) {
    throw new BadRequestException('Lock minutes must be between 0 and 10080.');
  }
  return {
    tournamentId,
    stageId,
    homeTeamId,
    awayTeamId,
    scheduledTime: date.toISOString(),
    lockMinutes,
  };
}

export function validateScores(input: Record<string, unknown>) {
  const { homeScore, awayScore } = input;
  for (const score of [homeScore, awayScore]) {
    if (
      typeof score !== 'number' ||
      !Number.isInteger(score) ||
      score < 0 ||
      score > 100
    ) {
      throw new BadRequestException(
        'Scores must be integers between 0 and 100.',
      );
    }
  }
  const home = homeScore as number;
  const away = awayScore as number;
  return {
    home,
    away,
    outcome: home === away ? 'DRAW' : home > away ? 'HOME_WIN' : 'AWAY_WIN',
  };
}
