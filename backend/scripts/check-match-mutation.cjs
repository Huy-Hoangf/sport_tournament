// Run the same validation suite against an isolated copy, then invert its same-team check.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sport-match-mutation-'));
try {
  const source = fs.readFileSync(path.join(root, 'src/matches/match-validation.ts'), 'utf8');
  const test = fs.readFileSync(path.join(root, 'src/matches/match-validation.spec.ts'), 'utf8');
  const target = path.join(temp, 'match-validation.ts');
  fs.writeFileSync(target, source);
  fs.writeFileSync(path.join(temp, 'match-validation.spec.ts'), test);
  const config = {
    rootDir: temp, testEnvironment: 'node', testRegex: 'match-validation.spec.ts$',
    moduleDirectories: [path.join(root, 'node_modules')],
    transform: { '^.+\\.ts$': [path.join(root,'node_modules/ts-jest'), { tsconfig: path.join(root,'tsconfig.json') }] },
  };
  function run() {
    return spawnSync(process.execPath, [path.join(root, 'node_modules/jest/bin/jest.js'),
      '--config', JSON.stringify(config), '--runInBand', '--no-cache'], { cwd: root, encoding: 'utf8' });
  }
  const baseline = run();
  if (baseline.status !== 0) throw new Error(`Isolated baseline did not pass: ${baseline.stderr}`);
  const mutant = source.replace('homeTeamId === awayTeamId', 'homeTeamId !== awayTeamId');
  if (source === mutant) throw new Error('Mutation target was not found.');
  fs.writeFileSync(target, mutant);
  const result = run();
  if (result.status === 0 || !result.stderr.includes('rejects a team playing itself')) {
    throw new Error(`Mutation was not caught as expected: ${result.stderr}`);
  }
  console.log('PASS: isolated baseline is green; inverted same-team condition is caught by the tests.');
} finally {
  // Only the uniquely created OS temp directory is removed; the workspace is never mutated.
  if (path.dirname(temp) !== os.tmpdir() || !path.basename(temp).startsWith('sport-match-mutation-')) throw new Error('Unexpected temp path.');
  fs.rmSync(temp, { recursive: true, force: true });
}
