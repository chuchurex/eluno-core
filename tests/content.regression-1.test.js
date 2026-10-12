// Regression: dormidos showed literal **asterisks** in 30 chapters
// Found by /qa on 2026-10-12 while applying the A1 design to the sibling books
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processText, cleanTextForMeta } from '../lib/build/content.js';

const features = { termMarkup: false, refMarkup: false };

test('markdown bold renders as <strong>', () => {
  assert.equal(
    processText('nacemos: **dormidos creyendo que estamos despiertos**.', {}, features),
    'nacemos: <strong>dormidos creyendo que estamos despiertos</strong>.'
  );
});

test('several bold spans in one paragraph each close on their own', () => {
  assert.equal(processText('**Primero:** uno y **dos**', {}, features), '<strong>Primero:</strong> uno y <strong>dos</strong>');
});

test('a lone asterisk pair without text is left alone', () => {
  assert.equal(processText('a ** b', {}, features), 'a ** b');
});

test('meta descriptions drop the bold markers', () => {
  assert.equal(cleanTextForMeta('El órgano es el **sueño de la consciencia**.', {}), 'El órgano es el sueño de la consciencia.');
});
