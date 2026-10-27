/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const file = path.resolve(__dirname, '../app/admin/lib/navigation.ts');
const source = fs.readFileSync(file, 'utf8');
const mod = new Module(file, module);
mod.filename = file;
mod.paths = module.paths;
mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { parseNavigation, formatNavigation } = mod.exports;
test('history preserves the originating view, tournament, and detail tab', () => {
  const state = { view: 'dashboard', tournamentId: 42, tournamentTab: 'Teams' };
  assert.deepEqual(parseNavigation(formatNavigation(state)), state);
});
test('history preserves matches filters', () => {
  const state = { view: 'matches', matchFilters: { tournamentId: 42, stageId: 8, tournamentName: 'Cup', stageName: 'Final' } };
  assert.deepEqual(parseNavigation(formatNavigation(state)), state);
});
test('legacy and malformed links are safely handled', () => {
  assert.deepEqual(parseNavigation('#tournaments'), { view: 'tournaments' });
  assert.deepEqual(parseNavigation('#unknown'), { view: 'dashboard' });
  assert.deepEqual(parseNavigation('#dashboard?tournament=-1&tab=invalid'), { view: 'dashboard' });
});

test('back and forward restore the preceding navigation entries', () => {
  const stack = ['#dashboard']; let index = 0;
  global.window = {
    location: { hash: stack[0] },
    history: { pushState(_data, _unused, hash) { stack.splice(++index); stack.push(hash); window.location.hash = hash; } },
    dispatchEvent() {},
  };
  const { navigate } = mod.exports;
  navigate({ view: 'tournaments' });
  navigate({ view: 'tournaments', tournamentId: 42 });
  navigate({ view: 'tournaments', tournamentId: 42, tournamentTab: 'Teams' });
  navigate({ view: 'matches', matchFilters: { tournamentId: 42 } });
  assert.deepEqual(parseNavigation(stack[--index]), { view: 'tournaments', tournamentId: 42, tournamentTab: 'Teams' });
  assert.deepEqual(parseNavigation(stack[--index]), { view: 'tournaments', tournamentId: 42 });
  assert.deepEqual(parseNavigation(stack[++index]), { view: 'tournaments', tournamentId: 42, tournamentTab: 'Teams' });
  delete global.window;
});
test('matches filters survive in the current history entry', () => {
  let state = {existing: true};
  global.window = { history: { get state() { return state; }, replaceState(value) { state = value; } }, location: { href: 'https://example.test/admin#matches' } };
  mod.exports.saveMatchesState({query:'final', status:'FINISHED', tournamentId:'5', stageId:'2', page:3});
  assert.deepEqual(mod.exports.readMatchesState(), {query:'final', status:'FINISHED', tournamentId:'5', stageId:'2', page:3});
  delete global.window;
});
test('in-page back uses a known prior entry and falls back for direct links', () => {
  let backCount = 0; let pushed = '';
  global.window = { location: {hash:'#tournaments?tournament=42'}, history: {state:{adminPreviousHash:'#tournaments'}, back(){backCount++;}, pushState(_s,_t,h){pushed=h;}}, dispatchEvent(){} };
  mod.exports.backToAdminView('tournaments');
  assert.equal(backCount, 1);
  window.history.state = null;
  mod.exports.backToAdminView('tournaments');
  assert.equal(pushed, '#tournaments');
  delete global.window;
});
