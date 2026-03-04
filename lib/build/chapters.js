/**
 * Data loading — chapters, glossary, media, provenance, references
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Load all chapters for a language.
 * Filters to enabledChapters if specified in config.
 */
export function loadChapters(config, lang) {
  const chaptersDir = join(config.inputDir, lang, 'chapters');
  if (!existsSync(chaptersDir)) {
    console.warn(`  ⚠ No chapters directory for ${lang}`);
    return [];
  }

  const enabledSet = config.enabledChapters
    ? new Set(config.enabledChapters)
    : null;

  const files = readdirSync(chaptersDir)
    .filter(f => f.match(/^\d+\.json$/))
    .filter(f => !enabledSet || enabledSet.has(parseInt(f)))
    .sort((a, b) => parseInt(a) - parseInt(b));

  return files.map(file => {
    const content = readFileSync(join(chaptersDir, file), 'utf8');
    return JSON.parse(content);
  });
}

/**
 * Load glossary for a language.
 */
export function loadGlossary(config, lang) {
  const filePath = join(config.inputDir, lang, 'glossary.json');
  if (!existsSync(filePath)) {
    return {};
  }
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/**
 * Load glossary metadata (categories, term→category mapping).
 */
export function loadGlossaryMeta(config) {
  const filePath = join(config.inputDir, 'glossary-meta.json');
  if (!existsSync(filePath)) {
    return { categories: {}, terms: {} };
  }
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/**
 * Load references for a language.
 */
export function loadReferences(config, lang) {
  const filePath = join(config.inputDir, lang, 'references.json');
  if (!existsSync(filePath)) {
    return {};
  }
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/**
 * Load media.json for a language.
 */
export function loadMedia(config, lang) {
  const mediaPath = join(config.inputDir, lang, 'media.json');
  try {
    return JSON.parse(readFileSync(mediaPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Load provenance data for a chapter.
 */
export function loadProvenance(config, chapterNum) {
  if (!config.features.provenance) return null;

  const padded = String(chapterNum).padStart(2, '0');
  const filePath = join(config.provenanceDir, `ch${padded}_provenance.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/**
 * Load about.json for a language.
 */
export function loadAbout(config, lang) {
  const filePath = join(config.inputDir, lang, 'about.json');
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, 'utf8'));
}
