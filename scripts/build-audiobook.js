#!/usr/bin/env node

/**
 * Audiobook Script Generator for fish.audio
 *
 * Generates clean plain text scripts without artificial pause markers.
 * Fish.audio will use natural entonation based on paragraph breaks.
 *
 * Usage:
 *   node scripts/build-audiobook.js [language]
 *   node scripts/build-audiobook.js         # Generates ES (default)
 *   node scripts/build-audiobook.js en      # Generates EN
 *
 * Output:
 *   dist/audiobook/ep01-cosmologia-y-genesis.txt
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const I18N_DIR = path.join(PROJECT_ROOT, 'i18n');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const AUDIOBOOK_DIR = path.join(DIST_DIR, 'audiobook');

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Fallback translations for terms not in glossary
const FALLBACK_ES = {
  'holographic': 'holográfica',
  'spiral': 'espiral',
  'photon': 'fotón',
  'rays': 'rayos',
  'self-awareness': 'autoconciencia',
  'the-choice': 'la elección',
  'illusion': 'ilusión',
  'fractal': 'fractal',
  'indras-net': 'la red de Indra',
  'kybalion': 'el Kybalion',
  'catalyst': 'catalizadores'
};

function cleanText(text, glossary) {
  // Replace term references with their display text
  let clean = text.replace(/\{term:([^}|]+)(?:\|([^}]+))?\}/g, (match, termId, customText) => {
    if (customText) return customText;
    if (glossary && glossary[termId]) return glossary[termId].title;
    if (FALLBACK_ES[termId]) return FALLBACK_ES[termId];
    return termId.replace(/-/g, ' ');
  });

  // Remove reference markers entirely
  clean = clean.replace(/\{ref:[^}]+\}/g, '');

  // Remove markdown bold/italic
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
  clean = clean.replace(/\*([^*]+)\*/g, '$1');

  // Grammar fixes
  clean = clean.replace(/los Catalizador /g, 'los catalizadores ');
  clean = clean.replace(/los Densidades/g, 'las densidades');

  return clean.trim();
}

function generateChapterContent(chapter, glossary, episodeNum) {
  let content = '';

  // Chapter header
  content += `Episodio ${episodeNum}: ${chapter.title}\n\n`;

  // Process each section
  for (let i = 0; i < chapter.sections.length; i++) {
    const section = chapter.sections[i];

    // Skip first section title when it duplicates the chapter title
    if (!(i === 0 && section.title === chapter.title)) {
      content += `${section.title}\n\n`;
    }

    // Process content blocks (paragraphs)
    for (const block of section.content) {
      const text = cleanText(block.text, glossary);
      content += `${text}\n\n`;
    }
  }

  return content.trim();
}

async function buildAudiobook(lang = 'es') {
  console.log(`\n🎧 Generando guiones para Audiolibro (${lang.toUpperCase()})...\n`);

  ensureDir(AUDIOBOOK_DIR);

  const glossaryPath = path.join(I18N_DIR, lang, 'glossary.json');
  const glossary = loadJSON(glossaryPath) || {};

  const chaptersDir = path.join(I18N_DIR, lang, 'chapters');
  const chapterFiles = fs.readdirSync(chaptersDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  let totalFiles = 0;
  let totalChars = 0;

  for (const file of chapterFiles) {
    const chNum = file.replace('.json', '');
    const episodeNum = parseInt(chNum);

    const chapter = loadJSON(path.join(chaptersDir, file));
    if (!chapter) continue;

    const slug = slugify(chapter.title);
    const content = generateChapterContent(chapter, glossary, episodeNum);

    const filename = `ep${chNum}-${slug}.txt`;
    const outputPath = path.join(AUDIOBOOK_DIR, filename);
    fs.writeFileSync(outputPath, content);

    const charCount = content.length;
    totalChars += charCount;
    console.log(`   ✅ ${filename} (${charCount.toLocaleString()} chars)`);
    totalFiles++;
  }

  console.log(`\n✨ Guiones para audiolibro generados!\n`);
  console.log(`📁 Ubicación: dist/audiobook/`);
  console.log(`📊 Total: ${totalFiles} archivos`);
  console.log(`📝 Caracteres totales: ${totalChars.toLocaleString()}\n`);
}

const lang = process.argv[2] || 'es';
buildAudiobook(lang);
