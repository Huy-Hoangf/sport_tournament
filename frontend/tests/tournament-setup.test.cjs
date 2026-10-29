/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const file = path.resolve(__dirname, '../app/admin/tournaments/tournament-detail/tournament-setup.tsx');
const mod = new Module(file, module);
mod.filename = file;
mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
const { TournamentSetup } = mod.exports;
test('shows setup progress and actionable entry points', () => {
  const html = renderToStaticMarkup(React.createElement(TournamentSetup, { teamCount: 2, matchCount: 3, onManageTeams() {}, onCreateMatch() {}, onImportMatches() {} }));
  assert.match(html, /2 teams/);
  assert.match(html, /3 matches/);
  assert.match(html, /Add teams and players/);
  assert.match(html, /Create match/);
  assert.match(html, /Import matches/);
});
test('does not report zero while team or match data is unavailable', () => {
  const html = renderToStaticMarkup(React.createElement(TournamentSetup, { teamCount: null, matchCount: null, onManageTeams() {}, onCreateMatch() {}, onImportMatches() {} }));
  assert.doesNotMatch(html, /0 teams|0 matches/);
});
