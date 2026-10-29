/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const file = path.resolve(__dirname, '../app/admin/dashboard/next-tournament-match.ts');
const source = fs.readFileSync(file, 'utf8');
const mod = new Module(file, module);
mod.filename = file;
mod.paths = module.paths;
mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { getNextTournamentMatch } = mod.exports;
test('selects the earliest future match and ignores invalid or past dates', () => {
  const now = Date.parse('2026-10-29T03:00:00Z');
  const matches = [{ scheduledTime: 'invalid' }, { scheduledTime: '2026-10-28T12:00:00Z' }, { scheduledTime: '2026-10-31T12:00:00Z' }, { scheduledTime: '2026-10-30T12:00:00Z' }];
  assert.equal(getNextTournamentMatch(matches, now), matches[3]);
  assert.equal(getNextTournamentMatch(matches.slice(0, 2), now), null);
});
