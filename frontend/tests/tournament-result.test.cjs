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
const { ResultMatchRow } = require('../src/features/tournaments/tournament-detail/tournament-detail-view.tsx');
const match = { id: 1, homeName: 'Home', awayName: 'Away', actualHomeScore: 0, actualAwayScore: 0, status: 'FINISHED' };
function render(prediction, predictionState = 'ready') {
  assert.equal(typeof ResultMatchRow, 'function', 'result rows must expose personal prediction feedback');
  return renderToStaticMarkup(React.createElement(ResultMatchRow, { match, prediction, predictionState }));
}
test('recent results show server-awarded points for a correct draw, including zero scores', () => {
  const html = render({ matchId: 1, outcome: 'DRAW', status: 'CORRECT', points: 7 });
  assert.match(html, /Correct/);
  assert.match(html, /\+7 pts/);
  assert.match(html, /Draw/);
  assert.match(html, /0 - 0/);
});
test('recent results distinguish incorrect, ungraded, and missing predictions', () => {
  assert.match(render({ matchId: 1, outcome: 'HOME_WIN', status: 'INCORRECT', points: 0 }), /Incorrect/);
  const pending = render({ matchId: 1, outcome: 'DRAW', status: 'PENDING', points: null });
  assert.match(pending, /Awaiting points/);
  assert.doesNotMatch(pending, /Correct|\+0 pts/);
  assert.match(render(undefined), /No prediction/);
});
test('loading and failed prediction requests do not masquerade as an unvoted match', () => {
  assert.match(render(undefined, 'loading'), /Loading prediction/);
  const failed = render(undefined, 'error');
  assert.match(failed, /Prediction unavailable/);
  assert.doesNotMatch(failed, /No prediction/);
});
