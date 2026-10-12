// Regression: ISSUE-003 - About portrait never swapped to its light version
// Found by /qa on 2026-10-12
// Report: eluno-design/.gstack/qa-reports/run-20261012T174030Z/qa-report-eluno.org-2026-10-12.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeElement, createDocument, createStorage, runScript } from './helpers/fake-dom.js';

// Book content (i18n/*/about.json) swaps images with [data-theme=light], so light
// mode must set the attribute instead of leaving it absent.
test('light is the default and is set explicitly as data-theme="light"', () => {
  const document = createDocument({ '.theme-toggle': new FakeElement() });
  runScript('js/theme.js', { document });
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
});

test('a stored dark preference loads as data-theme="dark"', () => {
  const document = createDocument();
  runScript('js/theme.js', { document, localStorage: createStorage({ theme: 'dark' }) });
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
});

test('toggling dark -> light sets data-theme="light" and clears the stored preference', () => {
  const document = createDocument();
  const localStorage = createStorage();
  const sandbox = runScript('js/theme.js', { document, localStorage });
  sandbox.__exports.toggleTheme();
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(localStorage.getItem('theme'), 'dark');
  sandbox.__exports.toggleTheme();
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(localStorage.getItem('theme'), null);
});

test('the toggle paints a drawn SVG icon, not a text glyph, once the DOM is ready', () => {
  const btn = new FakeElement();
  const document = createDocument({ '.theme-toggle': btn });
  runScript('js/theme.js', { document });
  document.fire('DOMContentLoaded');
  assert.match(btn.innerHTML, /^<svg/);
});
