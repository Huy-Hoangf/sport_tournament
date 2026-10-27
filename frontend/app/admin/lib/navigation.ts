import type { AdminView } from '../types/player';
import type { MatchesInitialFilter } from '../matches/matches-view';

export type TournamentTab = 'Overview' | 'Teams' | 'Predictions' | 'Scoring Rules';
export type Navigation = { view: AdminView; tournamentId?: number; tournamentTab?: TournamentTab; matchFilters?: MatchesInitialFilter };
const views: AdminView[] = ['dashboard', 'tournaments', 'matches', 'players', 'leaderboard'];
const tabs: TournamentTab[] = ['Overview', 'Teams', 'Predictions', 'Scoring Rules'];
function positive(value: string | null): number | undefined {
  const n = Number(value);
  return value && Number.isSafeInteger(n) && n > 0 ? n : undefined;
}
export function parseNavigation(hash: string): Navigation {
  const [name, query = ''] = hash.replace(/^#/, '').split('?');
  const view = views.includes(name as AdminView) ? name as AdminView : 'dashboard';
  const params = new URLSearchParams(query);
  const tournamentId = positive(params.get('tournament'));
  const tab = params.get('tab');
  if ((view === 'dashboard' || view === 'tournaments') && tournamentId) {
    return { view, tournamentId, ...(tabs.includes(tab as TournamentTab) ? { tournamentTab: tab as TournamentTab } : {}) };
  }
  if (view === 'matches') {
    const tid = positive(params.get('tournament'));
    const stageId = positive(params.get('stage'));
    const tournamentName = params.get('tournamentName') || undefined;
    const stageName = params.get('stageName') || undefined;
    if (tid || stageId || tournamentName || stageName) return { view, matchFilters: { ...(tid ? { tournamentId: tid } : {}), ...(stageId ? { stageId } : {}), ...(tournamentName ? { tournamentName } : {}), ...(stageName ? { stageName } : {}) } };
  }
  return { view };
}
export function formatNavigation(state: Navigation): string {
  const p = new URLSearchParams();
  if (state.tournamentId) p.set('tournament', String(state.tournamentId));
  if (state.tournamentTab) p.set('tab', state.tournamentTab);
  if (state.matchFilters?.tournamentId) p.set('tournament', String(state.matchFilters.tournamentId));
  if (state.matchFilters?.stageId) p.set('stage', String(state.matchFilters.stageId));
  if (state.matchFilters?.tournamentName) p.set('tournamentName', state.matchFilters.tournamentName);
  if (state.matchFilters?.stageName) p.set('stageName', state.matchFilters.stageName);
  const query = p.toString();
  return `#${state.view}${query ? `?${query}` : ''}`;
}
export function navigate(state: Navigation) {
  const hash = formatNavigation(state);
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash);
    window.dispatchEvent(new Event('admin-navigation'));
  }
}
