#!/usr/bin/env node

/**
 * Markdown Generation Script for Podcast - Full Chapter Version
 *
 * Generates clean plain-text Markdown files, one per chapter (no splitting).
 * - Numbers converted to Spanish text for TTS
 * - No ** for subtitles, uses extra line breaks instead
 * - Clean text without markup
 *
 * Usage:
 *   node scripts/build-md-podcast-full.js [language]
 *   node scripts/build-md-podcast-full.js         # Generates ES (default)
 *
 * Output:
 *   dist/new-podcast/ep01-cosmologia-y-genesis.md
 *   dist/new-podcast/ep02-el-creador-y-la-creacion.md
 *   ...
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const I18N_DIR = path.join(PROJECT_ROOT, 'i18n');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PODCAST_DIR = path.join(DIST_DIR, 'new-podcast');
const MAX_CHARS = 30000;

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

// Number to Spanish text conversion
const UNITS = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const TENS = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const TEENS = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve'];
const TWENTIES = ['veinte', 'veintiuno', 'veintidos', 'veintitres', 'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function numberToSpanish(num) {
  if (num === 0) return 'cero';
  if (num < 0) return 'menos ' + numberToSpanish(-num);

  if (num === 100) return 'cien';
  if (num === 1000) return 'mil';
  if (num === 1000000) return 'un millon';

  let result = '';

  // Millions
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    if (millions === 1) {
      result += 'un millon ';
    } else {
      result += numberToSpanish(millions) + ' millones ';
    }
    num %= 1000000;
  }

  // Thousands
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    if (thousands === 1) {
      result += 'mil ';
    } else {
      result += numberToSpanish(thousands) + ' mil ';
    }
    num %= 1000;
  }

  // Hundreds
  if (num >= 100) {
    const hundreds = Math.floor(num / 100);
    if (hundreds === 1 && num === 100) {
      result += 'cien';
      return result.trim();
    }
    result += HUNDREDS[hundreds] + ' ';
    num %= 100;
  }

  // Tens and units
  if (num >= 30) {
    const tens = Math.floor(num / 10);
    const units = num % 10;
    result += TENS[tens];
    if (units > 0) {
      result += ' y ' + UNITS[units];
    }
  } else if (num >= 20) {
    result += TWENTIES[num - 20];
  } else if (num >= 10) {
    result += TEENS[num - 10];
  } else if (num > 0) {
    result += UNITS[num];
  }

  return result.trim();
}

function convertNumbersToText(text) {
  // Handle numbers with dots or commas as thousands separators
  // Must process larger numbers first (millions, then thousands)

  // Millions: 1.000.000 or 1,000,000 format
  text = text.replace(/\b(\d{1,3})[.,](\d{3})[.,](\d{3})\b/g, (match, p1, p2, p3) => {
    const num = parseInt(p1 + p2 + p3);
    return numberToSpanish(num);
  });

  // Thousands: 25.000 or 25,000 format (ensure it's exactly 3 digits after separator)
  text = text.replace(/\b(\d{1,3})[.,](\d{3})\b/g, (match, p1, p2) => {
    const num = parseInt(p1 + p2);
    return numberToSpanish(num);
  });

  // Handle ordinals (1a, 2a, 3a, etc.) - use word boundaries to avoid partial matches
  const ordinalsFem = {
    '1a': 'primera', '2a': 'segunda', '3a': 'tercera', '4a': 'cuarta', '5a': 'quinta',
    '6a': 'sexta', '7a': 'septima', '8a': 'octava', '9a': 'novena', '10a': 'decima'
  };
  const ordinalsMasc = {
    '1o': 'primero', '2o': 'segundo', '3o': 'tercero', '4o': 'cuarto', '5o': 'quinto',
    '6o': 'sexto', '7o': 'septimo', '8o': 'octavo', '9o': 'noveno', '10o': 'decimo'
  };

  for (const [num, word] of Object.entries(ordinalsFem)) {
    text = text.replace(new RegExp('\\b' + num + '\\b', 'g'), word);
  }
  for (const [num, word] of Object.entries(ordinalsMasc)) {
    text = text.replace(new RegExp('\\b' + num + '\\b', 'g'), word);
  }

  // Handle remaining standalone numbers (only pure digits, not decimals)
  text = text.replace(/\b(\d+)\b/g, (match) => {
    const num = parseInt(match);
    if (num <= 1000000) {
      return numberToSpanish(num);
    }
    return match;
  });

  return text;
}

// Fallback translations for terms not in glossary
const FALLBACK_ES = {
  'holographic': 'holografica',
  'spiral': 'espiral',
  'photon': 'foton',
  'rays': 'rayos',
  'self-awareness': 'autoconciencia',
  'the-choice': 'la eleccion',
  'illusion': 'ilusion',
  'fractal': 'fractal',
  'indras-net': 'la red de Indra',
  'kybalion': 'el Kybalion',
  'catalyst': 'catalizadores'
};

function cleanText(text, glossary) {
  let clean = text.replace(/\{term:([^}|]+)(?:\|([^}]+))?\}/g, (match, termId, customText) => {
    if (customText) return customText;
    if (glossary && glossary[termId]) return glossary[termId].title;
    if (FALLBACK_ES[termId]) return FALLBACK_ES[termId];
    return termId.replace(/-/g, ' ');
  });

  clean = clean.replace(/\{ref:[^}]+\}/g, '');
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
  clean = clean.replace(/\*([^*]+)\*/g, '$1');
  clean = clean.replace(/los Catalizador /g, 'los catalizadores ');
  clean = clean.replace(/los Densidades/g, 'las densidades');

  // Convert numbers to text
  clean = convertNumbersToText(clean);

  return clean;
}

function generateChapterMd(chapter, glossary, episodeNum) {
  let md = `Episodio ${episodeNum}: ${chapter.title}\n\n`;

  chapter.sections.forEach((section) => {
    // Subtitle with extra line breaks (no ** markers)
    md += `\n${section.title}\n\n`;

    section.content.forEach(block => {
      const text = cleanText(block.text, glossary);
      md += `${text}\n\n`;
    });
  });

  return md;
}

function splitChapterInTwo(chapter, glossary, episodeNum) {
  const sections = [];

  chapter.sections.forEach((section) => {
    let sectionMd = `\n${section.title}\n\n`;
    section.content.forEach(block => {
      const text = cleanText(block.text, glossary);
      sectionMd += `${text}\n\n`;
    });
    sections.push({ title: section.title, content: sectionMd });
  });

  // Find split point (try to split near middle by character count)
  let totalChars = sections.reduce((sum, s) => sum + s.content.length, 0);
  let targetChars = totalChars / 2;
  let currentChars = 0;
  let splitIndex = 0;

  for (let i = 0; i < sections.length; i++) {
    currentChars += sections[i].content.length;
    if (currentChars >= targetChars) {
      splitIndex = i + 1;
      break;
    }
  }

  // Ensure we don't split too early or too late
  if (splitIndex < 2) splitIndex = 2;
  if (splitIndex >= sections.length - 1) splitIndex = Math.floor(sections.length / 2);

  const part1Sections = sections.slice(0, splitIndex);
  const part2Sections = sections.slice(splitIndex);

  const part1 = `Episodio ${episodeNum}: ${chapter.title}\n\n` + part1Sections.map(s => s.content).join('');
  const part2 = `Episodio ${episodeNum}: ${chapter.title} (continuacion)\n\n` + part2Sections.map(s => s.content).join('');

  return [part1, part2];
}

async function buildPodcastMdFull(lang = 'es') {
  console.log(`\n🎙️  Generando Markdown completo para Podcast (${lang.toUpperCase()})...\n`);

  ensureDir(PODCAST_DIR);

  const glossaryPath = path.join(I18N_DIR, lang, 'glossary.json');
  const glossary = loadJSON(glossaryPath) || {};

  const chaptersDir = path.join(I18N_DIR, lang, 'chapters');
  const chapterFiles = fs.readdirSync(chaptersDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  let totalFiles = 0;

  for (const file of chapterFiles) {
    const chNum = file.replace('.json', '');
    const episodeNum = parseInt(chNum);

    const chapter = loadJSON(path.join(chaptersDir, file));
    if (!chapter) continue;

    const slug = slugify(chapter.title);
    const md = generateChapterMd(chapter, glossary, episodeNum);

    // Check if chapter exceeds MAX_CHARS
    if (md.length > MAX_CHARS) {
      // Split into two parts
      const [part1, part2] = splitChapterInTwo(chapter, glossary, episodeNum);

      const filename1 = `ep${chNum}-parte1-${slug}.md`;
      const filename2 = `ep${chNum}-parte2-${slug}.md`;

      fs.writeFileSync(path.join(PODCAST_DIR, filename1), part1);
      fs.writeFileSync(path.join(PODCAST_DIR, filename2), part2);

      console.log(`   ✅ ${filename1} (${part1.length} chars)`);
      console.log(`   ✅ ${filename2} (${part2.length} chars)`);
      totalFiles += 2;
    } else {
      const filename = `ep${chNum}-${slug}.md`;
      const outputPath = path.join(PODCAST_DIR, filename);
      fs.writeFileSync(outputPath, md);

      const charCount = md.length;
      console.log(`   ✅ ${filename} (${charCount} chars)`);
      totalFiles++;
    }
  }

  console.log(`\n✨ Markdown completo para podcast generado!\n`);
  console.log(`📁 Ubicacion: dist/new-podcast/`);
  console.log(`📊 Total: ${totalFiles} archivos\n`);
}

const lang = process.argv[2] || 'es';
buildPodcastMdFull(lang);
