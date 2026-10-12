// Regression: ISSUE-002 - About page overflowed 56px horizontally on mobile
// Found by /qa on 2026-10-12
// Report: eluno-design/.gstack/qa-reports/run-20261012T174030Z/qa-report-eluno.org-2026-10-12.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const css = sass.compile(fileURLToPath(new URL('../scss/main.scss', import.meta.url)), { style: 'compressed' }).css;

// .main is a grid item: without min-width:0 its min-content (a fixed-width
// portrait next to an unbreakable email) widens the column past the viewport.
test('.main can shrink below its content width', () => {
  assert.match(css, /\.main\{[^}]*min-width:0/);
});

test('links inside .main may break anywhere so emails and URLs wrap', () => {
  assert.match(css, /\.main a\{[^}]*overflow-wrap:anywhere/);
});

// Single-language books (dormidos, doctrinas) rendered a lone "ES" selector
test('empty language selectors collapse', () => {
  assert.match(css, /\.toc-lang-selector:empty,\.nav-lang-selector:empty\{display:none\}/);
});

// Long two-line home titles (Nuestras Doctrinas) inherited body leading 1.75
test('home title uses display leading, not body leading', () => {
  assert.match(css, /\.toc-title\{[^}]*line-height:1\.08/);
});
