/**
 * Configuration loader for @eluno/core v2
 *
 * Loads eluno.config.js from the consumer's project root,
 * merges with defaults, and resolves environment variables.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

const DEFAULTS = {
  siteUrl: 'https://example.com',
  languages: ['en'],
  baseLang: 'en',
  baseLangPrefix: true,
  bookTitles: { en: 'Book' },
  chapterUrlPattern: 'slug', // 'slug' or 'numeric'
  enabledChapters: null, // null = all, array = specific numbers
  gaId: '',
  githubRepo: '',

  // Law of One URL patterns (eluno-specific, overridable)
  lawOfOneUrls: {
    en: 'https://www.lawofone.info/s/',
    es: 'https://es.lawofone.info/s/',
    pt: 'https://www.lawofone.info/s/'
  },

  features: {
    glossary: false,
    glossaryCategories: false,
    provenance: false,
    search: false,
    mediaToolbar: false,
    termMarkup: false,
    refMarkup: false
  },

  audiobook: {
    voices: {
      en: 'en-US-GuyNeural',
      es: 'es-MX-JorgeNeural',
      pt: 'pt-BR-AntonioNeural'
    },
    rate: '-5%',
    pitch: '+0Hz',
    outputDir: 'audiobook',
    bookNames: null,   // falls back to bookTitles
    tagline: null,     // optional intro text
    outro: null,       // optional outro text per lang
    tags: {
      artist: null,    // falls back to siteDomain
      year: null,      // falls back to current year
      attribution: null
    }
  }
};

/**
 * Load eluno.config.js (or .mjs) from the project root.
 * Checks .mjs first (works without "type": "module" in package.json).
 */
async function loadUserConfig(projectRoot) {
  // Try .mjs first (safe for CJS packages), then .js
  for (const ext of ['.mjs', '.js']) {
    const configPath = join(projectRoot, `eluno.config${ext}`);
    if (existsSync(configPath)) {
      const configUrl = pathToFileURL(configPath).href;
      const mod = await import(configUrl);
      return mod.default || mod;
    }
  }
  console.warn('  No eluno.config.js found, using defaults');
  return {};
}

/**
 * Normalize old nested ui.json format to flat v2 format.
 * Old format: { nav: { index: "..." }, disclaimer: { title: "..." }, footer: { attribution: "..." } }
 * New format: { home: "...", disclaimerTitle: "...", footerAttribution: "..." }
 */
function normalizeUi(raw) {
  // If it has a 'nav' key, it's the old nested format — normalize
  if (!raw.nav && !raw.footer && typeof raw.disclaimer !== 'object') {
    return raw; // Already flat format or no conversion needed
  }

  const flat = {};

  // Map old nested keys to flat v2 keys
  if (raw.nav) {
    if (raw.nav.index) flat.home = raw.nav.index;
    if (raw.nav.backToIndex) flat.home = flat.home || raw.nav.backToIndex;
    if (raw.nav.chapter) flat.chapter = raw.nav.chapter;
    if (raw.nav.about) flat.about = raw.nav.about;
    if (raw.nav.tableOfContents) flat.tableOfContents = raw.nav.tableOfContents;
    if (raw.nav.previousChapter) flat.previous = raw.nav.previousChapter;
    if (raw.nav.nextChapter) flat.next = raw.nav.nextChapter;
    if (raw.nav.notesEmpty) flat.notesEmpty = raw.nav.notesEmpty;
    if (raw.nav.notesPanel) flat.glossary = raw.nav.notesPanel;
    if (raw.nav.notes) flat.glossary = flat.glossary || raw.nav.notes;
  }

  if (raw.media) {
    if (raw.media.downloadPdf) flat.downloadPdf = raw.media.downloadPdf;
    if (raw.media.listenAudio || raw.media.listen) flat.listenAudio = raw.media.listen || raw.media.listenAudio;
  }

  if (raw.footer) {
    if (raw.footer.attribution) flat.footerAttribution = raw.footer.attribution;
    if (raw.footer.originalSessions) flat.footerSessions = raw.footer.originalSessions;
    if (raw.footer.derivedFrom) flat.footerCopyright = raw.footer.derivedFrom;
  }

  if (raw.disclaimer && typeof raw.disclaimer === 'object' && !Array.isArray(raw.disclaimer)) {
    if (raw.disclaimer.title) flat.disclaimerTitle = raw.disclaimer.title;
    // Convert disclaimer text fields to array
    const parts = [];
    if (raw.disclaimer.text1) parts.push(raw.disclaimer.text1);
    if (raw.disclaimer.text2) parts.push(raw.disclaimer.text2);
    if (raw.disclaimer.text3) {
      let text = raw.disclaimer.text3;
      if (raw.disclaimer.text3b) text += raw.disclaimer.text3b;
      if (text.trim()) parts.push(text);
    }
    if (parts.length > 0) flat.disclaimer = parts;
  }

  if (raw.description) flat.subtitle = raw.description;
  if (raw.introduction?.content?.[0]) flat.intro = raw.introduction.content[0];

  // Copy any flat keys that already match (pass-through)
  const nestedKeys = new Set(['nav', 'media', 'footer', 'disclaimer', 'introduction', 'meta', 'siteTitle', 'bookTitle', 'footerVersion']);
  for (const [key, value] of Object.entries(raw)) {
    if (!nestedKeys.has(key) && typeof value === 'string') {
      flat[key] = value;
    }
  }

  return flat;
}

/**
 * Load UI strings: first from consumer's i18n/{lang}/ui.json,
 * then fill gaps from core defaults/ui.json
 */
function loadUiStrings(projectRoot, coreRoot, languages) {
  const defaultUiPath = join(coreRoot, 'defaults', 'ui.json');
  let defaultUi = {};
  if (existsSync(defaultUiPath)) {
    defaultUi = JSON.parse(readFileSync(defaultUiPath, 'utf8'));
  }

  const ui = {};
  for (const lang of languages) {
    // Consumer's ui.json
    const userUiPath = join(projectRoot, 'i18n', lang, 'ui.json');
    let userUi = {};
    if (existsSync(userUiPath)) {
      const rawUi = JSON.parse(readFileSync(userUiPath, 'utf8'));
      userUi = normalizeUi(rawUi);
    }

    // Merge: user overrides > language defaults > english defaults
    ui[lang] = {
      ...(defaultUi.en || {}),
      ...(defaultUi[lang] || {}),
      ...userUi
    };
  }

  return ui;
}

/**
 * Resolve the full configuration object
 */
export async function resolveConfig(projectRoot) {
  // Load .env from project root
  const dotenvPath = join(projectRoot, '.env');
  if (existsSync(dotenvPath)) {
    const dotenv = await import('dotenv');
    dotenv.config({ path: dotenvPath });
  }

  const coreRoot = new URL('..', import.meta.url).pathname;
  const userConfig = await loadUserConfig(projectRoot);

  // Merge features
  const features = { ...DEFAULTS.features, ...(userConfig.features || {}) };

  // Merge audiobook config
  const audiobook = {
    ...DEFAULTS.audiobook,
    ...(userConfig.audiobook || {}),
    voices: { ...DEFAULTS.audiobook.voices, ...(userConfig.audiobook?.voices || {}) },
    tags: { ...DEFAULTS.audiobook.tags, ...(userConfig.audiobook?.tags || {}) }
  };

  // Build final config
  const config = {
    ...DEFAULTS,
    ...userConfig,
    features,
    audiobook,

    // Resolved paths
    projectRoot,
    coreRoot,
    inputDir: join(projectRoot, 'i18n'),
    outputDir: join(projectRoot, 'dist'),
    provenanceDir: join(projectRoot, 'i18n', 'provenance'),

    // Env overrides (if present)
    siteUrl: userConfig.siteUrl || process.env.SITE_URL || DEFAULTS.siteUrl,
    gaId: userConfig.gaId || process.env.GA_ID || '',
    githubRepo: userConfig.githubRepo || process.env.GITHUB_REPO || ''
  };

  // Derived
  try {
    config.siteDomain = new URL(config.siteUrl).hostname;
  } catch {
    config.siteDomain = 'example.com';
  }

  // Cache buster
  config.buildHash = Date.now().toString(36);

  // Audiobook derived defaults
  if (!config.audiobook.bookNames) config.audiobook.bookNames = config.bookTitles;
  if (!config.audiobook.tags.artist) config.audiobook.tags.artist = config.siteDomain;
  if (!config.audiobook.tags.year) config.audiobook.tags.year = String(new Date().getFullYear());
  config.audiobook.audiobookDir = join(projectRoot, config.audiobook.outputDir);

  // Load UI strings
  config.ui = loadUiStrings(projectRoot, coreRoot, config.languages);

  return config;
}
