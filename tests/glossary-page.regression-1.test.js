// Regression: ISSUE-001 - Glossary "Categorías" view rendered empty
// Found by /qa on 2026-10-12
// Report: eluno-design/.gstack/qa-reports/run-20261012T174030Z/qa-report-eluno.org-2026-10-12.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeElement, createDocument, runScript } from './helpers/fake-dom.js';

function setup(hash = '') {
  const az = new FakeElement({ className: 'glossary-view glossary-view-az' });
  const cat = new FakeElement({ className: 'glossary-view glossary-view-cat' });
  const btnAz = new FakeElement({ className: 'glossary-view-btn active', attrs: { 'data-view': 'az' } });
  const btnCat = new FakeElement({ className: 'glossary-view-btn', attrs: { 'data-view': 'categories' } });
  const tag = new FakeElement({ className: 'glossary-cat-tag', attrs: { 'data-cat': 'polarity' } });
  const target = new FakeElement({ id: 'cat-polarity' });
  target.scrollIntoView = () => {};
  const document = createDocument({
    '.glossary-view-az': az,
    '.glossary-view-cat': cat,
    '.glossary-view-btn': [btnAz, btnCat],
    '.glossary-cat-tag': tag,
    '#cat-polarity': target
  });
  runScript('js/glossary-page.js', { document, hash });
  return { az, cat, btnAz, btnCat, tag };
}

// The stylesheet hides .glossary-view-cat (display:none), so an empty inline
// value would leave it hidden. Showing it needs an explicit display.
test('Categorías button shows the category view with an explicit display', () => {
  const { az, cat, btnCat } = setup();
  btnCat.dispatch('click');
  assert.equal(cat.style.display, 'block');
  assert.equal(az.style.display, 'none');
  assert.equal(btnCat.getAttribute('aria-selected'), 'true');
});

test('A-Z button hides the category view again', () => {
  const { az, cat, btnCat, btnAz } = setup();
  btnCat.dispatch('click');
  btnAz.dispatch('click');
  assert.equal(cat.style.display, 'none');
  assert.equal(az.style.display, '');
});

test('a category tag and a #cat- deep link both open the category view', () => {
  const viaTag = setup();
  viaTag.tag.dispatch('click');
  assert.equal(viaTag.cat.style.display, 'block');

  const viaHash = setup('#cat-polarity');
  assert.equal(viaHash.cat.style.display, 'block');
});
