#!/usr/bin/env node

/**
 * Markdown Generation Script for Podcast - book-template
 *
 * Generates clean Markdown files without term markers, ideal for podcast scripts.
 * Easy to copy/paste into Descript or any text editor.
 *
 * Usage:
 *   node scripts/build-md-podcast.js [language]
 *   node scripts/build-md-podcast.js         # Generates ES (default)
 *   node scripts/build-md-podcast.js en      # Generates EN
 *
 * Output:
 *   dist/podcast/ep01-cosmologia-y-genesis.md
 *   dist/podcast/ep02-el-creador-y-la-creacion.md
 *   ...
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const I18N_DIR = path.join(PROJECT_ROOT, 'i18n');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PODCAST_DIR = path.join(DIST_DIR, 'podcast');

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
  // Replace {term:id} or {term:id|text} with glossary title or custom text
  let clean = text.replace(/\{term:([^}|]+)(?:\|([^}]+))?\}/g, (match, termId, customText) => {
    if (customText) return customText;
    if (glossary && glossary[termId]) return glossary[termId].title;
    if (FALLBACK_ES[termId]) return FALLBACK_ES[termId];
    // Convert kebab-case to readable text
    return termId.replace(/-/g, ' ');
  });

  // Remove {ref:...} references completely
  clean = clean.replace(/\{ref:[^}]+\}/g, '');

  // Remove markdown bold/italic markers
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
  clean = clean.replace(/\*([^*]+)\*/g, '$1');

  // Fix grammatical issues with glossary terms
  clean = clean.replace(/los Catalizador /g, 'los catalizadores ');
  clean = clean.replace(/los Densidades/g, 'las densidades');

  return clean;
}

function generateMarkdown(chapter, episodeNum, glossary) {
  let md = `# Episodio ${episodeNum}: ${chapter.title}\n\n`;

  chapter.sections.forEach((section, index) => {
    md += `## ${section.title}\n\n`;

    section.content.forEach(block => {
      const text = cleanText(block.text, glossary);
      if (block.type === 'quote') {
        md += `> ${text}\n\n`;
      } else {
        md += `${text}\n\n`;
      }
    });

    if (index < chapter.sections.length - 1) {
      md += `---\n\n`;
    }
  });

  return md;
}

async function buildPodcastMd(lang = 'es') {
  console.log(`\n🎙️  Generando Markdown para Podcast (${lang.toUpperCase()})...\n`);

  ensureDir(PODCAST_DIR);

  // Load glossary for the language
  const glossaryPath = path.join(I18N_DIR, lang, 'glossary.json');
  const glossary = loadJSON(glossaryPath) || {};

  const chaptersDir = path.join(I18N_DIR, lang, 'chapters');
  const chapterFiles = fs.readdirSync(chaptersDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  for (const file of chapterFiles) {
    const chNum = file.replace('.json', '');
    const episodeNum = parseInt(chNum);

    const chapter = loadJSON(path.join(chaptersDir, file));
    if (!chapter) continue;

    const slug = slugify(chapter.title);
    const filename = `ep${chNum}-${slug}.md`;
    const outputPath = path.join(PODCAST_DIR, filename);

    const markdown = generateMarkdown(chapter, episodeNum, glossary);
    fs.writeFileSync(outputPath, markdown);

    console.log(`   ✅ ${filename}`);
  }

  console.log('\n✨ Markdown para podcast generado!\n');
  console.log(`📁 Ubicación: dist/podcast/`);
  console.log(`📊 Total: ${chapterFiles.length} episodios\n`);
}

const lang = process.argv[2] || 'es';
buildPodcastMd(lang);
