/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const file = path.resolve(__dirname, '../app/admin/matches/voting-availability.ts');
// An empty module lets the first run report the missing behavior as an assertion.
const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const mod = new Module(file, module);
mod.filename = file;
mod.paths = module.paths;
mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { getVotingClosedReason } = mod.exports;
const now = Date.parse('2026-11-16T10:00:00Z');
const match = { status: 'PENDING', deadline: '2026-11-16T11:00:00Z', source: 'MANUAL' };

test('allows a public pending football match before its deadline', () => {
  assert.equal(typeof getVotingClosedReason, 'function');
  assert.equal(getVotingClosedReason(match, { visibility: 'PUBLIC', sportType: 'FOOTBALL' }, now), null);
});

test('closes voting at the deadline and rejects invalid deadlines', () => {
  assert.equal(getVotingClosedReason({ ...match, deadline: new Date(now).toISOString() }, { visibility: 'PUBLIC' }, now), 'Voting closed');
  assert.equal(getVotingClosedReason({ ...match, deadline: 'invalid' }, { visibility: 'PUBLIC' }, now), 'Voting closed');
});

test('honors manual locks, match status, visibility and unsupported F1 sessions', () => {
  assert.equal(getVotingClosedReason({ ...match, predictionLocked: true }, { visibility: 'PUBLIC' }, now), 'Voting closed');
  assert.equal(getVotingClosedReason({ ...match, status: 'LIVE' }, { visibility: 'PUBLIC' }, now), 'Voting closed');
  assert.equal(getVotingClosedReason(match, { visibility: 'PRIVATE' }, now), 'Private tournament · voting unavailable');
  assert.equal(getVotingClosedReason(match, { visibility: 'PUBLIC', sportType: 'F1' }, now), '1X2 voting unavailable for F1');
  assert.equal(getVotingClosedReason({ ...match, source: 'OPENF1' }, { visibility: 'PUBLIC' }, now), '1X2 voting unavailable for F1');
  assert.equal(getVotingClosedReason(match, { visibility: 'PUBLIC' }, null), 'Loading voting status…');
});
