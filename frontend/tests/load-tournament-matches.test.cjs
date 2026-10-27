/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const file = path.resolve(__dirname, '../app/admin/matches/load-tournament-matches.ts');
const mod = new Module(file, module); mod.filename = file; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, file);
test('loads all pages of matches beyond 300', async () => {
  const fetchPage = async page => ({items: Array.from({length: page < 4 ? 100 : 50}, (_,i) => (page - 1)*100+i), total: 350});
  const items = await mod.exports.loadAllMatchPages(fetchPage);
  assert.equal(items.length, 350); assert.equal(items[349], 349);
});
