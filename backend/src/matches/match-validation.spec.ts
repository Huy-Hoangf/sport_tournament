import { validateMatchInput, validateScores } from './match-validation';

describe('Match input rules', () => {
  const now = new Date('2026-10-22T00:00:00Z');
  const valid = {
    tournamentId: 1,
    stageId: 2,
    homeTeamId: 3,
    awayTeamId: 4,
    scheduledTime: '2026-10-23T19:00:00+07:00',
    lockMinutes: 15,
  };

  it('normalizes a future kickoff with an explicit timezone', () => {
    expect(validateMatchInput(valid, now).scheduledTime).toBe(
      '2026-10-23T12:00:00.000Z',
    );
  });
  it.each([
    '8h tối',
    '2026-10-23',
    '2026-10-23T19:00:00',
    '2026-02-30T12:00:00Z',
  ])('rejects invalid date %s', (scheduledTime) => {
    expect(() =>
      validateMatchInput({ ...valid, scheduledTime }, now),
    ).toThrow();
  });
  it('rejects kickoff in the past or exactly now', () => {
    expect(() =>
      validateMatchInput({ ...valid, scheduledTime: now.toISOString() }, now),
    ).toThrow('tương lai');
  });
  it('rejects a team playing itself', () => {
    expect(() =>
      validateMatchInput({ ...valid, awayTeamId: 3 }, now),
    ).toThrow();
  });
  it.each([0, -1, 1.5, NaN])('rejects invalid identifiers %s', (homeTeamId) => {
    expect(() => validateMatchInput({ ...valid, homeTeamId }, now)).toThrow();
  });
  it('allows zero minutes of lock lead time', () => {
    expect(
      validateMatchInput({ ...valid, lockMinutes: 0 }, now).lockMinutes,
    ).toBe(0);
  });
  it.each([-1, 1.5, 101, '2', null])(
    'rejects invalid predicted score %s',
    (homeScore) => {
      expect(() => validateScores({ homeScore, awayScore: 1 })).toThrow();
    },
  );
  it('derives an outcome from predicted scores', () => {
    expect(validateScores({ homeScore: 2, awayScore: 1 }).outcome).toBe(
      'HOME_WIN',
    );
    expect(validateScores({ homeScore: 1, awayScore: 1 }).outcome).toBe('DRAW');
    expect(validateScores({ homeScore: 0, awayScore: 1 }).outcome).toBe(
      'AWAY_WIN',
    );
  });
});
