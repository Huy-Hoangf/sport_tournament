/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (mod, file) => {
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, file);
  };
}
const { formatDateTime } = require('../src/features/tournaments/utils.ts');
const { DashboardTournamentCard } = require('../src/features/dashboard/tournament-overview-card.tsx');
const tournament = { id: 1, name: 'Bundesliga', sportType: 'FOOTBALL', status: 'ONGOING', visibility: 'PUBLIC', teams: 18, matches: 8, source: 'MANUAL' };
function render(extra = {}) {
  return renderToStaticMarkup(React.createElement(DashboardTournamentCard, {
    tournament: { ...tournament, ...extra }, matches: [], isAdmin: false,
    onSelectTournament() {}, onEditTournament() {}, onDeleteTournament() {},
  }));
}
test('highlights a card before midnight for voting on a 01:00 match tomorrow', () => {
  const kickoff = '2026-11-27T01:00:00+07:00';
  const html = render({ matches: 0, votableMatchesToday: 0, openVotingCount: 1, nextOpenVotingKickoff: kickoff });
  assert.match(html, /Open for voting/);
  assert.ok(html.includes(formatDateTime(kickoff)));
  assert.match(html, /Enter Tournament &amp; Vote/);
  assert.match(html, /<article class="[^"]*border-\[#84d8e8\]/);
});
test('deemphasizes a card even when it has matches today if voting is closed', () => {
  const html = render({ openVotingCount: 0 });
  assert.match(html, /No voting open/);
  assert.match(html, /View Tournament/);
  assert.doesNotMatch(html, /Enter Tournament &amp; Vote/);
  assert.doesNotMatch(html, /disabled/);
});
test('keeps cards usable while the deployed backend does not yet supply the new field', () => {
  const html = render();
  assert.match(html, /View Tournament/);
  assert.doesNotMatch(html, /undefined|NaN|disabled/);
});
