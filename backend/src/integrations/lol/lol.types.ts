export type LolCompetitionOption = {
  id: string;
  name: string;
  region: string;
  start: string | null;
  nextMatchAt: string | null;
  current: boolean;
  matches: number;
};
